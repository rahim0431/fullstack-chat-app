import { useEffect, useMemo, useState, useCallback, useRef } from "react";
import { 
  Search, 
  Users, 
  MoreVertical,
  UserPlus,
  Settings,
  LogOut,
  MessageCircle,
  Bell,
  BellOff,
  Pin,
  Trash2,
  CheckCheck,
  Check,
  Camera,
  Filter,
  X,
  UserX
} from "lucide-react";
import { useChatStore } from "../store/useChatStore.jsx";
import { useAuthStore } from "../store/useAuthStore";
import SidebarSkeleton from "./skeletons/SidebarSkeleton";
import SearchUsersModal from "./SearchUsersModal";
import CreateGroupModal from "./CreateGroupModal";
import { motion, AnimatePresence } from "framer-motion";

const Sidebar = ({ onCloseSidebar }) => {
  const { 
    getUsers, 
    users, 
    selectedUser, 
    setSelectedUser, 
    isUsersLoading,
    getUnreadCount,
    pinnedUsers,
    togglePinUser,
    mutedUsers,
    toggleMuteUser,
    blockedUsers,
    getBlockedUsers,
    blockUser,
    unblockUser,
    removeConnection,
    typingUsers,
    getGroups,
    groups,
    selectedGroup,
    setSelectedGroup,
    isGroupsLoading,
    groupTypingUsers, // Added this
  } = useChatStore();
  
  const { onlineUsers = [], authUser, logout } = useAuthStore();
  
  const [searchTerm, setSearchTerm] = useState("");
  const [showMenu, setShowMenu] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [isSearchModalOpen, setIsSearchModalOpen] = useState(false);
  const [isCreateGroupModalOpen, setIsCreateGroupModalOpen] = useState(false);
  const [removeTarget, setRemoveTarget] = useState(null);
  const [filterType, setFilterType] = useState("all"); // all, online, unread, pinned
  const [sortBy, setSortBy] = useState("recent"); // recent, name, unread
  const [activeQuickActionsUserId, setActiveQuickActionsUserId] = useState(null);
  const [activeTab, setActiveTab] = useState("contacts"); // "contacts" | "groups"
  const menuRef = useRef(null);
  const searchInputRef = useRef(null);
  const longPressTimerRef = useRef(null);
  const longPressTriggeredRef = useRef(false);


  const getSortableTimestamp = (value) => {
    if (!value) return 0;
    if (typeof value === "number") return value;
    const parsed = new Date(value).getTime();
    return Number.isNaN(parsed) ? 0 : parsed;
  };

  // Load users on mount
  useEffect(() => {
    getUsers();
    getGroups();
    getBlockedUsers();
  }, [getUsers, getGroups, getBlockedUsers]);

  // Handle click outside menu
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setShowMenu(false);
      }
      if (!event.target.closest("[data-contact-actions]")) {
        setActiveQuickActionsUserId(null);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    return () => {
      if (longPressTimerRef.current) {
        clearTimeout(longPressTimerRef.current);
      }
    };
  }, []);

  // Keyboard shortcut for search (Ctrl/Cmd + K)
  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "k") {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  // Filter and sort users
  const filteredAndSortedUsers = useMemo(() => {
    let filtered = [...users];

    // Apply search filter
    const normalizedSearch = searchTerm.trim().toLowerCase();
    if (normalizedSearch) {
      filtered = filtered.filter(
        (user) =>
          user.fullName?.toLowerCase().includes(normalizedSearch) ||
          user.email?.toLowerCase().includes(normalizedSearch) ||
          user.username?.toLowerCase().includes(normalizedSearch)
      );
    }

    // Apply type filters
    switch (filterType) {
      case "online":
        filtered = filtered.filter(user => onlineUsers.includes(user._id));
        break;
      case "unread":
        filtered = filtered.filter(user => getUnreadCount(user._id) > 0);
        break;
      case "pinned":
        filtered = filtered.filter(user => pinnedUsers.includes(user._id));
        break;
      default:
        break;
    }

    // Apply sorting
    filtered.sort((a, b) => {
      // Pinned users always on top
      const aPinned = pinnedUsers.includes(a._id);
      const bPinned = pinnedUsers.includes(b._id);
      if (aPinned && !bPinned) return -1;
      if (!aPinned && bPinned) return 1;

      // Then apply selected sort
      switch (sortBy) {
        case "name":
          return a.fullName.localeCompare(b.fullName);
        case "unread":
          return getUnreadCount(b._id) - getUnreadCount(a._id);
        default: // recent
          return getSortableTimestamp(b.lastMessageTime) - getSortableTimestamp(a.lastMessageTime);
      }
    });

    return filtered;
  }, [users, searchTerm, filterType, sortBy, onlineUsers, pinnedUsers, getUnreadCount]);

  const filteredGroups = useMemo(() => {
    let filtered = [...groups];
    if (searchTerm.trim()) {
      filtered = filtered.filter(g => g.name.toLowerCase().includes(searchTerm.toLowerCase()));
    }
    return filtered;
  }, [groups, searchTerm]);

  // Get user status with last seen
  const getUserStatus = useCallback((user) => {
    if (onlineUsers.includes(user._id)) {
      return { text: "Online", color: "text-success", dot: "bg-success", ring: "ring-success" };
    }
    if (user?.privacySettings?.lastSeen === "Nobody") {
      return { text: "Hidden", color: "text-base-content/50", dot: "bg-base-content/30", ring: "ring-base-content/20" };
    }
    const lastSeenValue = user.lastSeenAt || user.lastSeen;
    if (lastSeenValue) {
      const lastSeen = new Date(lastSeenValue);
      const now = new Date();
      const diffMinutes = Math.floor((now - lastSeen) / 60000);
      
      // Away for inactivity under 15 minutes
      if (diffMinutes < 15) return { text: "Away", color: "text-warning", dot: "bg-warning", ring: "ring-warning" };
      if (diffMinutes < 60) return { text: `${diffMinutes}m ago`, color: "text-base-content/50", dot: "bg-base-content/30", ring: "ring-base-content/20" };
      if (diffMinutes < 1440) return { text: `${Math.floor(diffMinutes / 60)}h ago`, color: "text-base-content/50", dot: "bg-base-content/30", ring: "ring-base-content/20" };
      return { text: lastSeen.toLocaleDateString(), color: "text-base-content/50", dot: "bg-base-content/30", ring: "ring-base-content/20" };
    }
    return { text: "Offline", color: "text-base-content/50", dot: "bg-base-content/30", ring: "ring-base-content/20" };
  }, [onlineUsers]);

  // Clear search
  const clearSearch = () => {
    setSearchTerm("");
    searchInputRef.current?.focus();
  };

  const openRemoveConfirm = (user) => {
    setRemoveTarget(user);
  };

  const closeRemoveConfirm = () => {
    setRemoveTarget(null);
  };

  const confirmRemove = async () => {
    if (!removeTarget) return;
    try {
      await removeConnection(removeTarget._id);
    } finally {
      setRemoveTarget(null);
    }
  };

  // Render last message preview based on type
  const renderLastMessagePreview = useCallback((user) => {
    const msg = user.lastMessage;
    if (!msg) return "No messages yet";

    const isImage =
      user.lastMessageType === "image" ||
      (typeof msg === "string" && msg.match(/\.(jpeg|jpg|gif|png|webp)(\?.*)?$/i)) ||
      (typeof msg === "string" && msg.startsWith("data:image/"));

    if (isImage) {
      return (
        <span className="inline-flex items-center gap-1">
          <Camera className="size-3" /> Photo
        </span>
      );
    }

    return msg;
  }, []);

  const startLongPress = (userId) => {
    longPressTriggeredRef.current = false;
    if (longPressTimerRef.current) clearTimeout(longPressTimerRef.current);

    longPressTimerRef.current = setTimeout(() => {
      longPressTriggeredRef.current = true;
      setActiveQuickActionsUserId((prev) => (prev === userId ? null : userId));
    }, 450);
  };

  const cancelLongPress = () => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  };

  if (isUsersLoading) return <SidebarSkeleton />;

  return (
    <aside className="h-full w-full border-r border-base-300 bg-base-100 flex flex-col relative">
      {/* Header with menu */}
      <div className="border-b border-base-300 px-3 py-6 md:px-4 bg-gradient-to-r from-base-100 to-base-200/50 mt-[-10px]">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2 md:gap-3">
            <div className="relative">
              <div className="size-10 rounded-full bg-gradient-to-r from-primary to-secondary flex items-center justify-center">
                <MessageCircle className="size-5 text-white" />
              </div>
              {/* <span className="absolute -top-1 -right-1 size-4 bg-green-500 rounded-full border-2 border-base-100" /> */}
            </div>
            <div className="block">
              <h2 className="font-bold text-lg leading-tight">Messages</h2>
              <p className="text-xs text-base-content/60 flex items-center gap-1">
                <Users className="size-3" />
                {activeTab === "contacts" ? `${filteredAndSortedUsers.length} contacts` : `${filteredGroups.length} groups`}
                {activeTab === "contacts" && filterType !== "all" && (
                  <span className="badge badge-sm badge-primary ml-1">
                    {filterType}
                  </span>
                )}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1" ref={menuRef}>
            {/* New Contact button */}
            <motion.button
              whileHover={{ scale: 1.15, rotate: 10 }}
              whileTap={{ scale: 0.9 }}
              onClick={() => setIsSearchModalOpen(true)}
              className="p-2 hover:bg-base-200 rounded-xl transition-colors"
              title="Find Contacts"
            >
              <UserPlus className="size-5 text-base-content/70" />
            </motion.button>
            
            {/* New Group button */}
            <motion.button
              whileHover={{ scale: 1.15, rotate: -10 }}
              whileTap={{ scale: 0.9 }}
              onClick={() => setIsCreateGroupModalOpen(true)}
              className="p-2 hover:bg-base-200 rounded-xl transition-colors"
              title="Create Group"
            >
              <Users className="size-5 text-base-content/70" />
            </motion.button>
          </div>
        </div>

        {/* Tab Selection */}
        <div className="flex gap-1 p-1 bg-base-200/50 rounded-2xl mb-4">
          <button
            onClick={() => setActiveTab("contacts")}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold transition-all ${
              activeTab === "contacts" ? "bg-base-100 shadow-sm text-primary" : "text-base-content/50 hover:bg-base-300/30"
            }`}
          >
            <MessageCircle className="size-4" />
            Contacts
          </button>
          <button
            onClick={() => setActiveTab("groups")}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold transition-all ${
              activeTab === "groups" ? "bg-base-100 shadow-sm text-primary" : "text-base-content/50 hover:bg-base-300/30"
            }`}
          >
            <Users className="size-4" />
            Groups
          </button>
        </div>

        {/* Search bar */}
        <div className="relative">
          <label className="flex items-center gap-2 rounded-xl border border-base-300 bg-base-200/80 backdrop-blur-sm px-3 py-2.5 focus-within:ring-2 focus-within:ring-primary/30 transition-all">
            <Search className="size-4 text-base-content/55" />
              <input
                ref={searchInputRef}
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                placeholder={activeTab === "contacts" ? "Search Contacts..." : "Search Groups..."}
                className="bg-transparent border-none outline-none text-sm w-full placeholder:text-base-content/40"
              />
            {searchTerm && (
              <button onClick={clearSearch} className="hover:bg-base-300 p-1 rounded-lg">
                <X className="size-3.5 text-base-content/55" />
              </button>
            )}
          </label>
          
          {/* Search results count */}
          {searchTerm && (
            <div className="absolute -bottom-5 left-3 text-xs text-base-content/40">
              {activeTab === "contacts" ? filteredAndSortedUsers.length : filteredGroups.length} results found
            </div>
          )}
        </div>

        {/* Filter chips */}
        <AnimatePresence>
          {showFilters && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="mt-3 overflow-hidden"
            >
              <div className="flex flex-wrap gap-2">
                {["all", "online", "unread", "pinned"].map((filter) => (
                  <button
                    key={filter}
                    onClick={() => setFilterType(filter)}
                    className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                      filterType === filter
                        ? "bg-primary text-white"
                        : "bg-base-200 text-base-content/70 hover:bg-base-300"
                    }`}
                  >
                    {filter.charAt(0).toUpperCase() + filter.slice(1)}
                  </button>
                ))}
              </div>

             <div className="mt-2 flex items-center gap-2 p-2 bg-base-200/50 rounded-lg border border-base-300">
                <span className="text-xs font-medium text-base-content/70">Sort by:</span>
                <div className="relative flex-1">
                  <select
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value)}
                    className="w-full text-xs bg-base-100 border border-base-300 rounded-lg px-3 py-1.5 pr-8 outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary appearance-none cursor-pointer text-base-content"
                  >
                    <option value="recent" className="bg-base-100 text-base-content">Recent</option>
                    <option value="name" className="bg-base-100 text-base-content">Name</option>
                    <option value="unread" className="bg-base-100 text-base-content">Unread</option>
                  </select>
                  
                  {/* Custom arrow that works in both modes */}
                  <div className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none">
                    <svg 
                      className="w-3.5 h-3.5 text-base-content/60" 
                      fill="none" 
                      stroke="currentColor" 
                      viewBox="0 0 24 24"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Lists */}
      <div className="flex-1 overflow-y-auto p-2 md:p-3 scrollbar-thin scrollbar-thumb-base-300">
        <AnimatePresence mode="wait">
          {activeTab === "contacts" ? (
            <motion.div
              key="contacts-tab"
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -10 }}
              className="space-y-1.5"
            >
              {filteredAndSortedUsers.map((user, index) => {
                const isSelected = selectedUser?._id === user._id;
                const isPinned = pinnedUsers.includes(user._id);
                const isMuted = mutedUsers.includes(user._id);
                const isBlocked = blockedUsers.some((blocked) => blocked._id === user._id);
                const unreadCount = getUnreadCount(user._id);
                const status = getUserStatus(user);
                const unreadBadge = unreadCount > 0 ? (unreadCount > 99 ? "99+" : unreadCount) : null;
                const showNewMessagesLabel = unreadCount > 1;

                return (
                  <motion.div
                    key={user._id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.03 }}
                    className="relative group"
                    data-contact-actions
                  >
                    <button
                      onClick={() => {
                        if (longPressTriggeredRef.current) {
                          longPressTriggeredRef.current = false;
                          return;
                        }
                        setSelectedUser(user);
                        setActiveQuickActionsUserId(null);
                        if (onCloseSidebar) onCloseSidebar();
                      }}
                       onDoubleClick={(e) => {
                        e.preventDefault();
                        setActiveQuickActionsUserId((prev) => (prev === user._id ? null : user._id));
                      }}
                      onContextMenu={(e) => {
                        e.preventDefault();
                        setActiveQuickActionsUserId((prev) => (prev === user._id ? null : user._id));
                      }}
                      onMouseDown={() => startLongPress(user._id)}
                      onMouseUp={cancelLongPress}
                      onMouseLeave={cancelLongPress}
                      className={`w-full rounded-2xl px-2 py-2.5 md:px-3 md:py-3 transition-all flex items-center gap-3 text-left ${
                        isSelected ? "bg-primary/15 ring-1 ring-primary/20" : "hover:bg-base-200/60 active:scale-[0.98]"
                      }`}
                    >
                      <div className="relative shrink-0">
                        <div className={`size-12 rounded-2xl ring-2 transition-all ${isSelected ? 'ring-primary' : status.ring}`}>
                          <img
                            src={user.profilePic || "/avatar.png"}
                            alt={user.fullName}
                            className="size-full rounded-2xl object-cover"
                          />
                        </div>
                        <span className={`absolute bottom-0 right-0 size-3.5 rounded-full ring-2 ring-base-100 ${status.dot}`} />
                      </div>

                      <div className="flex flex-1 flex-col min-w-0">
                        <div className="flex justify-between items-center w-full">
                          <p className={`font-semibold truncate text-[15px] ${isSelected ? 'text-primary' : ''}`}>{user.fullName}</p>
                          {user.lastMessageTime && !unreadBadge && (
                            <span className="text-[10px] text-base-content/40">
                              {new Date(user.lastMessageTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          )}
                        </div>
                        
                        <div className="flex justify-between items-center gap-2 mt-0.5">
                          <p className={`text-xs truncate ${unreadCount > 0 ? "text-base-content font-semibold" : "text-base-content/50"}`}>
                            {showNewMessagesLabel ? `${unreadCount} new messages` : renderLastMessagePreview(user)}
                          </p>
                          {unreadBadge && (
                            <span className="size-5 bg-primary text-primary-content text-[10px] font-bold rounded-full flex items-center justify-center px-1">
                              {unreadBadge}
                            </span>
                          )}
                        </div>
                      </div>
                    </button>

                    {activeQuickActionsUserId === user._id && (
                      <div className="absolute left-1/2 top-full z-20 mt-1 flex -translate-x-1/2 items-center gap-1 rounded-xl bg-base-200/95 p-1 shadow-lg backdrop-blur-sm md:left-auto md:right-2 md:top-1/2 md:mt-0 md:translate-x-0 md:-translate-y-1/2">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleMuteUser(user._id);
                            setActiveQuickActionsUserId(null);
                          }}
                          className="rounded-lg p-1.5 transition-colors hover:bg-base-300"
                        >
                          {isMuted ? <Bell className="size-3.5" /> : <BellOff className="size-3.5" />}
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            togglePinUser(user._id);
                            setActiveQuickActionsUserId(null);
                          }}
                          className="rounded-lg p-1.5 transition-colors hover:bg-base-300"
                        >
                          <Pin className={`size-3.5 ${isPinned ? "fill-primary text-primary" : ""}`} />
                        </button>
                        <button
                           onClick={(e) => {
                            e.stopPropagation();
                            if (isBlocked) {
                              unblockUser(user._id);
                            } else if (window.confirm(`Block ${user.fullName}?`)) {
                              blockUser(user._id);
                            }
                            setActiveQuickActionsUserId(null);
                          }}
                          className="rounded-lg p-1.5 transition-colors hover:bg-base-300"
                        >
                          <UserX className="size-3.5" />
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            openRemoveConfirm(user);
                            setActiveQuickActionsUserId(null);
                          }}
                          className="rounded-lg p-1.5 transition-colors hover:bg-red-100/50 text-red-500"
                        >
                          <Trash2 className="size-3.5" />
                        </button>
                      </div>
                    )}
                  </motion.div>
                );
              })}
              {filteredAndSortedUsers.length === 0 && (
                <div className="py-20 text-center space-y-4">
                  <div className="size-16 rounded-3xl bg-base-200 flex items-center justify-center mx-auto opacity-40">
                    <MessageCircle className="size-8" />
                  </div>
                  <p className="text-sm text-base-content/40 font-medium">No contacts found</p>
                </div>
              )}
            </motion.div>
          ) : (
            <motion.div
              key="groups-tab"
              initial={{ opacity: 0, x: 10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 10 }}
              className="space-y-1.5"
            >
              {filteredGroups.map((group, index) => {
                const isSelected = selectedGroup?._id === group._id;
                const activeGroupTypers = groupTypingUsers[group._id] || [];
                const isGroupTyping = activeGroupTypers.length > 0;
                
                const getGroupTypingText = () => {
                  if (activeGroupTypers.length === 1) return `${activeGroupTypers[0].fullName} is typing`;
                  return `${activeGroupTypers.length} people are typing`;
                };

                return (
                  <motion.div
                    key={group._id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.03 }}
                  >
                    <button
                      onClick={() => {
                        setSelectedGroup(group);
                        if (onCloseSidebar) onCloseSidebar();
                      }}
                      className={`w-full rounded-2xl px-2 py-2.5 md:px-3 md:py-3 transition-all flex items-center gap-3 text-left ${
                        isSelected ? "bg-primary/15 ring-1 ring-primary/20" : "hover:bg-base-200/60 active:scale-[0.98]"
                      }`}
                    >
                      <div className="relative shrink-0">
                        <div className={`size-12 rounded-2xl ring-2 transition-all ${isSelected ? 'ring-primary' : 'ring-base-300'}`}>
                          <img
                            src={group.profilePic || "/avatar.png"}
                            alt={group.name}
                            className="size-full rounded-2xl object-cover"
                          />
                        </div>
                      </div>

                      <div className="flex flex-1 flex-col min-w-0">
                        <div className="flex justify-between items-center w-full">
                          <p className={`font-semibold truncate text-[15px] ${isSelected ? 'text-primary' : ''}`}>{group.name}</p>
                          <span className="text-[10px] text-base-content/40">
                            {group.updatedAt ? new Date(group.updatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                          </span>
                        </div>
                        
                        {isGroupTyping ? (
                          <div className="flex items-center gap-1.5 min-w-0 mt-0.5">
                            <span className="text-primary font-medium truncate text-xs">
                              {getGroupTypingText()}
                            </span>
                            <span className="flex gap-0.5 items-center flex-shrink-0">
                              {[0, 1, 2].map((i) => (
                                <span
                                  key={i}
                                  className="w-1 h-1 rounded-full bg-primary animate-bounce"
                                  style={{ animationDelay: `${i * 0.15}s`, animationDuration: "0.8s" }}
                                />
                              ))}
                            </span>
                          </div>
                        ) : (
                          <p className="text-xs truncate text-base-content/50 mt-0.5">
                            {group.lastMessage?.senderId?.fullName ? (
                              <span className="font-semibold text-primary/70">
                                {group.lastMessage.senderId === authUser?._id || group.lastMessage.senderId?._id === authUser?._id || group.lastMessage.senderId?.fullName === "You" 
                                  ? "You" 
                                  : (typeof group.lastMessage.senderId === 'string' ? "Someone" : group.lastMessage.senderId.fullName)}: 
                              </span>
                            ) : ""}
                            {typeof group.lastMessage === "object" 
                              ? (group.lastMessage.text || group.lastMessage.content || "Sent a message") 
                              : (group.lastMessage || `${group.members?.length || 0} members`)}
                          </p>
                        )}
                      </div>
                    </button>
                  </motion.div>
                );
              })}
              {filteredGroups.length === 0 && (
                <div className="py-20 text-center space-y-4">
                  <div className="size-16 rounded-3xl bg-base-200 flex items-center justify-center mx-auto opacity-40">
                    <Users className="size-8" />
                  </div>
                  <p className="text-sm text-base-content/40 font-medium">No groups yet</p>
                  <button onClick={() => setIsCreateGroupModalOpen(true)} className="btn btn-primary btn-sm btn-outline rounded-xl">
                    Create Group
                  </button>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Quick stats footer */}
      <div className="hidden md:block border-t border-base-300 p-3 bg-base-200/50 backdrop-blur-sm">
        <div className="flex items-center justify-between text-xs text-base-content/60">
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1">
              <span className="size-2 bg-green-500 rounded-full" />
              {Math.max(0, onlineUsers.length - 1)} online
            </span>
            <span className="flex items-center gap-1">
              <CheckCheck className="size-3" />
              {users.filter(u => getUnreadCount(u._id) > 0).length} unread
            </span>
          </div>
        </div>
      </div>

      <SearchUsersModal 
        isOpen={isSearchModalOpen} 
        onClose={() => setIsSearchModalOpen(false)} 
      />

      <CreateGroupModal
        isOpen={isCreateGroupModalOpen}
        onClose={() => setIsCreateGroupModalOpen(false)}
      />

      {typeof document !== "undefined" && (
        <AnimatePresence>
          {removeTarget && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[9999] bg-black/40 backdrop-blur-sm flex items-center justify-center p-4"
              onClick={closeRemoveConfirm}
            >
              <motion.div
                initial={{ scale: 0.96, opacity: 0, y: 8 }}
                animate={{ scale: 1, opacity: 1, y: 0 }}
                exit={{ scale: 0.96, opacity: 0, y: 8 }}
                transition={{ type: "spring", damping: 22, stiffness: 280 }}
                className="relative w-full max-sm rounded-2xl bg-base-100 shadow-2xl border border-base-300 p-5"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex items-start gap-3">
                  <div className="size-10 rounded-full bg-red-100/70 text-red-500 flex items-center justify-center">
                    <Trash2 className="size-5" />
                  </div>
                  <div className="flex-1">
                    <h3 className="text-base font-semibold">Remove contact?</h3>
                    <p className="text-sm text-base-content/60 mt-1">{removeTarget?.fullName} will be removed.</p>
                  </div>
                </div>
                <div className="mt-5 flex items-center justify-end gap-2">
                  <button onClick={closeRemoveConfirm} className="btn btn-ghost btn-sm">Cancel</button>
                  <button onClick={confirmRemove} className="btn btn-error btn-sm">Remove</button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      )}
    </aside>
  );
};

export default Sidebar;
