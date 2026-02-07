import React, { useState, useEffect } from "react";
import { useAuth } from "../context/AuthContext";
import { supabase } from "../utils/supabase";
import { useNavigate } from "react-router-dom";
import ConfirmModal from "../components/ConfirmModal";

const Discover = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [profiles, setProfiles] = useState([]);
  const [filteredProfiles, setFilteredProfiles] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [loading, setLoading] = useState(true);
  const [connectionStatuses, setConnectionStatuses] = useState({});
  const [sendingRequest, setSendingRequest] = useState({});
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [userToCancel, setUserToCancel] = useState(null);
  const [expandedSkills, setExpandedSkills] = useState({});

  useEffect(() => {
    fetchProfilesAndConnections();
  }, [user]);

  useEffect(() => {
    filterProfiles();
  }, [searchTerm, profiles, connectionStatuses]);

  const fetchProfilesAndConnections = async () => {
    try {
      // Fetch all profiles except current user
      const { data: profilesData, error: profilesError } = await supabase
        .from("profiles")
        .select("*")
        .neq("user_id", user.id);

      if (profilesError) throw profilesError;

      // Fetch all connections involving current user
      const { data: connectionsData, error: connectionsError } = await supabase
        .from("connections")
        .select("*")
        .or(`requester_id.eq.${user.id},recipient_id.eq.${user.id}`);

      if (connectionsError) throw connectionsError;

      // Build connection status map with connection IDs
      const statusMap = {};
      connectionsData?.forEach((conn) => {
        const otherUserId =
          conn.requester_id === user.id ? conn.recipient_id : conn.requester_id;

        if (conn.requester_id === user.id) {
          statusMap[otherUserId] = {
            status: conn.status,
            type: "sent",
            connectionId: conn.id,
          };
        } else {
          statusMap[otherUserId] = {
            status: conn.status,
            type: "received",
            connectionId: conn.id,
          };
        }
      });

      setConnectionStatuses(statusMap);
      setProfiles(profilesData || []);
      setLoading(false);
    } catch (err) {
      console.error("Error fetching profiles:", err);
      setLoading(false);
    }
  };

  const filterProfiles = () => {
    if (!searchTerm) {
      // Filter out users who are already connected (status: 'accepted')
      const unconnectedProfiles = profiles.filter((profile) => {
        const connectionInfo = connectionStatuses[profile.user_id];
        // Show only if no connection OR connection is not accepted
        return !connectionInfo || connectionInfo.status !== "accepted";
      });
      setFilteredProfiles(unconnectedProfiles);
      return;
    }

    const term = searchTerm.toLowerCase();
    const filtered = profiles.filter((profile) => {
      // Filter by search term AND exclude accepted connections
      const connectionInfo = connectionStatuses[profile.user_id];
      const notConnected =
        !connectionInfo || connectionInfo.status !== "accepted";

      const nameMatch = profile.full_name?.toLowerCase().includes(term);
      const skillMatch = profile.skills?.some((skill) =>
        skill.toLowerCase().includes(term),
      );
      return notConnected && (nameMatch || skillMatch);
    });

    setFilteredProfiles(filtered);
  };

  const sendConnectionRequest = async (targetUserId) => {
    if (sendingRequest[targetUserId]) return;

    setSendingRequest((prev) => ({ ...prev, [targetUserId]: true }));

    try {
      const { error } = await supabase.from("connections").insert({
        requester_id: user.id,
        recipient_id: targetUserId,
        status: "pending",
      });

      if (error) {
        if (error.code === "23505") {
          console.log("Connection request already exists");
          await fetchProfilesAndConnections();
        } else {
          throw error;
        }
      } else {
        setConnectionStatuses((prev) => ({
          ...prev,
          [targetUserId]: { status: "pending", type: "sent" },
        }));
      }
    } catch (err) {
      console.error("Error sending connection request:", err);
      alert("Failed to send connection request. Please try again.");
    } finally {
      setSendingRequest((prev) => ({ ...prev, [targetUserId]: false }));
    }
  };

  const handleCancelClick = (targetUserId) => {
    setUserToCancel(targetUserId);
    setShowCancelModal(true);
  };

  const cancelConnectionRequest = async () => {
    if (!userToCancel) return;

    setSendingRequest((prev) => ({ ...prev, [userToCancel]: true }));

    try {
      const { error } = await supabase
        .from("connections")
        .delete()
        .eq("requester_id", user.id)
        .eq("recipient_id", userToCancel)
        .eq("status", "pending");

      if (error) throw error;

      setConnectionStatuses((prev) => {
        const updated = { ...prev };
        delete updated[userToCancel];
        return updated;
      });
    } catch (err) {
      console.error("Error cancelling connection request:", err);
      alert("Failed to cancel connection request. Please try again.");
    } finally {
      setSendingRequest((prev) => ({ ...prev, [userToCancel]: false }));
      setUserToCancel(null);
    }
  };

  const toggleSkills = (profileId) => {
    setExpandedSkills((prev) => ({
      ...prev,
      [profileId]: !prev[profileId],
    }));
  };

  const getConnectionButton = (profile) => {
    const userId = profile.user_id;
    const connectionInfo = connectionStatuses[userId];
    const isSending = sendingRequest[userId];

    // No connection exists - show Add Connection button
    if (!connectionInfo) {
      return (
        <button
          onClick={(e) => {
            e.stopPropagation();
            sendConnectionRequest(userId);
          }}
          disabled={isSending}
          className="w-full px-4 py-2 bg-green-600 text-white text-sm rounded-md hover:bg-green-700 transition disabled:bg-green-300 disabled:cursor-not-allowed font-medium"
        >
          {isSending ? (
            <span className="flex items-center justify-center gap-1.5">
              <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
              Sending...
            </span>
          ) : (
            "Connect"
          )}
        </button>
      );
    }

    // Connection exists - show appropriate state
    const { status, type } = connectionInfo;

    if (status === "pending" && type === "sent") {
      return (
        <button
          onClick={(e) => {
            e.stopPropagation();
            handleCancelClick(userId);
          }}
          disabled={isSending}
          className="w-full px-4 py-2 bg-gray-500 text-white text-sm rounded-md hover:bg-gray-600 transition disabled:bg-gray-300 disabled:cursor-not-allowed font-medium"
        >
          {isSending ? "Cancelling..." : "Pending"}
        </button>
      );
    }

    if (status === "pending" && type === "received") {
      return (
        <button
          onClick={(e) => {
            e.stopPropagation();
            navigate("/connections");
          }}
          className="w-full px-4 py-2 bg-yellow-500 text-white text-sm rounded-md hover:bg-yellow-600 transition font-medium"
        >
          Respond
        </button>
      );
    }

    return null;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center">
        <div className="w-12 h-12 border-3 border-gray-300 border-t-green-600 rounded-full animate-spin"></div>
        <p className="mt-4 text-gray-600 text-sm">Loading...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 py-6">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900 mb-1">
            People You May Know
          </h1>
          <p className="text-gray-500 text-sm">
            Connect with developers around the world
          </p>
        </div>

        {/* Search */}
        <div className="mb-6">
          <div className="relative max-w-md">
            <svg
              className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
              />
            </svg>
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search people..."
              className="w-full pl-10 pr-4 py-2.5 bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent text-sm transition-all"
            />
          </div>
          {searchTerm && (
            <div className="mt-2">
              <p className="text-gray-600 text-sm">
                {filteredProfiles.length} result
                {filteredProfiles.length !== 1 ? "s" : ""} for "{searchTerm}"
              </p>
            </div>
          )}
        </div>

        {/* Card Grid */}
        {filteredProfiles.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {filteredProfiles.map((profile) => (
              <div
                key={profile.id}
                onClick={() => navigate(`/profile/${profile.user_id}`)}
                className="bg-white rounded-lg border border-gray-200 overflow-hidden hover:shadow-lg transition-shadow cursor-pointer"
              >
                {/* Profile Image */}
                <div className="relative h-20 bg-gradient-to-r from-green-400 to-emerald-500">
                  <div className="absolute -bottom-10 left-1/2 transform -translate-x-1/2">
                    <div className="w-20 h-20 rounded-full overflow-hidden bg-white border-4 border-white">
                      {profile.profile_image_url ? (
                        <img
                          src={profile.profile_image_url}
                          alt={profile.full_name}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full bg-gradient-to-br from-green-100 to-emerald-100 flex items-center justify-center">
                          <svg
                            className="w-10 h-10 text-gray-400"
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
                </div>

                {/* Content */}
                <div className="pt-12 px-4 pb-4">
                  {/* Name */}
                  <h3 className="text-center font-semibold text-gray-900 text-base mb-1 truncate">
                    {profile.full_name}
                  </h3>

                  {/* Bio */}
                  {profile.bio && (
                    <p className="text-center text-xs text-gray-600 mb-3 line-clamp-2 min-h-[2rem]">
                      {profile.bio}
                    </p>
                  )}

                  {/* Skills */}
                  {profile.skills?.length > 0 && (
                    <div className="mb-3">
                      <div className="flex flex-wrap gap-1 justify-center">
                        {profile.skills.slice(0, 2).map((skill, index) => (
                          <span
                            key={index}
                            className="text-xs bg-gray-100 text-gray-700 px-2 py-0.5 rounded-full"
                          >
                            {skill}
                          </span>
                        ))}
                        {profile.skills.length > 2 && (
                          <span className="text-xs text-gray-500">
                            +{profile.skills.length - 2}
                          </span>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Action Button */}
                  <div onClick={(e) => e.stopPropagation()}>
                    {getConnectionButton(profile)}
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-16 bg-white rounded-xl border border-gray-100">
            <svg
              className="w-16 h-16 mx-auto mb-4 text-gray-300"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
              />
            </svg>
            <h3 className="text-lg font-semibold text-gray-900 mb-1">
              {searchTerm ? "No results found" : "No suggestions available"}
            </h3>
            <p className="text-gray-500 text-sm mb-4">
              {searchTerm
                ? "Try adjusting your search to find what you're looking for."
                : "You're already connected with everyone! Check back later for new members."}
            </p>
            {searchTerm && (
              <button
                onClick={() => setSearchTerm("")}
                className="px-4 py-2 bg-green-600 text-white text-sm rounded-md hover:bg-green-700 transition font-medium"
              >
                Clear Search
              </button>
            )}
          </div>
        )}
      </div>

      {/* Cancel Request Modal */}
      <ConfirmModal
        isOpen={showCancelModal}
        onClose={() => {
          setShowCancelModal(false);
          setUserToCancel(null);
        }}
        onConfirm={cancelConnectionRequest}
        title="Cancel Connection Request?"
        message="Are you sure you want to cancel this connection request? You can send another request later."
        confirmText="Yes, Cancel Request"
        cancelText="Keep Request"
      />
    </div>
  );
};

export default Discover;
