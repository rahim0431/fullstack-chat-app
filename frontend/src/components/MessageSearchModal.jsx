import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { motion } from "framer-motion";
import { Code2, FileText, Image, Mic, MessageSquare, Search, Video, X } from "lucide-react";
import { formatMessageTime } from "../lib/utils";
import { useThemeStore } from "../store/useThemeStore";

const getMessageLabel = (message) => {
  switch (message.type) {
    case "image":
      return "Photo";
    case "video":
      return "Video";
    case "audio":
      return "Voice message";
    case "file":
      return message.fileName || "File";
    case "code":
      return "Code";
    default:
      return "Message";
  }
};

const getMessageIcon = (type) => {
  switch (type) {
    case "image":
      return <Image className="size-4" />;
    case "video":
      return <Video className="size-4" />;
    case "audio":
      return <Mic className="size-4" />;
    case "file":
      return <FileText className="size-4" />;
    case "code":
      return <Code2 className="size-4" />;
    default:
      return <MessageSquare className="size-4" />;
  }
};

const getSearchableText = (message) => {
  return [
    message.content,
    message.fileName,
    message.caption,
    message.type,
    getMessageLabel(message),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
};

const getPreviewText = (message, query) => {
  const label = getMessageLabel(message);
  if (!query) return message.content || label;

  const source = `${message.content || ""} ${message.fileName || ""}`.trim();
  const lower = source.toLowerCase();
  const index = lower.indexOf(query.toLowerCase());

  if (index === -1) {
    return message.content || label;
  }

  const start = Math.max(0, index - 24);
  const end = Math.min(source.length, index + query.length + 40);
  const prefix = start > 0 ? "..." : "";
  const suffix = end < source.length ? "..." : "";
  return `${prefix}${source.slice(start, end)}${suffix}`;
};

const MessageSearchModal = ({ isOpen, onClose, messages = [], selectedUser, onSelectMessage }) => {
  const [searchTerm, setSearchTerm] = useState("");
  const inputRef = useRef(null);
  const { theme } = useThemeStore();

  useEffect(() => {
    if (!isOpen) return;
    setSearchTerm("");
    const timer = window.setTimeout(() => {
      inputRef.current?.focus();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [isOpen]);

  const results = useMemo(() => {
    const normalized = searchTerm.trim().toLowerCase();
    if (!normalized) return [];

    return messages
      .map((message) => {
        const isMe = message.sender === "user" || (typeof message.sender === "object" && message.sender?._id === "user"); // or however 'me' is identified
        // In groups, message.sender is often a populated user object
        const senderName = (typeof message.sender === "object") ? message.sender?.fullName : (selectedUser?.fullName || "Contact");

        return {
          message,
          id: message._id || message.id,
          senderLabel: isMe ? "You" : senderName,
          searchText: getSearchableText(message),
        };
      })
      .filter(({ searchText }) => searchText.includes(normalized))
      .reverse();
  }, [messages, searchTerm, selectedUser?.fullName]);

  const handleSelect = (messageId) => {
    if (!onSelectMessage) return;
    onSelectMessage(messageId);
    onClose();
  };

  return createPortal(
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.3 }}
      className="fixed inset-0 z-[120] flex items-center justify-center bg-base-300/60 backdrop-blur-sm p-4 overflow-hidden"
      data-theme={theme}
    >
      <motion.div
        initial={{ scale: 0.95, opacity: 0, y: 20 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.95, opacity: 0, y: 20 }}
        transition={{ 
          type: "spring", 
          stiffness: 300, 
          damping: 30,
          opacity: { duration: 0.2 }
        }}
        className="w-full max-w-2xl overflow-hidden rounded-3xl border border-base-300 bg-base-100 shadow-2xl"
      >
        <div className="flex items-center justify-between border-b border-base-300 px-5 py-4">
          <div>
            <p className="text-lg font-bold">Search Messages</p>
            <p className="text-xs text-base-content/55">
              Search this chat for text, files, photos, videos, and voice notes.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="btn btn-ghost btn-sm btn-circle"
            aria-label="Close search"
          >
            <X className="size-5" />
          </button>
        </div>

        <div className="border-b border-base-300 px-5 py-4">
          <label className="relative block">
            <Search className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-base-content/40" />
            <input
              ref={inputRef}
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search messages in this chat"
              className="input input-bordered w-full rounded-full pl-11 pr-4"
            />
          </label>
        </div>

        <div className="max-h-[60vh] overflow-y-auto p-2">
          {!searchTerm.trim() ? (
            <div className="flex min-h-[240px] flex-col items-center justify-center px-6 py-10 text-center text-base-content/50">
              <Search className="mb-3 size-10 opacity-20" />
              <p className="font-medium">Type a word or name to find messages.</p>
              <p className="mt-1 text-sm">Try file names, text snippets, or media labels.</p>
            </div>
          ) : results.length === 0 ? (
            <div className="flex min-h-[240px] flex-col items-center justify-center px-6 py-10 text-center text-base-content/50">
              <MessageSquare className="mb-3 size-10 opacity-20" />
              <p className="font-medium">No matching messages found.</p>
              <p className="mt-1 text-sm">Try a different word or shorten the search.</p>
            </div>
          ) : (
            <div className="space-y-2 px-1 pb-2">
              <div className="px-3 pt-1 text-xs font-semibold uppercase tracking-wider text-base-content/40">
                {results.length} result{results.length === 1 ? "" : "s"}
              </div>
              {results.map(({ message, id, senderLabel }) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => handleSelect(id)}
                  className="flex w-full items-start gap-3 rounded-2xl border border-base-300 px-4 py-3 text-left transition-colors hover:bg-base-200/70"
                >
                  <div className="mt-0.5 flex size-10 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                    {getMessageIcon(message.type)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-3">
                      <p className="truncate text-sm font-semibold">{senderLabel}</p>
                      <span className="shrink-0 text-[11px] text-base-content/45">
                        {formatMessageTime(message.timestamp || message.createdAt || Date.now())}
                      </span>
                    </div>
                    <p className="mt-1 line-clamp-2 text-sm text-base-content/70">
                      {getPreviewText(message, searchTerm)}
                    </p>
                    <p className="mt-1 text-[11px] font-medium uppercase tracking-wider text-base-content/40">
                      {getMessageLabel(message)}
                    </p>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </motion.div>
    </motion.div>,
    document.body
  );
};

export default MessageSearchModal;
