import Group from "../models/group.model.js";
import User from "../models/user.model.js";
import Message from "../models/message.model.js";
import cloudinary from "../lib/cloudinary.js";
import { getReceiverSocketId, io } from "../lib/socket.js";

export const createGroup = async (req, res) => {
  try {
    const { name, description, profilePic, members, isPublic } = req.body;
    const adminId = req.user._id;

    if (!name) {
      return res.status(400).json({ message: "Group name is required" });
    }

    let imageUrl = "";
    if (profilePic) {
      const uploadResponse = await cloudinary.uploader.upload(profilePic);
      imageUrl = uploadResponse.secure_url;
    }

    // Ensure admin is in members
    const allMembers = Array.from(new Set([...(members || []), adminId.toString()]));

    const newGroup = new Group({
      name,
      description,
      profilePic: imageUrl,
      admin: adminId,
      members: allMembers,
      isPublic: isPublic || false,
    });

    await newGroup.save();

    // Populate members and admin for frontend
    const populatedGroup = await Group.findById(newGroup._id)
      .populate("members", "fullName profilePic lastSeenAt")
      .populate("admin", "fullName profilePic lastSeenAt");

    // Notify all online members via socket to join the room
    allMembers.forEach((memberId) => {
      const socketId = getReceiverSocketId(memberId);
      if (socketId) {
        io.to(socketId).emit("newGroupCreated", populatedGroup);
      }
    });

    res.status(201).json(populatedGroup);
  } catch (error) {
    console.error("Error in createGroup controller", error.message);
    res.status(500).json({ message: "Internal Server Error" });
  }
};

export const getGroups = async (req, res) => {
  try {
    const userId = req.user._id;
    const groups = await Group.find({
      members: { $in: [userId] },
    })
      .populate("members", "fullName profilePic lastSeenAt")
      .populate("admin", "fullName profilePic lastSeenAt")
      .populate({
        path: "lastMessage",
        populate: { path: "senderId", select: "fullName" }
      })
      .sort({ updatedAt: -1 });

    res.status(200).json(groups);
  } catch (error) {
    console.error("Error in getGroups controller", error.message);
    res.status(500).json({ message: "Internal Server Error" });
  }
};

export const getGroupMessages = async (req, res) => {
  try {
    const { groupId } = req.params;
    const userId = req.user._id;

    // Check if user is member
    const group = await Group.findById(groupId);
    if (!group) {
      return res.status(404).json({ message: "Group not found" });
    }

    if (!group.members.includes(userId) && !group.isPublic) {
      return res.status(403).json({ message: "Access denied" });
    }

    const messages = await Message.find({ groupId })
      .populate("senderId", "fullName profilePic")
      .sort({ createdAt: 1 });

    res.status(200).json(messages);
  } catch (error) {
    console.error("Error in getGroupMessages controller", error.message);
    res.status(500).json({ message: "Internal Server Error" });
  }
};

export const updateGroup = async (req, res) => {
  try {
    const { groupId } = req.params;
    const { name, description, profilePic, isPublic } = req.body;
    const userId = req.user._id;

    const group = await Group.findById(groupId);
    if (!group) return res.status(404).json({ message: "Group not found" });

    const isAdmin = group.admin.toString() === userId.toString();
    const canEdit = group.settings?.editInfo === "all" || isAdmin;

    if (!canEdit) {
      return res.status(403).json({ message: "Only admins can update group info" });
    }

    if (name) group.name = name;
    if (description !== undefined) group.description = description;
    if (isPublic !== undefined) group.isPublic = isPublic;

    if (profilePic) {
      const uploadResponse = await cloudinary.uploader.upload(profilePic);
      group.profilePic = uploadResponse.secure_url;
    }

    await group.save();
    const updatedGroup = await Group.findById(groupId).populate("members", "fullName profilePic lastSeenAt");
    
    io.to(groupId).emit("groupUpdated", updatedGroup);

    res.status(200).json(updatedGroup);
  } catch (error) {
    console.error("Error in updateGroup controller", error.message);
    res.status(500).json({ message: "Internal Server Error" });
  }
};

