import { useChatStore } from "../store/useChatStore.jsx";
import { useAuthStore } from "../store/useAuthStore";
import Sidebar from "./Sidebar";
import NoChatSelected from "./NoChatSelected";
import ChatContainer from "./ChatContainer";
import { useEffect, useState } from "react";

const ChatLayout = () => {
  const { selectedUser, selectedGroup, subscribeToMessages, unsubscribeFromMessages } = useChatStore();
  const { socket } = useAuthStore();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  useEffect(() => {
    subscribeToMessages();
    return () => unsubscribeFromMessages();
  }, [subscribeToMessages, unsubscribeFromMessages, socket]);

  useEffect(() => {
    if (selectedUser || selectedGroup) {
      setIsSidebarOpen(false);
    }
  }, [selectedUser, selectedGroup]);

  return (
    <div className="relative flex h-full overflow-hidden bg-base-100">
      {/* Mobile sidebar drawer */}
      <div
        className={`fixed inset-y-0 left-0 z-40 w-80 max-w-[85vw] transform transition-transform duration-300 ease-out bg-base-100 border-r border-base-300 shadow-2xl md:static md:translate-x-0 md:shadow-none md:w-80 lg:w-96 ${
          isSidebarOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"
        }`}
      >
        <Sidebar onCloseSidebar={() => setIsSidebarOpen(false)} />
      </div>

      {/* Mobile overlay */}
      {isSidebarOpen && (
        <button
          type="button"
          className="md:hidden fixed inset-0 z-30 bg-black/40 backdrop-blur-sm"
          onClick={() => setIsSidebarOpen(false)}
          aria-label="Close sidebar"
        />
      )}

      <main className="flex-1 min-w-0 flex flex-col">
        {(!selectedUser && !selectedGroup) ? (
          <NoChatSelected onOpenSidebar={() => setIsSidebarOpen(true)} />
        ) : (
          <ChatContainer onOpenSidebar={() => setIsSidebarOpen(true)} />
        )}
      </main>
    </div>
  );
};

export default ChatLayout;
