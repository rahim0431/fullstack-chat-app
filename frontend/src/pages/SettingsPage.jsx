import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import {
  Search,
  User,
  Shield,
  MessageSquare,
  Bell,
  Sparkles,
  Database,
  Users,
  HelpCircle,
  ChevronRight,
  ChevronDown,
  LogOut,
  Pencil,
  AtSign,
  PenLine,
  ShieldCheck,
  Laptop,
  Smartphone,
  Tablet,
  Check,
  X,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useAuthStore } from "../store/useAuthStore";
import { useThemeStore } from "../store/useThemeStore";
import { useChatStore } from "../store/useChatStore.jsx";
import { chatThemes, resolveTheme } from "../constants/chatThemes";
import { axiosInstance } from "../lib/axios";
import toast from "react-hot-toast";

const sidebarItems = [
  {
    id: "account",
    label: "Account",
    sub: "Profile, email, change password",
    icon: User,
    accent: "bg-amber-100 text-amber-600",
  },
  {
    id: "privacy",
    label: "Privacy",
    sub: "Blocked users, last seen, privacy",
    icon: Shield,
    accent: "bg-rose-100 text-rose-600",
  },
  {
    id: "chats",
    label: "Chats",
    sub: "Themes, wallpapers, chat history",
    icon: MessageSquare,
    accent: "bg-emerald-100 text-emerald-600",
  },
  {
    id: "notifications",
    label: "Notifications",
    sub: "Messages, groups, sounds",
    icon: Bell,
    accent: "bg-sky-100 text-sky-600",
  },
  {
    id: "ai",
    label: "AI Settings",
    sub: "Image style, prompt enhancer",
    icon: Sparkles,
    accent: "bg-teal-100 text-teal-600",
  },
  {
    id: "connected",
    label: "Connected Accounts",
    sub: "Friends, followers, manage connections",
    icon: Users,
    accent: "bg-indigo-100 text-indigo-600",
  },
  {
    id: "storage",
    label: "Data & Storage",
    sub: "Chat backup, clear history",
    icon: Database,
    accent: "bg-orange-100 text-orange-600",
  },
  {
    id: "help",
    label: "Help & Support",
    sub: "Help center, contact us, FAQ",
    icon: HelpCircle,
    accent: "bg-slate-100 text-slate-600",
  },
];

const contentCards = [
  ...sidebarItems,
];

const defaultPrivacySettings = {
  lastSeen: "Everyone",
  readReceipts: true,
  whoCanMessageMe: "Everyone",
};

const defaultChatSettings = {
  chatTheme: "System Default",
  enterKeySendsMessage: true,
  autoDownloadMedia: "Wi-Fi only",
  backupFrequency: "Weekly",
};

const defaultNotificationSettings = {
  messageNotifications: true,
  groupNotifications: true,
  notificationSound: "Default Chime",
  showMessagePreview: "Everyone",
};

const defaultConnectedAccountSettings = {
  whoCanFollowMe: "Everyone",
};

const defaultStorageSettings = {
  downloadMediaUsing: "Wi-Fi only",
  keepMediaOnDevice: "30 days",
  useLessDataForCalls: false,
};

const defaultHelpSupportSettings = {
  issueType: "General question",
  includeDiagnostics: true,
  lastDescription: "",
};

const defaultAISettings = {
  promptEnhancement: "Balanced",
  responseTone: "Friendly",
  safetyLevel: "Standard",
  autoSaveHistory: true,
};

const AnimatedSelect = ({ value, options, onChange, icon: Icon, placeholder = "Select" }) => {
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div ref={wrapperRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="flex w-full items-center gap-2 rounded-2xl border border-base-300 bg-base-100 px-3 py-2.5 text-left text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
      >
        {Icon && <Icon className="size-4 text-base-content/50" />}
        <span className="flex-1 truncate">{value || placeholder}</span>
        <ChevronDown className={`size-4 transition-transform ${open ? "rotate-180 text-primary" : "text-base-content/50"}`} />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -6, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.98 }}
            transition={{ type: "spring", damping: 22, stiffness: 260 }}
            className="absolute z-30 mt-2 w-full overflow-hidden rounded-2xl border border-base-300 bg-base-100 shadow-2xl"
          >
            {options.map((option) => {
              const isActive = option === value;
              return (
                <button
                  type="button"
                  key={option}
                  onClick={() => {
                    onChange(option);
                    setOpen(false);
                  }}
                  className={`flex w-full items-center justify-between px-3 py-2.5 text-sm transition-colors ${
                    isActive ? "bg-primary/10 text-primary" : "hover:bg-base-200"
                  }`}
                >
                  <span>{option}</span>
                  {isActive && <Check className="size-4" />}
                </button>
              );
            })}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

const formatLastUpdate = (value) => {
  if (!value) return "Unknown";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Unknown";

  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const diffDays = Math.round((startOfToday - startOfDate) / 86400000);

  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  if (diffDays > 1 && diffDays < 7) return `${diffDays} days ago`;
  return date.toLocaleDateString();
};