export const addMembers = async (req, res) => {
  try {
    const { groupId } = req.params;
    const { userIds } = req.body; // Array of IDs
    const userId = req.user._id;

    const group = await Group.findById(groupId);
    if (!group) return res.status(404).json({ message: "Group not found" });

    if (group.admin.toString() !== userId.toString()) {
      return res.status(403).json({ message: "Only admin can add members" });
    }

    const newMembers = [...new Set([...group.members.map(m => m.toString()), ...userIds])];
    if (newMembers.length > 100) {
      return res.status(400).json({ message: "Member limit reached (max 100)" });
    }

    group.members = newMembers;
    await group.save();

    const updatedGroup = await Group.findById(groupId)
      .populate("members", "fullName profilePic lastSeenAt")
      .populate("admin", "fullName profilePic lastSeenAt");
    
    // Notify added users and existing users
    userIds.forEach(id => {
        const socketId = getReceiverSocketId(id);
        if(socketId) io.to(socketId).emit("addedToGroup", updatedGroup);
    });
    io.to(groupId).emit("groupUpdated", updatedGroup);

    res.status(200).json(updatedGroup);
  } catch (error) {
    console.error("Error in addMembers controller", error.message);
    res.status(500).json({ message: "Internal Server Error" });
  }
};

export const removeMember = async (req, res) => {
    try {
      const { groupId } = req.params;
      const { memberId } = req.body;
      const userId = req.user._id;
  
      const group = await Group.findById(groupId);
      if (!group) return res.status(404).json({ message: "Group not found" });
  
      if (group.admin.toString() !== userId.toString()) {
        return res.status(403).json({ message: "Only admin can remove members" });
      }

      if (memberId === group.admin.toString()) {
          return res.status(400).json({ message: "Cannot remove admin" });
      }
  
      group.members = group.members.filter(m => m.toString() !== memberId);
      await group.save();
  
      const updatedGroup = await Group.findById(groupId)
        .populate("members", "fullName profilePic lastSeenAt")
        .populate("admin", "fullName profilePic lastSeenAt");
      
      const removedSocketId = getReceiverSocketId(memberId);
      if(removedSocketId) io.to(removedSocketId).emit("removedFromGroup", { groupId });

      io.to(groupId).emit("groupUpdated", updatedGroup);
  
      res.status(200).json(updatedGroup);
    } catch (error) {
      console.error("Error in removeMember controller", error.message);
      res.status(500).json({ message: "Internal Server Error" });
    }
  };

export const leaveGroup = async (req, res) => {
  try {
    const { groupId } = req.params;
    const userId = req.user._id;

    const group = await Group.findById(groupId);
    if (!group) return res.status(404).json({ message: "Group not found" });

    if (group.admin.toString() === userId.toString() && group.members.length > 1) {
      return res.status(400).json({ message: "Admin must transfer ownership before leaving" });
    }

    group.members = group.members.filter((m) => m.toString() !== userId.toString());
    
    if (group.members.length === 0) {
      await Group.findByIdAndDelete(groupId);
      return res.status(200).json({ message: "Group deleted" });
    }

    await group.save();
    const updatedGroup = await Group.findById(groupId).populate("members", "fullName profilePic lastSeenAt");

    io.to(groupId).emit("groupUpdated", updatedGroup);

    res.status(200).json({ message: "Left group success" });
  } catch (error) {
    console.error("Error in leaveGroup controller", error.message);
    res.status(500).json({ message: "Internal Server Error" });
  }
};

