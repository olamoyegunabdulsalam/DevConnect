import React, {
  useState,
  useEffect,
  useRef,
  useCallback,
  useMemo,
} from "react";
import { useParams } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { supabase } from "../utils/supabase";
import { FiSend, FiUser } from "react-icons/fi";

const Message = React.memo(({ message, isOwn, formatTime }) => {
  return (
    <div className={`flex ${isOwn ? "justify-end" : "justify-start"} mb-4`}>
      <div
        className={`max-w-xs lg:max-w-md px-4 py-3 rounded-2xl ${
          isOwn
            ? "bg-gradient-to-r from-green-500 to-emerald-600 text-white rounded-br-none"
            : "bg-gray-300 text-gray-800 rounded-bl-none shadow-sm"
        }`}
      >
        <p className="break-words leading-relaxed">{message.content}</p>
        <div className={`flex justify-end mt-2`}>
          <span
            className={`text-xs ${isOwn ? "text-green-100" : "text-gray-400"}`}
          >
            {formatTime(message.created_at)}
          </span>
        </div>
      </div>
    </div>
  );
});

Message.displayName = "Message";

const Chat = () => {
  const { connectionId, otherUserId } = useParams();
  const { user } = useAuth();
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState("");
  const [otherUser, setOtherUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);
  const subscriptionRef = useRef(null);

  const formatTime = useCallback((timestamp) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
    });
  }, []);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  useEffect(() => {
    const timer = setTimeout(scrollToBottom, 100);
    return () => clearTimeout(timer);
  }, [messages.length, scrollToBottom]);

  useEffect(() => {
    let mounted = true;

    const fetchOtherUser = async () => {
      try {
        const { data, error } = await supabase
          .from("profiles")
          .select("*")
          .eq("user_id", otherUserId)
          .single();

        if (error) throw error;
        if (mounted) setOtherUser(data);
      } catch (err) {
        console.error("Error fetching user:", err);
      }
    };

    const fetchMessages = async () => {
      try {
        const { data, error } = await supabase
          .from("messages")
          .select("*")
          .eq("connection_id", connectionId)
          .order("created_at", { ascending: true });

        if (error) throw error;

        if (mounted) {
          setMessages(data || []);
          setLoading(false);
        }
      } catch (err) {
        console.error("Error fetching messages:", err);
        if (mounted) setLoading(false);
      }
    };

    fetchOtherUser();
    fetchMessages();

    const channel = supabase
      .channel(`messages-${connectionId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
          filter: `connection_id=eq.${connectionId}`,
        },
        (payload) => {
          if (mounted) {
            setMessages((current) => {
              const exists = current.some((msg) => msg.id === payload.new.id);
              if (exists) return current;
              return [...current, payload.new];
            });
          }
        },
      )
      .subscribe();

    subscriptionRef.current = channel;

    return () => {
      mounted = false;
      if (subscriptionRef.current) {
        supabase.removeChannel(subscriptionRef.current);
      }
    };
  }, [connectionId, otherUserId]);

  const sendMessage = useCallback(
    async (e) => {
      e.preventDefault();

      const messageText = newMessage.trim();
      if (!messageText || sending) return;

      setNewMessage("");
      setSending(true);

      const optimisticMessage = {
        id: `temp-${Date.now()}`,
        connection_id: connectionId,
        sender_id: user.id,
        content: messageText,
        created_at: new Date().toISOString(),
        isOptimistic: true,
      };

      setMessages((prev) => [...prev, optimisticMessage]);

      try {
        const { data, error } = await supabase
          .from("messages")
          .insert({
            connection_id: connectionId,
            sender_id: user.id,
            content: messageText,
          })
          .select()
          .single();

        if (error) throw error;

        setMessages((prev) =>
          prev.map((msg) => (msg.id === optimisticMessage.id ? data : msg)),
        );

        inputRef.current?.focus();
      } catch (err) {
        console.error("Error sending message:", err);
        setMessages((prev) =>
          prev.filter((msg) => msg.id !== optimisticMessage.id),
        );
        setNewMessage(messageText);
        alert("Failed to send message. Please try again.");
      } finally {
        setSending(false);
      }
    },
    [newMessage, sending, connectionId, user.id],
  );

  const handleKeyPress = useCallback(
    (e) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        sendMessage(e);
      }
    },
    [sendMessage],
  );

  const messagesList = useMemo(() => {
    return messages.map((message) => (
      <Message
        key={message.id}
        message={message}
        isOwn={message.sender_id === user.id}
        formatTime={formatTime}
      />
    ));
  }, [messages, user.id, formatTime]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-gray-50 to-gray-100 flex flex-col items-center justify-center">
        <div className="w-16 h-16 border-4 border-green-200 border-t-green-600 rounded-full animate-spin"></div>
        <p className="mt-6 text-gray-600 font-medium">Loading chat...</p>
      </div>
    );
  }

  return (
    <div className="h-screen bg-gray-100 flex justify-center">
      <div className="w-full max-w-4xl bg-white flex flex-col shadow-sm border-2 border-gray-100 px-6 py-4">
        {/* Chat Header */}
        <div className="flex items-center gap-4 sticky top-18 py-4 bg-white z-10">
          <div className="relative">
            <div className="w-12 h-12 rounded-xl overflow-hidden border-2 border-green-400 ">
              {otherUser?.profile_image_url ? (
                <img
                  src={otherUser.profile_image_url}
                  alt={otherUser.full_name}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full bg-gradient-to-br from-green-400 to-emerald-600 flex items-center justify-center">
                  <FiUser className="text-white text-xl" />
                </div>
              )}
            </div>
          </div>
          <div>
            <h3 className="font-bold text-lg text-gray-800">
              {otherUser?.full_name}
            </h3>
          </div>
        </div>

        {/* Messages Container */}
        <div className="flex-1 overflow-y-auto p-6">
          <div className="max-w-4xl mx-auto">
            {messagesList}
            <div ref={messagesEndRef} />
          </div>
        </div>

        {/* Message Input */}
        <div className="bg-white border-t border-gray-100 p-4">
          <div className="">
            <form onSubmit={sendMessage} className="relative">
              <div className="flex items-center gap-2 px-4">
                <div className="flex-1 relative">
                  <input
                    ref={inputRef}
                    type="text"
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    onKeyPress={handleKeyPress}
                    placeholder="Type your message here..."
                    className="w-full px-5 py-3.5 bg-gray-50 border border-gray-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-green-500/30 focus:border-green-500 transition-all duration-300 pr-12"
                    disabled={sending}
                    autoFocus
                  />
                </div>
                <button
                  type="submit"
                  disabled={sending || !newMessage.trim()}
                  className="p-3.5 bg-gradient-to-r from-green-500 to-emerald-600 text-white rounded-xl hover:from-green-600 hover:to-emerald-700 transition-all duration-300 disabled:from-green-300 disabled:to-emerald-400 disabled:cursor-not-allowed shadow-sm hover:shadow-md"
                >
                  <FiSend className="text-xl" />
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Chat;
