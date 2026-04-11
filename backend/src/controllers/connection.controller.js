import Connection from "../models/connection.model.js";
import User from "../models/user.model.js";

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

// Send a connection/follow request
export const sendRequest = async (req, res) => {
  try {
    const senderId = req.user._id;
    const { id: receiverId } = req.params;

    if (senderId.toString() === receiverId) {
      return res.status(400).json({ message: "You cannot send a request to yourself" });
    }

    // Check if user exists
    const receiver = await User.findById(receiverId);
    if (!receiver) {
      return res.status(404).json({ message: "User not found" });
    }

    const blocked = await isBlockedBetween(senderId, receiverId);
    if (blocked) {
      return res.status(403).json({ message: "You cannot send requests to this user" });
    }

    const followPolicy = receiver?.connectedAccountSettings?.whoCanFollowMe || "Everyone";
    if (followPolicy === "Nobody") {
      return res.status(403).json({ message: "This user is not accepting follow requests" });
    }
    if (followPolicy === "Followers") {
      const isMutual = await Connection.exists({
        senderId: receiverId,
        receiverId: senderId,
        status: "accepted",
      });
      if (!isMutual) {
        return res.status(403).json({ message: "Only mutual connections can follow this user" });
      }
    }

    // Check if connection already exists in either direction
    const existingConnection = await Connection.findOne({
      $or: [
        { senderId, receiverId },
        { senderId: receiverId, receiverId: senderId }
      ]
    });

    if (existingConnection) {
      return res.status(400).json({ 
        message: "Connection already exists", 
        status: existingConnection.status 
      });
    }

    const newConnection = await Connection.create({
      senderId,
      receiverId,
      status: "pending"
    });

    res.status(201).json(newConnection);
  } catch (error) {
    console.error("Error in sendRequest controller:", error.message);
    res.status(500).json({ message: "Internal server error" });
  }
};

// Get incoming pending requests
export const getPendingRequests = async (req, res) => {
  try {
    const userId = req.user._id;
    const { blockedUsers, blockedByUsers } = await getBlockSets(userId);

    const requests = await Connection.find({
      receiverId: userId,
      status: "pending"
    }).populate("senderId", "_id fullName username profilePic");

    const filtered = requests.filter((reqItem) => {
      const senderId = reqItem.senderId?._id?.toString();
      if (!senderId) return false;
      if (blockedUsers.has(senderId) || blockedByUsers.has(senderId)) return false;
      return true;
    });

    res.status(200).json(filtered);
  } catch (error) {
    console.error("Error in getPendingRequests controller:", error.message);
    res.status(500).json({ message: "Internal server error" });
  }
};

// Get outgoing pending requests sent by current user
export const getSentRequests = async (req, res) => {
  try {
    const userId = req.user._id;
    const { blockedUsers, blockedByUsers } = await getBlockSets(userId);

    const requests = await Connection.find({
      senderId: userId,
      status: "pending"
    }).populate("receiverId", "_id fullName username profilePic");

    const filtered = requests.filter((reqItem) => {
      const receiverId = reqItem.receiverId?._id?.toString();
      if (!receiverId) return false;
      if (blockedUsers.has(receiverId) || blockedByUsers.has(receiverId)) return false;
      return true;
    });

    res.status(200).json(filtered);
  } catch (error) {
    console.error("Error in getSentRequests controller:", error.message);
    res.status(500).json({ message: "Internal server error" });
  }
};

// Cancel a connection request sent by current user
export const cancelRequest = async (req, res) => {
  try {
    const { id: receiverId } = req.params;
    const userId = req.user._id;

    const connection = await Connection.findOneAndDelete({
      senderId: userId,
      receiverId: receiverId,
      status: "pending"
    });
    
    if (!connection) {
      return res.status(404).json({ message: "Pending request not found" });
    }

    res.status(200).json({ message: "Request cancelled and removed" });
  } catch (error) {
    console.error("Error in cancelRequest controller:", error.message);
    res.status(500).json({ message: "Internal server error" });
  }
};

