import express from "express";
import dotenv from "dotenv";
import cors from "cors";
import cookieParser from "cookie-parser";

import authRoutes from "./routes/auth.route.js";
import messageRoutes from "./routes/message.route.js";
import aiRoutes from "./routes/ai.routes.js";
import connectionRoutes from "./routes/connection.route.js";
import supportRoutes from "./routes/support.route.js";
import groupRoutes from "./routes/group.route.js";
import { protectRoute } from "./middleware/auth.middleware.js";
import { updateProfile } from "./controllers/auth.controller.js";
import { app, server } from "./lib/socket.js";
import { connectDB } from "./lib/db.js";

dotenv.config();

// Suppress noisy ytdl-core warnings about decipher parsing (YouTube changes).
// If streaming fails, update @distube/ytdl-core when a new fix is released.
const originalWarn = console.warn.bind(console);
console.warn = (...args) => {
  const msg = args?.[0];
  if (typeof msg === "string") {
    if (
      msg.includes("Could not parse decipher function") ||
      msg.includes("Could not parse n transform function")
    ) {
      return;
    }
  }
  originalWarn(...args);
};

app.use(cors({
  origin: [
    "http://localhost:5173",
    "https://fullstack-chat-app-bice.vercel.app"
  ],
  credentials: true,
}));
app.use(express.json({ limit: "50mb" }));
app.use(cookieParser());

app.use("/api/auth", authRoutes);
app.use("/api/messages", messageRoutes);
app.use("/api/ai", aiRoutes);
app.use("/api/connections", connectionRoutes);
app.use("/api/support", supportRoutes);
app.use("/api/groups", groupRoutes);
app.post("/api/update-profile", protectRoute, updateProfile);
app.put("/api/update-profile", protectRoute, updateProfile);

const PORT = process.env.PORT || 5001;

const startServer = async () => {
  try {
    await connectDB();
    server.listen(PORT, () => {
      console.log(`Server running on PORT:${PORT}`);
    });
  } catch (error) {
    console.log("Failed to start server:", error.message || error);
  }
};

startServer();
