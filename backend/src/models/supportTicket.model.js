import mongoose from "mongoose";

const supportTicketSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    issueType: {
      type: String,
      enum: ["General question", "Account issue", "Privacy concern", "Bug report"],
      required: true,
    },
    description: {
      type: String,
      required: true,
      maxlength: 2000,
    },
    includeDiagnostics: {
      type: Boolean,
      default: true,
    },
    diagnostics: {
      type: Object,
      default: null,
    },
    status: {
      type: String,
      enum: ["open", "in_progress", "closed"],
      default: "open",
    },
  },
  { timestamps: true }
);

const SupportTicket = mongoose.model("SupportTicket", supportTicketSchema);

export default SupportTicket;
