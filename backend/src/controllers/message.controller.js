import User from "../models/user.model.js";
import Message from "../models/message.model.js";
import Call from "../models/call.model.js";
import Connection from "../models/connection.model.js";
import Group from "../models/group.model.js";
import cloudinary from "../lib/cloudinary.js";
import { getReceiverSocketId, io } from "../lib/socket.js";

const isBlockedBetween = async (userId, otherUserId) => {
  const [userBlocks, otherBlocks] = await Promise.all([
    User.exists({ _id: userId, blockedUsers: otherUserId }),
    User.exists({ _id: otherUserId, blockedUsers: userId }),
  ]);
  return Boolean(userBlocks || otherBlocks);
};

const getBlockSets = async (userId) => {
  const [self, blockedBy] = await Promise.all([
    User.findById(userId).select("blockedUsers"),
    User.find({ blockedUsers: userId }).select("_id"),
  ]);
  const blockedUsers = new Set((self?.blockedUsers || []).map((id) => id.toString()));
  const blockedByUsers = new Set(blockedBy.map((u) => u._id.toString()));
  return { blockedUsers, blockedByUsers };
};

const canShowLastSeen = (viewerId, user, isConnected = false) => {
  if (!user?._id || !viewerId) return false;
  if (user._id.toString() === viewerId.toString()) return true;
  const setting = user?.privacySettings?.lastSeen || "Everyone";
  if (setting === "Everyone") return true;
  if (setting === "Followers") return isConnected;
  return false;
};

const sanitizeUserForViewer = (userDoc, viewerId, options = {}) => {
  const user = userDoc.toObject ? userDoc.toObject() : { ...userDoc };
  const isConnected = Boolean(options.isConnected);
  if (!canShowLastSeen(viewerId, user, isConnected)) {
    user.lastSeenAt = null;
  }
  return user;
};

export const getUsersForSidebar = async (req, res) => {
  try {
    const loggedInUserId = req.user._id;
    const { blockedUsers, blockedByUsers } = await getBlockSets(loggedInUserId);
    
    // Find all accepted connections where the current user is either sender or receiver
    const connections = await Connection.find({
      $or: [{ senderId: loggedInUserId }, { receiverId: loggedInUserId }],
      status: "accepted"
    }).populate("senderId receiverId", "-password");

    // Extract the OTHER user from each connection
    const connectedUsersMap = new Map();
    connections.forEach(conn => {
      const otherUser = conn.senderId._id.toString() === loggedInUserId.toString() 
        ? conn.receiverId 
        : conn.senderId;
      connectedUsersMap.set(otherUser._id.toString(), otherUser);
    });

    const filteredUsers = Array.from(connectedUsersMap.values()).filter((user) => {
      const id = user?._id?.toString();
      if (!id) return false;
      if (blockedUsers.has(id) || blockedByUsers.has(id)) return false;
      return true;
    });

    if (filteredUsers.length === 0) {
      return res.status(200).json([]);
    }

    const otherUserIds = filteredUsers.map((user) => user._id);

    const lastMessages = await Message.aggregate([
      {
        $match: {
          deletedFor: { $nin: [loggedInUserId] },
          $or: [
            { senderId: loggedInUserId, receiverId: { $in: otherUserIds } },
            { senderId: { $in: otherUserIds }, receiverId: loggedInUserId },
          ],
        },
      },
      { $sort: { createdAt: -1 } },
      {
        $group: {
          _id: {
            $cond: [
              { $eq: ["$senderId", loggedInUserId] },
              "$receiverId",
              "$senderId",
            ],
          },
          lastMessage: { $first: "$text" },
          lastImage: { $first: "$image" },
          lastType: { $first: "$type" },
          lastMessageTime: { $first: "$createdAt" },
        },
      },
    ]);

    const unreadCounts = await Message.aggregate([
      {
        $match: {
          receiverId: loggedInUserId,
          senderId: { $in: otherUserIds },
          readAt: null,
          deletedFor: { $nin: [loggedInUserId] },
        },
      },
      {
        $group: {
          _id: "$senderId",
          count: { $sum: 1 },
        },
      },
    ]);

    const lastMessageMap = new Map();
    lastMessages.forEach((item) => {
      const lastMessageText =
        item.lastType === "call" ? (item.lastMessage || "📞 Call") :
        item.lastMessage && item.lastMessage.trim()
          ? item.lastMessage
          : item.lastImage
            ? "📷 Image"
            : item.lastType === "audio"
              ? "🎤 Voice message"
              : item.lastType === "file"
                ? "📎 File"
                : "";

      lastMessageMap.set(item._id.toString(), {
        lastMessage: lastMessageText,
        lastMessageTime: item.lastMessageTime,
      });
    });

    const unreadMap = new Map();
    unreadCounts.forEach((item) => {
      unreadMap.set(item._id.toString(), item.count);
    });

    const usersWithMeta = filteredUsers.map((user) => {
      const userId = user._id.toString();
      const meta = lastMessageMap.get(userId) || {};
      const safeUser = sanitizeUserForViewer(user, loggedInUserId, { isConnected: true });
      return {
        ...safeUser,
        lastMessage: meta.lastMessage || "",
        lastMessageTime: meta.lastMessageTime || null,
        unreadCount: unreadMap.get(userId) || 0,
      };
    });

    res.status(200).json(usersWithMeta);
  } catch (error) {
    console.error("Error in getUsersForSidebar: ", error.message);
    res.status(500).json({ error: "Internal server error" });
  }
};

