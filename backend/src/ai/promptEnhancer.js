export const enhancePrompt = (userPrompt, style = "realistic") => {
  const promptText = (userPrompt || "").trim();
  if (!promptText) return "";

  const base = "4k, highly detailed, sharp focus, high quality";
  const negative = "blurry, low quality, distorted face, extra limbs, bad anatomy";

  const styles = {
    realistic:
      "ultra realistic, cinematic lighting, professional photography, realistic textures, correct anatomy",
    anime: "anime style, vibrant colors, studio ghibli style, smooth shading, clean lines",
    cinematic: "cinematic lighting, dramatic shadows, film still, depth of field, color grading",
    fantasy: "fantasy art, magical atmosphere, glowing effects, epic scene, unreal engine style",
  };

  const normalizedStyle = (style || "").toString().toLowerCase();
  const stylePrefix = styles[normalizedStyle] || styles.realistic;

  const loweredPrompt = promptText.toLowerCase();
  if (loweredPrompt.includes("virat kohli")) {
    return `ultra realistic portrait of Virat Kohli, Indian cricketer, well-groomed beard, sharp facial features, stadium background, ${stylePrefix}, ${base}. Avoid: ${negative}`;
  }

  return `${stylePrefix}, ${promptText}, ${base}. Avoid: ${negative}`;
};