export const sendGroupMessage = async (req, res) => {
  try {
    const { text, image, audio, type, fileName, fileSize, content, replyTo } = req.body;
    const { groupId } = req.params;
    const senderId = req.user._id;

    const group = await Group.findById(groupId);
    if (!group) return res.status(404).json({ message: "Group not found" });

    if (!group.members.includes(senderId)) {
      return res.status(403).json({ message: "You are not a member of this group" });
    }

    const isAdmin = group.admin.toString() === senderId.toString();
    if (group.settings?.sendMessages === "admin" && !isAdmin) {
      return res.status(403).json({ message: "Only admins can send messages to this group" });
    }

    let imageUrl;
    if (image) {
      const uploadResponse = await cloudinary.uploader.upload(image);
      imageUrl = uploadResponse.secure_url;
    }

    let audioUrl;
    if (audio) {
      // Assuming audio is already a URL or base64
      // For base64, we'd upload to cloudinary
      if (audio.startsWith("data:")) {
        const uploadResponse = await cloudinary.uploader.upload(audio, { resource_type: "video" });
        audioUrl = uploadResponse.secure_url;
      } else {
        audioUrl = audio;
      }
    }

    const msgType = type || (imageUrl ? "image" : audioUrl ? "audio" : fileName ? "file" : "text");

    const newMessage = new Message({
      senderId,
      groupId,
      text,
      image: imageUrl,
      audio: audioUrl,
      content: content || null,
      type: msgType,
      fileName: fileName || null,
      fileSize: fileSize ? String(fileSize) : null,
      replyTo: replyTo || null,
      status: "sent",
      deliveredTo: [senderId],
      seenBy: [senderId],
    });

    await newMessage.save();
    
    // Update group's last message
    group.lastMessage = newMessage._id;
    await group.save();

    const populatedMessage = await Message.findById(newMessage._id).populate("senderId", "fullName profilePic");

    // Emit to group room
    io.to(groupId).emit("newGroupMessage", populatedMessage);

    res.status(201).json(populatedMessage);
  } catch (error) {
    console.error("Error in sendGroupMessage controller", error.message);
    res.status(500).json({ message: "Internal Server Error" });
  }
};

// --- New Features ---

export const updateGroupSettings = async (req, res) => {
  try {
    const { groupId } = req.params;
    const { settings } = req.body; // { editInfo: 'all'|'admin', sendMessages: 'all'|'admin' }
    const userId = req.user._id;

    const group = await Group.findById(groupId);
    if (!group) return res.status(404).json({ message: "Group not found" });

    if (group.admin.toString() !== userId.toString()) {
      return res.status(403).json({ message: "Only admin can update group settings" });
    }

    if (settings) {
      if (settings.editInfo) group.settings.editInfo = settings.editInfo;
      if (settings.sendMessages) group.settings.sendMessages = settings.sendMessages;
    }

    await group.save();
    const updatedGroup = await Group.findById(groupId)
      .populate("members", "fullName profilePic lastSeenAt")
      .populate("admin", "fullName profilePic lastSeenAt");

    io.to(groupId).emit("groupUpdated", updatedGroup);
    res.status(200).json(updatedGroup);
  } catch (error) {
    console.error("Error in updateGroupSettings controller", error.message);
    res.status(500).json({ message: "Internal Server Error" });
  }
};

export const makeAdmin = async (req, res) => {
  try {
    const { groupId } = req.params;
    const { memberId } = req.body;
    const userId = req.user._id;

    const group = await Group.findById(groupId);
    if (!group) return res.status(404).json({ message: "Group not found" });

    if (group.admin.toString() !== userId.toString()) {
      return res.status(403).json({ message: "Only admin can transfer ownership" });
    }

    if (!group.members.includes(memberId)) {
      return res.status(400).json({ message: "User is not a member of this group" });
    }

    group.admin = memberId;
    await group.save();

    const updatedGroup = await Group.findById(groupId)
      .populate("members", "fullName profilePic lastSeenAt")
      .populate("admin", "fullName profilePic lastSeenAt");

    io.to(groupId).emit("groupUpdated", updatedGroup);
    res.status(200).json(updatedGroup);
  } catch (error) {
    console.error("Error in makeAdmin controller", error.message);
    res.status(500).json({ message: "Internal Server Error" });
  }
};

export const muteGroup = async (req, res) => {
  try {
    const { groupId } = req.params;
    const userId = req.user._id;

    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ message: "User not found" });

    const mutedGroups = user.mutedGroups || [];
    const isMuted = mutedGroups.includes(groupId);
    
    if (isMuted) {
      user.mutedGroups = mutedGroups.filter((id) => id.toString() !== groupId.toString());
    } else {
      user.mutedGroups = [...mutedGroups, groupId];
    }

    await user.save();
    res.status(200).json({ isMuted: !isMuted });
  } catch (error) {
    console.error("Error in muteGroup controller", error.message);
    res.status(500).json({ message: "Internal Server Error" });
  }
};
