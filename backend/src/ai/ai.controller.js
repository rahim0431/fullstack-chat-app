import { generateText } from "./textAI.js";
import { generateImage } from "./imageAI.js";
import { generateVideo } from "./videoAI.js";
import { enhancePrompt } from "./promptEnhancer.js";
import AIMessage from "../models/aiMessage.model.js";
import ytdl from "@distube/ytdl-core";

export const getAIResponse = async (req, res) => {
  try {
    const { prompt, mode, style, imageData } = req.body;
    const userId = req.user._id;
    const normalizedMode = (mode || "TEXT").toString().toUpperCase();
    const trimmedPrompt = (prompt || "").toString().trim();
    const aiSettings = req.user?.aiSettings || {};
    const responseTone = aiSettings.responseTone || "Friendly";
    const safetyLevel = aiSettings.safetyLevel || "Standard";
    const autoSaveHistory = aiSettings.autoSaveHistory !== false;

    // Check if there's actual content
    if (!trimmedPrompt && !imageData) {
      return res.status(400).json({ error: "Prompt is required" });
    }

    const toneMap = {
      Friendly: "warm, supportive, and friendly",
      Professional: "professional, clear, and concise",
      Casual: "casual, relaxed, and approachable",
    };

    const safetyMap = {
      Strict: "Follow strict safety guidelines. Refuse harmful or illegal requests and prioritize user safety.",
      Standard: "Follow standard safety guidelines and avoid harmful or illegal advice.",
      Creative: "Be imaginative while still avoiding explicit illegal or harmful instructions.",
    };

    const baseInstruction = `You are an AI assistant inside a chat app. Respond in a ${toneMap[responseTone] || toneMap.Friendly} tone. ${safetyMap[safetyLevel] || safetyMap.Standard}`;
    const finalPrompt = trimmedPrompt ? `${baseInstruction}\nUser: ${trimmedPrompt}` : baseInstruction;
    const visionPrompt = trimmedPrompt
      ? finalPrompt
      : `${baseInstruction}\nUser: What's in this image?`;

    // Save the user's message
    if (autoSaveHistory) {
      await AIMessage.create({
        userId,
        sender: "user",
        type: "text",
        content: trimmedPrompt || (imageData ? "Image attached" : "")
      });
    }

    if (normalizedMode === "IMAGE") {
      const mood =
        responseTone === "Professional"
          ? "clean professional mood"
          : responseTone === "Casual"
            ? "casual candid mood"
            : "warm friendly mood";
      const enhancedPrompt = enhancePrompt(`${trimmedPrompt} ${mood}`.trim(), style);
      const result = await generateImage(enhancedPrompt);

      // Save the AI's response
      if (autoSaveHistory) {
        await AIMessage.create({
          userId,
          sender: "ai",
          type: "image",
          content: result.attachment
        });
      }

      return res.json({
        success: true,
        attachment: result.attachment,
        response: result.response
      });
    }

    if (normalizedMode === "VIDEO") {
      const mood =
        responseTone === "Professional"
          ? "professional"
          : responseTone === "Casual"
            ? "casual"
            : "friendly";
      const result = await generateVideo(`${trimmedPrompt} ${mood}`.trim());

      if (autoSaveHistory) {
        await AIMessage.create({
          userId,
          sender: "ai",
          type: result.type || "video",
          content: result.attachment
        });
      }

      return res.json({
        success: true,
        type: result.type || "video",
        attachment: result.attachment,
        response: result.response
      });
    }

    if (normalizedMode === "AUDIO") {
      const { generateAudio } = await import("./audioAI.js");
      const result = await generateAudio(trimmedPrompt, style, {
        responseTone,
        safetyLevel,
      });

      const resolvedType = result?.type || "audio";
      const resolvedContent =
        resolvedType === "text"
          ? result?.response || ""
          : result?.attachment || "";

      if (autoSaveHistory) {
        await AIMessage.create({
          userId,
          sender: "ai",
          type: resolvedType,
          content: resolvedContent
        });
      }

      return res.json({
        success: true,
        type: resolvedType,
        attachment: resolvedContent,
        response: result.response || ""
      });
    }

    // If imageData is provided, use vision model
    let result;
    if (imageData) {
      result = await generateText(visionPrompt, imageData);
    } else {
      result = await generateText(finalPrompt);
    }

    // Save the AI's response
    if (autoSaveHistory) {
      await AIMessage.create({
        userId,
        sender: "ai",
        type: "text",
        content: result
      });
    }

    return res.json({
      success: true,
      reply: result
    });
  } catch (error) {
    console.error("AI Controller Error:", error);
    let errorMessage = "AI failed to process your request";
    
    if (error.message?.includes("clipboard") || error.message?.includes("image")) {
      errorMessage = "Cannot process clipboard content as image. Please attach an actual image file instead.";
    } else if (error.message) {
      // Pass through specific Gemini API errors so the user can debug their API issues
      errorMessage = error.message;
    }

    res.status(500).json({
      error: errorMessage
    });
  }
};

