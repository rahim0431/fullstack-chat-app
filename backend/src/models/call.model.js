import mongoose from "mongoose";

const callSchema = new mongoose.Schema(
  {
    callerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    receiverId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    type: {
      type: String,
      enum: ["audio", "video"],
      required: true,
    },
    status: {
      type: String,
      enum: ["missed", "answered", "canceled"],
      default: "missed",
    },
    duration: {
      type: Number,
      default: 0,
    },
  },
  { timestamps: true }
);

const Call = mongoose.model("Call", callSchema);

export default Call;
