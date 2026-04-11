import express from "express";
import { getAIResponse, getAIHistory, streamAudioProxy, deleteAIMessage, clearAIHistory, reactToAIMessage } from "../ai/ai.controller.js";
import { protectRoute } from "../middleware/auth.middleware.js";

const router = express.Router();

router.post("/chat", protectRoute, getAIResponse);
router.get("/history", protectRoute, getAIHistory);
router.post("/history/react/:id", protectRoute, reactToAIMessage);
router.delete("/history/clear", protectRoute, clearAIHistory);
router.delete("/history/:id", protectRoute, deleteAIMessage);
router.get("/stream", streamAudioProxy);

export default router;
