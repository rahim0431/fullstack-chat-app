import express from "express";
import { checkAuth, getUserProfileById, login, logout, signup, updateProfile, checkUsername, getActiveSessions, logoutOtherSessions } from "../controllers/auth.controller.js";
import { protectRoute } from "../middleware/auth.middleware.js";

const router = express.Router();

router.post("/signup", signup);
router.post("/login", login);
router.post("/logout", logout);

router.put("/update-profile", protectRoute, updateProfile);
router.post("/update-profile", protectRoute, updateProfile);

router.get("/check", protectRoute, checkAuth);
router.get("/check-username", protectRoute, checkUsername);
router.get("/user/:id", protectRoute, getUserProfileById);

router.get("/sessions", protectRoute, getActiveSessions);
router.delete("/sessions/others", protectRoute, logoutOtherSessions);

export default router;