export const searchUsers = async (req, res) => {
  try {
    let { q } = req.query;
    const loggedInUserId = req.user._id;
    const { blockedUsers, blockedByUsers } = await getBlockSets(loggedInUserId);

    if (!q || !q.trim()) {
      return res.status(200).json([]);
    }

    q = q.trim();
    if (q.startsWith("@")) {
      q = q.slice(1);
    }

    const escaped = q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const usernameRegex = new RegExp(`^${escaped}`, "i");
    const nameRegex = new RegExp(`\\b${escaped}`, "i");

    const users = await User.find({
      _id: { $ne: loggedInUserId },
      $or: [
        { username: { $regex: usernameRegex } },
        { fullName: { $regex: nameRegex } },
      ],
    }).select("-password");

    const sanitized = users
      .filter((user) => {
        const id = user?._id?.toString();
        if (!id) return false;
        if (blockedUsers.has(id) || blockedByUsers.has(id)) return false;
        return true;
      })
      .map((user) => sanitizeUserForViewer(user, loggedInUserId, { isConnected: false }));

    res.status(200).json(sanitized);
  } catch (error) {
    console.error("Error in searchUsers: ", error.message);
    res.status(500).json({ error: "Internal server error" });
  }
};

export const getMessages = async (req, res) => {
  try {
    const { id: userToChatId } = req.params;
    const myId = req.user._id;
    const messages = await Message.find({
      $or: [
        { senderId: myId, receiverId: userToChatId },
        { senderId: userToChatId, receiverId: myId },
      ],
      deletedFor: { $nin: [myId] },
    }).populate("callId");
    res.status(200).json(messages);
  } catch (error) {
    console.log("Error in getMessages controller: ", error.message);
    res.status(500).json({ error: "Internal server error" });
  }
};

