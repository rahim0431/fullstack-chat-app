import { useChatStore } from "../store/useChatStore.jsx";
import { useEffect, useRef, useCallback, memo, useState } from "react";
import { AnimatePresence } from "framer-motion";
import ChatHeader from "./ChatHeader";
import MessageInput from "./MessageInput";
import MessageSkeleton from "./skeletons/MessageSkeleton";
import MessageBubble from "./MessageBubble";
import TypingIndicator from "./Typingindicator";
import ForwardMessageModal from "./ForwardMessageModal";
import MessageSearchModal from "./MessageSearchModal";
import { useAuthStore } from "../store/useAuthStore";
import { MessageSquare, Send, Paperclip, Navigation, MessageCircle } from "lucide-react";
import { motion } from "framer-motion";

const formatMessageDate = (date) => {
  const d = new Date(date);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);

  if (d.toDateString() === today.toDateString()) return "Today";
  if (d.toDateString() === yesterday.toDateString()) return "Yesterday";
  
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: d.getFullYear() !== today.getFullYear() ? "numeric" : undefined,
  });
};

const ChatContainer = ({ onOpenSidebar }) => {
  const {
    messages,
    getMessages,
    getGroupMessages,
    isMessagesLoading,
    selectedUser,
    selectedGroup,
    isUserTyping,
    subscribeToTyping,
    unsubscribeFromTyping,
    groupTypingUsers, // Added this
    subscribeToLastSeen,
    unsubscribeFromLastSeen,
    markMessagesAsRead,
    forwardMessage: forwardState,
    clearForwardMessage,
  } = useChatStore();
  
  const { authUser } = useAuthStore();
  const messagesEndRef = useRef(null);
  const containerRef = useRef(null);
  const searchResetRef = useRef(null);
  const [isMessageSearchOpen, setIsMessageSearchOpen] = useState(false);
  const [highlightedMessageId, setHighlightedMessageId] = useState(null);
  const isInitialLoad = useRef(true);
  const backupFrequency = authUser?.chatSettings?.backupFrequency || "Weekly";

  const scrollToBottom = useCallback((behavior = "smooth") => {
    messagesEndRef.current?.scrollIntoView({ behavior });
  }, []);

  const handleOpenMessageSearch = useCallback(() => {
    if (!selectedUser?._id && !selectedGroup?._id) return;
    setIsMessageSearchOpen(true);
  }, [selectedUser?._id, selectedGroup?._id]);

  const handleSelectMessage = useCallback((messageId) => {
    const target = document.getElementById(`message-${messageId}`);
    if (!target) return;

    target.scrollIntoView({ behavior: "smooth", block: "center" });
    setHighlightedMessageId(messageId);

    if (searchResetRef.current) {
      window.clearTimeout(searchResetRef.current);
    }

    searchResetRef.current = window.setTimeout(() => {
      setHighlightedMessageId(null);
    }, 1800);
  }, []);

  useEffect(() => {
    if (!selectedUser?._id && !selectedGroup?._id) return;

    const initializeChat = async () => {
      if (selectedGroup) {
        await getGroupMessages(selectedGroup._id);
      } else {
        await getMessages(selectedUser._id);
        subscribeToLastSeen();
      }
      
      // Always subscribe to typing for either user or group
      subscribeToTyping();
      scrollToBottom("auto");
    };

    initializeChat();

    return () => {
      unsubscribeFromTyping();
      if (selectedUser) {
        unsubscribeFromLastSeen();
      }
    };
  }, [selectedUser?._id, selectedGroup?._id, getMessages, getGroupMessages, subscribeToTyping, unsubscribeFromTyping, subscribeToLastSeen, unsubscribeFromLastSeen, scrollToBottom, selectedGroup]);

  useEffect(() => {
    if (!selectedUser?._id) return;
    markMessagesAsRead(selectedUser._id);
  }, [selectedUser?._id, markMessagesAsRead]);

  useEffect(() => {
    isInitialLoad.current = true;
  }, [selectedUser?._id, selectedGroup?._id]);

  useEffect(() => {
    if (messages.length > 0) {
      if (isInitialLoad.current) {
        scrollToBottom("auto");
        // We set isInitialLoad to false after a short delay or after the scroll has happened
        // to ensure that subsequent messages (like those received via socket) use "smooth"
        isInitialLoad.current = false;
      } else {
        scrollToBottom("smooth");
      }
    }
  }, [messages, scrollToBottom]);

  useEffect(() => {
    setIsMessageSearchOpen(false);
    setHighlightedMessageId(null);
  }, [selectedUser?._id, selectedGroup?._id]);

  useEffect(() => {
    if (!authUser?._id || !selectedUser?._id) return;
    if (backupFrequency === "Never") return;
    if (!messages || messages.length === 0) return;

    const backupIntervals = {
      Daily: 24 * 60 * 60 * 1000,
      Weekly: 7 * 24 * 60 * 60 * 1000,
      Monthly: 30 * 24 * 60 * 60 * 1000,
    };
    const intervalMs = backupIntervals[backupFrequency] || backupIntervals.Weekly;
    const lastKey = `chat-backup:last:${authUser._id}:${selectedUser._id}`;
    const dataKey = `chat-backup:data:${authUser._id}:${selectedUser._id}`;
    const last = Number(localStorage.getItem(lastKey) || 0);
    const now = Date.now();

    if (!Number.isFinite(last) || now - last >= intervalMs) {
      const sanitized = messages.map((msg) => {
        const content = msg?.content;
        if (typeof content === "string" && content.length > 5000) {
          return { ...msg, content: "[media omitted]", contentLength: content.length };
        }
        return msg;
      });

      const payload = {
        userId: authUser._id,
        peerId: selectedUser._id,
        backedUpAt: new Date(now).toISOString(),
        messages: sanitized,
      };

      localStorage.setItem(dataKey, JSON.stringify(payload));
      localStorage.setItem(lastKey, String(now));
    }
  }, [messages, backupFrequency, authUser?._id, selectedUser?._id]);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "ArrowDown") {
        e.preventDefault();
        scrollToBottom();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [scrollToBottom]);

  useEffect(() => {
    return () => {
      if (searchResetRef.current) {
        window.clearTimeout(searchResetRef.current);
      }
    };
  }, []);

  if (!selectedUser && !selectedGroup) {
    return (
      <div className="flex-1 flex items-center justify-center bg-base-100">
        <div className="text-center text-base-content/50">
          <div className="size-24 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-6">
            <MessageSquare className="size-12 text-primary animate-pulse" />
          </div>
          <h3 className="text-2xl font-bold text-base-content mb-2">Welcome Back!</h3>
          <p className="max-w-[280px] mx-auto">Select a friend or a group to start your conversation.</p>
        </div>
      </div>
    );
  }

  if (isMessagesLoading) {
    return (
      <div className="flex-1 flex flex-col bg-base-100">
        <ChatHeader onOpenSidebar={onOpenSidebar} />
        <MessageSkeleton />
        <MessageInput />
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col h-full relative overflow-hidden">

      {/* === CHAT WALLPAPER BACKGROUND === */}
      {/* Tiled SVG wallpaper image */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          backgroundImage: "url('/chat-bg.svg')",
          backgroundSize: "160px 160px",
          backgroundRepeat: "repeat",
        }}
      />
      {/* Color tint overlay that adapts to the current DaisyUI theme */}
      <div className="absolute inset-0 bg-base-200/85 pointer-events-none" />

      {/* Professional Drifting Background Icons */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden select-none z-0 opacity-[0.05]">
        {[
          { Icon: MessageSquare, top: "15%", left: "10%", size: 42, driftX: 40, driftY: 30, duration: 25 },
          { Icon: Send, top: "25%", right: "12%", size: 32, driftX: -30, driftY: 45, duration: 32 },
          { Icon: Paperclip, top: "55%", left: "15%", size: 28, driftX: 35, driftY: -25, duration: 28 },
          { Icon: Navigation, top: "75%", right: "15%", size: 38, driftX: -45, driftY: 20, duration: 35 },
          { Icon: MessageCircle, top: "45%", right: "45%", size: 30, driftX: 20, driftY: 50, duration: 30 },
        ].map(({ Icon, top, left, right, size, driftX, driftY, duration }, i) => (
          <motion.div
            key={i}
            initial={{ x: 0, y: 0 }}
            animate={{ 
              x: [0, driftX, 0], 
              y: [0, driftY, 0],
              rotate: [0, 5, -5, 0]
            }}
            transition={{ 
              duration, 
              repeat: Infinity, 
              ease: "linear"
            }}
            className="absolute"
            style={{ top, left, right }}
          >
            <Icon style={{ width: size, height: size }} />
          </motion.div>
        ))}
      </div>

      {/* Chat Header */}
      <div className="relative z-30">
        <ChatHeader onSearchMessages={handleOpenMessageSearch} />
      </div>

      <div
        ref={containerRef}
        className="flex-1 overflow-y-auto px-4 py-6 md:px-6 relative z-10"
      >
        {/* Messages */}
        <div className="space-y-1">
          {messages.map((message, index) => {
            const prevMessage = messages[index - 1];
            const messageDate = new Date(message.createdAt || message.timestamp || Date.now());
            const prevMessageDate = prevMessage ? new Date(prevMessage.createdAt || prevMessage.timestamp || Date.now()) : null;
            const showDateSeparator = !prevMessageDate || messageDate.toDateString() !== prevMessageDate.toDateString();
            const messageId = message.clientId || message._id || message.id;

            const showAvatar = true;
            const isConsecutive = prevMessage?.sender === message.sender && !showDateSeparator;

            return (
              <div key={messageId} id={`message-${messageId}`} className="scroll-mt-24">
                {showDateSeparator && (
                  <div className="flex items-center justify-center my-5">
                    <div className="h-[1px] flex-1 max-w-[40px] bg-base-300/80"></div>
                    <span className="px-4 text-[11px] font-semibold text-base-content/50 uppercase tracking-wider">
                      {formatMessageDate(messageDate)}
                    </span>
                    <div className="h-[1px] flex-1 max-w-[40px] bg-base-300/80"></div>
                  </div>
                )}
                <MessageBubble
                  message={message}
                  authUser={authUser}
                  selectedUser={selectedUser}
                  isGroup={!!selectedGroup}
                  showAvatar={showAvatar}
                  isConsecutive={isConsecutive}
                  isHighlighted={highlightedMessageId === messageId}
                />
              </div>
            );
          })}
        </div>

        {/* Typing Indicators */}
        {isUserTyping && (
          <div className="mt-3">
            <TypingIndicator user={selectedUser} />
          </div>
        )}

        {selectedGroup && (groupTypingUsers[selectedGroup._id] || []).filter(u => u.userId !== authUser?._id).map((typer) => (
          <div key={typer.userId} className="mt-3">
             <TypingIndicator user={typer} />
          </div>
        ))}

        {/* Scroll Anchor */}
        <div ref={messagesEndRef} className="h-1" />
      </div>

      {/* Scroll to bottom button */}
      <ScrollToBottomButton
        containerRef={containerRef}
        onClick={() => scrollToBottom()}
      />

      {/* Message Input */}
      <div className="relative z-10">
        <MessageInput />
      </div>

      {/* Forward Modal */}
      {forwardState && (
        <ForwardMessageModal onClose={clearForwardMessage} />
      )}

      <AnimatePresence>
        {isMessageSearchOpen && (
          <MessageSearchModal
            isOpen={isMessageSearchOpen}
            onClose={() => setIsMessageSearchOpen(false)}
            messages={messages}
            selectedUser={selectedUser}
            onSelectMessage={handleSelectMessage}
          />
        )}
      </AnimatePresence>
    </div>
  );
};

