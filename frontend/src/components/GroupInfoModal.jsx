import { X, User, Settings, Users, LogOut, Shield, ShieldCheck, Trash2, Camera, Edit2 } from "lucide-react";
import { useChatStore } from "../store/useChatStore";
import { useAuthStore } from "../store/useAuthStore";
import { motion, AnimatePresence } from "framer-motion";
import { useState, useRef, useEffect } from "react";
import toast from "react-hot-toast";
import ImageCropper from "./ImageCropper";

const GroupInfoModal = ({ isOpen, onClose, initialTab = "info" }) => {
  const { selectedGroup, updateGroup, updateGroupSettings, leaveGroup, removeGroupMember, makeGroupAdmin } = useChatStore();
  const { authUser, onlineUsers } = useAuthStore();
  
  const [activeTab, setActiveTab] = useState(initialTab); // "info" | "members" | "settings"
  const [isEditing, setIsEditing] = useState(false);
  const [editedName, setEditedName] = useState(selectedGroup?.name || "");
  const [editedDesc, setEditedDesc] = useState(selectedGroup?.description || "");
  const [selectedImage, setSelectedImage] = useState(null);
  const fileInputRef = useRef(null);

  useEffect(() => {
    if (isOpen) setActiveTab(initialTab);
  }, [isOpen, initialTab]);

  if (!selectedGroup) return null;

  const isAdmin = selectedGroup.admin?._id === authUser?._id || selectedGroup.admin === authUser?._id;
  const canEditInfo = selectedGroup.settings?.editInfo === "all" || isAdmin;

  const handleUpdateInfo = async () => {
    if (!editedName.trim()) return toast.error("Group name cannot be empty");
    await updateGroup(selectedGroup._id, { name: editedName, description: editedDesc });
    setIsEditing(false);
  };

  const handleImageUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) return toast.error("Only images are allowed");
    
    const reader = new FileReader();
    reader.onload = () => {
      setSelectedImage(reader.result);
    };
    reader.readAsDataURL(file);
  };

  const handleCropComplete = async (croppedImage) => {
    await updateGroup(selectedGroup._id, { profilePic: croppedImage });
    setSelectedImage(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleLeaveGroup = () => {
    if (isAdmin && selectedGroup.members?.length > 1) {
      return toast.error("Please transfer admin ownership before leaving");
    }
    if (window.confirm("Are you sure you want to leave this group?")) {
      leaveGroup(selectedGroup._id);
      onClose();
    }
  };

  const uniqueMembers = selectedGroup.members?.filter((member, index, self) => 
    index === self.findIndex((m) => m._id === member._id)
  ) || [];

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 md:p-6 mt-14">
          {/* Overlay */}
          <motion.div 
            initial={{ opacity: 0 }} 
            animate={{ opacity: 1 }} 
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
          />

          {/* Modal Container */}
          <motion.div
            initial={{ scale: 0.9, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.9, opacity: 0, y: 20 }}
            className="relative w-full max-w-lg bg-base-100 rounded-3xl shadow-2xl overflow-hidden border border-base-300"
          >
            {/* Header Area (Banner-like) */}
            <div className="relative h-52 bg-primary/10 flex items-center justify-center overflow-hidden">
              <img 
                src={selectedGroup.profilePic || "/avatar.png"} 
                alt={selectedGroup.name}
                className="w-full h-full object-cover blur-sm opacity-30 absolute inset-0"
              />
              <div className="relative z-10 flex flex-col items-center">
                <div className="relative group">
                  <img 
                    src={selectedGroup.profilePic || "/avatar.png"} 
                    alt={selectedGroup.name}
                    className="w-28 h-28 rounded-3xl object-cover ring-4 ring-base-100 shadow-xl"
                  />
                  {isAdmin && (
                    <button 
                      onClick={() => fileInputRef.current?.click()}
                      className="absolute bottom-0 right-0 p-2 bg-primary text-primary-content rounded-xl shadow-lg hover:scale-110 transition-transform"
                    >
                      <Camera className="w-4 h-4" />
                    </button>
                  )}
                  <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleImageUpload} />
                </div>
              </div>
              <button 
                onClick={onClose}
                className="absolute top-4 right-4 p-2 bg-base-100/50 hover:bg-base-100 rounded-full transition-colors z-20"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Content Tabs */}
            <div className="flex border-b border-base-300 bg-base-200/50 px-4">
              <button 
                onClick={() => setActiveTab("info")}
                className={`py-3 px-4 text-sm font-semibold flex items-center gap-2 border-b-2 transition-all ${activeTab === "info" ? "border-primary text-primary" : "border-transparent text-base-content/60 hover:text-base-content"}`}
              >
                <Users className="w-4 h-4" /> Info
              </button>
              <button 
                onClick={() => setActiveTab("members")}
                className={`py-3 px-4 text-sm font-semibold flex items-center gap-2 border-b-2 transition-all ${activeTab === "members" ? "border-primary text-primary" : "border-transparent text-base-content/60 hover:text-base-content"}`}
              >
                <Users className="w-4 h-4" /> Members ({selectedGroup.members?.length})
              </button>
              {isAdmin && (
                <button 
                  onClick={() => setActiveTab("settings")}
                  className={`py-3 px-4 text-sm font-semibold flex items-center gap-2 border-b-2 transition-all ${activeTab === "settings" ? "border-primary text-primary" : "border-transparent text-base-content/60 hover:text-base-content"}`}
                >
                  <Settings className="w-4 h-4" /> Settings
                </button>
              )}
            </div>

            {/* Tab Content Body */}
            <div className="p-6 max-h-[60vh] overflow-y-auto custom-scrollbar">
              
              {/* Tab: Info */}
              {activeTab === "info" && (
                <div className="space-y-6">
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-xs font-bold uppercase tracking-wider text-base-content/40">Group Name</label>
                      {canEditInfo && !isEditing && (
                        <button onClick={() => setIsEditing(true)} className="text-primary hover:underline text-xs flex items-center gap-1">
                          <Edit2 className="w-3 h-3" /> Edit
                        </button>
                      )}
                    </div>
                    {isEditing ? (
                      <div className="flex gap-2">
                        <input 
                          type="text" 
                          value={editedName} 
                          onChange={(e) => setEditedName(e.target.value)}
                          className="flex-1 input input-bordered input-sm rounded-xl"
                        />
                        <button onClick={handleUpdateInfo} className="btn btn-primary btn-sm rounded-xl">Save</button>
                        <button onClick={() => setIsEditing(false)} className="btn btn-ghost btn-sm rounded-xl">Cancel</button>
                      </div>
                    ) : (
                      <h2 className="text-xl font-bold">{selectedGroup.name}</h2>
                    )}
                  </div>

                  <div>
                    <label className="text-xs font-bold uppercase tracking-wider text-base-content/40">Description</label>
                    {isEditing ? (
                      <textarea 
                        value={editedDesc} 
                        onChange={(e) => setEditedDesc(e.target.value)}
                        className="w-full mt-1 textarea textarea-bordered rounded-xl text-sm leading-relaxed"
                        rows={3}
                        placeholder="Group description..."
                      />
                    ) : (
                      <p className="mt-1 text-sm text-base-content/80 leading-relaxed whitespace-pre-wrap">
                        {selectedGroup.description || "No description provided."}
                      </p>
                    )}
                  </div>

                  <div className="p-4 bg-base-200/50 rounded-2xl flex flex-col gap-2 border border-base-300">
                    <div className="flex items-center gap-3 text-sm">
                      <ShieldCheck className="w-4 h-4 text-primary" />
                      <span>Admin: <span className="font-semibold">{selectedGroup.admin?.fullName || "Created by Admin"}</span></span>
                    </div>
                    <div className="flex items-center gap-3 text-sm text-base-content/60">
                      <Edit2 className="w-4 h-4" />
                      <span>Created {new Date(selectedGroup.createdAt).toLocaleDateString()}</span>
                    </div>
                  </div>

                  <button 
                    onClick={handleLeaveGroup}
                    className="w-full btn btn-error btn-outline rounded-2xl gap-2 mt-4"
                  >
                    <LogOut className="w-4 h-4" /> Leave Group
                  </button>
                </div>
              )}

              {/* Tab: Members */}
              {activeTab === "members" && (
                <div className="space-y-4">
                  {uniqueMembers.map((member, index) => {
                    const isMemberAdmin = selectedGroup.admin?._id === member._id || selectedGroup.admin === member._id;
                    const isOnline = onlineUsers.includes(member._id);
                    
                    return (
                      <div key={member?._id || index} className="flex items-center justify-between group p-2 hover:bg-base-200/50 rounded-2xl transition-colors">
                        <div className="flex items-center gap-3">
                          <div className="relative">
                            <img 
                              src={member.profilePic || "/avatar.png"} 
                              alt={member.fullName} 
                              className="w-10 h-10 rounded-xl object-cover"
                            />
                            {Boolean(isOnline) && (
                              <span className="absolute -bottom-1 -right-1 w-3 h-3 bg-green-500 border-2 border-base-100 rounded-full" />
                            )}
                          </div>
                          <div>
                            <p className="text-sm font-semibold flex items-center gap-2">
                              {member.fullName} {Boolean(member._id === authUser?._id) && <span className="text-[10px] text-base-content/40 font-normal">(You)</span>}
                            </p>
                            <p className="text-xs text-base-content/50 truncate max-w-[150px]">
                              {isOnline ? "Online" : "Member"}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          {Boolean(isMemberAdmin) && (
                            <span className="px-2 py-0.5 bg-primary/10 text-primary rounded-lg text-[10px] font-bold uppercase tracking-tighter">
                              Admin
                            </span>
                          )}
                          
                          {Boolean(isAdmin && member._id !== authUser?._id) && (
                            <div className="dropdown dropdown-left">
                              <button tabIndex={0} className="p-1 hover:bg-base-300 rounded-lg transition-colors">
                                <Settings className="w-4 h-4 text-base-content/40" />
                              </button>
                              <ul tabIndex={0} className="dropdown-content z-[1] menu p-2 shadow-xl bg-base-100 rounded-xl w-48 border border-base-300">
                                <li>
                                  <button onClick={() => makeGroupAdmin(selectedGroup._id, member._id)} className="flex items-center gap-2 text-primary">
                                    <Shield className="w-3.5 h-3.5" /> Make Admin
                                  </button>
                                </li>
                                <li>
                                  <button onClick={() => removeGroupMember(selectedGroup._id, member._id)} className="flex items-center gap-2 text-error">
                                    <Trash2 className="w-3.5 h-3.5" /> Remove Member
                                  </button>
                                </li>
                              </ul>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Tab: Settings (Admin Only) */}
              {activeTab === "settings" && isAdmin && (
                <div className="space-y-6">
                  <div className="p-4 bg-base-200/50 rounded-2xl border border-base-300 space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="max-w-[60%]">
                        <h4 className="text-sm font-bold">Edit Group Info</h4>
                        <p className="text-xs text-base-content/50">Choose who can change name and description</p>
                      </div>
                      
                      {/* Custom Toggle Pill for Edit Info */}
                      <div className="flex bg-base-300/50 p-1 rounded-xl gap-1">
                        <button 
                          onClick={() => updateGroupSettings(selectedGroup._id, { editInfo: "all" })}
                          className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${selectedGroup.settings?.editInfo === "all" ? "bg-base-100 text-primary shadow-sm" : "hover:text-base-content text-base-content/40"}`}
                        >
                          All
                        </button>
                        <button 
                          onClick={() => updateGroupSettings(selectedGroup._id, { editInfo: "admin" })}
                          className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${selectedGroup.settings?.editInfo === "admin" ? "bg-base-100 text-primary shadow-sm" : "hover:text-base-content text-base-content/40"}`}
                        >
                          Admins
                        </button>
                      </div>
                    </div>

                    <div className="flex items-center justify-between border-t border-base-300 pt-4">
                      <div className="max-w-[60%]">
                        <h4 className="text-sm font-bold">Send Messages</h4>
                        <p className="text-xs text-base-content/50">Choose who can send messages locally</p>
                      </div>
                      
                      {/* Custom Toggle Pill for Send Messages */}
                      <div className="flex bg-base-300/50 p-1 rounded-xl gap-1">
                        <button 
                          onClick={() => updateGroupSettings(selectedGroup._id, { sendMessages: "all" })}
                          className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${selectedGroup.settings?.sendMessages === "all" ? "bg-base-100 text-primary shadow-sm" : "hover:text-base-content text-base-content/40"}`}
                        >
                          All
                        </button>
                        <button 
                          onClick={() => updateGroupSettings(selectedGroup._id, { sendMessages: "admin" })}
                          className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${selectedGroup.settings?.sendMessages === "admin" ? "bg-base-100 text-primary shadow-sm" : "hover:text-base-content text-base-content/40"}`}
                        >
                          Admins
                        </button>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-start gap-3 p-4 bg-primary/5 rounded-2xl border border-primary/10">
                    <ShieldCheck className="w-5 h-5 text-primary mt-0.5" />
                    <p className="text-xs text-base-content/70 leading-relaxed italic">
                      As an admin, you have full control over the group privacy and member status. Changes made here apply instantly to all members.
                    </p>
                  </div>
                </div>
              )}

            </div>
          </motion.div>
        </div>
      )}

      {/* Image Cropper Modal */}
      <AnimatePresence>
        {selectedImage && (
          <ImageCropper 
            image={selectedImage}
            onCrop={handleCropComplete}
            onCancel={() => {
              setSelectedImage(null);
              if (fileInputRef.current) fileInputRef.current.value = "";
            }}
          />
        )}
      </AnimatePresence>
    </AnimatePresence>
  );
};

export default GroupInfoModal;
