import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { supabase } from "../utils/supabase";

const ViewProfile = () => {
  const { userId } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [connectionStatus, setConnectionStatus] = useState(null);
  const [sendingRequest, setSendingRequest] = useState(false);

  useEffect(() => {
    if (userId === user.id) {
      // Redirect to own profile page
      navigate("/profile");
      return;
    }
    fetchProfileAndConnectionStatus();
  }, [userId, user.id]);

  const fetchProfileAndConnectionStatus = async () => {
    try {
      // Fetch profile
      const { data: profileData, error: profileError } = await supabase
        .from("profiles")
        .select("*")
        .eq("user_id", userId)
        .single();

      if (profileError) throw profileError;

      // Fetch connection status
      const { data: connectionData, error: connectionError } = await supabase
        .from("connections")
        .select("*")
        .or(
          `and(requester_id.eq.${user.id},recipient_id.eq.${userId}),and(requester_id.eq.${userId},recipient_id.eq.${user.id})`,
        )
        .maybeSingle();

      if (connectionError && connectionError.code !== "PGRST116") {
        throw connectionError;
      }

      if (connectionData) {
        const isRequester = connectionData.requester_id === user.id;
        setConnectionStatus({
          status: connectionData.status,
          type: isRequester ? "sent" : "received",
          connectionId: connectionData.id,
        });
      }

      setProfile(profileData);
      setLoading(false);
    } catch (err) {
      console.error("Error fetching profile:", err);
      setLoading(false);
    }
  };

  const sendConnectionRequest = async () => {
    setSendingRequest(true);
    try {
      const { error } = await supabase.from("connections").insert({
        requester_id: user.id,
        recipient_id: userId,
        status: "pending",
      });

      if (error) throw error;

      setConnectionStatus({ status: "pending", type: "sent" });
    } catch (err) {
      console.error("Error sending connection request:", err);
      alert("Failed to send connection request. Please try again.");
    } finally {
      setSendingRequest(false);
    }
  };

  const cancelConnectionRequest = async () => {
    const confirmed = window.confirm(
      "Are you sure you want to cancel this connection request?",
    );
    if (!confirmed) return;

    setSendingRequest(true);
    try {
      const { error } = await supabase
        .from("connections")
        .delete()
        .eq("requester_id", user.id)
        .eq("recipient_id", userId)
        .eq("status", "pending");

      if (error) throw error;

      setConnectionStatus(null);
    } catch (err) {
      console.error("Error cancelling connection request:", err);
      alert("Failed to cancel connection request. Please try again.");
    } finally {
      setSendingRequest(false);
    }
  };

  const startChat = () => {
    if (connectionStatus?.connectionId) {
      navigate(`/chat/${connectionStatus.connectionId}/${userId}`);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center">
        <div className="w-12 h-12 border-3 border-gray-300 border-t-green-600 rounded-full animate-spin"></div>
        <p className="mt-4 text-gray-600 text-sm">Loading profile...</p>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center">
        <h2 className="text-xl font-semibold text-gray-900 mb-2">
          Profile not found
        </h2>
        <p className="text-gray-500 mb-4">
          This user profile could not be found.
        </p>
        <button
          onClick={() => navigate("/discover")}
          className="px-4 py-2 bg-green-600 text-white text-sm rounded-md hover:bg-green-700 transition font-medium"
        >
          Back to Discover
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto px-4 py-6">
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          {/* Header with Actions */}
          <div className="p-6 border-b border-gray-100">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <button
                onClick={() => navigate(-1)}
                className="text-gray-600 hover:text-gray-900 text-sm font-medium flex items-center gap-2 self-start"
              >
                <svg
                  className="w-4 h-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M15 19l-7-7 7-7"
                  />
                </svg>
                Back
              </button>

              {/* Action Buttons */}
              <div className="flex gap-2">
                {!connectionStatus && (
                  <button
                    onClick={sendConnectionRequest}
                    disabled={sendingRequest}
                    className="px-4 py-2 bg-green-600 text-white text-sm rounded-md hover:bg-green-700 transition font-medium disabled:bg-green-300"
                  >
                    {sendingRequest ? "Sending..." : "Connect"}
                  </button>
                )}

                {connectionStatus?.status === "pending" &&
                  connectionStatus?.type === "sent" && (
                    <button
                      onClick={cancelConnectionRequest}
                      disabled={sendingRequest}
                      className="px-4 py-2 bg-gray-200 text-gray-700 text-sm rounded-md hover:bg-gray-300 transition font-medium"
                    >
                      Cancel Request
                    </button>
                  )}

                {connectionStatus?.status === "pending" &&
                  connectionStatus?.type === "received" && (
                    <button
                      onClick={() => navigate("/connections")}
                      className="px-4 py-2 bg-yellow-500 text-white text-sm rounded-md hover:bg-yellow-600 transition font-medium"
                    >
                      Respond to Request
                    </button>
                  )}

                {connectionStatus?.status === "accepted" && (
                  <button
                    onClick={startChat}
                    className="px-4 py-2 bg-green-600 text-white text-sm rounded-md hover:bg-green-700 transition font-medium"
                  >
                    Message
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Profile Content */}
          <div className="p-6">
            <div className="space-y-6">
              {/* Profile Header */}
              <div className="flex flex-col sm:flex-row items-start gap-4">
                {/* Profile Image */}
                <div className="relative flex-shrink-0">
                  <div className="w-32 h-32 rounded-full overflow-hidden bg-gray-100 border-4 border-gray-200">
                    {profile.profile_image_url ? (
                      <img
                        src={profile.profile_image_url}
                        alt={profile.full_name}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full bg-gradient-to-br from-green-100 to-emerald-100 flex items-center justify-center">
                        <svg
                          className="w-16 h-16 text-gray-400"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                          />
                        </svg>
                      </div>
                    )}
                  </div>
                </div>

                {/* Profile Info */}
                <div className="flex-1 min-w-0">
                  <h1 className="text-3xl font-bold text-gray-900 mb-2">
                    {profile.full_name}
                  </h1>
                  {connectionStatus?.status === "accepted" && (
                    <p className="text-green-600 text-sm font-medium mb-2">
                      ✓ Connected
                    </p>
                  )}
                </div>
              </div>

              {/* Bio Section */}
              <div>
                <h2 className="text-lg font-semibold text-gray-900 mb-3">
                  About
                </h2>
                <div className="bg-gray-50 rounded-lg border border-gray-100 p-4">
                  <p className="text-gray-600 text-sm leading-relaxed">
                    {profile.bio || "No bio available"}
                  </p>
                </div>
              </div>

              {/* Skills Section */}
              <div>
                <h2 className="text-lg font-semibold text-gray-900 mb-3">
                  Skills
                </h2>
                {profile.skills?.length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {profile.skills.map((skill, index) => (
                      <span
                        key={index}
                        className="px-3 py-1.5 bg-green-50 text-green-700 rounded-full text-sm font-medium"
                      >
                        {skill}
                      </span>
                    ))}
                  </div>
                ) : (
                  <p className="text-gray-500 text-sm">No skills listed</p>
                )}
              </div>

              {/* Connection Info */}
              {connectionStatus?.status === "pending" && (
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                  <p className="text-yellow-800 text-sm">
                    {connectionStatus.type === "sent"
                      ? "Connection request sent. Waiting for response."
                      : "This person sent you a connection request. Go to Connections to respond."}
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ViewProfile;
