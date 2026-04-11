import { createPortal } from "react-dom";
import useCallStore from "../store/useCallStore";
import { Phone, PhoneOff, Video } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useEffect, useRef, useState } from "react";

/* ─── Waveform pulse ring (decorative) ─── */
const PulseRings = ({ color = "255,255,255" }) => (
  <>
    {[1, 2, 3].map((i) => (
      <motion.div
        key={i}
        animate={{ scale: [1, 1.55 + i * 0.2], opacity: [0.3 - i * 0.05, 0] }}
        transition={{ duration: 2.8, repeat: Infinity, delay: i * 0.55, ease: "easeOut" }}
        className="absolute rounded-full"
        style={{
          width: 160,
          height: 160,
          border: `1.5px solid rgba(${color},0.35)`,
        }}
      />
    ))}
  </>
);

const IncomingCall = () => {
  const { callState, caller, callType, actions } = useCallStore();
  const isVideo = callType === "video";

  /* ─── Local camera preview for video calls ─── */
  const [localPreviewStream, setLocalPreviewStream] = useState(null);
  const previewVideoRef = useRef(null);
  const previewCleaned  = useRef(false);

  useEffect(() => {
    if (callState !== "receiving" || !isVideo) return;
    previewCleaned.current = false;

    navigator.mediaDevices
      .getUserMedia({ video: { facingMode: "user" }, audio: false })
      .then((stream) => {
        if (previewCleaned.current) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        setLocalPreviewStream(stream);
      })
      .catch((err) => {
        console.warn("Could not start video preview", err);
      });

    return () => {
      previewCleaned.current = true;
      setLocalPreviewStream((s) => {
        s?.getTracks().forEach((t) => t.stop());
        return null;
      });
    };
  }, [callState, isVideo]);

  useEffect(() => {
    if (previewVideoRef.current && localPreviewStream) {
      previewVideoRef.current.srcObject = localPreviewStream;
    }
  }, [localPreviewStream]);

  if (callState !== "receiving") return null;

  return createPortal(
    <AnimatePresence>
      <motion.div
        key="incoming-call"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.35 }}
        className="fixed inset-0 z-[1000] flex flex-col overflow-hidden"
      >
        {/* ══════════════════════════════════════
            BACKGROUND
        ══════════════════════════════════════ */}
        <div className="absolute inset-0 z-0">
          {/* Blurred caller avatar as background */}
          <img
            src={caller?.profilePic || "/avatar.png"}
            alt="bg"
            className="absolute w-full h-full object-cover scale-125 blur-3xl opacity-40"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-black/75 via-black/55 to-black/95" />
        </div>

        {/* ══════════════════════════════════════
            LOCAL CAMERA PREVIEW (video calls only)
            — Enhanced preview with better glassmorphism
        ══════════════════════════════════════ */}
        {isVideo && localPreviewStream && (
          <motion.div
            initial={{ opacity: 0, scale: 0.8, y: -20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{ type: "spring", stiffness: 200, damping: 25, delay: 0.5 }}
            className="absolute top-6 right-6 z-50 w-32 md:w-44 aspect-[3/4] rounded-3xl overflow-hidden
                       border border-white/20 shadow-2xl"
            style={{ 
              boxShadow: "0 12px 40px rgba(0,0,0,0.7), inset 0 0 0 1.5px rgba(255,255,255,0.18)",
              background: "rgba(0,0,0,0.4)",
              backdropFilter: "blur(12px)"
            }}
          >
            <video
              ref={previewVideoRef}
              autoPlay
              playsInline
              muted
              className="w-full h-full object-cover scale-x-[-1] transition-opacity duration-1000"
            />
            {/* Overlay for preview */}
            <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent pointer-events-none" />
            <div className="absolute bottom-3 left-3 bg-black/50 backdrop-blur-xl px-2.5 py-1 rounded-full text-[10px] text-white/90 font-bold tracking-wider uppercase">
              You
            </div>
          </motion.div>
        )}

        {/* ══════════════════════════════════════
            CENTER — CALLER INFO
        ══════════════════════════════════════ */}
        <div className="relative z-20 flex-1 flex flex-col items-center justify-center gap-6 px-6 -mt-8">
          {/* Call type pill */}
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 }}
            className={`flex items-center gap-1.5 px-4 py-1.5 rounded-full border text-xs font-bold uppercase tracking-widest
              ${isVideo
                ? "bg-sky-500/15 border-sky-400/30 text-sky-300"
                : "bg-emerald-500/15 border-emerald-400/30 text-emerald-300"
              }`}
          >
            {isVideo ? <Video size={12} /> : <Phone size={12} />}
            <span>Incoming {isVideo ? "Video" : "Voice"} Call</span>
          </motion.div>

          {/* Avatar + rings */}
          <motion.div
            initial={{ opacity: 0, scale: 0.85 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.1, type: "spring", stiffness: 180, damping: 22 }}
            className="relative flex items-center justify-center"
          >
            <PulseRings color={isVideo ? "56,189,248" : "52,211,153"} />
            <div
              className="relative w-36 h-36 md:w-44 md:h-44 rounded-full overflow-hidden shadow-2xl"
              style={{
                boxShadow: isVideo
                  ? "0 0 0 4px rgba(56,189,248,0.2), 0 0 0 8px rgba(56,189,248,0.08)"
                  : "0 0 0 4px rgba(52,211,153,0.2), 0 0 0 8px rgba(52,211,153,0.08)"
              }}
            >
              <img
                src={caller?.profilePic || "/avatar.png"}
                alt={caller?.fullName}
                className="w-full h-full object-cover"
              />
            </div>
          </motion.div>

          {/* Name + animated subtitle */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="text-center space-y-2"
          >
            <h2 className="text-white text-2xl md:text-4xl font-bold tracking-tight drop-shadow-lg">
              {caller?.fullName}
            </h2>

            <div className="flex items-center justify-center gap-2">
              <p className="text-white/50 text-sm font-medium">
                {isVideo ? "Wants to video call" : "is calling you"}
              </p>
              {/* Pulsing dots */}
              <div className="flex gap-1 items-center">
                {[0, 1, 2].map((i) => (
                  <motion.span
                    key={i}
                    animate={{ opacity: [0.2, 1, 0.2] }}
                    transition={{ duration: 1.6, repeat: Infinity, delay: i * 0.25 }}
                    className="w-1 h-1 rounded-full bg-white/50 inline-block"
                  />
                ))}
              </div>
            </div>
          </motion.div>
        </div>

        {/* ══════════════════════════════════════
            BOTTOM — ACCEPT / DECLINE BUTTONS
        ══════════════════════════════════════ */}
        <div className="relative z-30 flex justify-center gap-16 md:gap-28 pb-16 md:pb-20 px-6">

          {/* ── Decline ── */}
          <motion.div
            initial={{ opacity: 0, x: -30 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.35, type: "spring", stiffness: 200, damping: 20 }}
            className="flex flex-col items-center gap-3"
          >
            <motion.button
              whileHover={{ scale: 1.12 }}
              whileTap={{ scale: 0.9 }}
              onClick={() => actions.declineCall()}
              className="w-16 h-16 md:w-20 md:h-20 rounded-full bg-rose-500 text-white
                         flex items-center justify-center border border-rose-400/30
                         shadow-[0_0_24px_rgba(244,63,94,0.45)]
                         hover:shadow-[0_0_40px_rgba(244,63,94,0.7)]
                         hover:bg-rose-600 transition-all duration-200"
            >
              <PhoneOff size={26} />
            </motion.button>
            <span className="text-white/45 text-xs font-semibold uppercase tracking-[0.18em]">
              Decline
            </span>
          </motion.div>

          {/* ── Accept ── */}
          <motion.div
            initial={{ opacity: 0, x: 30 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.35, type: "spring", stiffness: 200, damping: 20 }}
            className="flex flex-col items-center gap-3"
          >
            <motion.button
              animate={{
                boxShadow: isVideo
                  ? ["0 0 20px rgba(56,189,248,0.3)", "0 0 50px rgba(56,189,248,0.7)", "0 0 20px rgba(56,189,248,0.3)"]
                  : ["0 0 20px rgba(34,197,94,0.3)", "0 0 50px rgba(34,197,94,0.7)", "0 0 20px rgba(34,197,94,0.3)"],
                scale: [1, 1.04, 1],
              }}
              transition={{ duration: 2.2, repeat: Infinity, ease: "easeInOut" }}
              whileHover={{ scale: 1.15, rotate: 5 }}
              whileTap={{ scale: 0.92 }}
              onClick={() => actions.answerCall()}
              className={`w-16 h-16 md:w-20 md:h-20 rounded-full text-white
                         flex items-center justify-center border transition-all duration-300
                         ${isVideo
                           ? "bg-sky-500 border-sky-400/40 hover:bg-sky-400 shadow-[0_0_30px_rgba(56,189,248,0.5)]"
                           : "bg-green-500 border-green-400/40 hover:bg-green-400 shadow-[0_0_30px_rgba(34,197,94,0.5)]"
                         }`}
            >
              {isVideo ? <Video size={28} /> : <Phone size={28} />}
            </motion.button>
            <span className="text-white/60 text-xs font-bold uppercase tracking-[0.2em] mt-1">
              {isVideo ? "Accept Video" : "Answer"}
            </span>
          </motion.div>
        </div>
      </motion.div>
    </AnimatePresence>,
    document.body
  );
};

export default IncomingCall;