export const sendMessage = async (req, res) => {
  try {
    const { text, image, audio, type, fileName, fileSize, content, replyTo } = req.body;
    const { id: receiverId } = req.params;
    const senderId = req.user._id;

    const blocked = await isBlockedBetween(senderId, receiverId);
    if (blocked) {
      return res.status(403).json({ error: "You cannot message this user" });
    }

    // Check if connection exists
    const connection = await Connection.findOne({
      $or: [
        { senderId, receiverId, status: "accepted" },
        { senderId: receiverId, receiverId: senderId, status: "accepted" }
      ]
    });

    if (!connection) {
      return res.status(403).json({ error: "You can only message accepted connections" });
    }

    const receiverSocketId = getReceiverSocketId(receiverId);
    
    let imageUrl;
    if (image) {
      const uploadResponse = await cloudinary.uploader.upload(image);
      imageUrl = uploadResponse.secure_url;
    }

    const msgType = type || (imageUrl ? "image" : audio ? "audio" : fileName ? "file" : "text");

    const newMessage = await Message.create({ 
      senderId, 
      receiverId, 
      text, 
      image: imageUrl,
      audio: audio || null,
      content: content || null,
      type: msgType,
      fileName: fileName || null,
      fileSize: fileSize ? String(fileSize) : null,
      replyTo: replyTo || null,
      status: receiverSocketId ? "delivered" : "sent"
    });

    if (receiverSocketId) {
      io.to(receiverSocketId).emit("newMessage", newMessage);
    }

    res.status(201).json(newMessage);

  } catch (error) {
    console.log("Error in sendMessage controller: ", error.message);
    res.status(500).json({ error: "Internal server error" });
  }
};

export const markMessagesAsRead = async (req, res) => {
  try {
    const { id: otherId } = req.params;
    const loggedInUserId = req.user._id;

    const isGroup = await Group.exists({ _id: otherId });

    if (isGroup) {
      // Find unread messages in the group that the user hasn't seen yet
      const unreadMessages = await Message.find({
        groupId: otherId,
        senderId: { $ne: loggedInUserId },
        seenBy: { $ne: loggedInUserId }
      });

      if (unreadMessages.length > 0) {
        const messageIds = unreadMessages.map(m => m._id);
        
        await Message.updateMany(
          { _id: { $in: messageIds } },
          { $addToSet: { seenBy: loggedInUserId } }
        );

        // Notify the group room about the read status
        io.to(otherId).emit("groupMessageRead", {
          groupId: otherId,
          userId: loggedInUserId,
          messageIds
        });
      }
    } else {
      // Existing 1-to-1 logic
      await Message.updateMany(
        {
          senderId: otherId,
          receiverId: loggedInUserId,
          readAt: null,
        },
        { $set: { readAt: new Date(), status: "read" } }
      );

      // Notify the sender that their messages have been read
      const senderSocketId = getReceiverSocketId(otherId.toString());
      if (senderSocketId) {
        io.to(senderSocketId).emit("messagesRead", { 
          readerId: loggedInUserId.toString() 
        });
      }
    }

    res.status(200).json({ success: true });
  } catch (error) {
    console.log("Error in markMessagesAsRead controller: ", error.message);
    res.status(500).json({ error: "Internal server error" });
  }
};

export const deleteMessage = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user._id;
    const scope = (req.query.scope || "all").toString().toLowerCase();

    const message = await Message.findById(id);
    if (!message) {
      return res.status(404).json({ error: "Message not found" });
    }

    const isParticipant =
      message.senderId.toString() === userId.toString() ||
      message.receiverId.toString() === userId.toString();

    if (!isParticipant) {
      return res.status(403).json({ error: "Unauthorized to delete this message" });
    }

    if (scope === "self" || scope === "me") {
      await Message.findByIdAndUpdate(
        id,
        { $addToSet: { deletedFor: userId } },
        { returnDocument: "after" }
      );
      return res.status(200).json({ success: true, message: "Message deleted for you", id, scope: "self" });
    }

    if (scope !== "all") {
      return res.status(400).json({ error: "Invalid delete scope" });
    }

    await Message.findByIdAndDelete(id);

    res.status(200).json({ success: true, message: "Message deleted for everyone", id, scope: "all" });
  } catch (error) {
    console.log("Error in deleteMessage controller: ", error.message);
    res.status(500).json({ error: "Internal server error" });
  }
};

