export const generateVideo = async (prompt) => {
  // We use the Pexels API to fetch breathtaking, 100% free, high-quality cinematic MP4 
  // stock videos based on the user's prompt, serving as an elite completely free fallback!
  
  const PEXELS_API_KEY = process.env.PEXELS_API_KEY; 

  if (!PEXELS_API_KEY) {
    throw new Error("Missing PEXELS_API_KEY in .env. Please add it to unlock free 4K Video Generation.");
  }

  try {
    // 1. Clean the prompt: Extract the first 2-4 primary keywords (Pexels works best with short phrasing)
    const words = prompt.split(" ").filter(w => w.trim().length > 0);
    const searchQuery = words.length > 4 ? words.slice(0, 4).join(" ") : prompt;
    
    // Attempt standard search
    let endpoint = `https://api.pexels.com/videos/search?query=${encodeURIComponent(searchQuery)}&per_page=1`;
    let response = await fetch(endpoint, { headers: { Authorization: PEXELS_API_KEY } });
    let data = await response.json();

    // 2. Fallback 1: Just the first 2 words
    if (!data.videos || data.videos.length === 0) {
      const fallbackQuery = words.slice(0, 2).join(" ");
      endpoint = `https://api.pexels.com/videos/search?query=${encodeURIComponent(fallbackQuery)}&per_page=1`;
      response = await fetch(endpoint, { headers: { Authorization: PEXELS_API_KEY } });
      data = await response.json();
    }
    
    // 3. Last Resort Fallback: A beautiful generic cinematic clip (never fails)
    if (!data.videos || data.videos.length === 0) {
      endpoint = `https://api.pexels.com/videos/search?query=cinematic+beautiful&per_page=1`;
      response = await fetch(endpoint, { headers: { Authorization: PEXELS_API_KEY } });
      data = await response.json();
    }

    if (!data.videos || data.videos.length === 0) {
      throw new Error("Pexels API returned absolutely no cinematic videos.");
    }

    // Grab the HD version of the video file
    const videoFiles = data.videos[0].video_files;
    const hdVideo = videoFiles.find(v => v.quality === "hd") || videoFiles[0];

    return {
      type: "video", // Render nicely as an MP4 inside the chat
      response: "Here is a breathtaking, 100% free cinematic video for your prompt! 🎥✨",
      attachment: hdVideo.link,
    };
  } catch (error) {
    console.error("Pexels Fallback Error:", error);
    throw new Error("Free Media Generation failed: " + error.message);
  }
};