import { Server } from "socket.io";
import http from "http";
import express from "express";
import User from "../models/user.model.js";
import Message from "../models/message.model.js";
import Connection from "../models/connection.model.js";
import Group from "../models/group.model.js";

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: ["http://localhost:5173"],
  },
});

export function getReceiverSocketId(userId) {
  return userSocketMap[userId];
}

const userSocketMap = {}; // {userId: socketId}

io.on("connection", async (socket) => {
  console.log("A user connected", socket.id);

  const userId = socket.handshake.query.userId;
  if (userId) {
    userSocketMap[userId] = socket.id;

    // Join rooms for all groups the user is in
    try {
      const userGroups = await Group.find({ members: userId });
      userGroups.forEach((group) => {
        socket.join(group._id.toString());
        console.log(`User ${userId} joined group room: ${group._id}`);
      });
    } catch (error) {
      console.error("Error joining group rooms:", error.message);
    }
  }

  // io.emit() is used to send events to all the connected clients
  io.emit("getOnlineUsers", Object.keys(userSocketMap));

  // Promote all 'sent' messages addressed to this user to 'delivered'
  if (userId) {
    try {
      const updated = await Message.updateMany(
        { receiverId: userId, status: "sent" },
        { $set: { status: "delivered" } }
      );
      if (updated.modifiedCount > 0) {
        // Notify senders whose messages were just delivered
        const delivered = await Message.find(
          { receiverId: userId, status: "delivered" },
          { senderId: 1, _id: 1 }
        );
        const senderIds = [...new Set(delivered.map((m) => m.senderId.toString()))];
        senderIds.forEach((senderId) => {
          const senderSocketId = getReceiverSocketId(senderId);
          if (senderSocketId) {
            io.to(senderSocketId).emit("messagesDelivered", { receiverId: userId });
          }
        });
      }
    } catch (err) {
      console.error("Error promoting messages to delivered:", err.message);
    }
  }

  socket.on("disconnect", async () => {
    console.log("A user disconnected", socket.id);
    delete userSocketMap[userId];
    io.emit("getOnlineUsers", Object.keys(userSocketMap));

    // Save lastSeenAt timestamp for this user
    if (userId) {
      try {
        const now = new Date();
        const updatedUser = await User.findByIdAndUpdate(
          userId,
          { lastSeenAt: now },
          { returnDocument: "after", select: "privacySettings blockedUsers" }
        );

        const lastSeenSetting = updatedUser?.privacySettings?.lastSeen || "Everyone";
        if (lastSeenSetting === "Nobody") return;

        const payload = { userId, lastSeenAt: now.toISOString() };

        if (lastSeenSetting === "Everyone") {
          io.emit("userLastSeen", payload);
          return;
        }

        const connections = await Connection.find({
          status: "accepted",
          $or: [{ senderId: userId }, { receiverId: userId }],
        }).select("senderId receiverId");

        const connectedIds = connections.map((conn) =>
          conn.senderId.toString() === userId.toString()
            ? conn.receiverId.toString()
            : conn.senderId.toString()
        );

        const blockedUsers = new Set((updatedUser?.blockedUsers || []).map((id) => id.toString()));
        const blockedBy = await User.find({ blockedUsers: userId, _id: { $in: connectedIds } }).select("_id");
        const blockedBySet = new Set(blockedBy.map((u) => u._id.toString()));

        connectedIds
          .filter((connectedId) => !blockedUsers.has(connectedId) && !blockedBySet.has(connectedId))
          .forEach((connectedId) => {
          const socketId = getReceiverSocketId(connectedId);
          if (socketId) {
            io.to(socketId).emit("userLastSeen", payload);
          }
        });
      } catch (err) {
        console.error("Error saving lastSeenAt:", err.message);
      }
    }
  });

  // Typing indicator events
  socket.on("typing", ({ receiverId }) => {
    const receiverSocketId = getReceiverSocketId(receiverId);
    if (receiverSocketId) {
      io.to(receiverSocketId).emit("userTyping", { userId });
    }
  });

  socket.on("stopTyping", ({ receiverId }) => {
    const receiverSocketId = getReceiverSocketId(receiverId);
    if (receiverSocketId) {
      io.to(receiverSocketId).emit("userStoppedTyping", { userId });
    }
  });

  // WebRTC signaling events
  socket.on("call-user", (data) => {
    const receiverSocketId = getReceiverSocketId(data.receiverId);
    if (receiverSocketId) {
      io.to(receiverSocketId).emit("call-made", {
        ...data,
        callerId: userId,
      });
    }
  });

  socket.on("answer-call", (data) => {
    const callerSocketId = getReceiverSocketId(data.callerId);
    if (callerSocketId) {
      io.to(callerSocketId).emit("call-answered", data);
    }
  });

  socket.on("call-received", (data) => {
    const callerSocketId = getReceiverSocketId(data.callerId);
    if (callerSocketId) {
      io.to(callerSocketId).emit("call-received");
    }
  });

  socket.on("decline-call", (data) => {
    const callerSocketId = getReceiverSocketId(data.callerId);
    if(callerSocketId) {
      io.to(callerSocketId).emit("call-declined");
    }
  })

  socket.on("call-ended", (data) => {
    const receiverSocketId = getReceiverSocketId(data.receiverId);
    if (receiverSocketId) {
      io.to(receiverSocketId).emit("call-ended");
    }
  });

  // Group events
  socket.on("join-group", ({ groupId }) => {
    if (!groupId) return;
    socket.join(groupId);
    console.log(`Socket ${socket.id} joined room ${groupId}`);
  });

  socket.on("leave-group", ({ groupId }) => {
    if (!groupId) return;
    socket.leave(groupId);
    console.log(`Socket ${socket.id} left room ${groupId}`);
  });

  socket.on("group-typing", ({ groupId, fullName, profilePic }) => {
    socket.to(groupId).emit("user-group-typing", { groupId, userId, fullName, profilePic });
  });

  socket.on("group-message-delivered", async ({ groupId, messageIds }) => {
    if (!groupId || !messageIds || !Array.isArray(messageIds)) return;
    
    await Message.updateMany(
      { _id: { $in: messageIds }, groupId },
      { $addToSet: { deliveredTo: userId } }
    );

    // Notify the group room about delivery updates
    io.to(groupId).emit("groupMessageDelivered", {
      groupId,
      userId,
      messageIds
    });
  });

  socket.on("group-stop-typing", ({ groupId }) => {
    socket.to(groupId).emit("user-group-stopped-typing", { groupId, userId });
  });
});

export { io, app, server };
