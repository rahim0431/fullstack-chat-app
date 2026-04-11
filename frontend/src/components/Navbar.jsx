import { Link } from "react-router-dom";
import { useAuthStore } from "../store/useAuthStore";
import { useThemeStore } from "../store/useThemeStore";
import { useChatStore } from "../store/useChatStore.jsx";
import useCallStore from "../store/useCallStore";
import { useState, useEffect, useRef } from "react";
import { 
  LogOut, 
  MessageSquare, 
  Settings, 
  User, 
  Sun, 
  Moon, 
  Menu, 
  X,
  ChevronDown,
  Bell,
  Home,
  Bot
} from "lucide-react";

const Navbar = () => {
  const { logout, authUser } = useAuthStore();
  const { theme, setTheme } = useThemeStore();
  const { 
    users, 
    getUnreadCount, 
    setSelectedUser, 
    pendingRequests, 
    acceptRequest, 
    rejectRequest, 
    getPendingRequests, 
    isRequestsLoading 
  } = useChatStore();
  const { missedCalls, actions: callActions } = useCallStore();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);
  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const menuRef = useRef(null);
  const profileMenuRef = useRef(null);

  // Handle scroll effect
  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 10);
    };

    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  // Close mobile menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setIsMenuOpen(false);
      }
      if (profileMenuRef.current && !profileMenuRef.current.contains(event.target)) {
        setIsProfileMenuOpen(false);
      }
      if (!event.target.closest("[data-notifications-wrapper]")) {
        setIsNotificationsOpen(false);
      }
    };

    if (isMenuOpen || isProfileMenuOpen || isNotificationsOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isMenuOpen, isProfileMenuOpen, isNotificationsOpen]);

  // Close menu on escape key
  useEffect(() => {
    const handleEscape = (e) => {
      if (e.key === "Escape") {
        setIsMenuOpen(false);
        setIsProfileMenuOpen(false);
        setIsNotificationsOpen(false);
      }
    };

    if (isMenuOpen || isProfileMenuOpen || isNotificationsOpen) {
      document.addEventListener("keydown", handleEscape);
      document.body.style.overflow = isMenuOpen ? "hidden" : "unset";
    }

    return () => {
      document.removeEventListener("keydown", handleEscape);
      document.body.style.overflow = "unset";
    };
  }, [isMenuOpen, isProfileMenuOpen, isNotificationsOpen]);

  useEffect(() => {
    if (!authUser) {
      setIsNotificationsOpen(false);
      return;
    }
    getPendingRequests();
  }, [authUser, getPendingRequests]);

  const handleThemeToggle = () => {
    setTheme(theme === "dark" ? "light" : "dark");
  };

  const closeMenu = () => {
    setIsMenuOpen(false);
    setIsProfileMenuOpen(false);
    setIsNotificationsOpen(false);
  };

  const handleNotificationsToggle = () => {
    setIsMenuOpen(false);
    setIsProfileMenuOpen(false);
    const nextOpen = !isNotificationsOpen;
    setIsNotificationsOpen(nextOpen);
  };

  const unreadMessages = users.filter(u => getUnreadCount(u._id) > 0).map(u => ({
    type: "message",
    id: `msg_${u._id}`,
    user: u,
    count: getUnreadCount(u._id),
    time: u.lastMessageTime || new Date(),
  }));

  const callNotifications = missedCalls.map(mc => ({
    type: "call",
    id: mc.id,
    user: mc.caller,
    time: mc.time,
  }));

  const followRequests = (pendingRequests || []).map(req => ({
    type: "follow_request",
    id: req._id,
    user: req.senderId,
    time: req.createdAt || new Date(),
  }));

  const allNotifications = [...unreadMessages, ...callNotifications, ...followRequests].sort((a, b) => new Date(b.time) - new Date(a.time));
  const notificationCount = allNotifications.length;

  const notificationsDropdown = (
    <div className="absolute right-0 top-12 z-50 w-80 overflow-hidden rounded-2xl border border-base-300 bg-base-200 shadow-xl">
      <div className="border-b border-base-300 p-3 font-medium flex justify-between items-center">
        <span>Notifications</span>
        {callNotifications.length > 0 && (
          <button 
            onClick={(e) => { e.stopPropagation(); callActions.clearMissedCalls(); }} 
            className="text-xs text-base-content/60 hover:text-primary transition-colors px-2 py-1 rounded hover:bg-base-300"
          >
            Clear
          </button>
        )}
      </div>
      <div className="max-h-80 overflow-y-auto">
        {notificationCount === 0 ? (
          <div className="p-6 text-center text-sm text-base-content/60">No new notifications</div>
        ) : (
          allNotifications.map((notif) => (
            <button
              key={notif.id}
              onClick={() => {
                setSelectedUser(notif.user);
                setIsNotificationsOpen(false);
                if (notif.type === "call") {
                  callActions.removeMissedCall(notif.id);
                }
              }}
              className="w-full text-left border-b border-base-300/50 p-3 transition-colors last:border-0 hover:bg-base-300/30 flex items-start gap-3 group"
            >
              <img
                src={notif.user?.profilePic || "/avatar.png"}
                alt={notif.user?.fullName || "User"}
                className="size-10 rounded-full object-cover ring-1 ring-base-300"
              />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-base-content group-hover:text-primary transition-colors">
                  {notif.user?.fullName || "Unknown user"}
                </p>
                <div className="text-xs mt-0.5">
                  {notif.type === "message" ? (
                    <span className="text-primary font-medium">{notif.count} new message{notif.count > 1 ? "s" : ""}</span>
                  ) : notif.type === "call" ? (
                    <span className="text-red-500 font-medium flex items-center justify-between pr-2">
                       Missed Call
                       <div 
                         onClick={(e) => { e.preventDefault(); e.stopPropagation(); callActions.removeMissedCall(notif.id); }} 
                         className="text-base-content/40 hover:text-red-500 px-1 rounded hover:bg-red-500/10 transition-colors"
                       >
                         ✕
                       </div>
                    </span>
                  ) : (
                    <div className="flex flex-col gap-2 mt-1">
                      <span className="text-primary font-medium text-[11px]">Follow Request</span>
                      <div className="flex gap-2">
                        <button 
                          onClick={(e) => { e.preventDefault(); e.stopPropagation(); acceptRequest(notif.id); }}
                          className="btn btn-primary btn-[10px] h-6 min-h-0 flex-1 shadow-sm"
                        >
                          Accept
                        </button>
                        <button 
                          onClick={(e) => { e.preventDefault(); e.stopPropagation(); rejectRequest(notif.id); }}
                          className="btn btn-ghost btn-[10px] h-6 min-h-0 flex-1 bg-base-300 text-base-content/70 hover:bg-error/20 hover:text-error"
                        >
                          Reject
                        </button>
                      </div>
                    </div>
                  )}
                </div>
                {notif.time && (
                  <p className="text-[10px] text-base-content/40 mt-1">
                    {new Date(notif.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </p>
                )}
              </div>
            </button>
          ))
        )}
      </div>
    </div>
  );

  return (
    <header
      className={`
        fixed w-full top-0 z-50 transition-all duration-300
        ${isScrolled 
          ? 'bg-base-100/95 backdrop-blur-xl border-b border-base-300 shadow-lg' 
          : 'bg-base-100/80 backdrop-blur-md border-b border-base-200/50'
        }
      `}
      ref={menuRef}
    >
      <div className="container mx-auto px-4 lg:px-6">
        <div className="flex items-center justify-between h-16 lg:h-20">
          {/* Logo with animated gradient */}
          <Link 
            to="/" 
            className="flex items-center gap-2.5 group relative"
            onClick={closeMenu}
            aria-label="Chatty Home"
          >
            <div className="relative">
              <div className="absolute -inset-1 bg-gradient-to-r from-primary to-secondary rounded-xl blur opacity-0 group-hover:opacity-75 transition-opacity duration-300"></div>
              <div className="relative size-10 lg:size-11 rounded-xl bg-gradient-to-br from-primary to-secondary flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform duration-300">
                <MessageSquare className="w-5 h-5 lg:w-6 lg:h-6 text-white" />
              </div>
            </div>
            <div className="flex flex-col">
              <h1 className="text-xl lg:text-2xl font-bold bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
                Chatty
              </h1>
              <span className="text-[10px] lg:text-xs text-base-content/40 -mt-1">connect instantly</span>
            </div>
          </Link>

          {/* Desktop Navigation */}
          <nav className="hidden lg:flex items-center gap-1">
            {/* Home Link */}
            <Link
              to="/"
              className="btn btn-ghost btn-sm gap-2 hover:bg-base-200 rounded-full px-4"
            >
              <Home className="w-4 h-4" />
              <span>Home</span>
            </Link>

            <Link
              to="/ai"
              className="btn btn-ghost btn-sm gap-2 hover:bg-base-200 rounded-full px-4"
            >
              <Bot className="w-4 h-4" />
              <span>AI Mode</span>
            </Link>

            {/* Theme Toggle with animation */}
            <button
              onClick={handleThemeToggle}
              className="btn btn-ghost btn-sm gap-2 hover:bg-base-200 rounded-full px-4 relative overflow-hidden group"
              aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
            >
              <div className="absolute inset-0 bg-gradient-to-r from-primary/10 to-secondary/10 opacity-0 group-hover:opacity-100 transition-opacity"></div>
              {theme === "dark" ? (
                <>
                  <Sun className="w-4 h-4 text-yellow-500" />
                  <span>Light</span>
                </>
              ) : (
                <>
                  <Moon className="w-4 h-4 text-indigo-500" />
                  <span>Dark</span>
                </>
              )}
            </button>

            <Link
              to="/settings"
              className="btn btn-ghost btn-sm gap-2 hover:bg-base-200 rounded-full px-4"
            >
              <Settings className="w-4 h-4" />
              <span>Settings</span>
            </Link>

            {authUser ? (
              <>
                <div className="relative" data-notifications-wrapper>
                  <button
                    type="button"
                    onClick={handleNotificationsToggle}
                    className="btn btn-ghost btn-sm btn-circle relative"
                    aria-label="Follow requests"
                    aria-expanded={isNotificationsOpen}
                  >
                    <Bell className="w-4 h-4" />
                    {notificationCount > 0 && (
                      <span className="absolute -top-1 -right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-error px-1 text-[10px] text-error-content animate-pulse">
                        {notificationCount > 9 ? "9+" : notificationCount}
                      </span>
                    )}
                  </button>

                  {isNotificationsOpen && notificationsDropdown}
                </div>

                {/* Profile Dropdown */}
                <div className="relative" ref={profileMenuRef}>
                  <button
                    onClick={() => {
                      setIsNotificationsOpen(false);
                      setIsProfileMenuOpen(!isProfileMenuOpen);
                    }}
                    className="flex items-center gap-2 pl-2 pr-1 py-1 rounded-full hover:bg-base-200 transition-all duration-200 group"
                    aria-label="Profile menu"
                    aria-expanded={isProfileMenuOpen}
                  >
                    <div className="relative">
                      <div className="absolute -inset-0.5 bg-gradient-to-r from-primary to-secondary rounded-full blur opacity-0 group-hover:opacity-75 transition-opacity"></div>
                      <div className="relative w-8 h-8 rounded-full overflow-hidden ring-2 ring-base-300 group-hover:ring-primary transition-all">
                        <img 
                          src={authUser.profilePic || "/avatar.png"} 
                          alt={authUser.fullName}
                          className="w-full h-full object-cover"
                        />
                      </div>
                    </div>
                    <ChevronDown className={`w-4 h-4 transition-transform duration-200 ${isProfileMenuOpen ? 'rotate-180' : ''}`} />
                  </button>

                  {/* Dropdown Menu */}
                  {isProfileMenuOpen && (
                    <div className="absolute right-0 mt-2 w-64 bg-base-100 rounded-2xl shadow-2xl border border-base-300 overflow-hidden animate-slide-down">
                      <div className="p-4 bg-gradient-to-r from-primary/10 to-secondary/10">
                        <p className="font-semibold truncate">{authUser.fullName}</p>
                        <p className="text-xs text-base-content/60 truncate">{authUser.email}</p>
                      </div>
                      <div className="p-2">
                        <Link
                          to="/profile"
                          className="flex items-center gap-3 px-4 py-2.5 rounded-xl hover:bg-base-200 transition-all duration-200 group"
                          onClick={() => setIsProfileMenuOpen(false)}
                        >
                          <div className="p-1.5 rounded-lg bg-primary/10 group-hover:bg-primary/20 transition-colors">
                            <User className="size-4 text-primary" />
                          </div>
                          <span className="flex-1">Profile</span>
                          <span className="text-xs text-base-content/40">View</span>
                        </Link>

                        <button
                          className="w-full flex items-center gap-3 px-4 py-2.5 rounded-xl hover:bg-error/10 text-error transition-all duration-200 group"
                          onClick={() => {
                            logout();
                            setIsProfileMenuOpen(false);
                          }}
                        >
                          <div className="p-1.5 rounded-lg bg-error/10 group-hover:bg-error/20 transition-colors">
                            <LogOut className="size-4" />
                          </div>
                          <span className="flex-1 text-left">Logout</span>
                          <span className="text-xs text-base-content/40">Exit</span>
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </>
            ) : (
              <div className="flex items-center gap-2 ml-2">
                <Link
                  to="/login"
                  className="btn btn-ghost btn-sm rounded-full px-6"
                >
                  Login
                </Link>
                <Link
                  to="/signup"
                  className="btn btn-primary btn-sm rounded-full px-6 shadow-lg shadow-primary/20"
                >
                  Sign Up
                </Link>
              </div>
            )}
          </nav>

          {/* Mobile Navigation */}
          <div className="flex lg:hidden items-center gap-2">
            {/* Theme Toggle Mobile */}
            <button
              onClick={handleThemeToggle}
              className="btn btn-ghost btn-sm btn-circle relative overflow-hidden"
              aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
            >
              <div className="absolute inset-0 bg-gradient-to-r from-primary/20 to-secondary/20 opacity-0 hover:opacity-100 transition-opacity"></div>
              {theme === "dark" ? (
                <Sun className="w-4 h-4 text-yellow-500" />
              ) : (
                <Moon className="w-4 h-4 text-indigo-500" />
              )}
            </button>

            {/* Notifications Mobile */}
            {authUser && (
              <div className="relative" data-notifications-wrapper>
                <button
                  type="button"
                  onClick={handleNotificationsToggle}
                  className="btn btn-ghost btn-sm btn-circle relative"
                  aria-label="Follow requests"
                  aria-expanded={isNotificationsOpen}
                >
                  <Bell className="w-4 h-4" />
                  {notificationCount > 0 && (
                    <span className="absolute -top-1 -right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-error px-1 text-[10px] text-error-content">
                      {notificationCount > 9 ? "9+" : notificationCount}
                    </span>
                  )}
                </button>
                {isNotificationsOpen && notificationsDropdown}
              </div>
            )}

            {/* Mobile Menu Button */}
            <button
              className="btn btn-ghost btn-sm btn-circle relative"
              onClick={() => {
                setIsNotificationsOpen(false);
                setIsMenuOpen(!isMenuOpen);
              }}
              aria-label={isMenuOpen ? "Close menu" : "Open menu"}
              aria-expanded={isMenuOpen}
            >
              <div className="absolute inset-0 bg-gradient-to-r from-primary/20 to-secondary/20 opacity-0 hover:opacity-100 transition-opacity rounded-full"></div>
              {isMenuOpen ? (
                <X className="w-5 h-5" />
              ) : (
                <Menu className="w-5 h-5" />
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Menu Panel */}
      <div
        className={`
          lg:hidden fixed inset-x-0 top-16 bg-base-100/95 backdrop-blur-xl border-b border-base-300 shadow-2xl
          transition-all duration-300 ease-out transform
          ${isMenuOpen ? "translate-y-0 opacity-100" : "-translate-y-full opacity-0 pointer-events-none"}
        `}
        role="navigation"
        aria-label="Mobile navigation"
      >
        <div className="container mx-auto px-4 py-6 max-h-[calc(100vh-4rem)] overflow-y-auto">
          {/* User Profile Section */}
          {authUser && (
            <div className="mb-6 p-4 bg-gradient-to-r from-primary/5 to-secondary/5 rounded-2xl border border-base-200">
              <div className="flex items-center gap-4">
                <div className="relative">
                  <div className="absolute -inset-0.5 bg-gradient-to-r from-primary to-secondary rounded-full blur opacity-50"></div>
                  <div className="relative w-14 h-14 rounded-full overflow-hidden ring-2 ring-base-100">
                    <img 
                      src={authUser.profilePic || "/avatar.png"} 
                      alt={authUser.fullName}
                      className="w-full h-full object-cover"
                    />
                  </div>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-lg truncate">{authUser.fullName}</p>
                  <p className="text-sm text-base-content/60 truncate">{authUser.email}</p>
                </div>
              </div>
            </div>
          )}

          {/* Mobile Navigation Links */}
          <div className="space-y-2">
            <Link
              to="/"
              className="flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-base-200 transition-all duration-200 group"
              onClick={closeMenu}
            >
              <div className="p-2 rounded-lg bg-primary/10 group-hover:bg-primary/20 transition-colors">
                <Home className="w-5 h-5 text-primary" />
              </div>
              <span className="flex-1 font-medium">Home</span>
              <ChevronDown className="w-4 h-4 rotate-[-90deg] text-base-content/40" />
            </Link>

            <Link
              to="/ai"
              className="flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-base-200 transition-all duration-200 group"
              onClick={closeMenu}
            >
              <div className="p-2 rounded-lg bg-primary/10 group-hover:bg-primary/20 transition-colors">
                <Bot className="w-5 h-5 text-primary" />
              </div>
              <span className="flex-1 font-medium">AI Mode</span>
              <ChevronDown className="w-4 h-4 rotate-[-90deg] text-base-content/40" />
            </Link>

            <Link
              to="/settings"
              className="flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-base-200 transition-all duration-200 group"
              onClick={closeMenu}
            >
              <div className="p-2 rounded-lg bg-primary/10 group-hover:bg-primary/20 transition-colors">
                <Settings className="w-5 h-5 text-primary" />
              </div>
              <span className="flex-1 font-medium">Settings</span>
              <ChevronDown className="w-4 h-4 rotate-[-90deg] text-base-content/40" />
            </Link>

            {authUser ? (
              <>
                <Link
                  to="/profile"
                  className="flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-base-200 transition-all duration-200 group"
                  onClick={closeMenu}
                >
                  <div className="p-2 rounded-lg bg-primary/10 group-hover:bg-primary/20 transition-colors">
                    <User className="w-5 h-5 text-primary" />
                  </div>
                  <span className="flex-1 font-medium">Profile</span>
                  <ChevronDown className="w-4 h-4 rotate-[-90deg] text-base-content/40" />
                </Link>

                <button
                  className="w-full flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-error/10 text-error transition-all duration-200 group"
                  onClick={() => {
                    logout();
                    closeMenu();
                  }}
                >
                  <div className="p-2 rounded-lg bg-error/10 group-hover:bg-error/20 transition-colors">
                    <LogOut className="w-5 h-5" />
                  </div>
                  <span className="flex-1 font-medium text-left">Logout</span>
                  <ChevronDown className="w-4 h-4 rotate-[-90deg]" />
                </button>
              </>
            ) : (
              <div className="flex flex-col gap-2 pt-4">
                <Link
                  to="/login"
                  className="btn btn-ghost w-full justify-start gap-3"
                  onClick={closeMenu}
                >
                  <User className="w-5 h-5" />
                  Login
                </Link>
                <Link
                  to="/signup"
                  className="btn btn-primary w-full justify-start gap-3"
                  onClick={closeMenu}
                >
                  <MessageSquare className="w-5 h-5" />
                  Sign Up
                </Link>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Mobile Menu Overlay */}
      {isMenuOpen && (
        <div
          className="lg:hidden fixed inset-0 bg-black/40 backdrop-blur-sm z-40 animate-fade-in"
          onClick={closeMenu}
          aria-hidden="true"
        />
      )}

      {/* Custom CSS for animations */}
      <style>{`
        @keyframes slide-down {
          from {
            opacity: 0;
            transform: translateY(-10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        
        @keyframes fade-in {
          from {
            opacity: 0;
          }
          to {
            opacity: 1;
          }
        }
        
        .animate-slide-down {
          animation: slide-down 0.2s ease-out;
        }
        
        .animate-fade-in {
          animation: fade-in 0.2s ease-out;
        }
      `}</style>
    </header>
  );
};

export default Navbar;
