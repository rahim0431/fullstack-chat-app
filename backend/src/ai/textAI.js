import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

export const generateText = async (prompt, imageData = null) => {
  try {
    const model = genAI.getGenerativeModel({
      model: process.env.GEMINI_TEXT_MODEL || "gemini-2.5-flash"
    });

    let contents;
    if (imageData && imageData.data) {
      contents = [
        {
          role: "user",
          parts: [
            { text: prompt || "What's in this image?" },
            { inlineData: { mimeType: imageData.mimeType || "image/jpeg", data: imageData.data } }
          ]
        }
      ];
    } else {
      contents = prompt;
    }

    const result = await model.generateContent(contents);
    const response = await result.response;
    return response.text();

  } catch (error) {
    console.error("Gemini Error:", error.message);
    if (error.message && error.message.includes("clipboard")) {
      throw new Error("Cannot process clipboard content as image. Please attach an actual image file instead.");
    }
    throw error;
  }
};
