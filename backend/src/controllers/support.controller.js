import SupportTicket from "../models/supportTicket.model.js";

const VALID_ISSUES = ["General question", "Account issue", "Privacy concern", "Bug report"];

export const createSupportTicket = async (req, res) => {
  try {
    const userId = req.user._id;
    const issueType = String(req.body.issueType || "").trim();
    const description = String(req.body.description || "").trim();
    const includeDiagnostics = Boolean(req.body.includeDiagnostics);
    const diagnostics = req.body.diagnostics || null;

    if (!VALID_ISSUES.includes(issueType)) {
      return res.status(400).json({ message: "Invalid issue type" });
    }
    if (!description || description.length < 10) {
      return res.status(400).json({ message: "Please provide a detailed description (min 10 characters)." });
    }

    const ticket = await SupportTicket.create({
      userId,
      issueType,
      description,
      includeDiagnostics,
      diagnostics: includeDiagnostics ? diagnostics : null,
      status: "open",
    });

    res.status(201).json({ message: "Ticket submitted", ticketId: ticket._id });
  } catch (error) {
    console.error("Error in createSupportTicket:", error.message);
    res.status(500).json({ message: "Failed to submit ticket" });
  }
};