// Scroll to bottom button component
const ScrollToBottomButton = memo(({ containerRef, onClick }) => {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleScroll = () => {
      const { scrollTop, scrollHeight, clientHeight } = container;
      const isNearBottom = scrollHeight - scrollTop - clientHeight < 100;
      setIsVisible(!isNearBottom);
    };

    container.addEventListener("scroll", handleScroll);
    return () => container.removeEventListener("scroll", handleScroll);
  }, [containerRef]);

  if (!isVisible) return null;

  return (
    <button
      onClick={onClick}
      className="absolute bottom-20 right-6 bg-primary text-white p-3 rounded-full shadow-lg hover:bg-primary-focus transition-all duration-200 hover:scale-110 z-20"
      aria-label="Scroll to bottom"
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        className="h-5 w-5"
        viewBox="0 0 20 20"
        fill="currentColor"
      >
        <path
          fillRule="evenodd"
          d="M14.707 12.707a1 1 0 01-1.414 0L10 9.414l-3.293 3.293a1 1 0 01-1.414-1.414l4-4a1 1 0 011.414 0l4 4a1 1 0 010 1.414z"
          clipRule="evenodd"
        />
      </svg>
    </button>
  );
});

ScrollToBottomButton.displayName = "ScrollToBottomButton";

export default ChatContainer;
