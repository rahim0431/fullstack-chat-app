import express from "express";
import { protectRoute } from "../middleware/auth.middleware.js";
import { getMessages, getUsersForSidebar, sendMessage, searchUsers, markMessagesAsRead, deleteMessage, clearAllMessages, clearChatWithUser, logCall, reactToMessage } from "../controllers/message.controller.js";

const router = express.Router();

router.get("/users", protectRoute, getUsersForSidebar);
router.get("/search", protectRoute, searchUsers);
router.put("/read/:id", protectRoute, markMessagesAsRead);
router.get("/:id", protectRoute, getMessages);
router.post("/send/:id", protectRoute, sendMessage);
router.post("/react/:id", protectRoute, reactToMessage);
router.post("/log-call", protectRoute, logCall);
router.delete("/clear/all", protectRoute, clearAllMessages);
router.delete("/clear/:userId", protectRoute, clearChatWithUser);
router.delete("/:id", protectRoute, deleteMessage);

export default router;
