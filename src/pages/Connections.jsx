import React, { useState, useEffect } from "react";
import { useAuth } from "../context/AuthContext";
import { supabase } from "../utils/supabase";
import { useNavigate } from "react-router-dom";

const Connections = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [pendingRequests, setPendingRequests] = useState([]);
  const [connections, setConnections] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [activeTab, setActiveTab] = useState("all"); // "all" or "requests"

  useEffect(() => {
    fetchConnectionsData();
  }, [user]);

  const fetchConnectionsData = async () => {
    try {
      // Fetch pending requests where user is recipient
      const { data: pending, error: pendingError } = await supabase
        .from("connections")
        .select("*")
        .eq("recipient_id", user.id)
        .eq("status", "pending");

      if (pendingError) throw pendingError;

      // Fetch requester profiles
      const requesterIds = pending?.map((conn) => conn.requester_id) || [];
      const { data: requesterProfiles, error: profileError } = await supabase
        .from("profiles")
        .select("*")
        .in("user_id", requesterIds);

      if (profileError) throw profileError;

      // Attach profiles to pending requests
      const pendingWithProfiles =
        pending?.map((conn) => ({
          ...conn,
          requester: requesterProfiles.find(
            (p) => p.user_id === conn.requester_id,
          ),
        })) || [];

      // Fetch accepted connections
      const { data: accepted, error: acceptedError } = await supabase
        .from("connections")
        .select("*")
        .or(`requester_id.eq.${user.id},recipient_id.eq.${user.id}`)
        .eq("status", "accepted");

      if (acceptedError) throw acceptedError;

      // Get all user IDs from connections
      const userIds =
        accepted
          ?.flatMap((conn) => [conn.requester_id, conn.recipient_id])
          .filter((id) => id !== user.id) || [];

      // Fetch all profiles
      const { data: allProfiles, error: allProfilesError } = await supabase
        .from("profiles")
        .select("*")
        .in("user_id", userIds);

      if (allProfilesError) throw allProfilesError;

      // Map connections to show the other user's profile
      const mappedConnections =
        accepted?.map((conn) => {
          const otherUserId =
            conn.requester_id === user.id
              ? conn.recipient_id
              : conn.requester_id;
          const profile = allProfiles.find((p) => p.user_id === otherUserId);
          return {
            ...conn,
            profile,
          };
        }) || [];

      setPendingRequests(pendingWithProfiles);
      setConnections(mappedConnections);
      setLoading(false);
    } catch (err) {
      console.error("Error fetching connections:", err);
      setLoading(false);
    }
  };

  const handleAccept = async (connectionId) => {
    try {
      const { error } = await supabase
        .from("connections")
        .update({ status: "accepted" })
        .eq("id", connectionId);

      if (error) throw error;

      await fetchConnectionsData();
    } catch (err) {
      console.error("Error accepting connection:", err);
    }
  };

  const handleReject = async (connectionId) => {
    try {
      const { error } = await supabase
        .from("connections")
        .delete()
        .eq("id", connectionId);

      if (error) throw error;

      await fetchConnectionsData();
    } catch (err) {
      console.error("Error rejecting connection:", err);
    }
  };

  const startChat = (connectionId, otherUserId) => {
    navigate(`/chat/${connectionId}/${otherUserId}`);
  };

  // Filter connections and requests
  const filteredConnections = connections.filter(
    (conn) =>
      conn.profile?.full_name
        ?.toLowerCase()
        .includes(searchTerm.toLowerCase()) ||
      conn.profile?.skills?.some((skill) =>
        skill.toLowerCase().includes(searchTerm.toLowerCase()),
      ),
  );

  const filteredPending = pendingRequests.filter((req) =>
    req.requester?.full_name?.toLowerCase().includes(searchTerm.toLowerCase()),
  );

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center">
        <div className="w-12 h-12 border-3 border-gray-300 border-t-green-600 rounded-full animate-spin"></div>
        <p className="mt-4 text-gray-600 text-sm">Loading...</p>
      </div>
    );
  }

  const showingRequests =
    activeTab === "requests" || pendingRequests.length > 0;

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-2xl mx-auto px-4 py-6">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900 mb-1">Connections</h1>
          <p className="text-gray-500 text-sm">
            {connections.length} connection{connections.length !== 1 ? "s" : ""}
          </p>
        </div>

        {/* Tabs */}
        {pendingRequests.length > 0 && (
          <div className="mb-4 flex gap-2 border-b border-gray-200">
            <button
              onClick={() => setActiveTab("all")}
              className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                activeTab === "all"
                  ? "border-green-600 text-green-600"
                  : "border-transparent text-gray-600 hover:text-gray-900"
              }`}
            >
              All connections
            </button>
            <button
              onClick={() => setActiveTab("requests")}
              className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                activeTab === "requests"
                  ? "border-green-600 text-green-600"
                  : "border-transparent text-gray-600 hover:text-gray-900"
              }`}
            >
              Connection Requests
              {pendingRequests.length > 0 && (
                <span className="ml-2 px-2 py-0.5 bg-red-500 text-white text-xs rounded-full">
                  {pendingRequests.length}
                </span>
              )}
            </button>
          </div>
        )}

        {/* Search */}
        <div className="mb-4">
          <div className="relative">
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
              placeholder="Search connections..."
              className="w-full pl-10 pr-4 py-2.5 bg-gray-100 border-0 rounded-full focus:outline-none focus:bg-white focus:ring-1 focus:ring-gray-300 text-sm transition-all"
            />
          </div>
        </div>

        {/* Connections Requests Section */}
        {(activeTab === "requests" ||
          (activeTab === "all" && pendingRequests.length > 0)) && (
          <div className="mb-6">
            {activeTab === "all" && (
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-lg font-semibold text-gray-900">
                  Connections Requests
                  <span className="ml-2 text-sm text-gray-500">
                    {pendingRequests.length}
                  </span>
                </h2>
                <button
                  onClick={() => setActiveTab("requests")}
                  className="text-green-600 hover:text-green-700 text-sm font-medium"
                >
                  See all
                </button>
              </div>
            )}

            <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
              {filteredPending.length > 0 ? (
                filteredPending.map((request, index) => (
                  <div
                    key={request.id}
                    className={`flex items-start gap-4 p-4 hover:bg-gray-50 transition-colors ${
                      index !== filteredPending.length - 1
                        ? "border-b border-gray-100"
                        : ""
                    }`}
                  >
                    {/* Avatar */}
                    <div className="relative flex-shrink-0">
                      <div className="w-12 h-12 rounded-full overflow-hidden bg-gray-100">
                        {request.requester?.profile_image_url ? (
                          <img
                            src={request.requester.profile_image_url}
                            alt={request.requester.full_name}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="w-full h-full bg-gradient-to-br from-green-100 to-emerald-100 flex items-center justify-center">
                            <svg
                              className="w-6 h-6 text-gray-400"
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

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          <h3 className="font-semibold text-gray-900 truncate">
                            {request.requester?.full_name}
                          </h3>
                          {request.requester?.skills?.length > 0 && (
                            <div className="mt-1 flex flex-wrap gap-1">
                              {request.requester.skills
                                .slice(0, 2)
                                .map((skill, skillIndex) => (
                                  <span
                                    key={skillIndex}
                                    className="text-xs bg-gray-100 text-gray-700 px-2 py-0.5 rounded-full"
                                  >
                                    {skill}
                                  </span>
                                ))}
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Action Buttons */}
                      <div className="mt-3 flex gap-2">
                        <button
                          onClick={() => handleAccept(request.id)}
                          className="flex-1 px-4 py-1.5 bg-green-600 text-white text-sm rounded-md hover:bg-green-700 transition font-medium"
                        >
                          Confirm
                        </button>
                        <button
                          onClick={() => handleReject(request.id)}
                          className="flex-1 px-4 py-1.5 bg-gray-200 text-gray-900 text-sm rounded-md hover:bg-gray-300 transition font-medium"
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="p-8 text-center">
                  <p className="text-gray-500 text-sm">No pending requests</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* All connections Section */}
        {activeTab === "all" && (
          <div>
            {connections.length > 0 && (
              <div className="mb-3">
                <h2 className="text-lg font-semibold text-gray-900">
                  All connections
                  <span className="ml-2 text-sm text-gray-500">
                    {connections.length}
                  </span>
                </h2>
              </div>
            )}

            {filteredConnections.length > 0 ? (
              <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
                {filteredConnections.map((connection, index) => (
                  <div
                    key={connection.id}
                    className={`flex items-start gap-4 p-4 hover:bg-gray-50 transition-colors cursor-pointer ${
                      index !== filteredConnections.length - 1
                        ? "border-b border-gray-100"
                        : ""
                    }`}
                    onClick={() =>
                      startChat(connection.id, connection.profile.user_id)
                    }
                  >
                    {/* Avatar */}
                    <div className="relative flex-shrink-0">
                      <div className="w-12 h-12 rounded-full overflow-hidden bg-gray-100">
                        {connection.profile?.profile_image_url ? (
                          <img
                            src={connection.profile.profile_image_url}
                            alt={connection.profile.full_name}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="w-full h-full bg-gradient-to-br from-green-100 to-emerald-100 flex items-center justify-center">
                            <svg
                              className="w-6 h-6 text-gray-400"
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

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          <h3 className="font-semibold text-gray-900 truncate">
                            {connection.profile?.full_name}
                          </h3>
                        </div>

                        {/* Message Button */}
                        <div className="flex-shrink-0 flex gap-2">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              navigate(
                                `/profile/${connection.profile.user_id}`,
                              );
                            }}
                            className="px-3 py-1.5 bg-gray-200 text-gray-700 text-sm rounded-md hover:bg-gray-300 transition font-medium"
                          >
                            View Profile
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              startChat(
                                connection.id,
                                connection.profile.user_id,
                              );
                            }}
                            className="px-3 py-1.5 bg-green-600 text-white text-sm rounded-md hover:bg-green-700 transition font-medium"
                          >
                            Message
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="bg-white rounded-xl border border-gray-100 p-12 text-center">
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
                  {searchTerm ? "No results found" : "No connections yet"}
                </h3>
                <p className="text-gray-500 text-sm mb-6">
                  {searchTerm
                    ? "Try adjusting your search"
                    : "Start connecting with developers"}
                </p>
                {!searchTerm && (
                  <button
                    onClick={() => navigate("/discover")}
                    className="px-6 py-2 bg-green-600 text-white text-sm rounded-md hover:bg-green-700 transition font-medium"
                  >
                    Connect With People
                  </button>
                )}
                {searchTerm && (
                  <button
                    onClick={() => setSearchTerm("")}
                    className="px-6 py-2 bg-green-600 text-white text-sm rounded-md hover:bg-green-700 transition font-medium"
                  >
                    Clear Search
                  </button>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default Connections;
