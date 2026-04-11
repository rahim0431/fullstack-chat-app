import { generateText } from "./textAI.js";
import { generateImage } from "./imageAI.js";
import { generateAudio } from "./audioAI.js";
import { generateVideo } from "./videoAI.js";

export const routeRequest = async (message) => {
  const intent = identifyIntent(message);

  switch (intent) {
    case "image":
      return await generateImage(message);
    case "audio":
      return await generateAudio(message);
    case "video":
      return await generateVideo(message);
    default:
      return await generateText(message);
  }
};

const identifyIntent = (message) => {
  const m = message.toLowerCase();
  if (m.startsWith("generate image") || m.includes("create image") || m.includes("draw")) return "image";
  if (m.startsWith("generate audio") || m.includes("text to speech") || m.startsWith("say")) return "audio";
  if (m.startsWith("generate video") || m.includes("create video") || m.includes("movie")) return "video";
  return "text";
};