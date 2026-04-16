import User from "../models/user.model.js";
import Session from "../models/session.model.js";
import Connection from "../models/connection.model.js";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import cloudinary from "../lib/cloudinary.js";
import { UAParser } from "ua-parser-js";
import { v4 as uuidv4 } from "uuid";

const USERNAME_REGEX = /^[a-zA-Z0-9_]+$/;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const SETTINGS_VALIDATION = {
  privacySettings: {
    lastSeen: { type: "enum", values: ["Everyone", "Followers", "Nobody"] },
    readReceipts: { type: "boolean" },
    whoCanMessageMe: { type: "enum", values: ["Everyone", "Followers"] },
  },
  chatSettings: {
    chatTheme: {
      type: "enum",
      values: [
        "light",
        "dark",
        "cupcake",
        "bumblebee",
        "emerald",
        "corporate",
        "synthwave",
        "retro",
        "valentine",
        "halloween",
        "garden",
        "forest",
        "lofi",
        "pastel",
        "fantasy",
        "wireframe",
        "black",
        "dracula",
        "cmyk",
        "autumn",
        "business",
        "lemonade",
        "night",
        "coffee",
        "winter",
        "dim",
        "nord",
        "sunset",
        "System Default",
        "Light",
        "Dark",
      ],
    },
    enterKeySendsMessage: { type: "boolean" },
    autoDownloadMedia: { type: "enum", values: ["Wi-Fi and Mobile Data", "Wi-Fi only", "Never"] },
    backupFrequency: { type: "enum", values: ["Daily", "Weekly", "Monthly", "Never"] },
  },
  notificationSettings: {
    messageNotifications: { type: "boolean" },
    groupNotifications: { type: "boolean" },
    notificationSound: {
      type: "enum",
      values: [
        "Default Chime",
        "Soft Bell",
        "Pop Tone",
        "Crystal Ping",
        "Warm Pulse",
        "Gentle Drop",
        "Echo Spark",
        "Silent",
      ],
    },
    showMessagePreview: { type: "enum", values: ["Everyone", "Followers", "Nobody"] },
  },
  connectedAccountSettings: {
    whoCanFollowMe: { type: "enum", values: ["Everyone", "Followers", "Nobody"] },
  },
  storageSettings: {
    downloadMediaUsing: { type: "enum", values: ["Wi-Fi and Mobile Data", "Wi-Fi only", "Never"] },
    keepMediaOnDevice: { type: "enum", values: ["7 days", "30 days", "1 year", "Forever"] },
    useLessDataForCalls: { type: "boolean" },
  },
  helpSupportSettings: {
    issueType: { type: "enum", values: ["General question", "Account issue", "Privacy concern", "Bug report"] },
    includeDiagnostics: { type: "boolean" },
    lastDescription: { type: "string", maxLength: 1000 },
  },
  aiSettings: {
    promptEnhancement: { type: "enum", values: ["Minimal", "Balanced", "Creative"] },
    responseTone: { type: "enum", values: ["Friendly", "Professional", "Casual"] },
    safetyLevel: { type: "enum", values: ["Strict", "Standard", "Creative"] },
    autoSaveHistory: { type: "boolean" },
  },
};

const normalizeUsername = (value = "") => {
  let username = String(value).trim();
  if (username.startsWith("@")) username = username.slice(1);
  return username.toLowerCase();
};

const normalizeEmail = (value = "") => String(value).trim().toLowerCase();

const toClientUser = (userDoc) => {
  const user = userDoc.toObject ? userDoc.toObject() : { ...userDoc };
  delete user.password;
  return user;
};

const isPlainObject = (value) => !!value && typeof value === "object" && !Array.isArray(value);

const canShowLastSeen = (viewerId, user, isConnected = false) => {
  if (!user?._id || !viewerId) return false;
  if (user._id.toString() === viewerId.toString()) return true;
  const setting = user?.privacySettings?.lastSeen || "Everyone";
  if (setting === "Everyone") return true;
  if (setting === "Followers") return isConnected;
  return false;
};

