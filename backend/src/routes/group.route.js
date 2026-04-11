import express from "express";
import { protectRoute } from "../middleware/auth.middleware.js";
import {
  createGroup,
  getGroups,
  getGroupMessages,
  updateGroup,
  addMembers,
  removeMember,
  leaveGroup,
  sendGroupMessage,
  updateGroupSettings,
  makeAdmin,
  muteGroup,
} from "../controllers/group.controller.js";

const router = express.Router();

router.post("/", protectRoute, createGroup);
router.get("/", protectRoute, getGroups);
router.get("/messages/:groupId", protectRoute, getGroupMessages);
router.post("/send/:groupId", protectRoute, sendGroupMessage);
router.put("/update/:groupId", protectRoute, updateGroup);
router.put("/add/:groupId", protectRoute, addMembers);
router.post("/remove/:groupId", protectRoute, removeMember);
router.post("/leave/:groupId", protectRoute, leaveGroup);
router.put("/settings/:groupId", protectRoute, updateGroupSettings);
router.put("/mute/:groupId", protectRoute, muteGroup);
router.post("/make-admin/:groupId", protectRoute, makeAdmin);

export default router;
