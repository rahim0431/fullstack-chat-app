import express from "express";
import { protectRoute } from "../middleware/auth.middleware.js";
import { createSupportTicket } from "../controllers/support.controller.js";

const router = express.Router();

router.post("/tickets", protectRoute, createSupportTicket);

export default router;
