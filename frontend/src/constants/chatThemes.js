export const chatThemes = [
  "light",
  "dark",
  "cupcake",
  "bumblebee",
  "emerald",
  "corporate",
  "synthwave",
  "retro",
  "valentine",
  "halloween",
  "garden",
  "forest",
  "lofi",
  "pastel",
  "fantasy",
  "wireframe",
  "black",
  "dracula",
  "cmyk",
  "autumn",
  "business",
  "lemonade",
  "night",
  "coffee",
  "winter",
  "dim",
  "nord",
  "sunset",
];

export const defaultChatTheme = "coffee";

export const normalizeThemeName = (value) => {
  if (!value) return "";
  const lower = value.toLowerCase();
  return chatThemes.includes(lower) ? lower : value;
};

export const resolveTheme = (value, fallback = defaultChatTheme) => {
  const normalized = normalizeThemeName(value);
  return chatThemes.includes(normalized) ? normalized : fallback;
};
