import { useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Users, Camera, Search, Check, Loader2 } from "lucide-react";
import { useChatStore } from "../store/useChatStore.jsx";
import toast from "react-hot-toast";
import ImageCropper from "./ImageCropper";

const CreateGroupModal = ({ isOpen, onClose }) => {
  const { users, createGroup } = useChatStore();
  const [groupName, setGroupName] = useState("");
  const [selectedMembers, setSelectedMembers] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [imagePreview, setImagePreview] = useState(null);
  const [isCreating, setIsCreating] = useState(false);
  const [isCropperOpen, setIsCropperOpen] = useState(false);
  const [tempImage, setTempImage] = useState(null);
  const fileInputRef = useRef(null);

  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => {
      setTempImage(reader.result);
      setIsCropperOpen(true);
    };
  };

  const handleCrop = (croppedImage) => {
    setImagePreview(croppedImage);
    setIsCropperOpen(false);
    setTempImage(null);
  };

  const handleCancelCrop = () => {
    setIsCropperOpen(false);
    setTempImage(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const toggleMember = (userId) => {
    setSelectedMembers((prev) =>
      prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId]
    );
  };

  const handleCreateGroup = async (e) => {
    e.preventDefault();
    if (!groupName.trim()) return toast.error("Group name is required");
    if (selectedMembers.length === 0) return toast.error("Select at least one member");

    setIsCreating(true);
    try {
      await createGroup({
        name: groupName,
        members: selectedMembers,
        profilePic: imagePreview,
      });
      onClose();
      // Reset form
      setGroupName("");
      setSelectedMembers([]);
      setImagePreview(null);
    } catch (error) {
      // toast handled in store
    } finally {
      setIsCreating(false);
    }
  };

  const filteredUsers = users.filter((user) =>
    user.fullName.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-base-300/50 backdrop-blur-sm z-[100] flex items-center justify-center p-4"
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0, y: 15 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 15 }}
              className="bg-base-100 rounded-3xl w-full max-w-md shadow-2xl flex flex-col max-h-[80vh] overflow-hidden border border-base-300"
            >
              {/* Header */}
              <div className="flex items-center justify-between p-6 border-b border-base-300 bg-gradient-to-r from-base-100 to-base-200/50">
                <div className="flex items-center gap-3">
                  <div className="size-10 rounded-2xl bg-primary/10 flex items-center justify-center text-primary">
                    <Users className="size-6" />
                  </div>
                  <div>
                    <h2 className="font-bold text-xl">Create Group</h2>
                    <p className="text-xs text-base-content/50">Start a new conversation</p>
                  </div>
                </div>
                <button
                  onClick={onClose}
                  className="btn btn-ghost btn-sm btn-circle hover:bg-base-300/50 transition-colors"
                  disabled={isCreating}
                >
                  <X className="size-5" />
                </button>
              </div>

              <form onSubmit={handleCreateGroup} className="flex-1 flex flex-col overflow-hidden">
                <div className="flex-1 overflow-y-auto p-6 space-y-6 scrollbar-thin">
                  {/* Group Info */}
                  <div className="flex flex-col items-center gap-4">
                    <div className="relative group">
                      <div className="size-24 rounded-3xl bg-base-200 border-2 border-dashed border-base-300 flex items-center justify-center overflow-hidden transition-all group-hover:border-primary/50">
                        {imagePreview ? (
                          <img src={imagePreview} alt="Group" className="size-full object-cover" />
                        ) : (
                          <Camera className="size-8 text-base-content/20" />
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className="absolute -bottom-2 -right-2 btn btn-primary btn-circle btn-sm shadow-xl hover:scale-110 transition-transform"
                        disabled={isCreating}
                      >
                        <Camera className="size-4" />
                      </button>
                      <input
                        ref={fileInputRef}
                        type="file"
                        className="hidden"
                        accept="image/*"
                        onChange={handleImageChange}
                      />
                    </div>
                    <div className="w-full">
                      <label className="label py-1">
                        <span className="label-text font-semibold text-xs tracking-wider text-base-content/50">Group Name</span>
                      </label>
                      <input
                        type="text"
                        placeholder="Enter Group Name..."
                        className="input input-bordered w-full rounded-2xl bg-base-200/50 border-base-300 focus:border-primary focus:ring-4 focus:ring-primary/10 transition-all text-sm"
                        value={groupName}
                        onChange={(e) => setGroupName(e.target.value)}
                        required
                        disabled={isCreating}
                      />
                    </div>
                  </div>

                  {/* Member Selection */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <label className="label py-0">
                        <span className="label-text font-semibold text-xs tracking-wider text-base-content/50">
                          Add Members ({selectedMembers.length}/100)
                        </span>
                      </label>
                    </div>
                    
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-base-content/30" />
                      <input
                        type="text"
                        placeholder="Search contacts..."
                        className="input input-bordered input-sm w-full pl-9 rounded-xl bg-base-200/30 border-base-300 focus:border-primary transition-all text-xs"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        disabled={isCreating}
                      />
                    </div>

                    <div className="max-h-60 overflow-y-auto space-y-1 pr-2 scrollbar-thin">
                      {filteredUsers.length === 0 ? (
                        <div className="py-8 text-center text-sm text-base-content/40">
                          No contacts found
                        </div>
                      ) : (
                        filteredUsers.map((user) => (
                          <div
                            key={user._id}
                            onClick={() => !isCreating && toggleMember(user._id)}
                            className={`flex items-center justify-between p-3 rounded-2xl cursor-pointer transition-all ${
                              selectedMembers.includes(user._id)
                                ? "bg-primary/10 ring-1 ring-primary/20"
                                : "hover:bg-base-200/50 border border-transparent"
                            }`}
                          >
                            <div className="flex items-center gap-3">
                              <img
                                src={user.profilePic || "/avatar.png"}
                                alt={user.fullName}
                                className="size-9 rounded-xl object-cover"
                              />
                              <div>
                                <p className="font-semibold text-sm">{user.fullName}</p>
                                <p className="text-[10px] text-base-content/50 tracking-tighter">@{user.username}</p>
                              </div>
                            </div>
                            <div
                              className={`size-5 rounded-lg border-2 flex items-center justify-center transition-all ${
                                selectedMembers.includes(user._id)
                                  ? "bg-primary border-primary"
                                  : "border-base-300 bg-base-100"
                              }`}
                            >
                              {selectedMembers.includes(user._id) && <Check className="size-3 text-white" />}
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </div>

                {/* Actions */}
                <div className="p-6 border-t border-base-300 bg-base-100">
                  <button
                    type="submit"
                    className="btn btn-primary w-full rounded-2xl shadow-xl shadow-primary/20 gap-2 h-12"
                    disabled={isCreating || !groupName.trim() || selectedMembers.length === 0}
                  >
                    {isCreating ? (
                      <Loader2 className="size-5 animate-spin" />
                    ) : (
                      <>
                        <Users className="size-5" />
                        Create Group
                      </>
                    )}
                  </button>
                </div>
              </form>
            </motion.div>
          </motion.div>

          <AnimatePresence>
            {isCropperOpen && (
              <ImageCropper
                image={tempImage}
                onCrop={handleCrop}
                onCancel={handleCancelCrop}
              />
            )}
          </AnimatePresence>
        </>
      )}
    </AnimatePresence>
  );
};

export default CreateGroupModal;
