import { useAuthStore } from "../store/useAuthStore";

export const getSocket = () => {
  return useAuthStore.getState().socket;
}
