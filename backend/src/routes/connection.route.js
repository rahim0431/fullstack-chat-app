import express from "express";
import { protectRoute } from "../middleware/auth.middleware.js";
import {
  sendRequest,
  getPendingRequests,
  acceptRequest,
  rejectRequest,
  getConnections,
  getConnectionStats,
  getFollowers,
  getFollowing,
  removeConnection,
  getSentRequests,
  cancelRequest,
  getBlockedUsers,
  blockUser,
  unblockUser,
} from "../controllers/connection.controller.js";

const router = express.Router();

router.post("/request/:id", protectRoute, sendRequest);
router.get("/requests/pending", protectRoute, getPendingRequests);
router.get("/requests/sent", protectRoute, getSentRequests);
router.delete("/request/cancel/:id", protectRoute, cancelRequest);
router.put("/accept/:id", protectRoute, acceptRequest);
router.put("/reject/:id", protectRoute, rejectRequest);
router.delete("/remove/:id", protectRoute, removeConnection);
router.get("/stats", protectRoute, getConnectionStats);
router.get("/stats/:userId", protectRoute, getConnectionStats);
router.get("/followers", protectRoute, getFollowers);
router.get("/followers/:userId", protectRoute, getFollowers);
router.get("/following", protectRoute, getFollowing);
router.get("/following/:userId", protectRoute, getFollowing);
router.get("/", protectRoute, getConnections);
router.get("/blocked", protectRoute, getBlockedUsers);
router.post("/block/:id", protectRoute, blockUser);
router.delete("/block/:id", protectRoute, unblockUser);

export default router;
