import React from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { FiHome, FiUsers, FiUser, FiLogOut } from "react-icons/fi";

const Navbar = () => {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const handleSignOut = async () => {
    await signOut();
    navigate("/login");
  };

  const isActive = (path) => {
    return location.pathname.startsWith(path);
  };

  if (!user) return null;

  return (
    <nav className="bg-white shadow-sm border-b border-gray-100 sticky top-0 z-50">
      <div className="container mx-auto px-4">
        <div className="grid grid-cols-1 md:grid-cols-2 py-2 pl-3">
          {/* Logo */}
          <Link to="/discover" className="flex items-center gap-2">
            <div className="w-10 h-10 bg-gradient-to-r from-green-500 to-emerald-600 rounded-lg flex items-center justify-center overflow-hidden">
              <img
                src="/img/dev_connect.png"
                alt="DevConnect Logo"
                className="w-full h-full object-contain"
              />
            </div>

            <span className="text-xl font-bold bg-gradient-to-r from-green-600 to-emerald-700 bg-clip-text text-transparent">
              DevConnect
            </span>
          </Link>

          {/* Navigation Links */}
          <div className="flex justify-center mt-3">
            <div className="flex items-end gap-4">
            <Link
              to="/discover"
              className={`px-4 py-2 rounded-xl transition-all duration-300 flex items-center gap-2 font-medium ${
                isActive("/discover")
                  ? "bg-gradient-to-r from-green-500 to-emerald-600 text-white shadow-md"
                  : "text-gray-600 hover:bg-gray-100"
              }`}
            >
              <FiHome className="text-lg" />
              <span className="hidden sm:inline">Discover</span>
            </Link>
            <Link
              to="/connections"
              className={`px-4 py-2 rounded-xl transition-all duration-300 flex items-center gap-2 font-medium ${
                isActive("/connections")
                  ? "bg-gradient-to-r from-green-500 to-emerald-600 text-white shadow-md"
                  : "text-gray-600 hover:bg-gray-100"
              }`}
            >
              <FiUsers className="text-lg" />
              <span className="hidden sm:inline">Connections</span>
            </Link>
            <Link
              to="/profile"
              className={`px-4 py-2 rounded-xl transition-all duration-300 flex items-center gap-2 font-medium ${
                isActive("/profile")
                  ? "bg-gradient-to-r from-green-500 to-emerald-600 text-white shadow-md"
                  : "text-gray-600 hover:bg-gray-100"
              }`}
            >
              <FiUser className="text-lg" />
              <span className="hidden sm:inline">Profile</span>
            </Link>

            {/* User Menu */}
            <button
              onClick={handleSignOut}
              className="px-4 py-2 bg-gradient-to-r from-red-500 to-red-600 text-white rounded-xl hover:from-red-600 hover:to-red-700 transition-all duration-300 font-medium flex items-center gap-2 shadow-sm hover:shadow-md"
            >
              <FiLogOut className="text-lg" />
              <span className="hidden sm:inline">Logout</span>
            </button>
          </div>
          </div>
        </div>
      </div>
    </nav>
  );
};

export default Navbar;
