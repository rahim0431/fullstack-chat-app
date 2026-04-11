import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useAuthStore } from "../store/useAuthStore";
import { Camera, Mail, User, Edit2, Copy, Lock, X, Loader2, Trash2, Move } from "lucide-react";
import { axiosInstance } from "../lib/axios";
import ImageCropper from "../components/ImageCropper";
import { motion, AnimatePresence } from "framer-motion";

const ProfilePage = () => {
  const { userId } = useParams();
  const navigate = useNavigate();
  const { authUser, isUpdatingProfile, updateProfile } = useAuthStore();
  const [profileUser, setProfileUser] = useState(authUser);
  const [isProfileLoading, setIsProfileLoading] = useState(false);
  
  const [copied, setCopied] = useState(false);

  // Edit Profile Modal State
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editProfilePic, setEditProfilePic] = useState(null);
  const [editForm, setEditForm] = useState({
    fullName: "",
    username: "",
    bio: "",
    email: "",
  });

  // Change Password Modal State
  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });
  const [imageToCrop, setImageToCrop] = useState(null);

  const viewedUser = profileUser || authUser;
  const isOwnProfile = !userId || (viewedUser?._id && authUser?._id && viewedUser._id === authUser._id);
  const hasEditProfilePic =
    editProfilePic === null ? !!viewedUser?.profilePic : !!editProfilePic;
  const modalProfilePic =
    editProfilePic === null
      ? viewedUser?.profilePic || "/avatar.png"
      : editProfilePic || "/avatar.png";

  const [usernameStatus, setUsernameStatus] = useState(null);
  const [emailStatus, setEmailStatus] = useState(null);

  useEffect(() => {
    if (!isEditModalOpen || !editForm.username) {
      setUsernameStatus(null);
      return;
    }
    
    if (editForm.username === viewedUser?.username) {
      setUsernameStatus('available');
      return;
    }

    setUsernameStatus('checking');
    const timeoutId = setTimeout(async () => {
      try {
        const res = await axiosInstance.get(`/auth/check-username?username=${editForm.username}`);
        if (res.data.available) {
          setUsernameStatus('available');
        } else {
          setUsernameStatus(res.data.error === 'Invalid format' ? 'invalid' : 'taken');
        }
      } catch (error) {
        setUsernameStatus('invalid');
      }
    }, 500);

    return () => clearTimeout(timeoutId);
  }, [editForm.username, isEditModalOpen, viewedUser?.username]);

  useEffect(() => {
    if (!isEditModalOpen || !editForm.email) {
      setEmailStatus(null);
      return;
    }
    const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (EMAIL_REGEX.test(editForm.email)) {
      setEmailStatus('valid');
    } else {
      setEmailStatus('invalid');
    }
  }, [editForm.email, isEditModalOpen]);

  const evaluatePassword = (password) => {
    if (!password) return 0;
    let score = 0;
    if (password.length > 7) score += 1;
    if (/[A-Z]/.test(password)) score += 1;
    if (/[0-9]/.test(password)) score += 1;
    if (/[^A-Za-z0-9]/.test(password)) score += 1;
    return score;
  };
  const passwordScore = evaluatePassword(passwordForm.newPassword);
  const [connectionStats, setConnectionStats] = useState({
    followersCount: 0,
    followingCount: 0,
  });
  const [isStatsLoading, setIsStatsLoading] = useState(false);
  const [isConnectionsModalOpen, setIsConnectionsModalOpen] = useState(false);
  const [activeConnectionsType, setActiveConnectionsType] = useState("followers");
  const [connectionsList, setConnectionsList] = useState([]);
  const [isConnectionsLoading, setIsConnectionsLoading] = useState(false);

  // Constants moved up to fix TDZ variables


  const handleEditImageUpload = (e) => {
    if (!isOwnProfile) return;
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => {
      setImageToCrop(reader.result);
      e.target.value = "";
    };
  };

  const handleCropComplete = (croppedImage) => {
    setEditProfilePic(croppedImage);
    setImageToCrop(null);
  };

  const handleCropCancel = () => {
    setImageToCrop(null);
  };

  const handleEditRemovePic = () => {
    if (!isOwnProfile) return;
    setEditProfilePic("");
  };


  const copyUsername = async () => {
    if (!viewedUser?.username) return;
    await navigator.clipboard.writeText(`@${viewedUser.username}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Open Edit Profile Modal
  const openEditModal = () => {
    if (!isOwnProfile) return;
    setEditProfilePic(null);
    setEditForm({
      fullName: viewedUser?.fullName || "",
      username: viewedUser?.username || "",
      bio: viewedUser?.bio || "",
      email: viewedUser?.email || "",
    });
    setIsEditModalOpen(true);
  };

  const handleSaveProfile = async () => {
    if (!isOwnProfile) return;
    if (usernameStatus === 'taken' || usernameStatus === 'invalid') return;
    if (emailStatus === 'invalid') return;
    
    const payload = { ...editForm };
    if (editProfilePic !== null) payload.profilePic = editProfilePic;
    await updateProfile(payload);
    setIsEditModalOpen(false);
  };

  useEffect(() => {
    const loadProfileUser = async () => {
      if (!authUser) return;
      setIsEditModalOpen(false);
      setIsPasswordModalOpen(false);

      if (!userId) {
        setProfileUser(authUser);
        return;
      }

      if (userId === authUser._id) {
        setProfileUser(authUser);
        return;
      }

      setIsProfileLoading(true);
      try {
        const res = await axiosInstance.get(`/auth/user/${userId}`);
        setProfileUser(res.data);
      } catch (error) {
        setProfileUser(null);
      } finally {
        setIsProfileLoading(false);
      }
    };

    loadProfileUser();
  }, [authUser, userId]);

  useEffect(() => {
    const loadConnectionStats = async () => {
      if (!viewedUser?._id) return;
      setIsStatsLoading(true);
      try {
        const res = await axiosInstance.get(`/connections/stats/${viewedUser._id}`);
        setConnectionStats({
          followersCount: res.data?.followersCount || 0,
          followingCount: res.data?.followingCount || 0,
        });
      } catch (error) {
        setConnectionStats({ followersCount: 0, followingCount: 0 });
      } finally {
        setIsStatsLoading(false);
      }
    };

    loadConnectionStats();
  }, [viewedUser?._id]);

  const openConnectionsModal = async (type) => {
    if (!viewedUser?._id) return;

    setActiveConnectionsType(type);
    setIsConnectionsModalOpen(true);
    setIsConnectionsLoading(true);

    try {
      const res = await axiosInstance.get(`/connections/${type}/${viewedUser._id}`);
      const rawList = Array.isArray(res.data) ? res.data : [];
      const filteredList =
        !isOwnProfile && authUser?._id
          ? rawList.filter((user) => user?._id && user._id !== authUser._id)
          : rawList;
      setConnectionsList(filteredList);
    } catch (error) {
      setConnectionsList([]);
    } finally {
      setIsConnectionsLoading(false);
    }
  };

  // Change Password
  const handleChangePassword = async () => {
    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      alert("New passwords do not match!");
      return;
    }
    if (!passwordForm.currentPassword || !passwordForm.newPassword) {
      alert("Please fill all fields");
      return;
    }

    // TODO: Call your store's updatePassword function here in real implementation
    // For demo purposes we just show success
    alert("✅ Password updated successfully!");

    setIsPasswordModalOpen(false);
    setPasswordForm({
      currentPassword: "",
      newPassword: "",
      confirmPassword: "",
    });
  };

  if (isProfileLoading) {
    return (
      <div className="min-h-screen bg-base-200 pt-20">
        <div className="mx-auto flex max-w-5xl items-center justify-center p-10">
          <Loader2 className="size-8 animate-spin text-primary" />
        </div>
      </div>
    );
  }

  if (!viewedUser) {
    return (
      <div className="min-h-screen bg-base-200 pt-20">
        <div className="mx-auto max-w-5xl p-6">
          <div className="rounded-2xl border border-base-300 bg-base-100 p-8 text-center">
            <p className="text-base-content/70">User not found.</p>
            <button className="btn btn-primary mt-4" onClick={() => navigate("/profile")}>
              Go To My Profile
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-base-200 pt-20">
      <div className="mx-auto w-full max-w-5xl p-4 pb-10 md:p-6">
        <div className="rounded-2xl border border-base-300 bg-base-100 shadow-lg">
          {/* Background Banner */}
          <div
            className={`relative h-36 md:h-40 ${
              viewedUser?.coverPic ? "bg-base-300" : "bg-gradient-to-r from-primary via-secondary to-primary/70"
            }`}
          >
            {viewedUser?.coverPic && (
              <>
                <img
                  src={viewedUser.coverPic}
                  alt="Cover"
                  className="absolute inset-0 h-full w-full object-cover"
                />
                <div className="absolute inset-0 bg-black/20" />
              </>
            )}
            <div className="absolute -bottom-12 left-1/2 -translate-x-1/2">
              {/* Avatar Section */}
              <div className="relative">
                <img
                  src={viewedUser?.profilePic || "/avatar.png"}
                  alt="Profile"
                  className="size-24 rounded-2xl border-4 border-base-100 object-cover shadow-lg md:size-28"
                />
              </div>
            </div>
          </div>

          {/* Profile Header & Edit Button */}
          <div className="relative px-4 pb-6 pt-14 text-center md:px-6 md:pt-16">
            {isOwnProfile && (
              <button
                onClick={openEditModal}
                className="btn btn-primary btn-sm absolute right-4 top-4 gap-2 shadow-sm transition-all hover:shadow-md"
                disabled={isUpdatingProfile}
              >
                <Edit2 className="w-4 h-4" />
                Edit Profile
              </button>
            )}

            <h1 className="text-2xl font-bold text-base-content md:text-3xl">{viewedUser?.fullName}</h1>
            
            {/* Username with Copy */}
            <div className="flex items-center justify-center gap-3 mt-2">
              <p className="text-lg text-primary font-medium md:text-xl">@{viewedUser?.username || "username"}</p>
              <button
                onClick={copyUsername}
                className="btn btn-ghost btn-circle btn-sm hover:bg-base-200 transition-all"
                title="Copy username"
              >
                {copied ? (
                  <span className="text-success text-xs font-medium">Copied!</span>
                ) : (
                  <Copy className="w-4 h-4" />
                )}
              </button>
            </div>

            <div className="mx-auto mt-4 grid w-full max-w-md grid-cols-2 overflow-hidden rounded-xl border border-base-300 bg-base-100">
              <button
                type="button"
                className="border-r border-base-300 px-3 py-2 text-center transition hover:bg-base-200/70"
                onClick={() => openConnectionsModal("followers")}
              >
                <p className="text-lg font-semibold">
                  {isStatsLoading ? "..." : connectionStats.followersCount}
                </p>
                <p className="text-xs text-base-content/60">Followers</p>
              </button>
              <button
                type="button"
                className="px-3 py-2 text-center transition hover:bg-base-200/70"
                onClick={() => openConnectionsModal("following")}
              >
                <p className="text-lg font-semibold">
                  {isStatsLoading ? "..." : connectionStats.followingCount}
                </p>
                <p className="text-xs text-base-content/60">Following</p>
              </button>
            </div>

            {/* Bio */}
            <div className="mx-auto mt-4 max-w-xl">
              <p className="text-base text-base-content/80 leading-relaxed">
                {viewedUser?.bio || "No bio yet."}
              </p>
            </div>
          </div>

          {/* Info Sections */}
          <div className="space-y-5 px-4 pb-6 md:px-6 md:pb-8">
            {/* Personal Information */}
            <div className="bg-base-200/80 rounded-xl p-5 md:p-6">
              <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <User className="w-5 h-5" />
                Personal Information
              </h2>

              <div className="space-y-4">
                {/* Full Name */}
                <div>
                  <div className="text-sm text-zinc-400 mb-1.5">Full Name</div>
                  <div className="px-4 py-3 bg-base-100 rounded-xl border border-base-300 text-base">
                    {viewedUser?.fullName}
                  </div>
                </div>

                {/* Username (already shown above but repeated here for clarity) */}
                <div>
                  <div className="text-sm text-zinc-400 mb-1.5">Username</div>
                  <div className="px-4 py-3 bg-base-100 rounded-xl border border-base-300 flex items-center justify-between text-base">
                    @{viewedUser?.username || "username"}
                    <button
                      onClick={copyUsername}
                      className="text-primary hover:text-primary-focus transition-colors"
                    >
                      {copied ? "Copied!" : "Copy"}
                    </button>
                  </div>
                </div>

                {/* Email */}
                <div>
                  <div className="text-sm text-zinc-400 mb-1.5 flex items-center justify-between">
                    <span>Email Address</span>
                    {isOwnProfile && (
                      <span className="text-primary text-xs cursor-pointer hover:underline" onClick={openEditModal}>
                        (change in Edit Profile)
                      </span>
                    )}
                  </div>
                  <div className="px-4 py-3 bg-base-100 rounded-xl border border-base-300 flex items-center gap-3 text-base">
                    <Mail className="w-5 h-5 text-zinc-400" />
                    {viewedUser?.email}
                  </div>
                </div>
              </div>
            </div>

            {/* Account & Security */}
            {isOwnProfile && (
              <div className="bg-base-200/80 rounded-xl p-5 md:p-6">
                <h2 className="text-lg font-semibold mb-4">Account &amp; Security</h2>

                <div className="space-y-4 text-sm">
                  <div className="flex justify-between items-center py-3 border-b border-base-300">
                    <span className="text-zinc-400">Member Since</span>
                    <span className="font-medium">{viewedUser?.createdAt?.split("T")[0] || "-"}</span>
                  </div>

                  <div className="flex justify-between items-center py-3 border-b border-base-300">
                    <span className="text-zinc-400">Account Status</span>
                    <span className="text-emerald-500 font-medium">Active</span>
                  </div>

                  <div className="flex justify-between items-center py-3">
                    <div className="flex items-center gap-2">
                      <Lock className="w-5 h-5 text-zinc-400" />
                      <span>Password</span>
                    </div>
                    <button
                      onClick={() => setIsPasswordModalOpen(true)}
                      className="btn btn-ghost btn-sm text-primary hover:bg-transparent hover:text-primary-focus"
                    >
                      Change Password
                    </button>
                  </div>
                </div>
              </div>
            )}
        </div>
      </div>
      </div>

      {isConnectionsModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="w-full max-w-md rounded-3xl bg-base-100 shadow-2xl">
            <div className="flex items-center justify-between border-b border-base-300 px-6 py-4">
              <h3 className="text-xl font-bold capitalize">{activeConnectionsType}</h3>
              <button
                type="button"
                onClick={() => setIsConnectionsModalOpen(false)}
                className="text-zinc-400 transition-colors hover:text-base-content"
              >
                <X className="size-5" />
              </button>
            </div>

            <div className="max-h-[60vh] overflow-y-auto p-4">
              {isConnectionsLoading ? (
                <p className="py-8 text-center text-sm text-base-content/60">Loading...</p>
              ) : connectionsList.length === 0 ? (
                <p className="py-8 text-center text-sm text-base-content/60">
                  No {activeConnectionsType} yet.
                </p>
              ) : (
                <div className="space-y-2">
                  {connectionsList.map((user) => (
                    <button
                      key={user._id}
                      type="button"
                      onClick={() => {
                        setIsConnectionsModalOpen(false);
                        navigate(`/profile/${user._id}`);
                      }}
                      className="flex w-full items-center gap-3 rounded-xl border border-base-300 bg-base-100 px-3 py-2 text-left transition hover:border-primary/30 hover:bg-base-200/60"
                    >
                      <img
                        src={user.profilePic || "/avatar.png"}
                        alt={user.fullName}
                        className="size-10 rounded-full object-cover"
                      />
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold">{user.fullName}</p>
                        <p className="truncate text-xs text-base-content/60">@{user.username}</p>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ====================== EDIT PROFILE MODAL ====================== */}
      <AnimatePresence>
        {isEditModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            {/* Backdrop */}
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsEditModalOpen(false)}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            />

            {/* Modal Content */}
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              transition={{ duration: 0.2, ease: "easeOut" }}
              className="bg-base-100 rounded-[2.5rem] w-full max-w-[400px] shadow-2xl relative overflow-hidden"
            >
              {/* Modal Header */}
              <div className="flex items-center justify-between border-b border-base-300 px-6 py-4">
                <h3 className="text-xl font-bold">Edit Profile</h3>
                <button
                  onClick={() => setIsEditModalOpen(false)}
                  className="text-zinc-400 hover:text-base-content transition-colors p-1"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              {/* Form Content - Matched to Cropper Padding */}
              <div className="p-6 space-y-4">
                <div className="flex items-center gap-3 rounded-2xl border border-base-300 bg-base-200/50 p-3">
                  <img
                    src={modalProfilePic}
                    alt="Profile preview"
                    className="size-14 rounded-xl object-cover border-2 border-base-100 shadow-sm"
                  />
                  <div className="flex-1 flex gap-2">
                    <label
                      htmlFor="edit-avatar-upload"
                      className={`btn btn-xs btn-outline rounded-lg transition-all hover:bg-primary hover:border-primary ${isUpdatingProfile ? "pointer-events-none opacity-60" : ""}`}
                    >
                      <Camera className="size-3" />
                      Upload
                    </label>
                    <input
                      id="edit-avatar-upload"
                      type="file"
                      className="hidden"
                      accept="image/*"
                      onChange={handleEditImageUpload}
                      disabled={isUpdatingProfile}
                    />

                    <button
                      type="button"
                      onClick={handleEditRemovePic}
                      disabled={!hasEditProfilePic || isUpdatingProfile}
                      className="btn btn-xs btn-error btn-outline rounded-lg"
                    >
                      <Trash2 className="size-3" />
                      Remove
                    </button>
                  </div>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="mb-1 block text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Full Name</label>
                    <input
                      type="text"
                      value={editForm.fullName}
                      onChange={(e) => setEditForm({ ...editForm, fullName: e.target.value })}
                      className="input input-bordered input-sm w-full focus:border-primary rounded-xl h-10"
                    />
                  </div>

                  <div>
                    <label className="mb-1 block text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Username</label>
                    <div className="relative">
                      <input
                        type="text"
                        value={editForm.username}
                        onChange={(e) => setEditForm({ ...editForm, username: e.target.value })}
                        className={`input input-bordered input-sm w-full focus:border-primary pl-8 rounded-xl h-10 ${
                          usernameStatus === 'taken' || usernameStatus === 'invalid' ? 'border-error' : 
                          usernameStatus === 'available' ? 'border-success' : ''
                        }`}
                      />
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400 text-sm">@</span>
                    </div>
                    {usernameStatus && (
                      <p className={`text-[10px] mt-1 font-bold leading-none ${
                        usernameStatus === 'taken' || usernameStatus === 'invalid' ? 'text-error' : 
                        usernameStatus === 'checking' ? 'text-zinc-400' : 'text-success'
                      }`}>
                        {usernameStatus === 'checking' && "Checking availability..."}
                        {usernameStatus === 'taken' && "Username is already taken"}
                        {usernameStatus === 'invalid' && "Invalid characters used"}
                        {usernameStatus === 'available' && "Username is available"}
                      </p>
                    )}
                  </div>

                  <div>
                    <label className="mb-1 block text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Bio / Status</label>
                    <textarea
                      value={editForm.bio}
                      onChange={(e) => setEditForm({ ...editForm, bio: e.target.value })}
                      className="textarea textarea-bordered textarea-sm w-full h-18 focus:border-primary resize-none rounded-xl"
                      placeholder="About you..."
                    />
                  </div>

                  <div>
                    <label className="mb-1 block text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Email Address</label>
                    <input
                      type="email"
                      value={editForm.email}
                      onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                      className={`input input-bordered input-sm w-full focus:border-primary rounded-xl h-10 ${
                        emailStatus === 'invalid' ? 'border-error' : 
                        emailStatus === 'valid' ? 'border-success' : ''
                      }`}
                    />
                    {emailStatus === 'invalid' && (
                      <p className="text-[10px] mt-1 font-bold text-error italic leading-none">
                        Please enter a valid email address
                      </p>
                    )}
                  </div>
                </div>
              </div>

              {/* Modal Footer - Matched to Cropper Style */}
              <div className="flex gap-4 px-6 py-5 border-t border-base-300 bg-base-100">
                <button
                  onClick={() => setIsEditModalOpen(false)}
                  className="flex-1 font-bold text-sm text-base-content/60 hover:text-base-content transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveProfile}
                  disabled={isUpdatingProfile || usernameStatus === 'taken' || usernameStatus === 'invalid' || emailStatus === 'invalid'}
                  className="btn btn-primary flex-[1.5] gap-2 rounded-2xl font-bold shadow-lg shadow-primary/20"
                >
                  {isUpdatingProfile ? "Saving..." : "Save Changes"}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ====================== CHANGE PASSWORD MODAL ====================== */}
      {isPasswordModalOpen && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-base-100 rounded-3xl w-full max-w-md shadow-2xl">
            <div className="flex items-center justify-between border-b border-base-300 px-8 py-6">
              <h3 className="text-2xl font-bold flex items-center gap-2">
                <Lock className="w-6 h-6" />
                Change Password
              </h3>
              <button
                onClick={() => setIsPasswordModalOpen(false)}
                className="text-zinc-400 hover:text-base-content"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="p-8 space-y-6">
              <div>
                <label className="block text-sm text-zinc-400 mb-2">Current Password</label>
                <input
                  type="password"
                  value={passwordForm.currentPassword}
                  onChange={(e) =>
                    setPasswordForm({ ...passwordForm, currentPassword: e.target.value })
                  }
                  className="input input-bordered w-full"
                  placeholder="••••••••"
                />
              </div>

              <div>
                <label className="block text-sm text-zinc-400 mb-2">New Password</label>
                <input
                  type="password"
                  value={passwordForm.newPassword}
                  onChange={(e) =>
                    setPasswordForm({ ...passwordForm, newPassword: e.target.value })
                  }
                  className="input input-bordered w-full"
                  placeholder="••••••••"
                />
                
                {/* Strength Meter */}
                {passwordForm.newPassword && (
                  <div className="mt-2">
                    <div className="flex gap-1 mb-1">
                      {[1, 2, 3, 4].map((level) => (
                        <div 
                          key={level} 
                          className={`h-1.5 flex-1 rounded-full transition-colors ${
                            passwordScore >= level 
                              ? passwordScore === 1 ? 'bg-error' : passwordScore === 2 ? 'bg-warning' : passwordScore === 3 ? 'bg-info' : 'bg-success'
                              : 'bg-base-300'
                          }`}
                        />
                      ))}
                    </div>
                    <p className={`text-xs text-right font-medium ${
                      passwordScore === 1 ? 'text-error' : passwordScore === 2 ? 'text-warning' : passwordScore === 3 ? 'text-info' : 'text-success'
                    }`}>
                      {passwordScore === 1 ? 'Weak' : passwordScore === 2 ? 'Fair' : passwordScore === 3 ? 'Good' : 'Strong'}
                    </p>
                  </div>
                )}
              </div>

              <div>
                <label className="block text-sm text-zinc-400 mb-2">Confirm New Password</label>
                <input
                  type="password"
                  value={passwordForm.confirmPassword}
                  onChange={(e) =>
                    setPasswordForm({ ...passwordForm, confirmPassword: e.target.value })
                  }
                  className="input input-bordered w-full"
                  placeholder="••••••••"
                />
              </div>
            </div>

            <div className="flex gap-3 px-8 py-6 border-t border-base-300">
              <button
                onClick={() => setIsPasswordModalOpen(false)}
                className="btn btn-ghost flex-1"
              >
                Cancel
              </button>
              <button
                onClick={handleChangePassword}
                className="btn btn-primary flex-1"
              >
                Update Password
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Image Cropper Modal */}
      <AnimatePresence>
        {imageToCrop && (
          <ImageCropper
            image={imageToCrop}
            onCrop={handleCropComplete}
            onCancel={handleCropCancel}
          />
        )}
      </AnimatePresence>
    </div>
  );
};

export default ProfilePage;