export const getAIHistory = async (req, res) => {
  try {
    const userId = req.user._id;
    if (req.user?.aiSettings?.autoSaveHistory === false) {
      return res.status(200).json([]);
    }
    const all = String(req.query.all || "").toLowerCase() === "true";
    const requestedLimit = Number(req.query.limit || 50);
    const limit = Number.isFinite(requestedLimit)
      ? Math.min(Math.max(requestedLimit, 1), 2000)
      : 50;

    const query = AIMessage.find({ userId }).sort({ createdAt: -1 });
    if (!all) query.limit(limit);
    const history = await query.lean();

    res.status(200).json(history.reverse());
  } catch (error) {
    console.error("Fetch AI History Error:", error);
    res.status(500).json({ error: "Failed to fetch AI history" });
  }
};

export const clearAIHistory = async (req, res) => {
  try {
    const userId = req.user._id;
    await AIMessage.deleteMany({ userId });
    res.status(200).json({ success: true, message: "AI Chat history cleared" });
  } catch (error) {
    console.error("Clear AI History Error:", error);
    res.status(500).json({ error: "Failed to clear AI history" });
  }
};

export const deleteAIMessage = async (req, res) => {
  try {
    const userId = req.user._id;
    const { id } = req.params;

    const message = await AIMessage.findById(id);
    if (!message) {
      return res.status(404).json({ error: "Message not found" });
    }

    if (message.userId.toString() !== userId.toString()) {
      return res.status(403).json({ error: "Unauthorized to delete this message" });
    }

    await AIMessage.findByIdAndDelete(id);
    res.status(200).json({ success: true, message: "Message deleted", id });
  } catch (error) {
    console.error("Delete AI Message Error:", error);
    res.status(500).json({ error: "Failed to delete AI message" });
  }
};

export const streamAudioProxy = async (req, res) => {
  try {
    const videoId = req.query.v;
    if (!videoId) return res.status(400).send("No video ID provided");

    const url = `https://www.youtube.com/watch?v=${videoId}`;
    const requestOptions = {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
        "Accept-Language": "en-US,en;q=0.9",
      },
    };

    const getInfoWithClients = async (playerClients) =>
      ytdl.getInfo(url, { requestOptions, playerClients });

    let info;
    try {
      info = await getInfoWithClients(["ANDROID", "WEB"]);
    } catch {
      info = await ytdl.getInfo(url, { requestOptions });
    }

    let audioFormats = ytdl.filterFormats(info.formats, "audioonly");
    if (!audioFormats.length) {
      info = await getInfoWithClients(["WEB"]);
      audioFormats = ytdl.filterFormats(info.formats, "audioonly");
    }

    if (!audioFormats.length) {
      return res.status(404).send("No playable audio format found");
    }

    const format = ytdl.chooseFormat(audioFormats, { quality: "highestaudio" });
    if (!format || !format.url) {
      return res.status(404).send("No playable audio format found");
    }

    const mimeType = (format.mimeType || "audio/mpeg").split(";")[0];
    const total = format.contentLength ? Number(format.contentLength) : null;
    const range = req.headers.range;

    if (range && Number.isFinite(total)) {
      const [startStr, endStr] = range.replace(/bytes=/, "").split("-");
      const start = Number.parseInt(startStr || "0", 10);
      const end = Number.isFinite(Number(endStr)) ? Number(endStr) : total - 1;

      if (Number.isNaN(start) || Number.isNaN(end) || start > end) {
        return res.status(416).set("Content-Range", `bytes */${total}`).end();
      }

      res.status(206);
      res.set({
        "Content-Range": `bytes ${start}-${end}/${total}`,
        "Accept-Ranges": "bytes",
        "Content-Length": end - start + 1,
        "Content-Type": mimeType,
      });

      ytdl(url, { format, range: { start, end } }).pipe(res);
      return;
    }

    res.status(200);
    res.set({
      "Accept-Ranges": "bytes",
      "Content-Type": mimeType,
      ...(Number.isFinite(total) ? { "Content-Length": total } : {}),
    });

    ytdl(url, { format }).pipe(res);
  } catch (error) {
    console.error("Audio Proxy Error:", error);
    res.status(500).send("Failed to stream audio proxy");
  }
};

export const reactToAIMessage = async (req, res) => {
  try {
    const { id } = req.params;
    const { emoji } = req.body;
    const userId = req.user._id;

    if (!emoji) return res.status(400).json({ error: "Emoji is required" });

    const message = await AIMessage.findById(id);
    if (!message) return res.status(404).json({ error: "Message not found" });

    if (message.userId.toString() !== userId.toString()) {
      return res.status(403).json({ error: "Unauthorized to react to this message" });
    }

    const userReactionIndex = message.reactions.findIndex(
      (r) => r.userId.toString() === userId.toString()
    );

    if (userReactionIndex > -1) {
      if (message.reactions[userReactionIndex].emoji === emoji) {
        message.reactions.splice(userReactionIndex, 1);
      } else {
        message.reactions[userReactionIndex].emoji = emoji;
      }
    } else {
      message.reactions.push({ emoji, userId });
    }

    await message.save();
    res.status(200).json({ success: true, reactions: message.reactions, messageId: id });
  } catch (error) {
    console.error("Error in reactToAIMessage controller:", error.message);
    res.status(500).json({ error: "Internal server error" });
  }
};
