import { createPortal } from "react-dom";
import useCallStore from "../store/useCallStore";
import { useAuthStore } from "../store/useAuthStore";
import {
  Mic, MicOff, PhoneOff, Video, VideoOff,
  Volume2, VolumeX, SwitchCamera, Phone,
  Wifi, WifiOff, Signal
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useEffect, useRef, useState } from "react";

/* ─── Utility: format seconds → mm:ss ─── */
const fmt = (s) =>
  `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;

/* ─── Network quality badge ─── */
const NetworkBadge = ({ quality }) => {
  const label = quality === 3 ? "HD" : quality === 2 ? "Fair" : quality === 1 ? "Poor" : "Lost";
  const barColors = [
    quality >= 1 ? (quality === 1 ? "#f87171" : quality === 2 ? "#fbbf24" : "#34d399") : "#ffffff33",
    quality >= 2 ? (quality === 2 ? "#fbbf24" : "#34d399") : "#ffffff33",
    quality >= 3 ? "#34d399" : "#ffffff33",
  ];
  return (
    <div className="flex items-center gap-2 bg-black/40 backdrop-blur-xl px-3 py-2 rounded-2xl border border-white/10 shadow-lg">
      <div className="flex items-end gap-[3px] h-4">
        {barColors.map((color, i) => (
          <div
            key={i}
            style={{ height: `${(i + 1) * 33}%`, background: color }}
            className="w-[3px] rounded-full transition-all duration-700"
          />
        ))}
      </div>
      <span className="text-[10px] font-bold uppercase tracking-widest text-white/80">{label}</span>
    </div>
  );
};

/* ─── Control Button ─── */
const CtrlBtn = ({ onClick, active, danger, icon, label, hidden }) => {
  if (hidden) return null;
  return (
    <div className="flex flex-col items-center gap-2">
      <motion.button
        whileHover={{ scale: 1.08 }}
        whileTap={{ scale: 0.92 }}
        onClick={onClick}
        title={label}
        className={`w-14 h-14 rounded-full flex items-center justify-center border transition-all duration-200 shadow-lg
          ${danger
            ? "bg-rose-500 border-rose-400/40 text-white shadow-rose-500/40 hover:bg-rose-600 hover:shadow-rose-500/60"
            : active
            ? "bg-white text-zinc-900 border-white/20 shadow-white/10"
            : "bg-white/10 text-white border-white/10 hover:bg-white/20 backdrop-blur-md"
          }`}
      >
        {icon}
      </motion.button>
      <span className="text-[10px] text-white/50 font-medium tracking-wider uppercase">{label}</span>
    </div>
  );
};

/* ═══════════════════════════════════════════
   MAIN COMPONENT
═══════════════════════════════════════════ */
const CallModal = () => {
  const {
    callState, callType,
    localStream, remoteStream,
    caller, receiver,
    actions,
    isMuted, isCameraOff, isSpeakerOff,
    isReconnecting, networkQuality,
  } = useCallStore();

  const { authUser } = useAuthStore();
  const localVideoRef  = useRef(null);
  const remoteVideoRef = useRef(null);
  const [callDuration, setCallDuration] = useState(0);
  const [showControls, setShowControls] = useState(true);
  const controlsTimer = useRef(null);

  // Derived state (needs to be at the top so it can be used in effects)
  const otherUser = caller?._id === authUser?._id ? receiver : caller;
  const inCall    = callState === "in-call";
  const isVideo   = callType === "video";
  const hasRemoteVideo = isVideo && !!remoteStream;

  /* ─── Attach streams ─── */
  useEffect(() => {
    if (localStream && localVideoRef.current) {
      localVideoRef.current.srcObject = localStream;
    }
  }, [localStream, isVideo, hasRemoteVideo]); // Re-run when layout/visibility changes

  useEffect(() => {
    if (remoteStream && remoteVideoRef.current) {
      remoteVideoRef.current.srcObject = remoteStream;
      remoteVideoRef.current.muted = isSpeakerOff;
    }
  }, [remoteStream, hasRemoteVideo, isSpeakerOff]);

  /* ─── Call timer ─── */
  useEffect(() => {
    let t;
    if (inCall) {
      t = setInterval(() => setCallDuration((p) => p + 1), 1000);
    } else {
      setCallDuration(0);
    }
    return () => clearInterval(t);
  }, [inCall]);

  /* ─── Auto-hide controls on video call after 4s of no interaction ─── */
  const revealControls = () => {
    setShowControls(true);
    clearTimeout(controlsTimer.current);
    if (inCall && isVideo && remoteStream) {
      controlsTimer.current = setTimeout(() => setShowControls(false), 4000);
    }
  };

  useEffect(() => {
    revealControls();
    return () => clearTimeout(controlsTimer.current);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inCall, isVideo, remoteStream]);

  /* ─── Guard ─── */
  if (callState === "idle" || callState === "receiving") return null;

  return createPortal(
    <AnimatePresence>
      <motion.div
        key="call-modal"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={revealControls}
        onMouseMove={revealControls}
        className="fixed inset-0 z-[1000] bg-black flex flex-col overflow-hidden select-none"
      >
        {/* ══════════════════════════════════════
            BACKGROUND LAYER
        ══════════════════════════════════════ */}
        <div className="absolute inset-0 z-0">
          {/* Blurred profile background (always shown under everything) */}
          <img
            src={otherUser?.profilePic || "/avatar.png"}
            alt="bg"
            className="absolute w-full h-full object-cover scale-110 blur-3xl opacity-30"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-black/70 via-black/50 to-black/90" />
        </div>

        {/* ══════════════════════════════════════
            VIDEO LAYER (Local or Remote)
        ══════════════════════════════════════ */}
        <div className="absolute inset-0 z-10">
          {/* Main Remote Video */}
          <AnimatePresence>
            {hasRemoteVideo && (
              <motion.div
                key="remote-video-container"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.8 }}
                className="absolute inset-0 w-full h-full"
              >
                <video
                  ref={remoteVideoRef}
                  autoPlay
                  playsInline
                  className="w-full h-full object-cover"
                />
              </motion.div>
            )}
          </AnimatePresence>

          {/* Local Preview (shown full-screen when calling, or PiP when connected) */}
          <AnimatePresence>
            {isVideo && (
              <motion.div
                key="local-video-container"
                layout
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ 
                  opacity: 1,
                  scale: 1,
                  // When remote video exists, switch to PiP mode
                  ...(hasRemoteVideo ? {
                    top: "1.25rem",
                    right: "1.25rem",
                    width: "110px",
                    height: "160px",
                    borderRadius: "1rem",
                  } : {
                    top: 0,
                    right: 0,
                    width: "100%",
                    height: "100%",
                    borderRadius: 0,
                  })
                }}
                className={`absolute z-30 overflow-hidden shadow-2xl transition-all duration-500 border border-white/20
                  ${hasRemoteVideo ? "ring-1 ring-black/20" : "pointer-events-none border-none"}`}
              >
                <video
                  ref={localVideoRef}
                  autoPlay
                  playsInline
                  muted
                  className="w-full h-full object-cover"
                  style={{ transform: "scaleX(-1)" }}
                />
                
                {/* Subtle "You" tag inside PiP */}
                {hasRemoteVideo && (
                  <div className="absolute bottom-2 left-2 px-2 py-0.5 bg-black/40 backdrop-blur-md rounded-md border border-white/10">
                    <span className="text-[9px] font-bold text-white/90 uppercase tracking-tighter">You</span>
                  </div>
                )}
                
                {/* Visual feedback if camera is OFF */}
                {isCameraOff && (
                  <div className="absolute inset-0 bg-zinc-900 flex items-center justify-center">
                    <VideoOff size={hasRemoteVideo ? 20 : 40} className="text-white/20" />
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>

          {/* Subtle vignette for readability */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/30 pointer-events-none z-20" />
        </div>

        {/* ══════════════════════════════════════
            CENTER — Caller/Identity Info
        ══════════════════════════════════════ */}
        <div className={`relative z-20 flex-1 flex flex-col items-center justify-center gap-6 px-6 transition-all duration-700 ${hasRemoteVideo ? "opacity-0 scale-95 pointer-events-none" : "opacity-100 scale-100"}`}>
          {/* Pulsing avatar ring */}
          <div className="relative flex items-center justify-center">
            {/* Ripple rings */}
            {[1, 2, 3].map((i) => (
              <motion.div
                key={i}
                animate={{ scale: [1, 1.6 + i * 0.2], opacity: [0.25, 0] }}
                transition={{ duration: 2.5, repeat: Infinity, delay: i * 0.5, ease: "easeOut" }}
                className="absolute rounded-full border border-white/30"
                style={{ width: 160, height: 160 }}
              />
            ))}
            {/* Avatar */}
            <div className="relative w-36 h-36 md:w-44 md:h-44 rounded-full overflow-hidden ring-4 ring-white/10 shadow-2xl">
              <img
                src={otherUser?.profilePic || "/avatar.png"}
                alt={otherUser?.fullName}
                className="w-full h-full object-cover"
              />
            </div>
          </div>

          {/* Name */}
          <div className="text-center space-y-1">
            <h2 className="text-white text-2xl md:text-4xl font-bold tracking-tight drop-shadow-lg">
              {otherUser?.fullName}
            </h2>

            {/* Status row */}
            <div className="flex items-center justify-center gap-2 mt-1">
              {inCall ? (
                <p className="text-white/60 text-lg font-mono tracking-widest">{fmt(callDuration)}</p>
              ) : (
                <>
                  <p className="text-white/60 text-base font-medium">
                    {callState === "ringing" ? "Ringing" : isVideo ? "Starting video call" : "Calling"}
                  </p>
                  <div className="flex gap-1 items-end">
                    {[0, 1, 2].map((i) => (
                      <motion.span
                        key={i}
                        animate={{ opacity: [0.2, 1, 0.2] }}
                        transition={{ duration: 1.5, repeat: Infinity, delay: i * 0.2 }}
                        className="w-1.5 h-1.5 rounded-full bg-white/50 inline-block"
                      />
                    ))}
                  </div>
                </>
              )}
            </div>

            {/* Call type badge */}
            <div className="flex items-center justify-center gap-1.5 mt-2">
              {isVideo
                ? <Video size={13} className="text-sky-400" />
                : <Phone size={13} className="text-emerald-400" />
              }
              <span className="text-xs text-white/40 font-medium uppercase tracking-widest">
                {isVideo ? "Video Call" : "Voice Call"}
              </span>
            </div>
          </div>
        </div>

        {/* ══════════════════════════════════════
            TOP BAR — Timer + Network (in-call)
        ══════════════════════════════════════ */}
        <AnimatePresence>
          {(showControls || !hasRemoteVideo) && (
            <motion.div
              key="topbar"
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.25 }}
              className="absolute top-0 left-0 right-0 z-50 flex items-start justify-between p-4 md:p-6"
            >
              {/* Network quality */}
              {inCall && <NetworkBadge quality={networkQuality} />}

              {/* Center: In-call duration when video is active */}
              {inCall && hasRemoteVideo && (
                <div className="absolute left-1/2 -translate-x-1/2 top-4 md:top-6 flex flex-col items-center">
                  <p className="text-white text-sm font-bold tracking-wider font-mono drop-shadow-md">
                    {fmt(callDuration)}
                  </p>
                  <p className="text-white/50 text-[10px] uppercase tracking-widest mt-0.5">
                    {otherUser?.fullName}
                  </p>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {/* ══════════════════════════════════════
            RECONNECTING PILL
        ══════════════════════════════════════ */}
        <AnimatePresence>
          {isReconnecting && (
            <motion.div
              key="reconnect"
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="absolute top-20 left-0 right-0 z-[70] flex justify-center pointer-events-none"
            >
              <div className="flex items-center gap-3 bg-zinc-900/80 backdrop-blur-2xl px-5 py-2.5 rounded-full border border-white/10 shadow-2xl">
                <div className="w-4 h-4 rounded-full border-2 border-amber-400 border-t-transparent animate-spin" />
                <span className="text-sm font-medium text-white/90">Reconnecting…</span>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ══════════════════════════════════════
            BOTTOM CONTROLS
        ══════════════════════════════════════ */}
        <AnimatePresence>
          {(showControls || !hasRemoteVideo) && (
            <motion.div
              key="controls"
              initial={{ opacity: 0, y: 40 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 40 }}
              transition={{ duration: 0.3, ease: "easeOut" }}
              className="absolute bottom-0 left-0 right-0 z-50 flex justify-center pb-10 md:pb-14 px-4"
            >
              {/* Glassmorphism control pill */}
              <div
                className="flex items-end gap-4 md:gap-6 px-6 md:px-8 py-4 md:py-5 rounded-[2rem]"
                style={{
                  background: "rgba(15,15,20,0.65)",
                  backdropFilter: "blur(24px)",
                  WebkitBackdropFilter: "blur(24px)",
                  border: "1px solid rgba(255,255,255,0.08)",
                  boxShadow: "0 16px 48px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.06)",
                }}
              >
                {/* Camera — video only */}
                <CtrlBtn
                  hidden={!isVideo}
                  onClick={() => actions.toggleCamera()}
                  active={isCameraOff}
                  icon={isCameraOff ? <VideoOff size={20} /> : <Video size={20} />}
                  label={isCameraOff ? "Cam On" : "Cam Off"}
                />

                {/* Mic */}
                <CtrlBtn
                  onClick={() => actions.toggleMute()}
                  active={isMuted}
                  icon={isMuted ? <MicOff size={20} /> : <Mic size={20} />}
                  label={isMuted ? "Unmute" : "Mute"}
                />

                {/* Speaker */}
                <CtrlBtn
                  onClick={() => actions.toggleSpeaker()}
                  active={isSpeakerOff}
                  icon={isSpeakerOff ? <VolumeX size={20} /> : <Volume2 size={20} />}
                  label={isSpeakerOff ? "Spkr On" : "Spkr Off"}
                />

                {/* Divider */}
                <div className="w-px h-10 bg-white/10 mx-1" />

                {/* End Call */}
                <CtrlBtn
                  danger
                  onClick={() => actions.endCall()}
                  icon={<PhoneOff size={22} />}
                  label="End"
                />
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </AnimatePresence>,
    document.body
  );
};

export default CallModal;
