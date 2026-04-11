import jwt from "jsonwebtoken";
import User from "../models/user.model.js";
import Session from "../models/session.model.js";

export const protectRoute = async (req, res, next) => {
  try {
    const token = req.cookies?.jwt;

    if (!token) {
      return res.status(401).json({ message: "Unauthorized - No Token Provided" });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET || "secret");

    if (!decoded) {
      return res.status(401).json({ message: "Unauthorized - Invalid Token" });
    }

    const session = await Session.findOne({ sessionId: decoded.sessionId });
    if (!session) {
      res.cookie("jwt", "", { maxAge: 0 }); // Clean up obsolete cookie
      return res.status(401).json({ message: "Unauthorized - Session Expired" });
    }
    
    // Non-blocking update to lastActive (throttled conceptually, but direct for simplicity)
    const now = new Date();
    if (now - new Date(session.lastActive) > 1000 * 60 * 5) {
      session.lastActive = now;
      session.save().catch(err => console.error("Error updating session lastActive:", err.message));
    }

    const user = await User.findById(decoded.userId).select("-password");

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    req.user = user;
    req.sessionId = decoded.sessionId;

    next();
  } catch (error) {
    console.log("Error in protectRoute middleware: ", error.message);
    if (error.name === "JsonWebTokenError" || error.name === "TokenExpiredError") {
      return res.status(401).json({ message: "Unauthorized - Invalid Token" });
    }
    res.status(500).json({ message: "Internal server error" });
  }
};