// Accept a connection request
export const acceptRequest = async (req, res) => {
  try {
    const { id: connectionId } = req.params;
    const userId = req.user._id;

    const connection = await Connection.findById(connectionId);
    
    if (!connection) {
      return res.status(404).json({ message: "Request not found" });
    }

    // Ensure only the receiver can accept
    if (connection.receiverId.toString() !== userId.toString()) {
      return res.status(403).json({ message: "Unauthorized to accept this request" });
    }

    if (connection.status !== "pending") {
      return res.status(400).json({ message: "Request is already processed" });
    }

    const blocked = await isBlockedBetween(userId, connection.senderId);
    if (blocked) {
      return res.status(403).json({ message: "You cannot accept this request" });
    }

    connection.status = "accepted";
    await connection.save();

    res.status(200).json(connection);
  } catch (error) {
    console.error("Error in acceptRequest controller:", error.message);
    res.status(500).json({ message: "Internal server error" });
  }
};

// Reject a connection request
export const rejectRequest = async (req, res) => {
  try {
    const { id: connectionId } = req.params;
    const userId = req.user._id;

    const connection = await Connection.findById(connectionId);
    
    if (!connection) {
      return res.status(404).json({ message: "Request not found" });
    }

    // Ensure only the receiver can reject
    if (connection.receiverId.toString() !== userId.toString()) {
      return res.status(403).json({ message: "Unauthorized to reject this request" });
    }

    // In a production app, we might flag as "rejected". 
    // Here, deleting it allows another request to be sent in the future if desired.
    await Connection.findByIdAndDelete(connectionId);

    res.status(200).json({ message: "Request rejected and removed" });
  } catch (error) {
    console.error("Error in rejectRequest controller:", error.message);
    res.status(500).json({ message: "Internal server error" });
  }
};

// Get all accepted connections for the current user
export const getConnections = async (req, res) => {
  try {
    const userId = req.user._id;
    const { blockedUsers, blockedByUsers } = await getBlockSets(userId);

    const connections = await Connection.find({
      $or: [{ senderId: userId }, { receiverId: userId }],
      status: "accepted"
    }).populate("senderId receiverId", "_id fullName username profilePic");

    // Format the response so that it just returns a list of "users" we are connected with
    const connectedUsers = connections.map(conn => {
      if (conn.senderId._id.toString() === userId.toString()) {
        return conn.receiverId;
      } else {
        return conn.senderId;
      }
    });

    const filtered = connectedUsers.filter((user) => {
      const id = user?._id?.toString();
      if (!id) return false;
      if (blockedUsers.has(id) || blockedByUsers.has(id)) return false;
      return true;
    });

    res.status(200).json(filtered);
  } catch (error) {
    console.error("Error in getConnections controller:", error.message);
    res.status(500).json({ message: "Internal server error" });
  }
};

// Remove/unfollow an accepted connection
export const removeConnection = async (req, res) => {
  try {
    const userId = req.user._id;
    const { id: otherUserId } = req.params;

    const connection = await Connection.findOneAndDelete({
      $or: [
        { senderId: userId, receiverId: otherUserId, status: "accepted" },
        { senderId: otherUserId, receiverId: userId, status: "accepted" }
      ]
    });

    if (!connection) {
      return res.status(404).json({ message: "Connection not found" });
    }

    res.status(200).json({ message: "Connection removed successfully" });
  } catch (error) {
    console.error("Error in removeConnection controller:", error.message);
    res.status(500).json({ message: "Internal server error" });
  }
};

