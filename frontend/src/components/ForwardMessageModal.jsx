import { useState, useEffect } from "react";
import { useChatStore } from "../store/useChatStore.jsx";
import { X, Search, Send, User } from "lucide-react";
import toast from "react-hot-toast";

const ForwardMessageModal = ({ onClose }) => {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedUser, setSelectedUser] = useState(null);
  const [isForwarding, setIsForwarding] = useState(false);
  const { forwardMessage, sendForwardMessage, users, getUsers } = useChatStore();

  useEffect(() => {
    getUsers();
  }, [getUsers]);

  const filteredUsers = users.filter((user) =>
    user.fullName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    user.username?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleForward = async () => {
    if (!selectedUser || !forwardMessage) return;
    setIsForwarding(true);
    try {
      await sendForwardMessage(forwardMessage, selectedUser._id);
      onClose();
    } catch (error) {
      toast.error("Failed to forward message");
    } finally {
      setIsForwarding(false);
    }
  };

  const handleSelectUser = (user) => {
    setSelectedUser(user);
  };

  if (!forwardMessage) return null;

  const getPreviewContent = () => {
    if (!forwardMessage) return "";
    if (forwardMessage.type === "image") return "📷 Photo";
    if (forwardMessage.type === "file") return `📎 ${forwardMessage.fileName}`;
    if (forwardMessage.type === "audio") return "🎤 Voice message";
    if (forwardMessage.type === "video") return "🎬 Video";
    return forwardMessage.content?.slice(0, 50) + (forwardMessage.content?.length > 50 ? "..." : "");
  };

  return (
    <div className="fixed inset-0 z-[9999] bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-base-100 rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-base-200">
          <h3 className="font-semibold text-lg">Forward Message</h3>
          <button onClick={onClose} className="btn btn-ghost btn-sm btn-circle">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Message Preview */}
        <div className="px-4 py-2 bg-base-200/50 border-b border-base-200">
          <p className="text-xs text-base-content/60 mb-1">Forwarding:</p>
          <p className="text-sm truncate">{getPreviewContent()}</p>
        </div>

        {/* Search */}
        <div className="p-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-base-content/40" />
            <input
              type="text"
              placeholder="Search users..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="input input-bordered w-full pl-10"
            />
          </div>
        </div>

        {/* User List */}
        <div className="max-h-64 overflow-y-auto px-2 pb-2">
          {filteredUsers.length === 0 ? (
            <p className="text-center text-base-content/50 py-4">No users found</p>
          ) : (
            filteredUsers.map((user) => (
              <button
                key={user._id}
                onClick={() => handleSelectUser(user)}
                className={`w-full flex items-center gap-3 p-3 rounded-xl transition-colors ${
                  selectedUser?._id === user._id
                    ? "bg-primary/10 border border-primary/30"
                    : "hover:bg-base-200"
                }`}
              >
                <div className="w-10 h-10 rounded-full bg-base-300 overflow-hidden">
                  {user.profilePic ? (
                    <img src={user.profilePic} alt={user.fullName} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-base-content/50">
                      <User className="w-5 h-5" />
                    </div>
                  )}
                </div>
                <div className="flex-1 text-left">
                  <p className="font-medium">{user.fullName}</p>
                  <p className="text-xs text-base-content/50">@{user.username}</p>
                </div>
                {selectedUser?._id === user._id && (
                  <div className="w-5 h-5 rounded-full bg-primary flex items-center justify-center">
                    <span className="text-primary-content text-xs">✓</span>
                  </div>
                )}
              </button>
            ))
          )}
        </div>

        {/* Footer */}
        <div className="px-4 py-3 border-t border-base-200 bg-base-100">
          <button
            onClick={handleForward}
            disabled={!selectedUser || isForwarding}
            className="btn btn-primary w-full"
          >
            {isForwarding ? (
              <span className="loading loading-spinner loading-sm" />
            ) : (
              <>
                <Send className="w-4 h-4" />
                <span>Forward</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ForwardMessageModal;
