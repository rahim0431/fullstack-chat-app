export const generateImage = async (prompt) => {
  if (!process.env.CLOUDFLARE_API_TOKEN) {
    throw new Error("Cloudflare API token not configured");
  }
  if (!process.env.CLOUDFLARE_ACCOUNT_ID) {
    throw new Error("Cloudflare account ID not configured");
  }

  const model =
    process.env.CLOUDFLARE_AI_IMAGE_MODEL ||
    "@cf/stabilityai/stable-diffusion-xl-base-1.0";

  const response = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${process.env.CLOUDFLARE_ACCOUNT_ID}/ai/run/${model}`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.CLOUDFLARE_API_TOKEN}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({ prompt }),
    }
  );

  const contentType = response.headers.get("content-type") || "";

  if (contentType.includes("application/json")) {
    const data = await response.json().catch(() => null);
    if (!response.ok) {
      const errorMessage =
        data?.errors?.[0]?.message ||
        data?.error?.message ||
        data?.message ||
        "Failed to generate image";
      throw new Error(`${response.status} ${response.statusText}: ${errorMessage}`);
    }

    const imageBase64 =
      data?.result?.image ||
      data?.result?.images?.[0] ||
      data?.result?.output?.[0] ||
      null;

    if (!imageBase64) {
      throw new Error("No image returned from Cloudflare Workers AI");
    }

    const base64Image = imageBase64.startsWith("data:")
      ? imageBase64
      : `data:image/png;base64,${imageBase64}`;

    return {
      type: "image",
      response: "Image generated successfully",
      attachment: base64Image,
    };
  }

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`${response.status} ${response.statusText}: ${text || "Failed to generate image"}`);
  }

  const buffer = Buffer.from(await response.arrayBuffer());
  const base64Image = `data:${contentType || "image/png"};base64,${buffer.toString("base64")}`;

  return {
    type: "image",
    response: "Image generated successfully",
    attachment: base64Image,
  };
};
