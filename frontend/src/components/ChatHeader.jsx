import { ChevronDown, MoreVertical, Phone, Search, Video, X, ArrowLeft, User, Bell, BellOff, Trash2, ShieldOff, Users, LogOut } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useAuthStore } from "../store/useAuthStore";
import { useChatStore } from "../store/useChatStore.jsx";
import { useThemeStore } from "../store/useThemeStore";
import useCallStore from "../store/useCallStore";
import { getSocket } from "../lib/socket";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import GroupInfoModal from "./GroupInfoModal";

const ChatHeader = ({ onSearchMessages }) => {
  const { 
    selectedUser, 
    setSelectedUser, 
    selectedGroup, 
    setSelectedGroup, 
    isUserTyping, 
    groupTypingUsers, 
    toggleMuteUser, 
    mutedUsers, 
    clearChatWithUser, 
    blockUser,
    leaveGroup,
    toggleMuteGroup,
    clearGroupChat
  } = useChatStore();
  const { onlineUsers, authUser } = useAuthStore();
  const { callState, actions: callActions } = useCallStore();
  const navigate = useNavigate();
  const { theme } = useThemeStore();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef(null);
  const btnRef = useRef(null);
  const [menuPos, setMenuPos] = useState({ top: 0, right: 0 });
  // "" | "clear" | "block"
  const [confirm, setConfirm] = useState("");
  const [isGroupInfoOpen, setIsGroupInfoOpen] = useState(false);
  const [groupInfoTab, setGroupInfoTab] = useState("info");

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (
        menuRef.current && !menuRef.current.contains(e.target) &&
        btnRef.current && !btnRef.current.contains(e.target)
      ) {
        setMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const toggleMenu = () => {
    if (!menuOpen && btnRef.current) {
      const rect = btnRef.current.getBoundingClientRect();
      setMenuPos({
        top: rect.bottom + 6,
        right: window.innerWidth - rect.right,
      });
    }
    setConfirm("");
    setMenuOpen((prev) => !prev);
  };
  
  const handleCall = (type) => {
    callActions.startCall(type, authUser, selectedUser);
  };

  if (!selectedUser && !selectedGroup) return null;

  const isGroup = !!selectedGroup;
  const activeChat = isGroup ? selectedGroup : selectedUser;

  const isOnline = !isGroup && onlineUsers.includes(selectedUser._id);
  const title = isGroup ? selectedGroup.name : selectedUser.fullName;
  const canShowLastSeen = !isGroup && selectedUser?.privacySettings?.lastSeen !== "Nobody";

  const getLastSeen = () => {
    if (isGroup) {
      const members = activeChat.members || [];
      const onlineCount = members.filter(m => onlineUsers.includes(m._id || m)).length;
      return `${members.length} members • ${onlineCount} online`;
    }
    if (!canShowLastSeen) return "Last seen hidden";
    if (!selectedUser.lastSeenAt) return "Offline";
    const lastSeen = new Date(selectedUser.lastSeenAt);
    const now = new Date();
    const diffMinutes = Math.floor((now - lastSeen) / 60000);

    if (diffMinutes < 1) return "Last seen just now";
    if (diffMinutes < 60) return `Last seen ${diffMinutes} min ago`;
    if (diffMinutes < 1440) return `Last seen ${Math.floor(diffMinutes / 60)}h ago`;

    return `Last seen ${new Date(selectedUser.lastSeenAt).toLocaleDateString()}`;
  };

  // Group typing logic
  const activeGroupTypers = (isGroup && selectedGroup) ? (groupTypingUsers[selectedGroup._id] || []) : [];
  const showTyping = isGroup ? activeGroupTypers.length > 0 : isUserTyping;

  const getTypingText = () => {
    if (!isGroup) return "Typing";
    if (activeGroupTypers.length === 1) return `${activeGroupTypers[0].fullName} is typing`;
    return `${activeGroupTypers.length} people are typing`;
  };

  const subtitle = isOnline ? "Online" : getLastSeen();

  const openProfile = () => {
    if (selectedUser) navigate(`/profile/${selectedUser._id}`);
    if (selectedGroup) setIsGroupInfoOpen(true);
  };

  return (
    <header className="h-16 border-b border-base-300 bg-base-100 px-3 md:px-4 overflow-visible">
      <div className="h-full flex items-center justify-between gap-2">

        {/* ── Left section ── */}
        <div className="flex items-center gap-2 min-w-0">

          {/* ← Back button — mobile only (closes chat, shows sidebar) */}
          <button
            type="button"
            onClick={() => isGroup ? setSelectedGroup(null) : setSelectedUser(null)}
            className="md:hidden btn btn-ghost btn-sm btn-circle shrink-0"
            aria-label="Back"
          >
            <ArrowLeft className="size-5" />
          </button>

          {/* Avatar + name — clicking opens profile page */}
          <button
            type="button"
            onClick={openProfile}
            className="flex items-center gap-2.5 min-w-0 rounded-xl px-2 py-1
                       transition-colors hover:bg-base-200/60 active:scale-[0.98] text-left"
            aria-label="View Info"
          >
            {/* Avatar with online dot */}
            <div className="relative shrink-0">
              <img
                src={activeChat.profilePic || "/avatar.png"}
                alt={title}
                className={`size-9 md:size-10 object-cover ring-2 ring-base-300 ${isGroup ? 'rounded-2xl' : 'rounded-full'}`}
              />
              {isOnline && (
                <span className="absolute bottom-0 right-0 size-2.5 rounded-full bg-green-500 border-2 border-base-100" />
              )}
            </div>

            {/* Name + status */}
            <div className="min-w-0 text-left">
              <p className="font-semibold truncate leading-tight">{title}</p>
              
              {showTyping ? (
                <div className="flex items-center gap-1.5">
                  <span className="text-xs text-primary font-medium truncate max-w-[120px]">
                    {getTypingText()}
                  </span>
                  <span className="flex gap-[2px] items-end pb-[2px]">
                    {[0, 1, 2].map((i) => (
                      <span
                        key={i}
                        className="w-[3px] h-[3px] rounded-full bg-primary animate-bounce"
                        style={{ animationDelay: `${i * 0.15}s`, animationDuration: "0.8s" }}
                      />
                    ))}
                  </span>
                </div>
              ) : (
                <p className={`text-xs truncate ${isOnline ? "text-green-500" : "text-base-content/50"}`}>
                  {subtitle}
                </p>
              )}
            </div>
          </button>
        </div>

        <div className="flex items-center gap-1.5 md:gap-2.5 shrink-0">
          {!isGroup && (
            <>
              <motion.button
                whileTap={{ scale: 0.95 }}
                type="button"
                onClick={() => handleCall("audio")}
                className="flex h-10 items-center gap-2 rounded-xl bg-base-200/80 px-3 md:px-4 text-base-content/70 transition-colors hover:bg-base-300 active:bg-base-300/80"
                aria-label="Voice call"
              >
                <Phone className="size-4 md:size-[18px]" />
                <span className="hidden md:inline text-sm font-semibold">Call</span>
              </motion.button>

              <motion.button
                whileTap={{ scale: 0.95 }}
                type="button"
                onClick={() => handleCall("video")}
                className="flex h-10 items-center gap-2 rounded-xl bg-base-200/80 px-3 md:px-4 text-base-content/70 transition-colors hover:bg-base-300 active:bg-base-300/80"
                aria-label="Video call"
              >
                <Video className="size-4 md:size-[18px]" />
                <span className="hidden md:inline text-sm font-semibold">Video</span>
              </motion.button>
            </>
          )}
          <motion.button
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
            type="button"
            onClick={onSearchMessages}
            className="flex size-10 md:size-11 items-center justify-center rounded-full text-base-content/70 transition-colors hover:bg-base-200 hover:text-base-content"
            aria-label="Search messages"
            title="Search messages"
          >
            <Search className="size-4 md:size-5" />
          </motion.button>
          {/* Three-dot menu */}
            <div ref={btnRef} className="flex items-center justify-center">
              <motion.button
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.9 }}
                type="button"
                onClick={toggleMenu}
                className="btn btn-ghost btn-sm btn-circle"
                aria-label="More options"
              >
                <MoreVertical className="size-5" />
              </motion.button>
            </div>

            {createPortal(
              <AnimatePresence>
                {menuOpen && (
                  <motion.div
                    key="dropdown-menu"
                    ref={menuRef}
                    style={{ position: "fixed", top: menuPos.top, right: menuPos.right }}
                    className="z-[9999] w-56 rounded-2xl border border-base-300 bg-base-100 shadow-2xl overflow-hidden"
                    initial={{ opacity: 0, scale: 0.95, y: -10 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95, y: -10 }}
                    transition={{ duration: 0.2, ease: "easeOut" }}
                    data-theme={theme}
                    role="menu"
                  >
                    {confirm === "" && (
                      <ul className="py-2">
                        {/* ── Private Chat Actions ── */}
                        {!isGroup && (
                          <>
                            <li>
                              <button
                                type="button"
                                onClick={() => { setMenuOpen(false); navigate(`/profile/${selectedUser._id}`); }}
                                className="flex w-full items-center gap-3 px-4 py-2.5 text-sm hover:bg-base-200 transition-colors"
                              >
                                <User className="size-4 text-base-content/60" />
                                View Profile
                              </button>
                            </li>
                            <li>
                              <button
                                type="button"
                                onClick={() => {
                                  toggleMuteUser(selectedUser._id);
                                  setMenuOpen(false);
                                }}
                                className="flex w-full items-center gap-3 px-4 py-2.5 text-sm hover:bg-base-200 transition-colors"
                              >
                                {mutedUsers.includes(selectedUser._id)
                                  ? <Bell className="size-4 text-base-content/60" />
                                  : <BellOff className="size-4 text-base-content/60" />}
                                {mutedUsers.includes(selectedUser._id) ? "Unmute Notifications" : "Mute Notifications"}
                              </button>
                            </li>
                            <li className="border-t border-base-300 my-1" />
                            <li>
                              <button
                                type="button"
                                onClick={() => setConfirm("clear")}
                                className="flex w-full items-center gap-3 px-4 py-2.5 text-sm hover:bg-error/10 text-error transition-colors"
                              >
                                <Trash2 className="size-4" />
                                Clear Chat
                              </button>
                            </li>
                            <li>
                              <button
                                type="button"
                                onClick={() => setConfirm("block")}
                                className="flex w-full items-center gap-3 px-4 py-2.5 text-sm hover:bg-error/10 text-error transition-colors"
                              >
                                <ShieldOff className="size-4" />
                                Block User
                              </button>
                            </li>
                          </>
                        )}

                        {/* ── Group Chat Actions ── */}
                        {isGroup && (
                          <>
                            <li>
                              <button
                                type="button"
                                onClick={() => { setMenuOpen(false); setIsGroupInfoOpen(true); setGroupInfoTab("info"); }}
                                className="flex w-full items-center gap-3 px-4 py-2.5 text-sm hover:bg-base-200 transition-colors"
                              >
                                <User className="size-4 text-base-content/60" />
                                Group Info
                              </button>
                            </li>
                            <li>
                              <button
                                type="button"
                                onClick={() => { setMenuOpen(false); setIsGroupInfoOpen(true); setGroupInfoTab("members"); }}
                                className="flex w-full items-center gap-3 px-4 py-2.5 text-sm hover:bg-base-200 transition-colors"
                              >
                                <Users className="size-4 text-base-content/60" />
                                Add Participants
                              </button>
                            </li>
                            <li>
                              <button
                                type="button"
                                onClick={() => {
                                  toggleMuteGroup(selectedGroup._id);
                                  setMenuOpen(false);
                                }}
                                className="flex w-full items-center gap-3 px-4 py-2.5 text-sm hover:bg-base-200 transition-colors"
                              >
                                {authUser?.mutedGroups?.includes(selectedGroup._id)
                                  ? <Bell className="size-4 text-base-content/60" />
                                  : <BellOff className="size-4 text-base-content/60" />}
                                {authUser?.mutedGroups?.includes(selectedGroup._id) ? "Unmute Notifications" : "Mute Notifications"}
                              </button>
                            </li>
                            <li className="border-t border-base-300 my-1" />
                            <li>
                              <button
                                type="button"
                                onClick={() => setConfirm("clearGroup")}
                                className="flex w-full items-center gap-3 px-4 py-2.5 text-sm hover:bg-error/10 text-error transition-colors"
                              >
                                <Trash2 className="size-4" />
                                Clear Group Chat
                              </button>
                            </li>
                            <li>
                              <button
                                type="button"
                                onClick={() => setConfirm("leaveGroup")}
                                className="flex w-full items-center gap-3 px-4 py-2.5 text-sm hover:bg-error/10 text-error transition-colors font-semibold"
                              >
                                <LogOut className="size-4" />
                                Exit Group
                              </button>
                            </li>
                          </>
                        )}
                      </ul>
                    )}

                    {/* ── Confirm Section ── */}
                    <div className="overflow-hidden">
                      {confirm === "leaveGroup" && isGroup && (
                        <div className="px-4 py-4 space-y-4">
                          <div className="space-y-1">
                            <p className="text-sm font-bold text-error">Exit Group?</p>
                            <p className="text-[11px] text-base-content/60 leading-tight">
                              You will no longer be able to send or receive messages in this group.
                            </p>
                          </div>
                          <div className="flex flex-col gap-2">
                            <button onClick={() => { leaveGroup(selectedGroup._id); setMenuOpen(false); }} className="btn btn-error btn-sm w-full rounded-xl">Exit</button>
                            <button onClick={() => setConfirm("")} className="btn btn-ghost btn-sm w-full rounded-xl">Cancel</button>
                          </div>
                        </div>
                      )}

                      {confirm === "clearGroup" && isGroup && (
                        <div className="px-4 py-4 space-y-4">
                          <div className="space-y-1">
                            <p className="text-sm font-bold">Clear Group Chat?</p>
                            <p className="text-[11px] text-base-content/60 leading-tight">This will remove all messages from your view locally.</p>
                          </div>
                          <div className="flex flex-col gap-2">
                            <button onClick={() => { clearGroupChat(); setMenuOpen(false); }} className="btn btn-primary btn-sm w-full rounded-xl">Clear Chat</button>
                            <button onClick={() => setConfirm("")} className="btn btn-ghost btn-sm w-full rounded-xl">Cancel</button>
                          </div>
                        </div>
                      )}

                      {confirm === "clear" && !isGroup && selectedUser && (
                        <div className="px-4 py-4 space-y-3">
                          <p className="text-sm font-semibold">Clear this chat?</p>
                          <p className="text-xs text-base-content/60">Messages will be removed only for you.</p>
                          <div className="flex gap-2 pt-1">
                            <button onClick={() => setConfirm("")} className="flex-1 btn btn-sm btn-ghost">Cancel</button>
                            <button onClick={async () => { setMenuOpen(false); setConfirm(""); await clearChatWithUser(selectedUser._id); }} className="flex-1 btn btn-sm btn-error">Clear</button>
                          </div>
                        </div>
                      )}

                      {confirm === "block" && selectedUser && (
                        <div className="px-4 py-4 space-y-3">
                          <p className="text-sm font-semibold">Block {selectedUser.fullName}?</p>
                          <p className="text-xs text-base-content/60">They won't be able to message you.</p>
                          <div className="flex gap-2 pt-1">
                            <button onClick={() => setConfirm("")} className="flex-1 btn btn-sm btn-ghost">Cancel</button>
                            <button onClick={async () => { setMenuOpen(false); setConfirm(""); await blockUser(selectedUser._id); }} className="flex-1 btn btn-sm btn-error">Block</button>
                          </div>
                        </div>
                      )}
                    </div>
                  </motion.div>
              )}
            </AnimatePresence>,
            document.body
          )}

          {/* X — desktop only (mobile uses ← back) */}
          <motion.button
            whileHover={{ scale: 1.1, rotate: 90 }}
            whileTap={{ scale: 0.9 }}
            type="button"
            onClick={() => isGroup ? setSelectedGroup(null) : setSelectedUser(null)}
            className="btn btn-ghost btn-sm btn-circle hidden md:inline-flex"
            aria-label="Close"
          >
            <X className="size-5" />
          </motion.button>
        </div>
      </div>
      <GroupInfoModal isOpen={isGroupInfoOpen} onClose={() => setIsGroupInfoOpen(false)} initialTab={groupInfoTab} />
    </header>
  );
};

export default ChatHeader;
