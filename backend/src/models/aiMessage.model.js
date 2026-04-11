import mongoose from "mongoose";

const aiMessageSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true
    },
    sender: {
      type: String,
      enum: ["user", "ai"],
      required: true
    },
    type: {
      type: String,
      default: "text"
    },
    content: {
      type: String,
      required: true
    }
  },
  { timestamps: true }
);

aiMessageSchema.index({ userId: 1, createdAt: -1 });

export default mongoose.model("AIMessage", aiMessageSchema);
