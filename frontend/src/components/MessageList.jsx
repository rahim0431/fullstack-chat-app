import { useEffect, useRef } from "react";
import { Bot } from "lucide-react";
import { useChatStore } from "../store/useChatStore.jsx";
import { useAuthStore } from "../store/useAuthStore";
import MessageBubble from "./MessageBubble";

const MessageList = () => {
  const { messages, aiMessages, isAIMode, isUserTyping, isAIThinking, selectedUser, selectedGroup } = useChatStore();
  const { authUser } = useAuthStore();
  const endRef = useRef(null);

  const displayedMessages = isAIMode ? aiMessages : messages;

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [displayedMessages, isUserTyping, isAIThinking]);

  return (
    <div className="flex-1 overflow-y-auto px-3 py-4 md:px-5 md:py-5 space-y-3 bg-base-100">
      {displayedMessages.length === 0 && (
        <div className="h-full min-h-[160px] flex items-center justify-center">
          <p className="text-sm text-base-content/55">
            {isAIMode ? "Start a prompt to begin chatting with AI." : "Send a message to start this conversation."}
          </p>
        </div>
      )}

      {displayedMessages.map((message) => (
        <MessageBubble key={message.id} message={message} authUser={authUser} selectedUser={selectedUser} isGroup={!!selectedGroup} />
      ))}

      {!isAIMode && isUserTyping && (
        <div className="flex items-end gap-2">
          <img
            src={selectedUser?.profilePic || "/avatar.png"}
            alt="contact avatar"
            className="size-8 rounded-full object-cover ring-2 ring-base-200"
          />
          <div className="bg-base-200 rounded-2xl px-4 py-3 flex items-center gap-1">
            <span className="size-2 rounded-full bg-base-content/40 animate-bounce" />
            <span className="size-2 rounded-full bg-base-content/40 animate-bounce [animation-delay:150ms]" />
            <span className="size-2 rounded-full bg-base-content/40 animate-bounce [animation-delay:300ms]" />
          </div>
        </div>
      )}

      {isAIMode && isAIThinking && (
        <div className="flex items-end gap-2">
          <div className="size-8 rounded-full bg-primary text-primary-content flex items-center justify-center shadow-sm">
            <Bot className="size-4" />
          </div>
          <div className="bg-base-200 rounded-2xl px-4 py-3 flex items-center gap-2">
            <span className="size-2 rounded-full bg-primary animate-pulse" />
            <span className="size-2 rounded-full bg-primary animate-pulse [animation-delay:150ms]" />
            <span className="size-2 rounded-full bg-primary animate-pulse [animation-delay:300ms]" />
            <span className="text-xs text-base-content/60 ml-1">AI is thinking...</span>
          </div>
        </div>
      )}

      <div ref={endRef} />
    </div>
  );
};

export default MessageList;