// Get follower/following stats for a user
export const getConnectionStats = async (req, res) => {
  try {
    const userId = req.params.userId || req.user._id;
    const { blockedUsers, blockedByUsers } = await getBlockSets(userId);

    const [followers, following] = await Promise.all([
      Connection.find({ receiverId: userId, status: "accepted" }).select("senderId"),
      Connection.find({ senderId: userId, status: "accepted" }).select("receiverId"),
    ]);

    const followersCount = followers.filter((conn) => {
      const id = conn.senderId?.toString();
      return id && !blockedUsers.has(id) && !blockedByUsers.has(id);
    }).length;
    const followingCount = following.filter((conn) => {
      const id = conn.receiverId?.toString();
      return id && !blockedUsers.has(id) && !blockedByUsers.has(id);
    }).length;

    res.status(200).json({
      userId,
      followersCount,
      followingCount,
    });
  } catch (error) {
    console.error("Error in getConnectionStats controller:", error.message);
    res.status(500).json({ message: "Internal server error" });
  }
};

// Get followers list (users who follow this user)
export const getFollowers = async (req, res) => {
  try {
    const userId = req.params.userId || req.user._id;
    const { blockedUsers, blockedByUsers } = await getBlockSets(userId);

    const connections = await Connection.find({
      receiverId: userId,
      status: "accepted",
    })
      .populate("senderId", "_id fullName username profilePic bio")
      .sort({ createdAt: -1 });

    const followers = connections
      .map((conn) => conn.senderId)
      .filter(Boolean)
      .filter((user) => {
        const id = user?._id?.toString();
        return id && !blockedUsers.has(id) && !blockedByUsers.has(id);
      });

    res.status(200).json(followers);
  } catch (error) {
    console.error("Error in getFollowers controller:", error.message);
    res.status(500).json({ message: "Internal server error" });
  }
};

// Get following list (users this user follows)
export const getFollowing = async (req, res) => {
  try {
    const userId = req.params.userId || req.user._id;
    const { blockedUsers, blockedByUsers } = await getBlockSets(userId);

    const connections = await Connection.find({
      senderId: userId,
      status: "accepted",
    })
      .populate("receiverId", "_id fullName username profilePic bio")
      .sort({ createdAt: -1 });

    const following = connections
      .map((conn) => conn.receiverId)
      .filter(Boolean)
      .filter((user) => {
        const id = user?._id?.toString();
        return id && !blockedUsers.has(id) && !blockedByUsers.has(id);
      });

    res.status(200).json(following);
  } catch (error) {
    console.error("Error in getFollowing controller:", error.message);
    res.status(500).json({ message: "Internal server error" });
  }
};

export const getBlockedUsers = async (req, res) => {
  try {
    const userId = req.user._id;
    const user = await User.findById(userId).populate("blockedUsers", "_id fullName username profilePic");
    const blocked = user?.blockedUsers || [];
    res.status(200).json(blocked);
  } catch (error) {
    console.error("Error in getBlockedUsers controller:", error.message);
    res.status(500).json({ message: "Internal server error" });
  }
};

export const blockUser = async (req, res) => {
  try {
    const userId = req.user._id;
    const { id: targetId } = req.params;

    if (userId.toString() === targetId) {
      return res.status(400).json({ message: "You cannot block yourself" });
    }

    const target = await User.findById(targetId);
    if (!target) return res.status(404).json({ message: "User not found" });

    await User.findByIdAndUpdate(userId, { $addToSet: { blockedUsers: targetId } });

    await Connection.deleteMany({
      $or: [
        { senderId: userId, receiverId: targetId },
        { senderId: targetId, receiverId: userId },
      ],
    });

    res.status(200).json({ message: "User blocked successfully" });
  } catch (error) {
    console.error("Error in blockUser controller:", error.message);
    res.status(500).json({ message: "Internal server error" });
  }
};

export const unblockUser = async (req, res) => {
  try {
    const userId = req.user._id;
    const { id: targetId } = req.params;
    await User.findByIdAndUpdate(userId, { $pull: { blockedUsers: targetId } });
    res.status(200).json({ message: "User unblocked successfully" });
  } catch (error) {
    console.error("Error in unblockUser controller:", error.message);
    res.status(500).json({ message: "Internal server error" });
  }
};
