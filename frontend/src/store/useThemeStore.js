import { create } from "zustand";
import { resolveTheme } from "../constants/chatThemes";

const getInitialTheme = () => {
  const stored = localStorage.getItem("chat-theme");
  const safeTheme = resolveTheme(stored);
  if (stored !== safeTheme) {
    localStorage.setItem("chat-theme", safeTheme);
  }
  return safeTheme;
};

export const useThemeStore = create((set) => ({
  theme: getInitialTheme(),
  setTheme: (theme) => {
    const safeTheme = resolveTheme(theme);
    localStorage.setItem("chat-theme", safeTheme);
    set({ theme: safeTheme });
  },
}));
