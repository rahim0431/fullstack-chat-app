import { create } from "zustand";
import toast from "react-hot-toast";
import { axiosInstance } from "../lib/axios";
import { useAuthStore } from "./useAuthStore";
import { showCustomToast } from "../components/NotificationToast";
import { playNotificationSound } from "../lib/soundUtils";

const createId = () => `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
const getNextVoiceGender = (current) => (current === "male" ? "female" : "male");

const detectType = (message = {}) => {
  if (message.type) return message.type;
  if (message.image) return "image";
  if (message.video) return "video";
  if (message.audio) return "audio";
  if (message.code) return "code";
  if (message.fileName || message.content) return "file";
  return "text";
};

const getContent = (message, type) => {
  if (type === "image") return message.content ?? message.image ?? "";
  if (type === "video") return message.content ?? message.video ?? "";
  if (type === "audio") return message.content ?? message.audio ?? "";
  if (type === "code") return message.content ?? message.code ?? "";
  if (type === "file") return message.content ?? message.fileUrl ?? "";
  return message.content ?? message.text ?? "";
};

// Notification tracking
const processedToastIds = new Set();

const normalizeMessage = (rawMessage, authUserId) => {
  const type = detectType(rawMessage);
  let sender = "contact";

  // If senderId is an object (populated), it's a group message sender
  const senderId = typeof rawMessage.senderId === 'object' ? rawMessage.senderId?._id : rawMessage.senderId;

  if (senderId === authUserId) {
    sender = "user";
  } else if (typeof rawMessage.senderId === 'object') {
    sender = rawMessage.senderId; // Store populated user object
  }

  return {
    id: rawMessage.id || rawMessage._id || createId(),
    sender,
    senderInfo: typeof rawMessage.senderId === 'object' ? rawMessage.senderId : null,
    type,
    content: getContent(rawMessage, type),
    timestamp: rawMessage.timestamp || rawMessage.createdAt || new Date().toISOString(),
    senderId: senderId,
    receiverId: rawMessage.receiverId,
    groupId: rawMessage.groupId,
    status: rawMessage.status || "sent",
    deliveredTo: rawMessage.deliveredTo || [],
    seenBy: rawMessage.seenBy || [],
    fileName: rawMessage.fileName || null,
    fileSize: rawMessage.fileSize || null,
    replyTo: rawMessage.replyTo || null,
    clientId: rawMessage.clientId || rawMessage.id || null,
    callId: rawMessage.callId || null,
    isAIMessage: rawMessage.sender === "ai",
  };
};

export const useChatStore = create((set, get) => ({
  messages: [],
  aiMessages: [],
  users: [],
  blockedUsers: [],
  unreadCounts: {},
  pendingRequests: [],
  sentRequests: [],
  selectedUser: null,
  groups: [],
  selectedGroup: null,
  setSelectedUser: (selectedUser) => {
    const socket = useAuthStore.getState().socket;
    const prevUser = get().selectedUser;
    if (prevUser && socket) {
      socket.emit("leave-private", { userId: prevUser._id });
    }
    if (selectedUser && socket) {
      socket.emit("join-private", { userId: selectedUser._id });
    }
    set({ selectedUser, selectedGroup: null });
  },
  setSelectedGroup: (selectedGroup) => {
    const socket = useAuthStore.getState().socket;
    const prevGroup = get().selectedGroup;
    if (prevGroup && socket) {
      socket.emit("leave-group", { groupId: prevGroup._id });
    }
    if (selectedGroup && socket) {
      socket.emit("join-group", { groupId: selectedGroup._id });
    }
    set({ selectedGroup, selectedUser: null });
  },
  isUsersLoading: false,
  isGroupsLoading: false,
  isBlockedLoading: false,
  isRequestsLoading: false,
  isMessagesLoading: false,
  isUserTyping: false,
  isAIThinking: false,
  isAITyping: false,
  aiAbortController: null,
  lastVoiceGender: "female",
  pinnedUsers: [],
  archivedUsers: [],
  mutedUsers: [],
  replyMessage: null,
  forwardMessage: null,
  typingUsers: new Set(),
  groupTypingUsers: {}, // { groupId: Set([{userId, fullName}]) }

  setIsAITyping: (val) => set({ isAITyping: val }),

  setReplyMessage: (message) => set({ replyMessage: message }),
  setForwardMessage: (message) => set({ forwardMessage: message }),

  deleteMessage: async (messageId, scope = "all") => {
    try {
      await axiosInstance.delete(`/messages/${messageId}?scope=${encodeURIComponent(scope)}`);
      set((state) => ({
        messages: state.messages.filter((msg) => msg._id !== messageId && msg.id !== messageId),
      }));
    } catch (error) {
      console.error("Error deleting message:", error);
      throw error;
    }
  },

  getUnreadCount: (userId) => get().unreadCounts[userId] || 0,

  togglePinUser: (userId) => set((state) => {
    const isPinned = state.pinnedUsers.includes(userId);
    return {
      pinnedUsers: isPinned
        ? state.pinnedUsers.filter((id) => id !== userId)
        : [...state.pinnedUsers, userId],
    };
  }),

  toggleMuteUser: (userId) => set((state) => {
    const isMuted = state.mutedUsers.includes(userId);
    return {
      mutedUsers: isMuted
        ? state.mutedUsers.filter((id) => id !== userId)
        : [...state.mutedUsers, userId],
    };
  }),

  archiveUser: (userId) => set((state) => {
    const isArchived = state.archivedUsers.includes(userId);
    return {
      archivedUsers: isArchived
        ? state.archivedUsers.filter((id) => id !== userId)
        : [...state.archivedUsers, userId],
    };
  }),

  getUsers: async () => {
    set({ isUsersLoading: true });
    try {
      const res = await axiosInstance.get("/messages/users");
      const counts = {};
      (res.data || []).forEach((user) => {
        counts[user._id] = typeof user.unreadCount === "number" ? user.unreadCount : 0;
      });
      set({ users: res.data, unreadCounts: counts });
    } catch (error) {
      toast.error(error?.response?.data?.message || "Failed to load users");
    } finally {
      set({ isUsersLoading: false });
    }
  },

  getGroups: async () => {
    set({ isGroupsLoading: true });
    try {
      const res = await axiosInstance.get("/groups");
      set({ groups: res.data || [] });
    } catch (error) {
      toast.error(error?.response?.data?.message || "Failed to load groups");
    } finally {
      set({ isGroupsLoading: false });
    }
  },

  createGroup: async (data) => {
    try {
      const res = await axiosInstance.post("/groups", data);
      // The group will be added to the state via the 'newGroupCreated' socket listener
      // which is emitted by the server to all members (including the creator).
      toast.success("Group created successfully!");
      return res.data;
    } catch (error) {
      toast.error(error?.response?.data?.message || "Failed to create group");
      throw error;
    }
  },

  getBlockedUsers: async () => {
    set({ isBlockedLoading: true });
    try {
      const res = await axiosInstance.get("/connections/blocked");
      set({ blockedUsers: res.data || [] });
    } catch (error) {
      toast.error(error?.response?.data?.message || "Failed to load blocked users");
    } finally {
      set({ isBlockedLoading: false });
    }
  },

  blockUser: async (userId) => {
    try {
      await axiosInstance.post(`/connections/block/${userId}`);
      toast.success("User blocked");
      set((state) => ({
        users: state.users.filter((user) => user._id !== userId),
        selectedUser: state.selectedUser?._id === userId ? null : state.selectedUser,
      }));
      get().getBlockedUsers();
    } catch (error) {
      toast.error(error?.response?.data?.message || "Failed to block user");
    }
  },

  unblockUser: async (userId) => {
    try {
      await axiosInstance.delete(`/connections/block/${userId}`);
      toast.success("User unblocked");
      set((state) => ({
        blockedUsers: state.blockedUsers.filter((user) => user._id !== userId),
      }));
    } catch (error) {
      toast.error(error?.response?.data?.message || "Failed to unblock user");
    }
  },

  sendConnectionRequest: async (userId) => {
    try {
      await axiosInstance.post(`/connections/request/${userId}`);
      toast.success("Follow request sent!");
      get().getSentRequests();
      return true;
    } catch (error) {
      toast.error(error?.response?.data?.message || "Failed to send request");
      return false;
    }
  },

  getSentRequests: async () => {
    try {
      const res = await axiosInstance.get("/connections/requests/sent");
      set({ sentRequests: res.data });
    } catch (error) {
      console.log("Error loading sent requests", error);
    }
  },

  cancelConnectionRequest: async (receiverId) => {
    try {
      await axiosInstance.delete(`/connections/request/cancel/${receiverId}`);
      set((state) => ({
        sentRequests: state.sentRequests.filter(req => req.receiverId._id !== receiverId)
      }));
      toast.success("Request withdrawn");
    } catch (error) {
      toast.error("Failed to withdraw request");
    }
  },

  getPendingRequests: async () => {
    set({ isRequestsLoading: true });
    try {
      const res = await axiosInstance.get("/connections/requests/pending");
      set({ pendingRequests: res.data });
    } catch (error) {
      console.log("Error loading requests", error);
    } finally {
      set({ isRequestsLoading: false });
    }
  },

  acceptRequest: async (requestId) => {
    try {
      await axiosInstance.put(`/connections/accept/${requestId}`);
      set((state) => ({
        pendingRequests: state.pendingRequests.filter((req) => req._id !== requestId),
      }));
      // Refresh user list since a new connection was made
      get().getUsers();
      toast.success("Request accepted");
    } catch (error) {
      toast.error("Failed to accept request");
    }
  },

  rejectRequest: async (requestId) => {
    try {
      await axiosInstance.put(`/connections/reject/${requestId}`);
      set((state) => ({
        pendingRequests: state.pendingRequests.filter((req) => req._id !== requestId),
      }));
      toast.success("Request rejected");
    } catch (error) {
      toast.error("Failed to reject request");
    }
  },

  removeConnection: async (userId) => {
    try {
      await axiosInstance.delete(`/connections/remove/${userId}`);
      get().getUsers(); // Refresh the sidebar user list
      toast.success("Contact removed");
    } catch (error) {
      toast.error("Failed to remove contact");
    }
  },

  clearAllChatHistory: async () => {
    try {
      await axiosInstance.delete("/messages/clear/all");
      set({ messages: [], unreadCounts: {} });
      get().getUsers();
      toast.success("Chat history cleared");
    } catch (error) {
      toast.error(error?.response?.data?.message || "Failed to clear chat history");
    }
  },

  clearChatWithUser: async (userId) => {
    try {
      await axiosInstance.delete(`/messages/clear/${userId}`);
      set({ messages: [] });
      set((state) => ({
        users: state.users.map((u) =>
          u._id === userId ? { ...u, lastMessage: "", lastMessageTime: null } : u
        ),
      }));
      toast.success("Chat cleared");
    } catch (error) {
      toast.error(error?.response?.data?.message || "Failed to clear chat");
    }
  },

  getMessages: async (userId) => {
    set({ isMessagesLoading: true });
    try {
      const authUserId = useAuthStore.getState().authUser?._id;
      const res = await axiosInstance.get(`/messages/${userId}`);
      const normalized = (res.data || []).map((message) => normalizeMessage(message, authUserId));
      set({ messages: normalized });
    } catch (error) {
      toast.error(error?.response?.data?.message || "Failed to load messages");
    } finally {
      set({ isMessagesLoading: false });
    }
  },

  getGroupMessages: async (groupId) => {
    set({ isMessagesLoading: true });
    try {
      const authUserId = useAuthStore.getState().authUser?._id;
      const res = await axiosInstance.get(`/groups/messages/${groupId}`);
      const normalized = (res.data || []).map((message) => normalizeMessage(message, authUserId));
      set({ messages: normalized });
    } catch (error) {
      toast.error(error?.response?.data?.message || "Failed to load group messages");
    } finally {
      set({ isMessagesLoading: false });
    }
  },

  updateGroupSettings: async (groupId, settings) => {
    try {
      const res = await axiosInstance.put(`/groups/settings/${groupId}`, { settings });
      set((state) => ({
        groups: state.groups.map((g) => (g._id === groupId ? res.data : g)),
        selectedGroup: state.selectedGroup?._id === groupId ? res.data : state.selectedGroup,
      }));
      toast.success("Group settings updated");
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to update settings");
    }
  },

  leaveGroup: async (groupId) => {
    try {
      await axiosInstance.post(`/groups/leave/${groupId}`);
      set((state) => ({
        groups: state.groups.filter((g) => g._id !== groupId),
        selectedGroup: state.selectedGroup?._id === groupId ? null : state.selectedGroup,
      }));
      toast.success("Left group successfully");
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to leave group");
    }
  },

  removeGroupMember: async (groupId, memberId) => {
    try {
      const res = await axiosInstance.post(`/groups/remove/${groupId}`, { memberId });
      set((state) => ({
        groups: state.groups.map((g) => (g._id === groupId ? res.data : g)),
        selectedGroup: state.selectedGroup?._id === groupId ? res.data : state.selectedGroup,
      }));
      toast.success("Member removed");
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to remove member");
    }
  },

  addGroupMembers: async (groupId, userIds) => {
    try {
      const res = await axiosInstance.put(`/groups/add/${groupId}`, { userIds });
      set((state) => ({
        groups: state.groups.map((g) => (g._id === groupId ? res.data : g)),
        selectedGroup: state.selectedGroup?._id === groupId ? res.data : state.selectedGroup,
      }));
      toast.success("Participants added successfully");
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to add participants");
      throw error;
    }
  },

  makeGroupAdmin: async (groupId, memberId) => {
    try {
      const res = await axiosInstance.post(`/groups/make-admin/${groupId}`, { memberId });
      set((state) => ({
        groups: state.groups.map((g) => (g._id === groupId ? res.data : g)),
        selectedGroup: state.selectedGroup?._id === groupId ? res.data : state.selectedGroup,
      }));
      toast.success("Admin ownership transferred");
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to assign admin");
    }
  },

  updateGroup: async (groupId, data) => {
    try {
      const res = await axiosInstance.put(`/groups/update/${groupId}`, data);
      set((state) => ({
        groups: state.groups.map((g) => (g._id === groupId ? res.data : g)),
        selectedGroup: state.selectedGroup?._id === groupId ? res.data : state.selectedGroup,
      }));
      toast.success("Group updated");
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to update group");
    }
  },

  toggleMuteGroup: async (groupId) => {
    try {
      const res = await axiosInstance.put(`/groups/mute/${groupId}`);
      const isMuted = res.data.isMuted;
      
      // Update the authUser state in useAuthStore for global consistency
      const { authUser, setAuthUser } = useAuthStore.getState();
      if (authUser) {
        let newMutedGroups = authUser.mutedGroups || [];
        if (isMuted) {
          newMutedGroups = [...new Set([...newMutedGroups, groupId])];
        } else {
          newMutedGroups = newMutedGroups.filter(id => id.toString() !== groupId.toString());
        }
        setAuthUser({ ...authUser, mutedGroups: newMutedGroups });
      }

      toast.success(isMuted ? "Group muted" : "Group unmuted");
    } catch (error) {
      toast.error("Failed to toggle mute");
    }
  },

  clearGroupChat: () => {
    set({ messages: [] });
    toast.success("Chat cleared locally");
  },

  markMessagesAsRead: async (id) => {
    try {
      await axiosInstance.put(`/messages/read/${id}`);
      set((state) => ({
        unreadCounts: { ...state.unreadCounts, [id]: 0 },
      }));
    } catch (error) {
      console.log("Failed to mark messages as read", error);
    }
  },

  logCall: async (receiverId, callType, status, duration) => {
    try {
      const res = await axiosInstance.post("/messages/log-call", { receiverId, callType, status, duration });
      const authUserId = useAuthStore.getState().authUser?._id;
      const normalized = normalizeMessage(res.data, authUserId);
      const { selectedUser, messages } = get();
      if (selectedUser && selectedUser._id === receiverId) {
        set({ messages: [...messages, normalized] });
      }

      set((state) => ({
        users: state.users.map((user) => 
          user._id === receiverId 
            ? { ...user, lastMessage: normalized.content || "📞 Call", lastMessageTime: normalized.timestamp }
            : user
        )
      }));
    } catch (error) {
      console.log("Error logging call:", error);
    }
  },

  sendMessage: async ({ type = "text", content = "", fileName = null, fileSize = null, replyTo = null }) => {
    const { selectedUser, replyMessage } = get();
    const authUser = useAuthStore.getState().authUser;
    if (!authUser) return;

    const normalizedContent = type === "text" && typeof content === "string" ? content.trim() : content;
    if (!normalizedContent && type !== "file" && type !== "audio") return;

    if (!selectedUser?._id) return;

    const resolvedReplyId = (typeof replyTo === "string" ? replyTo : replyTo?._id || replyTo?.id) || replyMessage?._id || replyMessage?.id || null;

    const optimisticMessage = {
      id: createId(),
      sender: "user",
      type,
      content: normalizedContent || "",
      timestamp: new Date().toISOString(),
      fileName: fileName || null,
      fileSize: fileSize || null,
      replyTo: resolvedReplyId,
    };

    set((state) => ({
      messages: [...state.messages, { ...optimisticMessage, clientId: optimisticMessage.id }],
    }));

    try {
      let payload;
      if (type === "image") {
        payload = { image: normalizedContent, text: "", type, replyTo: resolvedReplyId };
      } else if (type === "audio") {
        payload = { audio: normalizedContent, text: "", type, replyTo: resolvedReplyId };
      } else if (type === "file") {
        payload = { content: normalizedContent, text: "", type, fileName, fileSize, replyTo: resolvedReplyId };
      } else {
        payload = { text: normalizedContent, image: null, type, replyTo: resolvedReplyId };
      }

      const res = await axiosInstance.post(`/messages/send/${selectedUser._id}`, payload);
      const normalized = normalizeMessage(res.data, authUser._id);

      set((state) => ({
        messages: state.messages.map((message) => (message.id === optimisticMessage.id ? { ...normalized, clientId: message.id } : message)),
      }));

      const previewText = normalized.type === "image" ? "📷 Image" 
                        : normalized.type === "file" ? `📎 ${fileName || "File"}` 
                        : normalized.type === "audio" ? "🎤 Voice message" 
                        : normalized.type === "call" ? (normalized.content || "📞 Call")
                        : normalized.content || "";
      set((state) => ({
        users: state.users.map((user) =>
          user._id === selectedUser._id
            ? {
                ...user,
                lastMessage: previewText,
                lastMessageTime: normalized.timestamp,
              }
            : user
        ),
      }));
    } catch (error) {
      set((state) => ({
        messages: state.messages.filter((message) => message.id !== optimisticMessage.id),
      }));
      toast.error(error?.response?.data?.message || "Failed to send message");
    }
  },

  sendGroupMessage: async ({ type = "text", content = "", fileName = null, fileSize = null, replyTo = null }) => {
    const { selectedGroup, replyMessage } = get();
    const authUser = useAuthStore.getState().authUser;
    if (!authUser || !selectedGroup) return;

    const normalizedContent = type === "text" && typeof content === "string" ? content.trim() : content;
    if (!normalizedContent && type !== "file" && type !== "audio") return;

    const resolvedReplyId = (typeof replyTo === "string" ? replyTo : replyTo?._id || replyTo?.id) || replyMessage?._id || replyMessage?.id || null;

    const optimisticMessage = {
      id: createId(),
      sender: "user",
      senderId: authUser._id,
      type,
      content: normalizedContent || "",
      timestamp: new Date().toISOString(),
      fileName,
      fileSize,
      replyTo: resolvedReplyId,
      groupId: selectedGroup._id,
    };

    set((state) => ({
      messages: [...state.messages, { ...optimisticMessage, clientId: optimisticMessage.id }],
    }));

    try {
      let payload;
      if (type === "image") {
        payload = { image: normalizedContent, text: "", type, replyTo: resolvedReplyId };
      } else if (type === "audio") {
        payload = { audio: normalizedContent, text: "", type, replyTo: resolvedReplyId };
      } else if (type === "file") {
        payload = { content: normalizedContent, text: "", type, fileName, fileSize, replyTo: resolvedReplyId };
      } else {
        payload = { text: normalizedContent, type, replyTo: resolvedReplyId };
      }

      const res = await axiosInstance.post(`/groups/send/${selectedGroup._id}`, payload);
      const normalized = normalizeMessage(res.data, authUser._id);

      set((state) => ({
        messages: state.messages.map((m) => (m.id === optimisticMessage.id ? { ...normalized, clientId: m.id } : m)),
        groups: state.groups.map((g) => 
          g._id === selectedGroup._id 
            ? { 
                ...g, 
                lastMessage: { 
                  text: normalized.content || (normalized.type === "image" ? "Photo" : "Message"), 
                  senderId: { fullName: "You", _id: authUser._id } 
                }, 
                updatedAt: new Date().toISOString() 
              } 
            : g
        ),
      }));
    } catch (error) {
      set((state) => ({
        messages: state.messages.filter((m) => m.id !== optimisticMessage.id),
      }));
      toast.error(error?.response?.data?.message || "Failed to send group message");
    }
  },

  reactToMessage: async (messageId, emoji) => {
    try {
      const res = await axiosInstance.post(`/messages/react/${messageId}`, { emoji });
      set((state) => ({
        messages: state.messages.map((m) => 
          m._id === messageId || m.id === messageId ? { ...m, reactions: res.data.reactions } : m
        )
      }));
    } catch (error) {
      console.log("Failed to react to message:", error);
    }
  },

  reactToAIMessage: async (messageId, emoji) => {
    try {
      const res = await axiosInstance.post(`/ai/history/react/${messageId}`, { emoji });
      set((state) => ({
        aiMessages: state.aiMessages.map((m) => 
          m._id === messageId || m.id === messageId ? { ...m, reactions: res.data.reactions } : m
        )
      }));
    } catch (error) {
      console.log("Failed to react to AI message:", error);
    }
  },

  subscribeToMessages: () => {
    const socket = useAuthStore.getState().socket;
    if (!socket) return;

    // Preventive cleanup to avoid duplicate listeners
    socket.off("newMessage");
    socket.off("messagesDelivered");
    socket.off("messagesRead");
    socket.off("messageReaction");
    socket.off("newGroupMessage");
    socket.off("newGroupCreated");
    socket.off("addedToGroup");
    socket.off("removedFromGroup");

    socket.on("newMessage", (newMessage) => {
      const authUserId = useAuthStore.getState().authUser?._id;
      const authUser = useAuthStore.getState().authUser;
      const notificationSettings = authUser?.notificationSettings || {};
      const shouldNotify = notificationSettings.messageNotifications !== false;
      const previewSetting = notificationSettings.showMessagePreview || "Everyone";
      const soundSetting = notificationSettings.notificationSound || "Default Chime";
      const normalized = normalizeMessage(newMessage, authUserId);
      const previewText = normalized.type === "image" ? "📷 Image"
                        : normalized.type === "file" ? "📎 File"
                        : normalized.type === "audio" ? "🎤 Voice message"
                        : normalized.type === "call" ? (normalized.content || "📞 Call")
                        : normalized.content || "";

      set((state) => ({
        users: state.users.map((user) =>
          user._id === normalized.senderId
            ? {
                ...user,
                lastMessage: previewText,
                lastMessageTime: normalized.timestamp,
              }
            : user
        ),
      }));

      const currentSelected = get().selectedUser;
      if (currentSelected && normalized.senderId === currentSelected._id) {
        set((state) => {
          if (state.messages.some((message) => message.id === normalized.id)) return state;
          return { messages: [...state.messages, normalized] };
        });

        set((state) => ({
          unreadCounts: { ...state.unreadCounts, [normalized.senderId]: 0 },
        }));
        get().markMessagesAsRead(normalized.senderId);
      } else if (get().selectedGroup && normalized.groupId === get().selectedGroup?._id) {
          // If we are in the group, mark as read
          get().markMessagesAsRead(get().selectedGroup?._id);
      } else {
        set((state) => ({
          unreadCounts: {
            ...state.unreadCounts,
            [normalized.senderId]: (state.unreadCounts[normalized.senderId] || 0) + 1,
          },
        }));

          if (shouldNotify && !processedToastIds.has(normalized.id)) {
            processedToastIds.add(normalized.id);
            const sender =
              get().users.find((u) => u._id === normalized.senderId) ||
              (currentSelected && currentSelected._id === normalized.senderId ? currentSelected : null);
            const senderName = sender?.fullName || "New message";
            const body =
              previewSetting === "Nobody"
                ? "You received a new message"
                : normalized.type === "image"
                  ? "Sent a photo"
                  : normalized.type === "audio"
                    ? "Sent a voice message"
                    : normalized.type === "file"
                      ? `Sent a file${normalized.fileName ? `: ${normalized.fileName}` : ""}`
                    : normalized.type === "call"
                      ? "Missed your call"
                      : previewText || "Sent a message";

            showCustomToast({
              sender,
              senderName,
              body,
              onClick: () => get().setSelectedUser(sender),
            });

            playNotificationSound(soundSetting);
            
            // Cleanup old IDs
            if (processedToastIds.size > 50) {
              const firstId = processedToastIds.values().next().value;
              processedToastIds.delete(firstId);
            }
          }
        }
      });

    socket.on("newGroupMessage", (newMessage) => {
      const authUserId = useAuthStore.getState().authUser?._id;
      const normalized = normalizeMessage(newMessage, authUserId);
      const currentSelectedGroup = get().selectedGroup;

      if (currentSelectedGroup && newMessage.groupId === currentSelectedGroup._id) {
        // Automatically mark as delivered and read if we are in the group
        const socket = useAuthStore.getState().socket;
        if (socket && normalized.senderId !== authUserId) {
            socket.emit("group-message-delivered", {
                groupId: newMessage.groupId,
                messageIds: [newMessage._id]
            });
            // Also trigger the API to mark as read
            get().markMessagesAsRead(newMessage.groupId);
        }

        set((state) => {
          const isDuplicate = state.messages.some((m) => 
            m.id === normalized.id || 
            (normalized.senderId === authUserId && m.content === normalized.content && (String(m.id).includes('-') || !m._id))
          );
          if (isDuplicate) return state;
          return { messages: [...state.messages, normalized] };
        });
      } else {
        // Handle unread counts for groups if needed
        // For now just show toast if it's not the current group
        if (normalized.senderId !== authUserId && !processedToastIds.has(normalized.id)) {
          processedToastIds.add(normalized.id);
          const group = get().groups.find(g => g._id === newMessage.groupId);
          const senderName = normalized.senderInfo?.fullName || "Someone";
          const groupName = group?.name || "Group";
          
          showCustomToast({
            sender: group,
            senderName,
            groupName,
            body: normalized.content || "Sent a message",
            onClick: () => get().setSelectedGroup(group),
          });

          playNotificationSound();

          // Cleanup old IDs
          if (processedToastIds.size > 50) {
            const firstId = processedToastIds.values().next().value;
            processedToastIds.delete(firstId);
          }
        }
      }

      set((state) => ({
        groups: state.groups.map((g) => 
          g._id === newMessage.groupId 
            ? { 
                ...g, 
                lastMessage: { 
                  text: normalized.content || (normalized.type === "image" ? "Photo" : "Message"), 
                  senderId: { fullName: normalized.senderId === authUserId ? "You" : (normalized.senderInfo?.fullName || "Someone") }
                }, 
                updatedAt: normalized.timestamp || new Date().toISOString() 
              } 
            : g
        ),
      }));
    });

    socket.on("messagesRead", ({ readerId }) => {
      const authUser = useAuthStore.getState().authUser;
      if (!authUser) return;
      set((state) => ({
        messages: state.messages.map((m) =>
          m.senderId === authUser._id && m.receiverId === readerId && (!m.readAt || m.status !== "read")
            ? { ...m, status: "read", readAt: new Date() }
            : m
        ),
      }));
    });

    socket.on("groupMessageRead", ({ groupId, userId, messageIds }) => {
      set((state) => ({
        messages: state.messages.map((m) =>
          (m.groupId === groupId && (messageIds.includes(m._id) || messageIds.includes(m.id)))
            ? { ...m, seenBy: [...new Set([...(m.seenBy || []), userId])] }
            : m
        ),
      }));
    });

    socket.on("groupMessageDelivered", ({ groupId, userId, messageIds }) => {
      set((state) => ({
        messages: state.messages.map((m) =>
          (m.groupId === groupId && (messageIds.includes(m._id) || messageIds.includes(m.id)))
            ? { ...m, deliveredTo: [...new Set([...(m.deliveredTo || []), userId])] }
            : m
        ),
      }));
    });

    socket.on("newGroupCreated", (newGroup) => {
      set((state) => {
        if (state.groups.some((g) => g._id === newGroup._id)) return state;
        return { groups: [newGroup, ...state.groups] };
      });
      const authUser = useAuthStore.getState().authUser;
      if (newGroup.admin !== authUser?._id && newGroup.admin?._id !== authUser?._id) {
        toast(`You were added to a new group: ${newGroup.name}`);
      }
    });

    socket.on("addedToGroup", (group) => {
      set((state) => {
        const exists = state.groups.find(g => g._id === group._id);
        if (exists) return state;
        return { groups: [group, ...state.groups] };
      });
      toast(`You were added to ${group.name}`);
    });

    socket.on("groupUpdated", (updatedGroup) => {
      set((state) => ({
        groups: state.groups.map((g) => (g._id === updatedGroup._id ? updatedGroup : g)),
        selectedGroup: state.selectedGroup?._id === updatedGroup._id ? updatedGroup : state.selectedGroup,
      }));
    });

    socket.on("removedFromGroup", ({ groupId }) => {
        set((state) => ({
            groups: state.groups.filter(g => g._id !== groupId),
            selectedGroup: state.selectedGroup?._id === groupId ? null : state.selectedGroup
        }));
        toast("You were removed from a group");
    });

    // Recipient came online → upgrade all 'sent' messages we sent them to 'delivered'
    socket.on("messagesDelivered", ({ receiverId }) => {
      set((state) => ({
        messages: state.messages.map((m) =>
          m.senderId === useAuthStore.getState().authUser?._id &&
          m.receiverId === receiverId &&
          m.status === "sent"
            ? { ...m, status: "delivered" }
            : m
        ),
      }));
    });

    // Recipient read our messages → flip to 'read'
    socket.on("messagesRead", ({ readerId }) => {
      set((state) => ({
        messages: state.messages.map((m) =>
          m.senderId === useAuthStore.getState().authUser?._id &&
          m.receiverId === readerId &&
          m.status !== "read"
            ? { ...m, status: "read" }
            : m
        ),
      }));
    });

    socket.on("messageReaction", ({ messageId, reactions }) => {
      set((state) => ({
        messages: state.messages.map((m) =>
          m._id === messageId || m.id === messageId ? { ...m, reactions } : m
        )
      }));
    });
  },

  unsubscribeFromMessages: () => {
    const socket = useAuthStore.getState().socket;
    if (!socket) return;
    socket.off("newMessage");
    socket.off("messagesDelivered");
    socket.off("messagesRead");
    socket.off("messageReaction");
    socket.off("newGroupMessage");
    socket.off("newGroupCreated");
    socket.off("addedToGroup");
    socket.off("removedFromGroup");
    socket.off("groupUpdated");
  },

  subscribeToTyping: () => {
    const socket = useAuthStore.getState().socket;
    if (!socket) return;

    socket.on("userTyping", ({ userId }) => {
      const authUser = useAuthStore.getState().authUser;
      if (authUser && userId === authUser._id) return;

      const selectedUser = get().selectedUser;
      if (selectedUser && userId === selectedUser._id) {
        set({ isUserTyping: true });
      }
      // Also track globally for sidebar
      set((state) => {
        const next = new Set(state.typingUsers);
        next.add(userId);
        return { typingUsers: next };
      });
    });

    socket.on("userStoppedTyping", ({ userId }) => {
      const selectedUser = get().selectedUser;
      if (selectedUser && userId === selectedUser._id) {
        set({ isUserTyping: false });
      }
      // Remove from global tracking
      set((state) => {
        const next = new Set(state.typingUsers);
        next.delete(userId);
        return { typingUsers: next };
      });
    });

    socket.on("user-group-typing", ({ groupId, userId, fullName, profilePic }) => {
      const authUser = useAuthStore.getState().authUser;
      if (authUser && userId === authUser._id) return;

      set((state) => {
        const groupTypers = new Set(state.groupTypingUsers[groupId] || []);
        // Check if user already in set (by mapping to a string or finding)
        const exists = Array.from(groupTypers).some(u => u.userId === userId);
        if (exists) return state;
        
        groupTypers.add({ userId, fullName, profilePic: profilePic || "/avatar.png" });
        return {
          groupTypingUsers: {
            ...state.groupTypingUsers,
            [groupId]: Array.from(groupTypers)
          }
        };
      });
    });

    socket.on("user-group-stopped-typing", ({ groupId, userId }) => {
      set((state) => {
        const groupTypers = new Set(state.groupTypingUsers[groupId] || []);
        const filtered = Array.from(groupTypers).filter(u => u.userId !== userId);
        return {
          groupTypingUsers: {
            ...state.groupTypingUsers,
            [groupId]: filtered
          }
        };
      });
    });
  },

  unsubscribeFromTyping: () => {
    const socket = useAuthStore.getState().socket;
    if (!socket) return;
    socket.off("userTyping");
    socket.off("userStoppedTyping");
    socket.off("user-group-typing");
    socket.off("user-group-stopped-typing");
  },

  emitTyping: () => {
    const { selectedUser } = get();
    if (!selectedUser) return;

    const socket = useAuthStore.getState().socket;
    if (!socket) return;
    socket.emit("typing", { receiverId: selectedUser._id });
  },

  emitStopTyping: () => {
    const { selectedUser } = get();
    if (!selectedUser) return;

    const socket = useAuthStore.getState().socket;
    if (!socket) return;
    socket.emit("stopTyping", { receiverId: selectedUser._id });
  },

  emitGroupTyping: (groupId) => {
    const socket = useAuthStore.getState().socket;
    const authUser = useAuthStore.getState().authUser;
    if (!socket || !authUser) return;
    socket.emit("group-typing", { groupId, fullName: authUser.fullName, profilePic: authUser.profilePic });
  },

  emitGroupStopTyping: (groupId) => {
    const socket = useAuthStore.getState().socket;
    if (!socket) return;
    socket.emit("group-stop-typing", { groupId });
  },
  subscribeToLastSeen: () => {
    const socket = useAuthStore.getState().socket;
    if (!socket) return;

    socket.on("userLastSeen", ({ userId, lastSeenAt }) => {
      const currentSelected = get().selectedUser;
      if (currentSelected?._id === userId) {
        set({ selectedUser: { ...currentSelected, lastSeenAt } });
      }
      set((state) => ({
        users: state.users.map((user) =>
          user._id === userId ? { ...user, lastSeenAt } : user
        ),
      }));
    });
  },

  unsubscribeFromLastSeen: () => {
    const socket = useAuthStore.getState().socket;
    if (!socket) return;
    socket.off("userLastSeen");
  },

  stopAIGeneration: () => {
    const { aiAbortController } = get();
    if (aiAbortController) {
      aiAbortController.abort();
    }
    set({ aiAbortController: null, isAIThinking: false, isAITyping: false });
    if (typeof window !== "undefined") {
      window.dispatchEvent(new Event("stop-ai-typing"));
    }
  },

  sendAIMessage: async (content, mode = "TEXT", style = "realistic", imageData = null) => {
    const { aiMessages } = get();
    const trimmed = typeof content === "string" ? content.trim() : "";
    const normalizedMode = mode.toString().toUpperCase();

    const controller = new AbortController();

    const userMessage = {
      id: createId(),
      sender: "user",
      type: imageData ? "image" : "text",
      content: trimmed,
      timestamp: new Date().toISOString(),
    };

    set({ aiMessages: [...aiMessages, userMessage], isAIThinking: true, aiAbortController: controller });

    try {
      if (["IMAGE", "VIDEO", "AUDIO"].includes(normalizedMode)) {
        const res = await axiosInstance.post("/ai/chat", { 
          prompt: trimmed,
          mode: normalizedMode,
          style
        }, { signal: controller.signal });
        const isAudio = normalizedMode === "AUDIO";
        const nextVoiceGender = isAudio ? getNextVoiceGender(get().lastVoiceGender) : null;
        const aiMessage = {
          id: createId(),
          sender: "ai",
          type: res.data?.type || normalizedMode.toLowerCase(),
          content: res.data?.attachment || "",
          caption: res.data?.response || "",
          voiceGender: isAudio ? nextVoiceGender : null,
          timestamp: new Date().toISOString(),
        };
        set((state) => ({
          aiMessages: [...state.aiMessages, aiMessage],
          isAIThinking: false,
          aiAbortController: null,
          ...(isAudio ? { lastVoiceGender: nextVoiceGender } : {}),
        }));
        return;
      }

      const res = await axiosInstance.post("/ai/chat", { 
        prompt: trimmed, 
        mode, // pass actual mode
        style,
        imageData
      }, { signal: controller.signal });
      console.log("AI API response:", res.data);
      const aiMessage = {
        id: createId(),
        sender: "ai",
        type: mode === "AUDIO" ? "audio" : "text",
        content: res.data?.reply || res.data?.response || res.data?.message || "",     
        timestamp: new Date().toISOString(),
        isNew: true,
      };
      set((state) => ({
        aiMessages: [...state.aiMessages, aiMessage],
        isAIThinking: false,
        aiAbortController: null,
      }));
    } catch (error) {
      if (error?.name === "CanceledError" || error?.code === "ERR_CANCELED") {
        console.log("AI generation was cancelled");
        return; // do nothing because stopAIGeneration handles state
      }
      toast.error(error?.response?.data?.error || "Failed to get AI response");
      set({ isAIThinking: false, aiAbortController: null });
    }
  },

  getAIHistory: async () => {
    try {
      const authUser = useAuthStore.getState().authUser;
      if (authUser?.aiSettings?.autoSaveHistory === false) {
        set({ aiMessages: [] });
        return;
      }
      const res = await axiosInstance.get("/ai/history?all=true");

      let nextVoiceGender = get().lastVoiceGender;
      const history = res.data.map((msg) => {
        const isAudioAI = msg.type === "audio" && msg.sender === "ai";
        if (isAudioAI) {
          nextVoiceGender = getNextVoiceGender(nextVoiceGender);
        }

        return {
          id: msg._id,
          ...msg,
          timestamp: msg.createdAt || msg.timestamp,
          voiceGender: isAudioAI ? nextVoiceGender : null,
        };
      });
      set({ aiMessages: history, lastVoiceGender: nextVoiceGender });
    } catch (error) {
      console.error("Failed to load AI history", error);
    }
  },

  clearAIHistory: async () => {
    try {
      await axiosInstance.delete("/ai/history/clear");
      set({ aiMessages: [] });
      toast.success("AI Chat history cleared");
    } catch (error) {
      toast.error(error.response?.data?.error || "Failed to clear AI history");
    }
  },

  startNewAIChat: () => {
    set({ aiMessages: [] });
  },

  deleteAIMessage: async (messageId) => {
    try {
      const isMongoId = /^[a-f0-9]{24}$/i.test(messageId);
      if (isMongoId) {
        await axiosInstance.delete(`/ai/history/${messageId}`);
      }
      set((state) => ({
        aiMessages: state.aiMessages.filter((m) => m.id !== messageId && m._id !== messageId),
      }));
      toast.success("Message deleted");
    } catch (error) {
      toast.error(error?.response?.data?.error || "Failed to delete message");
      throw error;
    }
  },

  setReplyMessage: (message) => set({ replyMessage: message }),
  clearReplyMessage: () => set({ replyMessage: null }),
  clearForwardMessage: () => set({ forwardMessage: null }),

  deleteMessage: async (messageId, scope = "all") => {
    try {
      await axiosInstance.delete(`/messages/${messageId}?scope=${encodeURIComponent(scope)}`);
      set((state) => ({
        messages: state.messages.filter((m) => m.id !== messageId && m._id !== messageId),
      }));
      const message =
        scope === "self"
          ? "Message deleted for you"
          : "Message deleted for everyone";
      toast.success(message);
    } catch (error) {
      toast.error(error?.response?.data?.error || "Failed to delete message");
      throw error;
    }
  },

  sendForwardMessage: async (message, targetUserId) => {
    try {
      const payload = {
        text: message.content || "",
        type: message.type,
        fileName: message.fileName,
        fileSize: message.fileSize,
      };
      
      if (message.type === "image") {
        payload.image = message.content;
      } else if (message.type === "audio") {
        payload.audio = message.content;
      } else if (message.type === "file") {
        payload.content = message.content;
      }

      await axiosInstance.post(`/messages/send/${targetUserId}`, payload);
      toast.success("Message forwarded!");
      set({ forwardMessage: null });
    } catch (error) {
      toast.error(error?.response?.data?.error || "Failed to forward message");
      throw error;
    }
  },
}));