const isBlockedBetween = async (viewerId, userId) => {
  const [viewerBlocks, userBlocks] = await Promise.all([
    User.exists({ _id: viewerId, blockedUsers: userId }),
    User.exists({ _id: userId, blockedUsers: viewerId }),
  ]);
  return Boolean(viewerBlocks || userBlocks);
};

const mergeSettings = (currentSettings, incomingSettings, rules, sectionLabel) => {
  if (!isPlainObject(incomingSettings)) {
    return { error: `${sectionLabel} must be an object` };
  }

  const nextSettings = { ...(currentSettings || {}) };

  for (const [fieldName, fieldRule] of Object.entries(rules)) {
    if (!Object.prototype.hasOwnProperty.call(incomingSettings, fieldName)) continue;

    const value = incomingSettings[fieldName];

    if (fieldRule.type === "boolean") {
      if (typeof value !== "boolean") {
        return { error: `${sectionLabel}.${fieldName} must be true or false` };
      }
      nextSettings[fieldName] = value;
      continue;
    }

    if (fieldRule.type === "enum") {
      if (typeof value !== "string" || !fieldRule.values.includes(value)) {
        return {
          error: `${sectionLabel}.${fieldName} must be one of: ${fieldRule.values.join(", ")}`,
        };
      }
      nextSettings[fieldName] = value;
      continue;
    }

    if (fieldRule.type === "string") {
      if (typeof value !== "string") {
        return { error: `${sectionLabel}.${fieldName} must be a string` };
      }
      const normalizedValue = value.trim().slice(0, fieldRule.maxLength ?? value.length);
      nextSettings[fieldName] = normalizedValue;
    }
  }

  return { value: nextSettings };
};

export const signup = async (req, res) => {
  const { password } = req.body;
  const fullName = String(req.body.fullName || "").trim();
  const email = normalizeEmail(req.body.email);
  let { username } = req.body;
  try {
    if (!fullName || !username || !email || !password) return res.status(400).json({ message: "All fields are required" });
    if (password.length < 6) return res.status(400).json({ message: "Password must be at least 6 characters" });

    username = normalizeUsername(username);

    if (!USERNAME_REGEX.test(username)) {
      return res.status(400).json({ message: "Username can only contain letters, numbers, and underscores" });
    }
    if (!EMAIL_REGEX.test(email)) {
      return res.status(400).json({ message: "Please enter a valid email address" });
    }

    const existingEmail = await User.findOne({ email });
    if (existingEmail) return res.status(400).json({ message: "Email already exists" });

    const existingUsername = await User.findOne({ username });
    if (existingUsername) return res.status(400).json({ message: "Username already exists" });

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    const newUser = await User.create({
      fullName,
      username,
      email,
      password: hashedPassword,
      profilePic: "",
    });

    await generateToken(newUser._id, res, req);
    res.status(201).json(toClientUser(newUser));
  } catch (error) {
    console.log("Error in signup controller", error.message);
    res.status(500).json({ message: "Internal Server Error" });
  }
};

