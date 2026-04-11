import Peer from "simple-peer";
import { getSocket } from "./socket";
import useCallStore from "../store/useCallStore";

let peer;
let statsInterval;

export const createPeer = (initiator, localStream) => {
  if (statsInterval) clearInterval(statsInterval);
  
  peer = new Peer({
    initiator,
    trickle: false,
    stream: localStream,
  });

  peer.on("stream", (remoteStream) => {
    useCallStore.getState().actions.setRemoteStream(remoteStream);
  });

  if (peer._pc) {
    peer._pc.addEventListener("iceconnectionstatechange", () => {
      const state = peer._pc.iceConnectionState;
      if (state === "disconnected") {
        useCallStore.getState().actions.setIsReconnecting(true);
        useCallStore.getState().actions.setNetworkQuality(0);
        
        // WebRTC rarely recovers from full Wi-Fi drops without an ICE Restart renegotiation pipeline.
        // We set a hard 15s limit to drop the call instead of hanging infinitely on "Reconnecting..."
        if (!peer.reconnectTimer) {
          peer.reconnectTimer = setTimeout(() => {
            if (peer._pc && peer._pc.iceConnectionState === "disconnected") {
              useCallStore.getState().actions.setIsReconnecting(false);
              useCallStore.getState().actions.endCall();
              import("react-hot-toast").then(m => m.default.error("Connection lost completely"));
            }
          }, 15000);
        }
      } else if (state === "connected" || state === "completed") {
        useCallStore.getState().actions.setIsReconnecting(false);
        if (peer.reconnectTimer) {
          clearTimeout(peer.reconnectTimer);
          peer.reconnectTimer = null;
        }
      } else if (state === "failed") {
        useCallStore.getState().actions.setIsReconnecting(false);
        useCallStore.getState().actions.endCall();
        import("react-hot-toast").then(m => m.default.error("Connection failed"));
      }
    });

    statsInterval = setInterval(async () => {
      if (!peer || !peer._pc) return clearInterval(statsInterval);
      const state = peer._pc.iceConnectionState;
      if (state !== "connected" && state !== "completed") return;

      try {
        const stats = await peer._pc.getStats();
        let maxRtt = 0;
        let maxPacketLoss = 0;

        stats.forEach((report) => {
          if (report.type === "candidate-pair" && report.state === "succeeded") {
            if (report.currentRoundTripTime) maxRtt = Math.max(maxRtt, report.currentRoundTripTime * 1000);
          }
          if (report.type === "inbound-rtp" && report.kind === "video") {
            const lost = report.packetsLost || 0;
            const received = report.packetsReceived || 0;
            if (received + lost > 0) maxPacketLoss = Math.max(maxPacketLoss, lost / (received + lost));
          }
        });

        let quality = 3;
        if (maxRtt > 500 || maxPacketLoss > 0.05) quality = 1;
        else if (maxRtt > 200 || maxPacketLoss > 0.02) quality = 2;

        useCallStore.getState().actions.setNetworkQuality(quality);
      } catch (err) {}
    }, 2000);
  }

  peer.on("close", () => {
    if (statsInterval) clearInterval(statsInterval);
    if (peer.reconnectTimer) clearTimeout(peer.reconnectTimer);
  });

  return peer;
};

export const getPeer = () => peer;
