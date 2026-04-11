import { useEffect, useRef } from "react";
import {
  X,
  MessageSquare,
  Phone,
  Video,
  AtSign,
  Info,
  Clock,
  Shield,
  CheckCircle2,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useAuthStore } from "../store/useAuthStore";

/**
 * UserProfileModal
 * Props:
 *   user    – the selected user object (null → closed)
 *   onClose – callback to close the modal
 */
const UserProfileModal = ({ user, onClose }) => {
  const { onlineUsers } = useAuthStore();
  const overlayRef = useRef(null);

  const isOpen = Boolean(user);
  const isOnline = user ? onlineUsers.includes(user._id) : false;

  // Close on Escape key
  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [isOpen, onClose]);

  // Compute last-seen
  const getLastSeen = () => {
    if (!user) return "";
    const canShow = user?.privacySettings?.lastSeen !== "Nobody";
    if (!canShow) return "Last seen hidden";
    if (!user.lastSeenAt) return "Not available";
    const d = new Date(user.lastSeenAt);
    const diffMin = Math.floor((Date.now() - d) / 60000);
    if (diffMin < 1) return "Just now";
    if (diffMin < 60) return `${diffMin} min ago`;
    if (diffMin < 1440) return `${Math.floor(diffMin / 60)}h ago`;
    return d.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          ref={overlayRef}
          key="overlay"
          className="fixed inset-x-0 bottom-16 top-16 lg:top-20 z-[200] flex items-center justify-center p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
          onClick={(e) => e.target === overlayRef.current && onClose()}
          style={{ background: "rgba(0,0,0,0.55)", backdropFilter: "blur(6px)" }}
        >
          <motion.div
            key="card"
            initial={{ opacity: 0, y: 40, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 30, scale: 0.95 }}
            transition={{ type: "spring", stiffness: 340, damping: 28 }}
            className="relative w-full max-w-sm rounded-3xl border border-base-300 bg-base-100 shadow-2xl overflow-y-auto max-h-full"
          >
            {/* ── Banner / gradient hero ── */}
            <div className="relative h-32 bg-gradient-to-br from-primary/60 via-primary/30 to-secondary/30">
              {/* Decorative circles */}
              <span className="absolute -top-8 -right-8 size-36 rounded-full bg-primary/20 blur-2xl" />
              <span className="absolute bottom-0 left-10 size-20 rounded-full bg-secondary/20 blur-xl" />

              {/* Close button */}
              <button
                type="button"
                onClick={onClose}
                className="absolute top-3 right-3 btn btn-ghost btn-circle btn-sm bg-base-100/20 hover:bg-base-100/40 text-white"
                aria-label="Close"
              >
                <X className="size-4" />
              </button>
            </div>

            {/* ── Avatar (overlaps banner) ── */}
            <div className="absolute left-1/2 -translate-x-1/2 top-[72px]">
              <div className="relative">
                <img
                  src={user?.profilePic || "/avatar.png"}
                  alt={user?.fullName}
                  className="size-20 rounded-full object-cover ring-4 ring-base-100 shadow-lg"
                />
                {/* Online dot */}
                <span
                  className={`absolute bottom-1 right-1 size-4 rounded-full border-2 border-base-100 transition-colors ${
                    isOnline ? "bg-green-500" : "bg-base-300"
                  }`}
                />
              </div>
            </div>

            {/* ── Body ── */}
            <div className="mt-12 px-5 pb-5 text-center">
              {/* Name + username */}
              <h3 className="text-xl font-bold leading-tight truncate">{user?.fullName}</h3>
              {user?.username && (
                <p className="flex items-center justify-center gap-1 text-sm text-base-content/55 mt-0.5">
                  <AtSign className="size-3.5" />
                  {user.username}
                </p>
              )}

              {/* Online / last seen badge */}
              <div className="mt-2 flex justify-center">
                {isOnline ? (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-green-500/10 px-3 py-1 text-xs font-medium text-green-600">
                    <CheckCircle2 className="size-3.5" />
                    Online now
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-base-200 px-3 py-1 text-xs font-medium text-base-content/55">
                    <Clock className="size-3.5" />
                    {getLastSeen()}
                  </span>
                )}
              </div>

              {/* Bio */}
              {user?.bio && (
                <p className="mt-3 text-sm text-base-content/70 leading-relaxed line-clamp-3 border-t border-base-200 pt-3">
                  {user.bio}
                </p>
              )}

              {/* Info rows */}
              <div className="mt-4 grid gap-2 text-left">
                {user?.email && (
                  <div className="flex items-center gap-3 rounded-2xl border border-base-200 bg-base-200/50 px-3 py-2.5">
                    <span className="flex size-8 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                      <AtSign className="size-4" />
                    </span>
                    <div className="min-w-0">
                      <p className="text-[10px] font-semibold uppercase tracking-wider text-base-content/40">Email</p>
                      <p className="truncate text-sm font-medium">{user.email}</p>
                    </div>
                  </div>
                )}
                <div className="flex items-center gap-3 rounded-2xl border border-base-200 bg-base-200/50 px-3 py-2.5">
                  <span className="flex size-8 shrink-0 items-center justify-center rounded-xl bg-rose-500/10 text-rose-500">
                    <Shield className="size-4" />
                  </span>
                  <div className="min-w-0">
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-base-content/40">Privacy</p>
                    <p className="text-sm font-medium">
                      Last seen: {user?.privacySettings?.lastSeen ?? "Everyone"}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3 rounded-2xl border border-base-200 bg-base-200/50 px-3 py-2.5">
                  <span className="flex size-8 shrink-0 items-center justify-center rounded-xl bg-sky-500/10 text-sky-500">
                    <Info className="size-4" />
                  </span>
                  <div className="min-w-0">
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-base-content/40">Member since</p>
                    <p className="text-sm font-medium">
                      {user?.createdAt
                        ? new Date(user.createdAt).toLocaleDateString(undefined, {
                            day: "numeric",
                            month: "long",
                            year: "numeric",
                          })
                        : "Unknown"}
                    </p>
                  </div>
                </div>
              </div>

              {/* Action buttons */}
              <div className="mt-5 grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="col-span-3 btn btn-primary rounded-2xl gap-2"
                >
                  <MessageSquare className="size-4" />
                  Send Message
                </button>
                <button
                  type="button"
                  className="btn btn-outline rounded-2xl gap-1.5 text-sm"
                  aria-label="Voice call"
                >
                  <Phone className="size-4" />
                  Call
                </button>
                <button
                  type="button"
                  className="btn btn-outline rounded-2xl gap-1.5 text-sm"
                  aria-label="Video call"
                >
                  <Video className="size-4" />
                  Video
                </button>
                <button
                  type="button"
                  onClick={onClose}
                  className="btn btn-ghost btn-outline rounded-2xl text-sm"
                >
                  Close
                </button>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default UserProfileModal;
