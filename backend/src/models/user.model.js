import mongoose from "mongoose";

const userSchema = new mongoose.Schema(
  {
    username: {
      type: String,
      required: true,
      unique: true,
    },
    email: {
      type: String,
      required: true,
      unique: true,
    },
    fullName: {
      type: String,
      required: true,
    },
    password: {
      type: String,
      required: true,
      minlength: 6,
    },
    profilePic: {
      type: String,
      default: "",
    },
    coverPic: {
      type: String,
      default: "",
    },
    lastSeenAt: {
      type: Date,
      default: null,
    },
    bio: {
      type: String,
      default: "",
    },
    privacySettings: {
      lastSeen: {
        type: String,
        enum: ["Everyone", "Followers", "Nobody"],
        default: "Everyone",
      },
      readReceipts: {
        type: Boolean,
        default: true,
      },
      whoCanMessageMe: {
        type: String,
        enum: ["Everyone", "Followers"],
        default: "Everyone",
      },
    },
    chatSettings: {
      chatTheme: {
        type: String,
        enum: [
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
        default: "coffee",
      },
      enterKeySendsMessage: {
        type: Boolean,
        default: true,
      },
      autoDownloadMedia: {
        type: String,
        enum: ["Wi-Fi and Mobile Data", "Wi-Fi only", "Never"],
        default: "Wi-Fi only",
      },
      backupFrequency: {
        type: String,
        enum: ["Daily", "Weekly", "Monthly", "Never"],
        default: "Weekly",
      },
    },
    notificationSettings: {
      messageNotifications: {
        type: Boolean,
        default: true,
      },
      groupNotifications: {
        type: Boolean,
        default: true,
      },
      notificationSound: {
        type: String,
        enum: [
          "Default Chime",
          "Soft Bell",
          "Pop Tone",
          "Crystal Ping",
          "Warm Pulse",
          "Gentle Drop",
          "Echo Spark",
          "Silent",
        ],
        default: "Default Chime",
      },
      showMessagePreview: {
        type: String,
        enum: ["Everyone", "Followers", "Nobody"],
        default: "Everyone",
      },
    },
    connectedAccountSettings: {
      whoCanFollowMe: {
        type: String,
        enum: ["Everyone", "Followers", "Nobody"],
        default: "Everyone",
      },
    },
    storageSettings: {
      downloadMediaUsing: {
        type: String,
        enum: ["Wi-Fi and Mobile Data", "Wi-Fi only", "Never"],
        default: "Wi-Fi only",
      },
      keepMediaOnDevice: {
        type: String,
        enum: ["7 days", "30 days", "1 year", "Forever"],
        default: "30 days",
      },
      useLessDataForCalls: {
        type: Boolean,
        default: false,
      },
    },
    helpSupportSettings: {
      issueType: {
        type: String,
        enum: ["General question", "Account issue", "Privacy concern", "Bug report"],
        default: "General question",
      },
      includeDiagnostics: {
        type: Boolean,
        default: true,
      },
      lastDescription: {
        type: String,
        default: "",
      },
    },
    aiSettings: {
      promptEnhancement: {
        type: String,
        enum: ["Minimal", "Balanced", "Creative"],
        default: "Balanced",
      },
      responseTone: {
        type: String,
        enum: ["Friendly", "Professional", "Casual"],
        default: "Friendly",
      },
      safetyLevel: {
        type: String,
        enum: ["Strict", "Standard", "Creative"],
        default: "Standard",
      },
      autoSaveHistory: {
        type: Boolean,
        default: true,
      },
    },
    blockedUsers: {
      type: [mongoose.Schema.Types.ObjectId],
      ref: "User",
      default: [],
    },
    mutedGroups: {
      type: [mongoose.Schema.Types.ObjectId],
      ref: "Group",
      default: [],
    },
  },
  { timestamps: true }
);

const User = mongoose.model("User", userSchema);

export default User;