export const updateProfile = async (req, res) => {
  try {
    const {
      profilePic,
      coverPic,
      fullName,
      username,
      email,
      bio,
    } = req.body;

    const userId = req.user._id;
    const user = await User.findById(userId);

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    if (typeof fullName !== "undefined") {
      if (typeof fullName !== "string" || !fullName.trim()) {
        return res.status(400).json({ message: "Full name is required" });
      }
      user.fullName = fullName.trim();
    }

    if (typeof username !== "undefined") {
      const normalizedUsername = normalizeUsername(username);
      if (!normalizedUsername || !USERNAME_REGEX.test(normalizedUsername)) {
        return res.status(400).json({ message: "Username can only contain letters, numbers, and underscores" });
      }

      const existingUsername = await User.findOne({ username: normalizedUsername, _id: { $ne: userId } });
      if (existingUsername) {
        return res.status(400).json({ message: "Username already exists" });
      }

      user.username = normalizedUsername;
    }

    if (typeof email !== "undefined") {
      const normalizedEmail = normalizeEmail(email);
      if (!normalizedEmail || !EMAIL_REGEX.test(normalizedEmail)) {
        return res.status(400).json({ message: "Please enter a valid email address" });
      }

      const existingEmail = await User.findOne({ email: normalizedEmail, _id: { $ne: userId } });
      if (existingEmail) {
        return res.status(400).json({ message: "Email already exists" });
      }

      user.email = normalizedEmail;
    }

    if (typeof bio !== "undefined") {
      if (typeof bio !== "string") {
        return res.status(400).json({ message: "Bio must be a string" });
      }
      user.bio = bio.trim().slice(0, 300);
    }

    if (typeof profilePic !== "undefined") {
      if (profilePic === "") {
        user.profilePic = "";
      } else if (typeof profilePic === "string") {
        const uploadResponse = await cloudinary.uploader.upload(profilePic);
        user.profilePic = uploadResponse.secure_url;
      } else {
        return res.status(400).json({ message: "Profile picture must be a base64 string or empty string" });
      }
    }

    if (typeof coverPic !== "undefined") {
      if (coverPic === "") {
        user.coverPic = "";
      } else if (typeof coverPic === "string") {
        const uploadResponse = await cloudinary.uploader.upload(coverPic);
        user.coverPic = uploadResponse.secure_url;
      } else {
        return res.status(400).json({ message: "Cover picture must be a base64 string or empty string" });
      }
    }

    for (const [settingsKey, rules] of Object.entries(SETTINGS_VALIDATION)) {
      if (typeof req.body[settingsKey] === "undefined") continue;

      const merged = mergeSettings(user[settingsKey], req.body[settingsKey], rules, settingsKey);
      if (merged.error) {
        return res.status(400).json({ message: merged.error });
      }

      user[settingsKey] = merged.value;
    }

    await user.save();

    res.status(200).json(toClientUser(user));
  } catch (error) {
    console.log("error in updateProfile:", error.message);
    res.status(500).json({ message: error.message });
  }
};

export const login = async (req, res) => {
  const { email, password } = req.body;
  let { username } = req.body;
  try {
    if (!password) {
      return res.status(400).json({ message: "Password is required" });
    }

    if (typeof username === "string") {
      username = normalizeUsername(username);
    }

    const emailValue = typeof email === "string" ? normalizeEmail(email) : "";

    if (!username && !emailValue) {
      return res.status(400).json({ message: "Username or email is required" });
    }

    let user = null;
    if (username) {
      user = await User.findOne({ username });
    }
    if (!user && emailValue) {
      user = await User.findOne({ email: emailValue });
    }
    if (!user) return res.status(400).json({ message: "Invalid credentials" });

    const isPasswordCorrect = await bcrypt.compare(password, user.password || "");
    if (!isPasswordCorrect) return res.status(400).json({ message: "Invalid credentials" });

    await generateToken(user._id, res, req);
    res.status(200).json(toClientUser(user));
  } catch (error) {
    console.log("Error in login controller", error.message);
    res.status(500).json({ message: "Internal Server Error" });
  }
};

export const logout = async (req, res) => {
  try {
    const token = req.cookies?.jwt;
    if (token) {
      try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET || "secret");
        await Session.deleteOne({ sessionId: decoded.sessionId });
      } catch (err) {
        // Ignored if expired or invalid
      }
    }
    res.cookie("jwt", "", { maxAge: 0 });
    res.status(200).json({ message: "Logged out successfully" });
  } catch (error) {
    console.log("Error in logout controller", error.message);
    res.status(500).json({ message: "Internal Server Error" });
  }
};

