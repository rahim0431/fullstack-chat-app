let audioContext = null;
let activeLoop = null;

const getContext = () => {
  if (!audioContext) {
    audioContext = new (window.AudioContext || window.webkitAudioContext)();
  }
  return audioContext;
};

// One-time listener to unlock audio on first interaction
if (typeof window !== "undefined") {
  const unlockAudio = () => {
    const ctx = getContext();
    if (ctx.state === "suspended") {
      ctx.resume().then(() => {
        if (ctx.state === "running") {
          window.removeEventListener("click", unlockAudio);
          window.removeEventListener("touchstart", unlockAudio);
          window.removeEventListener("keydown", unlockAudio);
        }
      });
    }
  };
  window.addEventListener("click", unlockAudio);
  window.addEventListener("touchstart", unlockAudio);
  window.addEventListener("keydown", unlockAudio);
}

const playTone = (freq, start, duration, type = "sine", volume = 0.1) => {
  const ctx = getContext();
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();

  osc.type = type;
  osc.frequency.setValueAtTime(freq, start);

  gain.gain.setValueAtTime(0.0001, start);
  gain.gain.linearRampToValueAtTime(volume, start + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);

  osc.connect(gain);
  gain.connect(ctx.destination);

  osc.start(start);
  osc.stop(start + duration + 0.05);
};

// Popular melody patterns (Pitch + Duration + Gap)
const MELODIES = {
  nokia: [
    [659, 0.1], [587, 0.1], [370, 0.2], [415, 0.2],
    [554, 0.1], [493, 0.1], [293, 0.2], [329, 0.2],
    [493, 0.1], [440, 0.1], [277, 0.2], [329, 0.2], [440, 0.4]
  ],
  marimba: [
    [523, 0.08], [659, 0.08], [784, 0.08], [1046, 0.15],
    [784, 0.08], [659, 0.08], [523, 0.15]
  ],
  digital: [
    [880, 0.1], [1760, 0.1], [880, 0.1], [1760, 0.1]
  ]
};

export const playNotificationSound = (name = "Default Chime") => {
  const ctx = getContext();
  const now = ctx.currentTime;

  switch (name) {
    case "Crystal Ping":
      playTone(1046, now, 0.18, "triangle", 0.1);
      playTone(1318, now + 0.14, 0.18, "triangle", 0.1);
      break;
    case "Soft Bell":
      playTone(440, now, 0.22);
      playTone(660, now + 0.16, 0.22);
      break;
    case "Warm Pulse":
      playTone(330, now, 0.2, "sine", 0.12);
      playTone(330, now + 0.24, 0.2, "sine", 0.12);
      break;
    case "Pop Tone":
      playTone(880, now, 0.12, "square", 0.08);
      break;
    default:
      // Generic chime
      playTone(523, now, 0.18);
      playTone(659, now + 0.14, 0.18);
      playTone(784, now + 0.28, 0.18);
  }
};

export const startRingtone = (type = "marimba") => {
  stopAllSounds();
  const ctx = getContext();
  const melody = MELODIES[type] || MELODIES.marimba;
  
  let isPlaying = true;
  const loop = () => {
    if (!isPlaying) return;
    let time = ctx.currentTime;
    melody.forEach(([freq, dur]) => {
      playTone(freq, time, dur, "triangle", 0.15);
      time += dur + 0.05;
    });
    activeLoop = setTimeout(loop, 2000); // Repeat every 2 seconds
  };
  
  loop();
  return () => { isPlaying = false; clearTimeout(activeLoop); };
};

export const startRingback = () => {
  stopAllSounds();
  const ctx = getContext();
  
  let isPlaying = true;
  const loop = () => {
    if (!isPlaying) return;
    const now = ctx.currentTime;
    // Standard ringback tone: 440Hz + 480Hz
    playTone(440, now, 2.0, "sine", 0.05);
    playTone(480, now, 2.0, "sine", 0.05);
    activeLoop = setTimeout(loop, 6000); // 2s on, 4s off
  };
  
  loop();
  return () => { isPlaying = false; clearTimeout(activeLoop); };
};

export const stopAllSounds = () => {
  if (activeLoop) {
    clearTimeout(activeLoop);
    activeLoop = null;
  }
};
