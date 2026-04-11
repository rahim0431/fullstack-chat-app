import { create } from "zustand";
import { createPeer, getPeer } from "../lib/webrtc";
import { getSocket } from "../lib/socket";
import { useAuthStore } from "./useAuthStore";
import { useChatStore } from "./useChatStore.jsx";
import toast from "react-hot-toast";

const useCallStore = create((set, get) => ({
  // "idle" | "calling" | "in-call" | "receiving"
  callState: "idle",
  // "audio" | "video"
  callType: null,

  localStream: null,
  remoteStream: null,

  caller: null,
  receiver: null,

  peer: null,
  offer: null, // Add offer to state

  isMuted: false,
  isCameraOff: false,
  isSpeakerOff: false,
  cameraFacingMode: "user",
  callTimeoutRef: null,
  callStartTime: null,
  isReconnecting: false,
  networkQuality: 3, // 3: Good, 2: Fair, 1: Poor, 0: Disconnected
  missedCalls: [],

  actions: {
    setCallState: (callState) => {
      if (callState === "in-call") {
        set({ callState, callStartTime: Date.now() });
      } else {
        set({ callState });
      }
    },
    setIsReconnecting: (isReconnecting) => set({ isReconnecting }),
    setNetworkQuality: (networkQuality) => set({ networkQuality }),
    setCallType: (callType) => set({ callType }),
    setLocalStream: (localStream) => set({ localStream }),
    setRemoteStream: (remoteStream) => set({ remoteStream }),
    setCaller: (caller) => set({ caller }),
    setReceiver: (receiver) => set({ receiver }),
    setPeer: (peer) => set({ peer }),
    addMissedCall: (caller) => set((state) => ({ 
      missedCalls: [{ id: Date.now(), caller, time: new Date() }, ...state.missedCalls] 
    })),
    clearMissedCalls: () => set({ missedCalls: [] }),
    removeMissedCall: (id) => set((state) => ({ missedCalls: state.missedCalls.filter(mc => mc.id !== id) })),

    toggleMute: () => {
      const { localStream, isMuted } = get();
      const nextMuted = !isMuted;
      if (localStream) {
        localStream.getAudioTracks().forEach((track) => (track.enabled = !nextMuted));
      }
      set({ isMuted: nextMuted });
    },
    toggleCamera: () => {
      const { localStream, isCameraOff } = get();
      const nextCameraOff = !isCameraOff;
      if (localStream) {
        localStream.getVideoTracks().forEach((track) => (track.enabled = !nextCameraOff));
      }
      set({ isCameraOff: nextCameraOff });
    },
    
    toggleSpeaker: () => {
      set({ isSpeakerOff: !get().isSpeakerOff });
    },
    
    switchCamera: async () => {
      const { localStream, peer, cameraFacingMode } = get();
      if (!localStream || !peer) return;

      const newMode = cameraFacingMode === "user" ? "environment" : "user";
      
      try {
        const newStream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: newMode } },
        });

        const oldVideoTrack = localStream.getVideoTracks()[0];
        const newVideoTrack = newStream.getVideoTracks()[0];

        if (oldVideoTrack && newVideoTrack) {
          peer.replaceTrack(oldVideoTrack, newVideoTrack, localStream);
          localStream.removeTrack(oldVideoTrack);
          localStream.addTrack(newVideoTrack);
          oldVideoTrack.stop();
        }

        set({ cameraFacingMode: newMode });
      } catch (err) {
        console.error("Failed to switch camera", err);
        toast.error("Could not switch camera. Device might not support it.");
      }
    },
    
    startCall: async (type, authUser, selectedUser) => {
      if (get().callState !== "idle") return;

      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        toast.error("Your browser does not support calling. Please use a modern browser on a secure connection.");
        return;
      }

      try {
        console.log("Checking permissions for video/audio...");
        
        // Try to check platform-specific permission status if available
        if (navigator.permissions && navigator.permissions.query) {
          try {
            const camStatus = await navigator.permissions.query({ name: "camera" });
            const micStatus = await navigator.permissions.query({ name: "microphone" });
            console.log("Permission Status - Camera:", camStatus.state, "Mic:", micStatus.state);
            
            if (camStatus.state === "denied" || micStatus.state === "denied") {
              toast.error("Permission was previously denied. Please reset it in your browser settings.");
              // Don't return yet, as some browsers might still ask if we call getUserMedia
            }
          } catch (pErr) {
            console.warn("Permissions API check failed (non-critical):", pErr);
          }
        }

        // First, check if devices exist
        const devices = await navigator.mediaDevices.enumerateDevices();
        console.log("Devices found:", devices.map(d => d.kind));
        
        const hasCam = devices.some(d => d.kind === "videoinput");
        const hasMic = devices.some(d => d.kind === "audioinput");

        if (!hasMic) {
          toast.error("No microphone detected. Please connect one to start a call.");
          return;
        }

        if (type === "video" && !hasCam) {
          toast.error("No camera detected. Starting audio call instead.");
          type = "audio"; // Fallback to audio
        }

        // Simplest constraints for maximum compatibility
        const constraints = {
          video: type === "video",
          audio: true,
        };

        let stream;
        try {
          console.log("Attempting to get media with constraints:", constraints);
          stream = await navigator.mediaDevices.getUserMedia(constraints);
        } catch (initialErr) {
          console.error("Initial getUserMedia failed:", initialErr);
          
          // Fallback: If video failed due to permission or not found, try audio-only if that's allowed
          if (type === "video" && (initialErr.name === "NotAllowedError" || initialErr.name === "NotFoundError" || initialErr.name === "DevicesNotFoundError")) {
            console.log("Video failed, attempting audio-only fallback...");
            toast.error("Camera access failed. Trying to start as a voice call...");
            stream = await navigator.mediaDevices.getUserMedia({ video: false, audio: true });
            type = "audio"; // Update the call type for the rest of the flow
          } else {
            throw initialErr; // Rethrow if it's already an audio request or something else
          }
        }
        
        const peer = createPeer(true, stream);
        const timeoutId = setTimeout(() => {
          const state = get().callState;
          if (state === "calling" || state === "ringing") {
            get().actions.endCall("timeout");
            toast.error("User did not answer.");
          }
        }, 45000);

        set({
          peer,
          localStream: stream,
          callState: "calling",
          callType: type,
          caller: authUser,
          receiver: selectedUser,
          callTimeoutRef: timeoutId,
        });

        peer.on("signal", (data) => {
          const socket = getSocket();
          socket.emit("call-user", {
            receiverId: selectedUser._id,
            offer: data,
            caller: authUser,
            callType: type,
          });
        });

      } catch (err) {
        console.error("Final media acquisition failure:", err);
        
        if (err.name === "NotAllowedError" || err.name === "PermissionDeniedError") {
          toast.error("Permission denied. Please ensure you've allowed camera/microphone access in your browser or OS settings.");
        } else if (err.name === "NotFoundError" || err.name === "DevicesNotFoundError") {
          toast.error("No camera or microphone found. Please connect your hardware and try again.");
        } else if (err.name === "NotReadableError" || err.name === "TrackStartError") {
          toast.error("Your camera/microphone is already in use by another application.");
        } else {
          toast.error(`Call failed: ${err.message || "Unknown error"}`);
        }
        get().actions.reset();
      }
    },

    answerCall: () => {
      // Guard: Prevent multiple answer calls
      if (get().callState !== "receiving") return;

      const { caller, callType } = get();
      
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        toast.error("Your browser does not support answering calls. Please use a modern browser.");
        return;
      }

      const constraints = {
        video: callType === "video" ? { facingMode: "user", width: { ideal: 1280 }, height: { ideal: 720 } } : false,
        audio: true,
      };

      // Set state to a "connecting" sub-state to prevent double clicks
      set({ callState: "answering" });

      navigator.mediaDevices.getUserMedia(constraints)
        .then((stream) => {
          const { offer, callTimeoutRef } = get();
          
          if (callTimeoutRef) clearTimeout(callTimeoutRef);

          const peer = createPeer(false, stream);

          peer.on("signal", (data) => {
            const socket = getSocket();
            socket.emit("answer-call", {
              callerId: caller?._id,
              answer: data,
            });
          });

          if (offer) peer.signal(offer);
          set({ peer, localStream: stream, callState: "in-call", callTimeoutRef: null, callStartTime: Date.now() });
        })
        .catch((err) => {
          console.error("Failed to get local stream for answering", err);
          
          if (err.name === "NotAllowedError" || err.name === "PermissionDeniedError") {
            toast.error("Permission denied. Please allow access to answer.");
          } else if (err.name === "NotFoundError" || err.name === "DevicesNotFoundError") {
            toast.error("No camera or microphone found to answer the call.");
          } else {
            toast.error(`Could not answer call: ${err.message || "Unknown error"}`);
          }
          get().actions.declineCall();
        });
    },

    declineCall: () => {
      const { caller } = get();
      const socket = getSocket();
      socket.emit("decline-call", { callerId: caller._id });
      get().actions.reset();
    },

    endCall: (reason = null) => {
      const { caller, receiver, callState, callType, callStartTime } = get();
      const { authUser } = useAuthStore.getState();
      const target = caller?._id === authUser?._id ? receiver : caller;
      
      const isInitiator = caller?._id === authUser?._id;

      if (isInitiator && receiver?._id) {
        let status = "canceled";
        if (callState === "in-call") status = "answered";
        else if (reason === "timeout") status = "missed";

        const duration = callState === "in-call" ? Math.floor((Date.now() - callStartTime) / 1000) : 0;
        useChatStore.getState().logCall(receiver._id, callType, status, duration);
      }
      
      if (target?._id) {
        const socket = getSocket();
        socket.emit("call-ended", { receiverId: target._id });
      }
      get().actions.reset();
    },

    reset: () => {
      const { callTimeoutRef } = get();
      if (callTimeoutRef) clearTimeout(callTimeoutRef);

      get().localStream?.getTracks().forEach((track) => track.stop());
      get().peer?.destroy();
      set({
        callState: "idle",
        callType: null,
        localStream: null,
        remoteStream: null,
        caller: null,
        receiver: null,
        peer: null,
        isMuted: false,
        isCameraOff: false,
        isSpeakerOff: false,
        cameraFacingMode: "user",
        callTimeoutRef: null,
        callStartTime: null,
        isReconnecting: false,
        networkQuality: 3,
      });
    },

    initializeSocketListeners: () => {
      const socket = getSocket();
      if (!socket) return;

      // Remove existing listeners to avoid duplicates
      socket.off("call-made");
      socket.off("call-answered");
      socket.off("call-received");
      socket.off("call-declined");
      socket.off("call-ended");

      socket.on("call-made", (data) => {
        if (get().callState !== "idle") {
          socket.emit("decline-call", { callerId: data.caller._id });
          return;
        }

        const { authUser } = useAuthStore.getState();
        // Notify caller that we've received the call
        socket.emit("call-received", { callerId: data.caller._id });

        const timeoutId = setTimeout(() => {
          if (get().callState === "receiving") {
            get().actions.declineCall();
            get().actions.addMissedCall(data.caller);
            toast("Missed call", { icon: "📞" });
          }
        }, 30000);

        set({
          callState: "receiving",
          caller: data.caller,
          receiver: authUser,
          callType: data.callType,
          offer: data.offer, // Capture offer
          callTimeoutRef: timeoutId,
        });
      });

      socket.on("call-received", () => {
        if (get().callState === "calling") {
          set({ callState: "ringing" });
        }
      });

      socket.on("call-answered", (data) => {
        const { peer, callTimeoutRef, callState } = get();
        if (callTimeoutRef) clearTimeout(callTimeoutRef);

        // Guard: Only signal if the peer exists, isn't destroyed, and we aren't already in-call
        if (peer && !peer.destroyed && (callState === "calling" || callState === "ringing")) {
          try {
            peer.signal(data.answer);
            set({ callState: "in-call", callTimeoutRef: null, callStartTime: Date.now() });
          } catch (err) {
            console.error("Error signaling answer:", err);
          }
        }
      });
      
      socket.on("call-declined", () => {
        const { receiver, callType } = get();
        if (receiver) {
           useChatStore.getState().logCall(receiver._id, callType, "missed", 0);
        }
        get().actions.reset();
      });

      socket.on("call-ended", () => {
        const { callState, caller, receiver, callType, callStartTime } = get();
        const { authUser } = useAuthStore.getState();
        const isInitiator = caller?._id === authUser?._id;

        if (callState === "receiving" && caller) {
          get().actions.addMissedCall(caller);
          toast("Missed call", { icon: "📞" });
        } else if (isInitiator && callState === "in-call" && receiver) {
          const duration = Math.floor((Date.now() - callStartTime) / 1000);
          useChatStore.getState().logCall(receiver._id, callType, "answered", duration);
        }

        get().actions.reset();
      });
    },
  },
}));

export default useCallStore;
