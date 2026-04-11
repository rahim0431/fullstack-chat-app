import mongoose from "mongoose";

const groupSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    description: {
      type: String,
      default: "",
    },
    profilePic: {
      type: String,
      default: "",
    },
    admin: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    members: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    ],
    lastMessage: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Message",
    },
    isPublic: {
      type: Boolean,
      default: false,
    },
    settings: {
      editInfo: {
        type: String,
        enum: ["all", "admin"],
        default: "all",
      },
      sendMessages: {
        type: String,
        enum: ["all", "admin"],
        default: "all",
      },
    },
  },
  { timestamps: true }
);

// Limit members to 100
groupSchema.path("members").validate(function (value) {
  return value.length <= 100;
}, "Member limit reached (max 100).");

const Group = mongoose.model("Group", groupSchema);

export default Group;