export const clearAllMessages = async (req, res) => {
  try {
    const userId = req.user._id;
    await Message.updateMany(
      {
        $or: [{ senderId: userId }, { receiverId: userId }],
      },
      { $addToSet: { deletedFor: userId } }
    );
    res.status(200).json({ success: true, message: "Chat history cleared" });
  } catch (error) {
    console.log("Error in clearAllMessages controller: ", error.message);
    res.status(500).json({ error: "Internal server error" });
  }
};

export const clearChatWithUser = async (req, res) => {
  try {
    const myId = req.user._id;
    const { userId } = req.params;

    await Message.updateMany(
      {
        $or: [
          { senderId: myId, receiverId: userId },
          { senderId: userId, receiverId: myId },
        ],
      },
      { $addToSet: { deletedFor: myId } }
    );

    res.status(200).json({ success: true, message: "Chat cleared" });
  } catch (error) {
    console.log("Error in clearChatWithUser controller: ", error.message);
    res.status(500).json({ error: "Internal server error" });
  }
};

export const logCall = async (req, res) => {
  try {
    const { receiverId, callType, status, duration } = req.body;
    const senderId = req.user._id;

    if (!receiverId || !callType || !status) {
      return res.status(400).json({ error: "Missing required call logging fields" });
    }

    const newCall = await Call.create({
      callerId: senderId,
      receiverId,
      type: callType,
      status,
      duration: duration || 0,
    });

    const isVideo = callType === "video";
    let statusText = "Answered";
    if (status === "missed") statusText = "Missed";
    else if (status === "cancelled" || status === "canceled") statusText = "Canceled";
    
    const icon = isVideo ? "📹" : "📞";
    const callText = `${icon} ${statusText} ${callType} call`;

    let newMessage = await Message.create({
      senderId,
      receiverId,
      type: "call",
      callId: newCall._id,
      text: callText,
      status: getReceiverSocketId(receiverId) ? "delivered" : "sent"
    });

    // Populate call details to send back up to the frontend UI
    newMessage = await newMessage.populate("callId");

    const receiverSocketId = getReceiverSocketId(receiverId);
    if (receiverSocketId) {
      io.to(receiverSocketId).emit("newMessage", newMessage);
    }

    // Since the frontend might use this directly to inject into local state
    res.status(201).json(newMessage);
  } catch (error) {
    console.log("Error in logCall controller: ", error.message);
    res.status(500).json({ error: "Internal server error" });
  }
};

export const reactToMessage = async (req, res) => {
  try {
    const { id } = req.params;
    const { emoji } = req.body;
    const userId = req.user._id;

    if (!emoji) return res.status(400).json({ error: "Emoji is required" });

    const message = await Message.findById(id);
    if (!message) return res.status(404).json({ error: "Message not found" });

    const isParticipant = message.senderId.toString() === userId.toString() || 
                          message.receiverId.toString() === userId.toString();
    if (!isParticipant) {
      return res.status(403).json({ error: "Unauthorized to react to this message" });
    }

    const userReactionIndex = message.reactions.findIndex(
      (r) => r.userId.toString() === userId.toString()
    );

    if (userReactionIndex > -1) {
      if (message.reactions[userReactionIndex].emoji === emoji) {
        message.reactions.splice(userReactionIndex, 1);
      } else {
        message.reactions[userReactionIndex].emoji = emoji;
      }
    } else {
      message.reactions.push({ emoji, userId });
    }

    await message.save();

    const receiverId = message.senderId.toString() === userId.toString() ? message.receiverId : message.senderId;
    const receiverSocketId = getReceiverSocketId(receiverId.toString());
    
    if (receiverSocketId) {
      io.to(receiverSocketId).emit("messageReaction", { 
        messageId: id, 
        reactions: message.reactions 
      });
    }

    res.status(200).json({ success: true, reactions: message.reactions, messageId: id });
  } catch (error) {
    console.error("Error in reactToMessage controller: ", error.message);
    res.status(500).json({ error: "Internal server error" });
  }
};