const SettingsPage = () => {
  const { authUser, logout, updateProfile, isUpdatingProfile, sessions, isSessionsLoading, getSessions, logoutOtherSessions } = useAuthStore();
  const { blockedUsers, isBlockedLoading, getBlockedUsers, unblockUser, clearAllChatHistory } = useChatStore();
  const { theme, setTheme } = useThemeStore();
  const navigate = useNavigate();
  const location = useLocation();
  const [activeId, setActiveId] = useState(location.state?.activeTab || "account");
  const [searchQuery, setSearchQuery] = useState("");
  const [accountForm, setAccountForm] = useState({
    username: "",
    email: "",
    bio: "",
  });
  const [privacyForm, setPrivacyForm] = useState(defaultPrivacySettings);
  const [chatForm, setChatForm] = useState(defaultChatSettings);
  const [notificationForm, setNotificationForm] = useState(defaultNotificationSettings);
  const [connectedAccountForm, setConnectedAccountForm] = useState(defaultConnectedAccountSettings);
  const [storageForm, setStorageForm] = useState(defaultStorageSettings);
  const [helpSupportForm, setHelpSupportForm] = useState(defaultHelpSupportSettings);
  const [aiForm, setAiForm] = useState(defaultAISettings);
  const [isBlockedModalOpen, setIsBlockedModalOpen] = useState(false);
  const [isFaqOpen, setIsFaqOpen] = useState(false);
  const [isSubmittingTicket, setIsSubmittingTicket] = useState(false);

  const displayName = authUser?.fullName || "Your Profile";
  const displayEmail = authUser?.email || "you@example.com";
  const displayStatus = authUser?.bio || "Hey there! I am using Chatty.";
  const activeMeta = contentCards.find((item) => item.id === activeId);
  const profileCompleteness = useMemo(() => {
    const fields = [
      authUser?.fullName,
      authUser?.username,
      authUser?.email,
      authUser?.bio,
      authUser?.profilePic,
    ];
    const filled = fields.filter((value) => typeof value === "string" ? value.trim().length > 0 : Boolean(value)).length;
    return Math.round((filled / fields.length) * 100);
  }, [authUser]);
  const visibilityLabel = useMemo(() => {
    if (privacyForm.lastSeen === "Nobody") return "Private";
    if (privacyForm.lastSeen === "Everyone" && privacyForm.whoCanMessageMe === "Everyone") return "Public";
    return "Limited";
  }, [privacyForm.lastSeen, privacyForm.whoCanMessageMe]);
  const lastUpdatedLabel = useMemo(
    () => formatLastUpdate(authUser?.updatedAt || authUser?.createdAt),
    [authUser?.updatedAt, authUser?.createdAt]
  );
  const filteredSidebarItems = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return sidebarItems;

    return sidebarItems.filter((item) =>
      `${item.label} ${item.sub}`.toLowerCase().includes(query)
    );
  }, [searchQuery]);

  useEffect(() => {
    if (filteredSidebarItems.length === 0) return;
    const hasActiveInResults = filteredSidebarItems.some((item) => item.id === activeId);
    if (!hasActiveInResults) {
      setActiveId(filteredSidebarItems[0].id);
    }
  }, [filteredSidebarItems, activeId]);

  useEffect(() => {
    if (activeId === "account") {
      getSessions();
    }
    if (activeId === "privacy") {
      getBlockedUsers();
    }
  }, [activeId, getSessions, getBlockedUsers]);

  useEffect(() => {
    if (!authUser) return;

    const storedTheme = localStorage.getItem("chat-theme");
    const nextChatSettings = { ...defaultChatSettings, ...(authUser.chatSettings || {}) };
    const resolvedStoredTheme = resolveTheme(storedTheme, "");
    const resolvedChatTheme = resolveTheme(nextChatSettings.chatTheme, "");
    const effectiveTheme = resolvedStoredTheme || resolvedChatTheme || resolveTheme("");
    nextChatSettings.chatTheme = effectiveTheme;
    setAccountForm({
      username: authUser.username || "",
      email: authUser.email || "",
      bio: authUser.bio || "",
    });
    setPrivacyForm({ ...defaultPrivacySettings, ...(authUser.privacySettings || {}) });
    setChatForm(nextChatSettings);
    setNotificationForm({ ...defaultNotificationSettings, ...(authUser.notificationSettings || {}) });
    setConnectedAccountForm({
      ...defaultConnectedAccountSettings,
      ...(authUser.connectedAccountSettings || {}),
    });
    setStorageForm({ ...defaultStorageSettings, ...(authUser.storageSettings || {}) });
    setHelpSupportForm({ ...defaultHelpSupportSettings, ...(authUser.helpSupportSettings || {}) });
    setAiForm({ ...defaultAISettings, ...(authUser.aiSettings || {}) });

    if (!resolvedStoredTheme && resolvedChatTheme) {
      setTheme(resolvedChatTheme);
    }
  }, [authUser, setTheme]);

  const saveSettings = async (payload) => {
    await updateProfile(payload);
  };

  const submitSupportTicket = async () => {
    const description = helpSupportForm.lastDescription.trim();
    if (!description) {
      toast.error("Please describe your issue before submitting.");
      return;
    }

    const diagnostics = helpSupportForm.includeDiagnostics
      ? {
          userAgent: navigator.userAgent,
          platform: navigator.platform,
          language: navigator.language,
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
          online: navigator.onLine,
          screen: `${window.screen.width}x${window.screen.height}`,
          window: `${window.innerWidth}x${window.innerHeight}`,
          connection: navigator.connection
            ? {
                effectiveType: navigator.connection.effectiveType,
                downlink: navigator.connection.downlink,
                rtt: navigator.connection.rtt,
                saveData: navigator.connection.saveData,
              }
            : null,
        }
      : null;

    setIsSubmittingTicket(true);
    try {
      await axiosInstance.post("/support/tickets", {
        issueType: helpSupportForm.issueType,
        description,
        includeDiagnostics: helpSupportForm.includeDiagnostics,
        diagnostics,
      });

      toast.success("Ticket submitted. We’ll get back to you.");
      setHelpSupportForm((prev) => ({ ...prev, lastDescription: "" }));
      await saveSettings({
        helpSupportSettings: {
          issueType: helpSupportForm.issueType,
          includeDiagnostics: helpSupportForm.includeDiagnostics,
          lastDescription: "",
        },
      });
    } catch (error) {
      toast.error(error?.response?.data?.message || "Failed to submit ticket");
    } finally {
      setIsSubmittingTicket(false);
    }
  };

  return (
    <div className="min-h-screen bg-base-200 pt-16 lg:pt-20">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-4 p-3 md:flex-row md:items-start md:gap-6 md:p-6">
        <aside className="w-full rounded-3xl border border-base-300 bg-base-100 shadow-sm md:w-80 lg:w-96">
            <div className="border-b border-base-300 p-4 md:p-5">
              <h2 className="text-3xl font-bold tracking-tight">Settings</h2>
              <div className="relative mt-3">
                <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-base-content/50" />
                <input
                  type="text"
                  placeholder="Search settings"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="input input-bordered w-full rounded-xl bg-base-100 pl-9"
                />
              </div>
            </div>

            <nav className="space-y-2 p-3 md:p-4">
              {filteredSidebarItems.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-base-300 px-3 py-6 text-center text-sm text-base-content/60">
                  No settings found.
                </div>
              ) : (
                filteredSidebarItems.map((item) => {
                const isActive = activeId === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setActiveId(item.id)}
                    className={`group flex w-full items-center gap-3 rounded-2xl border px-3 py-3 text-left transition-all duration-200 ${
                      isActive
                        ? "border-primary/25 bg-gradient-to-r from-primary/15 to-transparent shadow-sm"
                        : "border-base-300/70 bg-base-100 hover:-translate-y-0.5 hover:border-base-300 hover:bg-base-200/50"
                    }`}
                  >
                    <div className={`flex size-10 shrink-0 items-center justify-center rounded-xl ring-1 ring-black/5 ${item.accent}`}>
                      <item.icon className="size-5" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-base font-semibold">{item.label}</p>
                      <p className="truncate text-sm text-base-content/60">{item.sub}</p>
                    </div>
                    <ChevronRight className={`ml-auto size-4 transition ${isActive ? "text-primary" : "text-base-content/30 group-hover:text-base-content/70"}`} />
                  </button>
                );
                })
              )}
            </nav>

            <div className="border-t border-base-300 p-4 md:p-5">
              <button
                type="button"
                onClick={logout}
                className="flex w-full items-center gap-3 rounded-2xl border border-error/20 bg-error/5 px-3 py-3 text-left text-error transition hover:bg-error/10"
              >
                <span className="flex size-10 items-center justify-center rounded-xl bg-error/10">
                  <LogOut className="size-4" />
                </span>
                <span className="text-base font-semibold">Log out</span>
              </button>
            </div>
        </aside>

        <main className="min-w-0 flex-1">
          <div className="p-1 md:p-0">
            <section className="space-y-6">
              <div className="rounded-3xl border border-base-300 bg-base-100 p-5 shadow-sm md:p-6">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex items-center gap-4">
                    <div className="relative">
                      <img
                        src={authUser?.profilePic || "/avatar.png"}
                        alt="Profile"
                        className="size-16 rounded-full object-cover ring-2 ring-base-200"
                      />
                      <span className="absolute -bottom-1 -right-1 size-4 rounded-full border-2 border-base-100 bg-emerald-500" />
                    </div>
                    <div className="min-w-0">
                      <h3 className="truncate text-xl font-semibold">{displayName}</h3>
                      <p className="truncate text-sm text-base-content/60">{displayStatus}</p>
                      <p className="truncate text-xs text-base-content/50">{displayEmail}</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    className="btn rounded-full btn-primary btn-sm gap-2"
                    onClick={() => navigate("/profile")}
                  >
                    <Pencil className="size-4" />
                    Edit Profile
                  </button>
                </div>
              </div>

              <div className="rounded-3xl border border-base-300 bg-base-100 p-5 shadow-sm md:p-6">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-3">
                    {activeMeta?.icon && (
                      <span className={`flex size-10 items-center justify-center rounded-full ${activeMeta.accent}`}>
                        <activeMeta.icon className="size-5" />
                      </span>
                    )}
                    <div>
                      <h4 className="text-lg font-semibold">{activeMeta?.label || "Settings"}</h4>
                      <p className="text-sm text-base-content/60">{activeMeta?.sub}</p>
                    </div>
                  </div>
                  <span className="badge badge-outline">{activeMeta?.label || "Settings"}</span>
                </div>
                <div className="mt-4">
                  {activeId === "account" ? (
                    <div className="space-y-6">
                      <div className="grid gap-4 lg:grid-cols-[2fr_1fr]">
                        <div className="rounded-2xl border border-base-300 bg-gradient-to-br from-base-200/70 to-base-100 p-4 md:p-5">
                          <div className="grid gap-4 md:grid-cols-2">
                            <label className="flex flex-col gap-2">
                              <span className="text-sm font-semibold text-base-content/70">Username</span>
                              <div className="flex items-center gap-2 rounded-2xl border border-base-300 bg-base-100 px-3 py-2.5 focus-within:ring-2 focus-within:ring-primary/30">
                                <User className="size-4 text-base-content/50" />
                                <input
                                  name="username"
                                  type="text"
                                  value={accountForm.username}
                                  onChange={(e) => setAccountForm((prev) => ({ ...prev, username: e.target.value }))}
                                  className="w-full bg-transparent text-sm outline-none"
                                />
                              </div>
                            </label>

                            <label className="flex flex-col gap-2">
                              <span className="text-sm font-semibold text-base-content/70">Email</span>
                              <div className="flex items-center gap-2 rounded-2xl border border-base-300 bg-base-100 px-3 py-2.5 focus-within:ring-2 focus-within:ring-primary/30">
                                <AtSign className="size-4 text-base-content/50" />
                                <input
                                  name="email"
                                  type="email"
                                  value={accountForm.email}
                                  onChange={(e) => setAccountForm((prev) => ({ ...prev, email: e.target.value }))}
                                  className="w-full bg-transparent text-sm outline-none"
                                />
                              </div>
                            </label>
                          </div>

                          <label className="mt-4 flex flex-col gap-2">
                            <span className="text-sm font-semibold text-base-content/70">Bio</span>
                            <div className="flex items-start gap-2 rounded-2xl border border-base-300 bg-base-100 px-3 py-2.5 focus-within:ring-2 focus-within:ring-primary/30">
                              <PenLine className="mt-0.5 size-4 text-base-content/50" />
                              <textarea
                                name="bio"
                                rows={3}
                                value={accountForm.bio}
                                onChange={(e) => setAccountForm((prev) => ({ ...prev, bio: e.target.value }))}
                                className="w-full resize-none bg-transparent text-sm outline-none"
                              />
                            </div>
                          </label>

                          <div className="mt-4 flex flex-wrap items-center gap-3">
                            <button
                              type="button"
                              className="btn rounded-full btn-primary px-6"
                              onClick={() => saveSettings(accountForm)}
                              disabled={isUpdatingProfile}
                            >
                              {isUpdatingProfile ? "Updating..." : "Update Profile"}
                            </button>
                            <span className="text-xs text-base-content/50">Changes reflect instantly across your profile.</span>
                          </div>
                        </div>

                        <div className="rounded-2xl border border-base-300 bg-base-100 p-4 md:p-5">
                          <div className="flex items-center gap-2">
                            <span className="flex size-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
                              <ShieldCheck className="size-4" />
                            </span>
                            <div>
                              <p className="text-sm font-semibold">Account Health</p>
                              <p className="text-xs text-base-content/60">Keep your profile complete</p>
                            </div>
                          </div>
                          <div className="mt-4 space-y-3 text-sm">
                            <div className="flex items-center justify-between rounded-xl border border-base-300 bg-base-200/60 px-3 py-2">
                              <span className="text-base-content/70">Profile completeness</span>
                              <span className="font-semibold">{profileCompleteness}%</span>
                            </div>
                            <div className="flex items-center justify-between rounded-xl border border-base-300 bg-base-200/60 px-3 py-2">
                              <span className="text-base-content/70">Visibility</span>
                              <span className="font-semibold">{visibilityLabel}</span>
                            </div>
                            <div className="flex items-center justify-between rounded-xl border border-base-300 bg-base-200/60 px-3 py-2">
                              <span className="text-base-content/70">Last update</span>
                              <span className="font-semibold">{lastUpdatedLabel}</span>
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="rounded-2xl border border-base-300 bg-base-100 p-4 md:p-5">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div>
                            <h2 className="text-xl font-semibold">Active Sessions</h2>
                            <p className="text-sm text-base-content/60">View and manage the devices where you are currently logged in.</p>
                          </div>
                        </div>

                        {isSessionsLoading ? (
                          <p className="text-sm py-4">Loading sessions...</p>
                        ) : (
                          <div className="mt-4 grid gap-3">
                            {sessions.map((session, idx) => (
                              <div key={session._id || idx} className="flex gap-4 p-4 rounded-2xl border border-base-300 bg-base-200/60 hover:shadow-sm transition-shadow">
                                <div className="size-11 rounded-2xl bg-base-100 border border-base-300 flex items-center justify-center text-base-content/70">
                                  {session.deviceType === "Mobile" ? (
                                    <Smartphone className="size-5" />
                                  ) : session.deviceType === "Tablet" ? (
                                    <Tablet className="size-5" />
                                  ) : (
                                    <Laptop className="size-5" />
                                  )}
                                </div>
                                <div className="flex-1 min-w-0">
                                  <p className="font-semibold text-sm flex items-center gap-2">
                                    {session.browser} on {session.os}
                                    {idx === 0 && <span className="badge badge-primary badge-sm">This Device</span>}
                                  </p>
                                  <p className="text-xs text-base-content/60 mt-1">
                                    {session.ipAddress} {"\u2022"} Last active: {new Date(session.lastActive).toLocaleDateString()}
                                  </p>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}

                        {sessions.length > 1 && (
                          <button
                            type="button"
                            className="btn rounded-full btn-error btn-outline w-full mt-4"
                            onClick={() => {
                              if (window.confirm("Are you sure you want to log out of all other devices?")) {
                                logoutOtherSessions();
                              }
                            }}
                          >
                            Log out of all other devices
                          </button>
                        )}
                      </div>
                    </div>
                  ) : activeId === "privacy" ? (
                    <div className="space-y-6">
                      <div className="grid gap-4 lg:grid-cols-[2fr_1fr]">
                        <div className="rounded-2xl border border-base-300 bg-gradient-to-br from-base-200/70 to-base-100 p-4 md:p-5 space-y-4">
                          <label className="flex flex-col gap-2">
                            <div className="flex items-center justify-between">
                              <span className="text-sm font-semibold text-base-content/70">Last Seen</span>
                              <span className="text-xs text-base-content/50">Visibility</span>
                            </div>
                            <AnimatedSelect
                              value={privacyForm.lastSeen}
                              options={["Everyone", "Followers", "Nobody"]}
                              onChange={(value) => setPrivacyForm((prev) => ({ ...prev, lastSeen: value }))}
                              icon={Shield}
                              placeholder="Choose visibility"
                            />
                          </label>

                          <div className="rounded-2xl border border-base-300 bg-base-100 p-4">
                            <div className="flex items-start justify-between gap-4">
                              <div>
                                <p className="text-sm font-semibold">Read receipts</p>
                                <p className="text-xs text-base-content/60">Let others know when you read their messages.</p>
                              </div>
                              <input
                                type="checkbox"
                                checked={privacyForm.readReceipts}
                                onChange={(e) => setPrivacyForm((prev) => ({ ...prev, readReceipts: e.target.checked }))}
                                className="toggle toggle-primary"
                              />
                            </div>
                          </div>

                          <label className="flex flex-col gap-2">
                            <span className="text-sm font-semibold text-base-content/70">Who can message me</span>
                            <AnimatedSelect
                              value={privacyForm.whoCanMessageMe}
                              options={["Everyone", "Followers"]}
                              onChange={(value) => setPrivacyForm((prev) => ({ ...prev, whoCanMessageMe: value }))}
                              icon={MessageSquare}
                              placeholder="Choose who can message you"
                            />
                          </label>

                          <div className="flex flex-wrap items-center gap-3">
                            <button
                              type="button"
                              className="btn rounded-full btn-primary px-6"
                              onClick={() => saveSettings({ privacySettings: privacyForm })}
                              disabled={isUpdatingProfile}
                            >
                              {isUpdatingProfile ? "Saving..." : "Save Privacy"}
                            </button>
                            <span className="text-xs text-base-content/50">Changes apply to all future chats.</span>
                          </div>
                        </div>

                        <div className="rounded-2xl border border-base-300 bg-base-100 p-4 md:p-5">
                          <div className="flex items-center gap-2">
                            <span className="flex size-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
                              <ShieldCheck className="size-4" />
                            </span>
                            <div>
                              <p className="text-sm font-semibold">Privacy Snapshot</p>
                              <p className="text-xs text-base-content/60">Quick view of your settings</p>
                            </div>
                          </div>
                          <div className="mt-4 space-y-3 text-sm">
                            <div className="flex items-center justify-between rounded-xl border border-base-300 bg-base-200/60 px-3 py-2">
                              <span className="text-base-content/70">Last seen</span>
                              <span className="font-semibold">{privacyForm.lastSeen}</span>
                            </div>
                            <div className="flex items-center justify-between rounded-xl border border-base-300 bg-base-200/60 px-3 py-2">
                              <span className="text-base-content/70">Read receipts</span>
                              <span className="font-semibold">{privacyForm.readReceipts ? "On" : "Off"}</span>
                            </div>
                            <div className="flex items-center justify-between rounded-xl border border-base-300 bg-base-200/60 px-3 py-2">
                              <span className="text-base-content/70">Messages</span>
                              <span className="font-semibold">{privacyForm.whoCanMessageMe}</span>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Blocked Users */}
                      <div className="rounded-2xl border border-base-300 bg-base-100 p-4 md:p-5">
                        <div className="flex items-center justify-between gap-2 mb-4">
                          <div className="flex items-center gap-2">
                            <span className="flex size-9 items-center justify-center rounded-xl bg-error/10 text-error">
                              <ShieldCheck className="size-4" />
                            </span>
                            <div>
                              <p className="text-sm font-semibold">Blocked Users</p>
                              <p className="text-xs text-base-content/60">People you have blocked cannot message you</p>
                            </div>
                          </div>
                          <span className="badge badge-error badge-outline badge-sm">{blockedUsers.length}</span>
                        </div>
                        {isBlockedLoading ? (
                          <p className="text-sm text-base-content/50 py-2">Loading...</p>
                        ) : blockedUsers.length === 0 ? (
                          <p className="text-sm text-base-content/40 py-2 text-center">No blocked users</p>
                        ) : (
                          <ul className="space-y-2">
                            {blockedUsers.map((user) => (
                              <li key={user._id} className="flex items-center gap-3 rounded-xl border border-base-300 bg-base-200/50 px-3 py-2.5">
                                <img src={user.profilePic || "/avatar.png"} alt={user.fullName} className="size-9 rounded-full object-cover ring-2 ring-base-300 shrink-0" />
                                <div className="min-w-0 flex-1">
                                  <p className="text-sm font-semibold truncate">{user.fullName}</p>
                                  {user.username && <p className="text-xs text-base-content/50 truncate">@{user.username}</p>}
                                </div>
                                <button type="button" onClick={() => unblockUser(user._id)} className="btn btn-sm btn-outline btn-error shrink-0">Unblock</button>
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                    </div>
                  ) : activeId === "chats" ? (
                    <div className="space-y-4">
                      <label className="form-control w-full space-y-2">
                        <span className="label-text text-sm font-medium">Chat Theme</span>
                        <div className="grid max-h-[420px] gap-3 overflow-y-auto pr-1 sm:grid-cols-2 lg:grid-cols-3">
                          {chatThemes.map((themeName) => {
                            const isActive = theme === themeName;
                            return (
                              <button
                                key={themeName}
                                type="button"
                                data-theme={themeName}
                                onClick={() => {
                                  setTheme(themeName);
                                  setChatForm((prev) => ({ ...prev, chatTheme: themeName }));
                                }}
                                className={`group rounded-2xl border p-3 text-left shadow-sm transition-all ${
                                  isActive
                                    ? "border-primary/40 bg-base-100 ring-2 ring-primary/30"
                                    : "border-base-300 bg-base-100 hover:-translate-y-0.5 hover:border-base-300"
                                }`}
                              >
                                <div className="flex items-center justify-between gap-2">
                                  <span className="text-sm font-semibold capitalize">{themeName}</span>
                                  {isActive && <Check className="size-4 text-primary" />}
                                </div>
                                <div className="mt-3 flex items-center gap-2">
                                  <span className="h-2 w-6 rounded-full bg-primary" />
                                  <span className="h-2 w-4 rounded-full bg-secondary" />
                                  <span className="h-2 w-3 rounded-full bg-accent" />
                                </div>
                                <div className="mt-2 grid grid-cols-3 gap-1">
                                  <span className="h-6 rounded-lg bg-base-200" />
                                  <span className="h-6 rounded-lg bg-base-300" />
                                  <span className="h-6 rounded-lg bg-neutral" />
                                </div>
                              </button>
                            );
                          })}
                        </div>
                      </label>

                      <label className="form-control w-full space-y-2">
                        <span className="label-text text-sm font-medium">Enter key sends message</span>
                        <input
                          type="checkbox"
                          checked={chatForm.enterKeySendsMessage}
                          onChange={(e) => setChatForm((prev) => ({ ...prev, enterKeySendsMessage: e.target.checked }))}
                          className="toggle toggle-primary mt-2"
                        />
                      </label>

                      <label className="form-control w-full space-y-2">
                        <span className="label-text text-sm font-medium">Auto-download media</span>
                        <AnimatedSelect
                          value={chatForm.autoDownloadMedia}
                          options={["Wi-Fi and Mobile Data", "Wi-Fi only", "Never"]}
                          onChange={(value) => setChatForm((prev) => ({ ...prev, autoDownloadMedia: value }))}
                          icon={Database}
                          placeholder="Select download rule"
                        />
                      </label>

                      <label className="form-control w-full space-y-2">
                        <span className="label-text text-sm font-medium">Chat backup frequency</span>
                        <AnimatedSelect
                          value={chatForm.backupFrequency}
                          options={["Daily", "Weekly", "Monthly", "Never"]}
                          onChange={(value) => setChatForm((prev) => ({ ...prev, backupFrequency: value }))}
                          icon={Database}
                          placeholder="Select backup cadence"
                        />
                      </label>

                      <button
                        type="button"
                        className="btn rounded-full btn-primary"
                        onClick={() => saveSettings({ chatSettings: chatForm })}
                        disabled={isUpdatingProfile}
                      >
                        {isUpdatingProfile ? "Saving..." : "Save Chats"}
                      </button>
                    </div>
                  ) : activeId === "notifications" ? (
                    <div className="space-y-4">
                      <label className="form-control w-full space-y-2">
                        <span className="label-text text-sm font-medium">Message notifications</span>
                        <input
                          type="checkbox"
                          checked={notificationForm.messageNotifications}
                          onChange={(e) => setNotificationForm((prev) => ({ ...prev, messageNotifications: e.target.checked }))}
                          className="toggle toggle-primary mt-2"
                        />
                      </label>

                      <label className="form-control w-full space-y-2">
                        <span className="label-text text-sm font-medium">Group notifications</span>
                        <input
                          type="checkbox"
                          checked={notificationForm.groupNotifications}
                          onChange={(e) => setNotificationForm((prev) => ({ ...prev, groupNotifications: e.target.checked }))}
                          className="toggle toggle-primary mt-2"
                        />
                      </label>

                      <label className="form-control w-full space-y-2">
                        <span className="label-text text-sm font-medium">Notification sound</span>
                        <AnimatedSelect
                          value={notificationForm.notificationSound}
                          options={[
                            "Default Chime",
                            "Soft Bell",
                            "Pop Tone",
                            "Crystal Ping",
                            "Warm Pulse",
                            "Gentle Drop",
                            "Echo Spark",
                            "Silent",
                          ]}
                          onChange={(value) => setNotificationForm((prev) => ({ ...prev, notificationSound: value }))}
                          icon={Bell}
                          placeholder="Choose a sound"
                        />
                      </label>

                      <label className="form-control w-full space-y-2">
                        <span className="label-text text-sm font-medium">Show message preview</span>
                        <AnimatedSelect
                          value={notificationForm.showMessagePreview}
                          options={["Everyone", "Followers", "Nobody"]}
                          onChange={(value) => setNotificationForm((prev) => ({ ...prev, showMessagePreview: value }))}
                          icon={MessageSquare}
                          placeholder="Choose preview visibility"
                        />
                      </label>

                      <button
                        type="button"
                        className="btn rounded-full btn-primary"
                        onClick={() => saveSettings({ notificationSettings: notificationForm })}
                        disabled={isUpdatingProfile}
                      >
                        {isUpdatingProfile ? "Saving..." : "Save Notifications"}
                      </button>
                    </div>
                  ) : activeId === "connected" ? (
                    <div className="space-y-4">
                      <label className="form-control w-full space-y-2">
                        <span className="label-text text-sm font-medium">Who can follow me</span>
                        <AnimatedSelect
                          value={connectedAccountForm.whoCanFollowMe}
                          options={["Everyone", "Followers", "Nobody"]}
                          onChange={(value) => setConnectedAccountForm((prev) => ({ ...prev, whoCanFollowMe: value }))}
                          icon={Users}
                          placeholder="Select who can follow"
                        />
                      </label>

                      <div className="flex flex-wrap gap-3">
                        <button
                          type="button"
                          className="btn rounded-full btn-outline"
                          onClick={() => {
                            setIsBlockedModalOpen(true);
                            getBlockedUsers();
                          }}
                        >
                          Manage Blocked Accounts
                        </button>

                        <button
                          type="button"
                          className="btn rounded-full btn-primary"
                          onClick={() => saveSettings({ connectedAccountSettings: connectedAccountForm })}
                          disabled={isUpdatingProfile}
                        >
                          {isUpdatingProfile ? "Saving..." : "Save Connected Accounts"}
                        </button>
                      </div>
                    </div>
                  ) : activeId === "storage" ? (
                    <div className="space-y-4">
                      <label className="form-control w-full space-y-2">
                        <span className="label-text text-sm font-medium">Download media using</span>
                        <AnimatedSelect
                          value={storageForm.downloadMediaUsing}
                          options={["Wi-Fi and Mobile Data", "Wi-Fi only", "Never"]}
                          onChange={(value) => setStorageForm((prev) => ({ ...prev, downloadMediaUsing: value }))}
                          icon={Database}
                          placeholder="Choose data usage"
                        />
                      </label>

                      <label className="form-control w-full space-y-2">
                        <span className="label-text text-sm font-medium">Keep media on device</span>
                        <AnimatedSelect
                          value={storageForm.keepMediaOnDevice}
                          options={["7 days", "30 days", "1 year", "Forever"]}
                          onChange={(value) => setStorageForm((prev) => ({ ...prev, keepMediaOnDevice: value }))}
                          icon={Database}
                          placeholder="Select retention period"
                        />
                      </label>

                      <label className="form-control w-full space-y-2">
                        <span className="label-text text-sm font-medium">Use less data for calls</span>
                        <input
                          type="checkbox"
                          checked={storageForm.useLessDataForCalls}
                          onChange={(e) => setStorageForm((prev) => ({ ...prev, useLessDataForCalls: e.target.checked }))}
                          className="toggle toggle-primary mt-2"
                        />
                      </label>

                      <div className="flex flex-wrap gap-3">
                        <button
                          type="button"
                          className="btn rounded-full btn-error btn-outline"
                          onClick={() => {
                            if (window.confirm("Clear your entire chat history? This cannot be undone.")) {
                              clearAllChatHistory();
                            }
                          }}
                        >
                          Clear Chat History
                        </button>

                        <button
                          type="button"
                          className="btn rounded-full btn-primary"
                          onClick={() => saveSettings({ storageSettings: storageForm })}
                          disabled={isUpdatingProfile}
                        >
                          {isUpdatingProfile ? "Saving..." : "Save Storage"}
                        </button>
                      </div>
                    </div>
                  ) : activeId === "help" ? (
                    <div className="space-y-4">
                      <label className="form-control w-full space-y-2">
                        <span className="label-text text-sm font-medium">Issue type</span>
                        <AnimatedSelect
                          value={helpSupportForm.issueType}
                          options={["General question", "Account issue", "Privacy concern", "Bug report"]}
                          onChange={(value) => setHelpSupportForm((prev) => ({ ...prev, issueType: value }))}
                          icon={HelpCircle}
                          placeholder="Pick issue type"
                        />
                      </label>

                      <label className="form-control w-full space-y-2">
                        <span className="label-text text-sm font-medium">Describe your issue</span>
                        <textarea
                          className="textarea textarea-bordered min-h-28 w-full"
                          placeholder="Tell us what happened and we will help you out."
                          value={helpSupportForm.lastDescription}
                          onChange={(e) =>
                            setHelpSupportForm((prev) => ({ ...prev, lastDescription: e.target.value }))
                          }
                        />
                      </label>

                      <label className="form-control w-full space-y-2">
                        <span className="label-text text-sm font-medium">Include diagnostics</span>
                        <input
                          type="checkbox"
                          checked={helpSupportForm.includeDiagnostics}
                          onChange={(e) =>
                            setHelpSupportForm((prev) => ({ ...prev, includeDiagnostics: e.target.checked }))
                          }
                          className="toggle toggle-primary mt-2"
                        />
                      </label>

                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          className="btn rounded-full btn-primary"
                          onClick={submitSupportTicket}
                          disabled={isSubmittingTicket}
                        >
                          {isSubmittingTicket ? "Submitting..." : "Submit Ticket"}
                        </button>
                        <button
                          type="button"
                          className="btn rounded-full btn-outline"
                          onClick={() => setIsFaqOpen(true)}
                        >
                          Open FAQ Center
                        </button>
                      </div>
                    </div>
                  ) : activeId === "ai" ? (
                    <div className="space-y-4">
                      <label className="form-control w-full space-y-2">
                        <span className="label-text text-sm font-medium">Prompt enhancement</span>
                        <AnimatedSelect
                          value={aiForm.promptEnhancement}
                          options={["Minimal", "Balanced", "Creative"]}
                          onChange={(value) => setAiForm((prev) => ({ ...prev, promptEnhancement: value }))}
                          icon={Sparkles}
                          placeholder="Select enhancement"
                        />
                      </label>

                      <label className="form-control w-full space-y-2">
                        <span className="label-text text-sm font-medium">Response tone</span>
                        <AnimatedSelect
                          value={aiForm.responseTone}
                          options={["Friendly", "Professional", "Casual"]}
                          onChange={(value) => setAiForm((prev) => ({ ...prev, responseTone: value }))}
                          icon={Sparkles}
                          placeholder="Select tone"
                        />
                      </label>

                      <label className="form-control w-full space-y-2">
                        <span className="label-text text-sm font-medium">Safety level</span>
                        <AnimatedSelect
                          value={aiForm.safetyLevel}
                          options={["Strict", "Standard", "Creative"]}
                          onChange={(value) => setAiForm((prev) => ({ ...prev, safetyLevel: value }))}
                          icon={Shield}
                          placeholder="Select safety level"
                        />
                      </label>

                      <label className="form-control w-full space-y-2">
                        <span className="label-text text-sm font-medium">Auto-save AI history</span>
                        <input
                          type="checkbox"
                          checked={aiForm.autoSaveHistory}
                          onChange={(e) => setAiForm((prev) => ({ ...prev, autoSaveHistory: e.target.checked }))}
                          className="toggle toggle-primary mt-2"
                        />
                      </label>

                      <button
                        type="button"
                        className="btn rounded-full btn-primary"
                        onClick={() => saveSettings({ aiSettings: aiForm })}
                        disabled={isUpdatingProfile}
                      >
                        {isUpdatingProfile ? "Saving..." : "Save AI Settings"}
                      </button>
                    </div>
                  ) : (
                    <div className="text-sm text-base-content/60">
                      Select a section from the sidebar.
                    </div>
                  )}
                </div>
              </div>
            </section>
          </div>
        </main>
      </div>

      {isBlockedModalOpen && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-3xl border border-base-300 bg-base-100 p-5 shadow-2xl">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold">Blocked Accounts</h3>
                <p className="text-sm text-base-content/60">People you blocked can’t message or follow you.</p>
              </div>
              <button
                type="button"
                onClick={() => setIsBlockedModalOpen(false)}
                className="btn btn-ghost btn-sm btn-circle"
                aria-label="Close"
              >
                <X className="size-4" />
              </button>
            </div>

            <div className="mt-4 max-h-[320px] overflow-y-auto space-y-2">
              {isBlockedLoading ? (
                <div className="rounded-2xl border border-base-300 p-4 text-sm text-base-content/60">
                  Loading blocked users...
                </div>
              ) : blockedUsers.length === 0 ? (
                <div className="rounded-2xl border border-base-300 p-4 text-sm text-base-content/60">
                  You haven’t blocked anyone yet.
                </div>
              ) : (
                blockedUsers.map((user) => (
                  <div
                    key={user._id}
                    className="flex items-center justify-between rounded-2xl border border-base-300 bg-base-200/60 p-3"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <img
                        src={user.profilePic || "/avatar.png"}
                        alt={user.fullName}
                        className="size-10 rounded-full object-cover"
                      />
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold">{user.fullName}</p>
                        <p className="truncate text-xs text-base-content/60">@{user.username}</p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => unblockUser(user._id)}
                      className="btn btn-sm rounded-full btn-outline"
                    >
                      Unblock
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {isFaqOpen && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm">
          <div className="w-full max-w-2xl rounded-3xl border border-base-300 bg-base-100 p-5 shadow-2xl">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold">FAQ Center</h3>
                <p className="text-sm text-base-content/60">Quick answers for common questions.</p>
              </div>
              <button
                type="button"
                onClick={() => setIsFaqOpen(false)}
                className="btn btn-ghost btn-sm btn-circle"
                aria-label="Close"
              >
                <X className="size-4" />
              </button>
            </div>

            <div className="mt-4 space-y-3">
              {[
                {
                  q: "Why am I not receiving notifications?",
                  a: "Check Notification settings and make sure your browser allows notifications. Also ensure you're online.",
                },
                {
                  q: "How do I change my chat theme?",
                  a: "Go to Settings → Chats and pick a theme. It applies instantly.",
                },
                {
                  q: "What does auto-download media do?",
                  a: "It controls whether photos, videos, and audio load automatically.",
                },
                {
                  q: "How do I clear chat history?",
                  a: "Settings → Data & Storage → Clear Chat History.",
                },
              ].map((item) => (
                <div key={item.q} className="rounded-2xl border border-base-300 bg-base-200/60 p-4">
                  <p className="text-sm font-semibold">{item.q}</p>
                  <p className="mt-1 text-sm text-base-content/60">{item.a}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SettingsPage;