const generateToken = async (userId, res, req) => {
  const sessionId = uuidv4();
  const token = jwt.sign({ userId, sessionId }, process.env.JWT_SECRET || "secret", { expiresIn: "7d" });
  res.cookie("jwt", token, {
    maxAge: 7 * 24 * 60 * 60 * 1000,
    httpOnly: true,
    sameSite: process.env.NODE_ENV === "production" ? "none" : "strict",
    secure: process.env.NODE_ENV === "production",
  });

  const parser = new UAParser(req.headers['user-agent']);
  const result = parser.getResult();
  const deviceType = result.device.type === 'mobile' ? 'Mobile' : result.device.type === 'tablet' ? 'Tablet' : 'Desktop';
  const browser = result.browser.name || "Unknown Browser";
  const os = result.os.name || "Unknown OS";
  const ipAddress = req.ip || req.connection?.remoteAddress || "Unknown IP";

  await Session.create({
    userId,
    sessionId,
    deviceType,
    browser,
    os,
    ipAddress
  });
};

export const checkAuth = (req, res) => {
  try {
    res.status(200).json(req.user);
  } catch (error) {
    console.log("Error in checkAuth controller", error.message);
    res.status(500).json({ message: "Internal Server Error" });
  }
};

export const getUserProfileById = async (req, res) => {
  try {
    const { id } = req.params;
    const user = await User.findById(id).select("-password");

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const viewerId = req.user?._id;
    if (viewerId && user._id.toString() !== viewerId.toString()) {
      const blocked = await isBlockedBetween(viewerId, user._id);
      if (blocked) {
        return res.status(403).json({ message: "This profile is not available" });
      }
    }
    let isConnected = false;
    if (viewerId && user._id.toString() !== viewerId.toString()) {
      const connection = await Connection.findOne({
        status: "accepted",
        $or: [
          { senderId: viewerId, receiverId: user._id },
          { senderId: user._id, receiverId: viewerId },
        ],
      });
      isConnected = Boolean(connection);
    }

    const safeUser = user.toObject ? user.toObject() : { ...user };
    if (!canShowLastSeen(viewerId, safeUser, isConnected)) {
      safeUser.lastSeenAt = null;
    }

    res.status(200).json(safeUser);
  } catch (error) {
    console.log("Error in getUserProfileById controller", error.message);
    res.status(500).json({ message: "Internal Server Error" });
  }
};

export const checkUsername = async (req, res) => {
  try {
    const { username } = req.query;
    if (!username) return res.status(400).json({ message: "Username query parameter is required" });

    const normalizedUsername = normalizeUsername(username);
    if (!USERNAME_REGEX.test(normalizedUsername)) {
      return res.status(200).json({ available: false, error: "Invalid format" });
    }

    const existingUser = await User.findOne({ 
      username: normalizedUsername, 
      _id: { $ne: req.user._id } 
    });

    if (existingUser) {
      return res.status(200).json({ available: false });
    }

    res.status(200).json({ available: true });
  } catch (error) {
    console.log("Error in checkUsername controller", error.message);
    res.status(500).json({ message: "Internal Server Error" });
  }
};

export const getActiveSessions = async (req, res) => {
  try {
    const sessions = await Session.find({ userId: req.user._id }).sort({ lastActive: -1 }).select("-userId -__v");
    res.status(200).json(sessions);
  } catch (error) {
    console.log("Error in getActiveSessions controller", error.message);
    res.status(500).json({ message: "Internal Server Error" });
  }
};

export const logoutOtherSessions = async (req, res) => {
  try {
    await Session.deleteMany({ userId: req.user._id, sessionId: { $ne: req.sessionId } });
    res.status(200).json({ message: "Logged out of all other devices successfully" });
  } catch (error) {
    console.log("Error in logoutOtherSessions controller", error.message);
    res.status(500).json({ message: "Internal Server Error" });
  }
};
