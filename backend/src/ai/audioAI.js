import { generateText } from "./textAI.js";

export const generateAudio = async (prompt, style, options = {}) => {
  try {
    // TTS-only Voice Assistant (stable and reliable).
    const languageInstruction = style === "tamil" ? "Respond in Tamil." : "Respond in English.";
    const toneMap = {
      Friendly: "warm, friendly, and supportive",
      Professional: "professional and concise",
      Casual: "casual and relaxed",
    };
    const safetyMap = {
      Strict: "Follow strict safety guidelines and refuse harmful or illegal requests.",
      Standard: "Follow standard safety guidelines and avoid harmful or illegal advice.",
      Creative: "Be imaginative while still avoiding explicit illegal or harmful instructions.",
    };
    const toneInstruction = toneMap[options.responseTone] || toneMap.Friendly;
    const safetyInstruction = safetyMap[options.safetyLevel] || safetyMap.Standard;
    const systemPrompt = `You are a conversational voice assistant. The user is talking to you directly. Keep your reply highly conversational, ${toneInstruction}, and extremely concise (under 180 characters). ${safetyInstruction} ${languageInstruction} Do not use emojis, markdown, or special formatting since your exact text will be read aloud by a Text-to-Speech engine. The user says: "${prompt}"`;
    
    let textReply = "";
    try {
      textReply = await generateText(systemPrompt);
    } catch (genError) {
      console.error("Voice text generation error:", genError?.message || genError);
      const fallback =
        style === "tamil"
          ? "மன்னிக்கவும், தயவுசெய்து மீண்டும் முயற்சிக்கவும்."
          : "Sorry, please try again in a moment.";
      textReply = (prompt || "").trim() || fallback;
    }

    let cleanText = String(textReply || "").replace(/[*#_`~"]/g, "").trim();
    if (!cleanText) {
      cleanText =
        style === "tamil"
          ? "மன்னிக்கவும், தயவுசெய்து மீண்டும் முயற்சிக்கவும்."
          : "Sorry, please try again in a moment.";
    }
    if (cleanText.length > 199) {
        cleanText = cleanText.substring(0, 196) + "...";
    }

    // Assign language based on Voice selector
    let tl = "en-US";
    if (style === "tamil") tl = "ta-IN";
    if (style === "english") tl = "en-US";
    
    const audioUrl = `https://translate.google.com/translate_tts?ie=UTF-8&client=tw-ob&tl=${tl}&q=${encodeURIComponent(cleanText)}`;

    // Buffer the text-to-speech audio on the backend so the frontend player never hits a CORS block.
    try {
      const response = await fetch(audioUrl, {
        headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)" }
      });

      if (!response.ok) {
        throw new Error(`TTS API Error: ${response.statusText}`);
      }

      const arrayBuffer = await response.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      const base64Audio = `data:audio/mp3;base64,${buffer.toString("base64")}`;

      return {
        type: "audio",
        response: cleanText, 
        attachment: base64Audio,
      };
    } catch (ttsError) {
      console.error("TTS fallback error:", ttsError?.message || ttsError);
      return {
        type: "text",
        response: "Audio is temporarily unavailable. Please try again in a moment.",
      };
    }
  } catch (error) {
    console.error("Audio Generation Error:", error);
    return {
      type: "text",
      response: "Audio is temporarily unavailable. Please try again in a moment.",
    };
  }
};
