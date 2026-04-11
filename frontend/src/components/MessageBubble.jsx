import { memo, useState, useEffect, useRef, useMemo } from "react";
import { formatMessageTime } from "../lib/utils";
import { axiosInstance } from "../lib/axios";
import { Check, CheckCheck, User, Copy, RefreshCw, ThumbsUp, X, Reply, Trash2, Forward, Phone, PhoneMissed, Video, Square, Bot, SmilePlus, Plus } from "lucide-react";
import toast from "react-hot-toast";
import Picker from "@emoji-mart/react";
import data from "@emoji-mart/data";
import { useChatStore } from "../store/useChatStore.jsx";
import { useAuthStore } from "../store/useAuthStore";
import useCallStore from "../store/useCallStore";
import { motion, AnimatePresence } from "framer-motion";
import { createPortal } from "react-dom";

const MessageBubble = memo(({ 
  message, 
  authUser, 
  selectedUser, 
  showAvatar = true,
  isConsecutive = false,
  context = "chat",
  isHighlighted = false,
  isGroup = false,
}) => {
  const [imageError, setImageError] = useState(false);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const audioRef = useRef(null);
  const senderId = typeof message.sender === 'string' ? message.sender : message.sender?._id;
  const isOwnMessage = senderId === "user" || senderId === authUser?._id;
  const isAIMessage = message.sender === "ai";
  
  const { aiMessages, sendAIMessage, deleteMessage, deleteAIMessage, setReplyMessage, setForwardMessage, messages, setIsAITyping, selectedGroup } = useChatStore();

  const [isTyping, setIsTyping] = useState(() => message.isNew && message.type === "text" && isAIMessage);
  const [displayedContent, setDisplayedContent] = useState(() => {
    if (message.isNew && message.type === "text" && isAIMessage) return "";
    return message.content;
  });

  const [showReactions, setShowReactions] = useState(false);
  const [showFullPicker, setShowFullPicker] = useState(false);
  const REACTION_EMOJIS = ["👍", "❤️", "😂", "😮", "😢", "👏"];

  const handleReaction = (e, emoji) => {
    if (e) e.stopPropagation();
    setShowReactions(false);
    setShowFullPicker(false);
    if (context === "ai") {
      useChatStore.getState().reactToAIMessage(message.id || message._id, emoji);
    } else {
      useChatStore.getState().reactToMessage(message.id || message._id, emoji);
    }
  };

  // Find the message being replied to
  const repliedMessage = message.replyTo 
    ? messages.find(m => m.id === message.replyTo || m._id === message.replyTo)
    : null;

  // Event listener to explicitly Stop AI Typing via global action
  useEffect(() => {
    const handleStopAI = () => {
      if (isTyping) {
        message.isNew = false;
        setIsTyping(false);
        setDisplayedContent(message.content);
        if (setIsAITyping) setIsAITyping(false);
      }
    };
    window.addEventListener("stop-ai-typing", handleStopAI);
    return () => window.removeEventListener("stop-ai-typing", handleStopAI);
  }, [isTyping, message, setIsAITyping]);

  useEffect(() => {
    if (message.isNew && message.type === "text" && isAIMessage) {
      setIsTyping(true);
      if (setIsAITyping) setIsAITyping(true);
      const tokens = message?.content?.split(/(\s+)/) || [];
      let currentIndex = 0;

      const intervalId = setInterval(() => {
        if (currentIndex < tokens.length) {
          setDisplayedContent(tokens.slice(0, currentIndex + 1).join(""));
          currentIndex++;
          window.dispatchEvent(new Event("chat-scroll"));
        } else {
          clearInterval(intervalId);
          setIsTyping(false);
          if (setIsAITyping) setIsAITyping(false);
          message.isNew = false;
        }
      }, 40);

      return () => clearInterval(intervalId);
    } else {
      setDisplayedContent(message.content);
      setIsTyping(false);
    }
  }, [message.content, message.isNew, isAIMessage, message.type, setIsAITyping]);
  
  // Get the correct avatar source
  const getAvatarSrc = () => {
    if (isOwnMessage) {
      return authUser?.profilePic || "/avatar.png";
    } else {
      if (isGroup && message.senderInfo) {
        return message.senderInfo.profilePic || "/avatar.png";
      }
      return selectedUser?.profilePic || "/avatar.png";
    }
  };

  const getAvatarName = () => {
    if (isOwnMessage) {
      return "You";
    }
    if (isGroup && message.senderInfo) {
      return message.senderInfo.fullName || "User";
    }
    return selectedUser?.fullName || "User";
  };

  // Handle image load error
  const handleImageError = () => {
    setImageError(true);
  };

  const openPreview = () => {
    if (message.type === "image" && message.content) {
      setIsPreviewOpen(true);
    }
  };

  const closePreview = () => {
    setIsPreviewOpen(false);
  };

  useEffect(() => {
    if (!isPreviewOpen) return;
    const handleKeyDown = (e) => {
      if (e.key === "Escape") setIsPreviewOpen(false);
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isPreviewOpen]);

  useEffect(() => {
    if (message.type !== "audio") return;
    if (!audioRef.current) return;

    const rate = message.voiceGender === "female" ? 1.06 : message.voiceGender === "male" ? 0.94 : 1;
    audioRef.current.playbackRate = rate;
    if ("preservesPitch" in audioRef.current) audioRef.current.preservesPitch = false;
    if ("mozPreservesPitch" in audioRef.current) audioRef.current.mozPreservesPitch = false;
    if ("webkitPreservesPitch" in audioRef.current) audioRef.current.webkitPreservesPitch = false;
  }, [message.type, message.voiceGender, message.content]);

  const handleDownloadImage = async (e) => {
    e.stopPropagation();
    try {
      const response = await fetch(message.content);
      if (!response.ok) throw new Error("Network response was not ok");
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.style.display = "none";
      a.href = url;
      a.download = message.fileName || `image-${Date.now()}.png`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      // Fallback for CORS errors
      const a = document.createElement("a");
      a.href = message.content;
      a.download = message.fileName || `image-${Date.now()}.png`;
      a.target = "_blank";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    }
  };

  const isMedia = ["image", "video", "audio"].includes(message.type);
  const isCode = message.type === "code";
  const isFile = message.type === "file";
  const isCall = message.type === "call";
  const isAIContext = context === "ai";
  const voiceLabel = message.voiceGender === "female" ? "Female" : message.voiceGender === "male" ? "Male" : null;
  const showVoiceMeta = isAIMessage && message.type === "audio" && voiceLabel;
  const autoDownloadSetting =
    authUser?.storageSettings?.downloadMediaUsing ||
    authUser?.chatSettings?.autoDownloadMedia ||
    "Wi-Fi only";
  const retentionSetting = authUser?.storageSettings?.keepMediaOnDevice || "Forever";

  const retentionDays = useMemo(() => {
    if (!retentionSetting || retentionSetting === "Forever") return null;
    if (retentionSetting.includes("year")) return 365;
    const match = retentionSetting.match(/(\d+)\s*days/i);
    if (match) return Number(match[1]);
    return null;
  }, [retentionSetting]);

  const messageTime = useMemo(() => {
    const raw = message.timestamp || message.createdAt || message.date || Date.now();
    const parsed = new Date(raw);
    return Number.isNaN(parsed.getTime()) ? new Date() : parsed;
  }, [message.timestamp, message.createdAt, message.date]);

  const isExpired = retentionDays
    ? Date.now() - messageTime.getTime() > retentionDays * 24 * 60 * 60 * 1000
    : false;

  const canAutoDownloadMedia = useMemo(() => {
    if (isOwnMessage) return true;
    if (autoDownloadSetting === "Wi-Fi and Mobile Data") return true;
    if (autoDownloadSetting === "Never") return false;

    const connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
    if (!connection) return true;

    if (connection.saveData) return false;
    if (connection.type) {
      return connection.type === "wifi" || connection.type === "ethernet";
    }
    if (connection.effectiveType) {
      return connection.effectiveType === "4g";
    }
    return true;
  }, [autoDownloadSetting, isOwnMessage]);

  const shouldAutoLoad = canAutoDownloadMedia && !isExpired;
  const [isMediaAllowed, setIsMediaAllowed] = useState(shouldAutoLoad);

  useEffect(() => {
    if (shouldAutoLoad) {
      setIsMediaAllowed(true);
    }
  }, [shouldAutoLoad]);

  const mediaBlockTitle = isExpired ? "Media expired" : "Media hidden";
  const mediaBlockHint = isExpired ? "Saved media has expired for this chat." : "Auto-download is off.";

  const handleAllowMedia = () => setIsMediaAllowed(true);

  const getMessageStatus = () => {
    if (!isOwnMessage) return null;

    const totalMembers = selectedGroup?.members?.length || 0;
    const deliveredCount = message.deliveredTo?.length || 0;
    const seenByCount = message.seenBy?.length || 0;

    // For groups, we exclude the sender (user) from the countRequirement
    // For private, we use the status field
    const isRead = isGroup 
      ? (totalMembers > 1 && seenByCount >= totalMembers - 1)
      : (message.status === "read" || message.read);
    
    const isDelivered = isGroup
      ? (totalMembers > 1 && deliveredCount >= totalMembers - 1)
      : (message.status === "delivered");

    // Blue double tick = read by everyone
    if (isRead) {
      return (
        <div className="flex items-center justify-center text-[#53bdeb]" title={isGroup ? "Seen by everyone" : "Read"}>
          <svg viewBox="0 0 16 15" width="16" height="15" fill="currentColor">
            <path d="M15.01 3.316l-.478-.372a.365.365 0 0 0-.51.063L8.666 9.879a.32.32 0 0 1-.484.033l-.358-.325a.32.32 0 0 0-.484.032l-.378.483a.418.418 0 0 0 .036.541l1.32 1.266c.143.14.361.125.484-.033l6.272-8.048a.366.366 0 0 0-.064-.512zm-4.1 0l-.478-.372a.365.365 0 0 0-.51.063L4.566 9.879a.32.32 0 0 1-.484.033L1.891 7.769a.366.366 0 0 0-.515.006l-.423.433a.364.364 0 0 0 .006.514l3.258 3.185c.143.14.361.125.484-.033l6.272-8.048a.365.365 0 0 0-.063-.51z" />
          </svg>
        </div>
      );
    }

    // Grey double tick = delivered to everyone
    if (isDelivered) {
      return (
        <div className="flex items-center justify-center opacity-70 text-inherit" title={isGroup ? "Delivered to everyone" : "Delivered"}>
          <svg viewBox="0 0 16 15" width="16" height="15" fill="currentColor">
            <path d="M15.01 3.316l-.478-.372a.365.365 0 0 0-.51.063L8.666 9.879a.32.32 0 0 1-.484.033l-.358-.325a.32.32 0 0 0-.484.032l-.378.483a.418.418 0 0 0 .036.541l1.32 1.266c.143.14.361.125.484-.033l6.272-8.048a.366.366 0 0 0-.064-.51zM10.91 3.316l-.478-.372a.365.365 0 0 0-.51.063L4.566 9.879a.32.32 0 0 1-.484.033L1.891 7.769a.366.366 0 0 0-.515.006l-.423.433a.364.364 0 0 0 .006.514l3.258 3.185c.143.14.361.125.484-.033l6.272-8.048a.365.365 0 0 0-.063-.51z" />
          </svg>
        </div>
      );
    }

    // Single grey tick = sent but not yet fully delivered
    return (
      <div className="flex items-center justify-center opacity-70 text-inherit" title="Sent">
        <svg viewBox="0 0 16 15" width="16" height="15" fill="currentColor">
          <path transform="translate(1.5, 0)" d="M10.91 3.316l-.478-.372a.365.365 0 0 0-.51.063L4.566 9.879a.32.32 0 0 1-.484.033L1.891 7.769a.366.366 0 0 0-.515.006l-.423.433a.364.364 0 0 0 .006.514l3.258 3.185c.143.14.361.125.484-.033l6.272-8.048a.365.365 0 0 0-.063-.51z" />
        </svg>
      </div>
    );
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(message.content);
    toast.success("Message copied to clipboard", { id: "copy-toast" }); // use id to prevent duplicates
  };

  const handleLike = () => {
    toast.success("Feedback submitted!", { id: "like-toast" });
  };

  const handleRegenerate = () => {
    // Find the index of this AI message in the AI history
    const messageIndex = aiMessages.findIndex((m) => m.id === message.id || m._id === (message._id || message.id));
    
    // The previous message should be the user's prompt
    if (messageIndex > 0) {
      const prevMessage = aiMessages[messageIndex - 1];
      if (prevMessage && prevMessage.sender === "user") {
        sendAIMessage(prevMessage.content);
        return;
      }
    }
    toast.error("Could not find the prompt to regenerate.");
  };

  const handleReply = () => {
    if (setReplyMessage) {
      setReplyMessage(message);
    } else {
      toast.error("Please add setReplyMessage to useChatStore");
    }
  };

  const openDeleteConfirm = () => {
    setIsDeleteOpen(true);
  };

  const closeDeleteConfirm = () => {
    setIsDeleteOpen(false);
  };

  const confirmDelete = async (scope) => {
    if (isAIContext && !deleteAIMessage) {
      return toast.error("Please add deleteAIMessage to useChatStore");
    }
    if (!isAIContext && !deleteMessage) {
      return toast.error("Please add deleteMessage to useChatStore");
    }
    
    try {
      if (isAIContext) {
        await deleteAIMessage(message._id || message.id);
      } else {
        await deleteMessage(message._id || message.id, scope);
      }
      setIsDeleteOpen(false);
    } catch (error) {
      // deleteMessage handles its own toasts
    }
  };

  const handleForward = () => {
    if (setForwardMessage) {
      setForwardMessage(message);
    }
  };

  // Get timestamp color class based on message type and theme
  const getTimestampColorClass = () => {
    if (isOwnMessage) {
      if (isMedia || isCode || isFile || isCall) {
        return "text-gray-400 dark:text-gray-500";
      } else {
        return "text-white/80 dark:text-white/70";
      }
    } else {
      if (isMedia || isCode || isFile || isCall) {
        return "text-gray-400 dark:text-gray-500";
      } else {
        return "text-gray-500 dark:text-gray-400";
      }
    }
  };

  // Avatar component with fallback
  const Avatar = () => {
    if (isAIMessage || (!isOwnMessage && context === "ai")) {
      return (
        <div className="size-8 rounded-full bg-primary/10 flex items-center justify-center ring-2 ring-base-200">
          <Bot className="size-5 text-primary" />
        </div>
      );
    }

    if (imageError) {
      return (
        <div className="size-8 rounded-full mr-0 bg-gradient-to-r from-primary to-secondary flex items-center justify-center ring-2 ring-base-200">
          <User className="w-4 h-4 text-white" />
        </div>
      );
    }

    return (
      <img
        src={getAvatarSrc()}
        alt={getAvatarName()}
        className="size-8 rounded-full object-cover ring-2 ring-base-200"
        title={getAvatarName()}
        onError={handleImageError}
        loading="lazy"
      />
    );
  };

  // Reply preview component
  const ReplyPreview = () => {
    if (!repliedMessage) return null;
    const replyContent = repliedMessage.type === "image" ? "📷 Photo" 
      : repliedMessage.type === "file" ? `📎 ${repliedMessage.fileName || "File"}`
      : repliedMessage.type === "audio" ? "🎤 Voice message"
      : repliedMessage.content || "Message";

    const isReplyToMe = repliedMessage.sender === "user" || repliedMessage.senderId === authUser?._id;
    const authorName = isReplyToMe ? "You" : selectedUser?.fullName || "User";

    const scrollToMessage = (e) => {
      e.stopPropagation();
      const targetId = repliedMessage.id || repliedMessage._id;
      const element = document.getElementById(`message-${targetId}`);
      if (element) {
        element.scrollIntoView({ behavior: 'smooth', block: 'center' });
        
        // Add temporary highlight effect
        const bubble = element.querySelector('[data-bubble-content="true"]');
        if (bubble) {
          const originalClasses = bubble.className;
          bubble.classList.add("ring-4", "ring-primary/50", "scale-[1.02]", "transition-all", "duration-300");
          setTimeout(() => {
            bubble.classList.remove("ring-4", "ring-primary/50", "scale-[1.02]");
          }, 1500);
        }
      } else {
        toast.error("Message is too old to view");
      }
    };

    return (
      <div 
        onClick={scrollToMessage}
        className={`mb-2 mt-0.5 flex flex-col px-3 py-1.5 rounded-xl rounded-tl-sm rounded-bl-sm border-l-[3px] 
          cursor-pointer transition-colors active:scale-[0.98]
          ${isOwnMessage 
            ? "bg-black/15 border-white/40 text-white hover:bg-black/25" 
            : "bg-base-300 border-primary text-base-content hover:bg-base-300/80"}`}
      >
        <span className={`text-[12px] font-extrabold ${isOwnMessage ? "text-white/90" : "text-primary"}`}>
          {authorName}
        </span>
        <span className={`text-[13px] truncate leading-tight mt-0.5 ${isOwnMessage ? "text-white/80" : "text-base-content/70"}`}>
          {replyContent}
        </span>
      </div>
    );
  };

  const renderContent = () => {
    const timestampClass = getTimestampColorClass();

    switch (message.type) {
      case "image":
        if (!isMediaAllowed) {
          return (
            <div className="rounded-2xl border border-base-300 bg-base-200/70 p-4 max-w-[280px]">
              <p className="text-sm font-medium">{mediaBlockTitle}</p>
              <p className="text-xs text-base-content/60 mt-1">{mediaBlockHint}</p>
              <button
                type="button"
                onClick={handleAllowMedia}
                className="btn btn-sm btn-primary mt-3 rounded-full"
              >
                {isExpired ? "Load anyway" : "Load image"}
              </button>
            </div>
          );
        }
        return (
          <div className="relative group">
            {repliedMessage && <ReplyPreview />}
            <img
              src={message.content}
              alt={message.caption || "Image"}
              className="block rounded-2xl max-w-[280px] max-h-[360px] w-auto h-auto object-cover cursor-pointer hover:opacity-95 transition-opacity"
              loading="lazy"
              onClick={openPreview}
              onError={(e) => {
                e.target.src = "/placeholder-image.png";
              }}
            />
            {message.caption && (
              <p className="mt-2 text-sm px-1">{message.caption}</p>
            )}
            {/* Timestamp for media */}
            <div className={`flex items-center justify-end gap-1.5 mt-1 ${timestampClass}`}>
              <time className="text-[11px] font-medium leading-none">
                {formatMessageTime(message.timestamp)}
              </time>
              {getMessageStatus()}
            </div>
          </div>
        );

      case "video":
        if (!isMediaAllowed) {
          return (
            <div className="rounded-2xl border border-base-300 bg-base-200/70 p-4 max-w-[300px]">
              <p className="text-sm font-medium">{mediaBlockTitle}</p>
              <p className="text-xs text-base-content/60 mt-1">{mediaBlockHint}</p>
              <button
                type="button"
                onClick={handleAllowMedia}
                className="btn btn-sm btn-primary mt-3 rounded-full"
              >
                {isExpired ? "Load anyway" : "Load video"}
              </button>
            </div>
          );
        }
        return (
          <div>
            {repliedMessage && <ReplyPreview />}
            <video
              controls
              preload="metadata"
              className="block rounded-2xl max-w-[300px] max-h-[360px] bg-black"
              poster={message.thumbnail}
            >
              <source src={message.content} type="video/mp4" />
              Your browser does not support the video tag.
            </video>
            {/* Timestamp for media */}
            <div className={`flex items-center justify-end gap-1.5 mt-1 ${timestampClass}`}>
              <time className="text-[11px] font-medium leading-none">
                {formatMessageTime(message.timestamp)}
              </time>
              {getMessageStatus()}
            </div>
          </div>
        );

      case "audio":
        if (!isMediaAllowed) {
          return (
            <div className="rounded-2xl border border-base-300 bg-base-200/70 p-4 min-w-[240px]">
              <p className="text-sm font-medium">{mediaBlockTitle}</p>
              <p className="text-xs text-base-content/60 mt-1">{mediaBlockHint}</p>
              <button
                type="button"
                onClick={handleAllowMedia}
                className="btn btn-sm btn-primary mt-3 rounded-full"
              >
                {isExpired ? "Load anyway" : "Load audio"}
              </button>
            </div>
          );
        }
        return (
          <div>
            {repliedMessage && <ReplyPreview />}
            <div className="bg-base-300 rounded-2xl p-3 min-w-[240px]">
              {showVoiceMeta && (
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[11px] font-semibold text-primary/80 bg-primary/10 px-2 py-0.5 rounded-full">
                    Voice • {voiceLabel}
                  </span>
                  <div className="flex items-end gap-1 h-4">
                    {[6, 10, 5, 12, 7].map((height, index) => (
                      <span
                        key={index}
                        className="block w-1 rounded-full bg-primary/60 animate-pulse"
                        style={{ height: `${height}px`, animationDelay: `${index * 0.12}s` }}
                      />
                    ))}
                  </div>
                </div>
              )}
              <audio
                ref={audioRef}
                controls
                className="w-full"
                src={message.content?.startsWith("/api") ? axiosInstance.defaults.baseURL.replace("/api", "") + message.content : message.content}
              >
                Your browser does not support the audio element.
              </audio>
            </div>
            {message.caption && (
              <p className="mt-2 text-sm px-1 leading-relaxed text-base-content whitespace-pre-wrap">{message.caption}</p>
            )}
            {/* Timestamp for media */}
            <div className={`flex items-center justify-end gap-1.5 mt-1 ${timestampClass}`}>
              <time className="text-[11px] font-medium leading-none">
                {formatMessageTime(message.timestamp)}
              </time>
              {getMessageStatus()}
            </div>
          </div>
        );

      case "file":
        if (!isMediaAllowed) {
          return (
            <div>
              {repliedMessage && <ReplyPreview />}
              <div className="rounded-2xl border border-base-300 bg-base-200/70 p-4 min-w-[240px]">
                <p className="text-sm font-medium">{mediaBlockTitle}</p>
                <p className="text-xs text-base-content/60 mt-1">{mediaBlockHint}</p>
                <button
                  type="button"
                  onClick={handleAllowMedia}
                  className="btn btn-sm btn-primary mt-3 rounded-full"
                >
                  {isExpired ? "Load anyway" : "Load file"}
                </button>
              </div>
            </div>
          );
        }
        return (
          <div>
            {repliedMessage && <ReplyPreview />}
            <a
              href={message.content}
              download={message.fileName}
              className="flex items-center gap-3 bg-base-300 rounded-2xl p-3 hover:bg-base-300/80 transition-colors"
            >
              <div className="p-2 bg-primary/10 rounded-xl">
                <svg className="w-6 h-6 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                </svg>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{message.fileName}</p>
                <p className="text-xs text-base-content/60">{message.fileSize}</p>
              </div>
            </a>
            {/* Timestamp for file */}
            <div className={`flex items-center justify-end gap-1.5 mt-1 ${timestampClass}`}>
              <time className="text-[11px] font-medium leading-none">
                {formatMessageTime(message.timestamp)}
              </time>
              {getMessageStatus()}
            </div>
          </div>
        );

      case "code":
        return (
          <div>
            {repliedMessage && <ReplyPreview />}
            <div className="bg-base-300 rounded-2xl overflow-hidden">
              {message.language && (
                <div className="bg-base-content/10 px-4 py-1 text-xs font-mono">
                  {message.language}
                </div>
              )}
              <pre className="p-4 overflow-x-auto text-sm">
                <code className="font-mono">{message.content}</code>
              </pre>
            </div>
            {/* Timestamp for code */}
            <div className={`flex items-center justify-end gap-1.5 mt-1 ${timestampClass}`}>
              <time className="text-[11px] font-medium leading-none">
                {formatMessageTime(message.timestamp)}
              </time>
              {getMessageStatus()}
            </div>
          </div>
        );

      case "call":
        const callType = message.callId?.type || "audio";
        const callStatus = message.callId?.status || "missed";
        const duration = message.callId?.duration || 0;
        
        const isMissed = callStatus === "missed" || callStatus === "canceled";
        const isAnswered = callStatus === "answered";
        
        // WhatsApp style colors: Red for missed on receiver side or canceled on sender side. Neutral otherwise.
        const iconColorClass = isMissed ? "text-error" : "text-base-content/80";
        
        const formatDuration = (seconds) => {
          if (!seconds) return "";
          const m = Math.floor(seconds / 60);
          const s = seconds % 60;
          return `${m}:${s.toString().padStart(2, '0')}`;
        };

        const CallIcon = callType === "video" ? Video : isMissed ? PhoneMissed : Phone;
        
        let callText = "Audio call";
        if (callType === "video") callText = "Video call";
        
        if (isMissed) {
          if (callStatus === "missed") {
            callText = isOwnMessage ? `Unanswered ${callType} call` : `Missed ${callType} call`;
          } else {
            callText = isOwnMessage ? `Canceled ${callType} call` : `Missed ${callType} call`;
          }
        } else if (isAnswered) {
          callText = isOwnMessage ? `Outgoing ${callType} call` : `Incoming ${callType} call`;
        }

        return (
          <div className="relative">
            {repliedMessage && <ReplyPreview />}
            <div 
              onClick={() => useCallStore.getState().actions.startCall(callType, authUser, selectedUser)}
              className="flex items-center gap-3 p-3 min-w-[240px] bg-base-300/80 rounded-2xl cursor-pointer hover:bg-base-300 transition-colors shadow-sm"
              title="Call again"
            >
              <div className={`p-2.5 rounded-full ${isMissed ? 'bg-error/10' : 'bg-base-100/50'}`}>
                <CallIcon className={`size-5 ${iconColorClass}`} />
              </div>
              <div className="flex-1 min-w-0">
                <p className={`text-[15px] font-semibold tracking-tight ${isMissed && !isOwnMessage ? 'text-error' : 'text-base-content'}`}>
                  {callText}
                </p>
                <div className="flex flex-wrap items-center gap-1.5 mt-0.5">
                  <span className="text-xs text-base-content/60 font-medium">
                    {formatMessageTime(message.timestamp)}
                  </span>
                  {isAnswered && duration > 0 && (
                    <>
                      <span className="text-xs text-base-content/40">•</span>
                      <span className="text-xs text-base-content/60 font-medium">{formatDuration(duration)}</span>
                    </>
                  )}
                </div>
              </div>
            </div>
            {/* Standard ticks (only for sent messages) */}
            <div className={`flex items-center justify-end gap-1.5 mt-1 ${timestampClass}`}>
              {getMessageStatus()}
            </div>
          </div>
        );

      default:
        return (
          <div className="relative flex flex-col">
            {repliedMessage && <ReplyPreview />}
            <p className={`whitespace-pre-wrap break-words text-[15px] leading-relaxed ${isAIMessage ? "text-base-content" : ""}`}>
              {displayedContent}
              {isTyping && <span className="inline-block w-2.5 h-4 ml-1 bg-current animate-pulse align-middle rounded-sm" />}
              {/* Magic Spacer: Forces text to leave room for the absolute timestamp/ticks */}
              {!isTyping && <span className="inline-block w-[65px]" />}
            </p>
            {!isTyping && (
              <div className={`absolute bottom-0 right-0 flex items-center justify-end gap-1.5 ${timestampClass}`}>
                <time className="text-[11px] font-medium opacity-80 leading-none pt-[1px]">
                  {formatMessageTime(message.timestamp)}
                </time>
                {getMessageStatus()}
              </div>
            )}
          </div>
        );
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ 
        type: "spring", 
        stiffness: 300, 
        damping: 30,
        opacity: { duration: 0.15 }
      }}
      id={`message-${message.id || message._id}`}
      className={`
        w-full flex ${isOwnMessage ? "justify-end" : "justify-start"} ${message.reactions && message.reactions.length > 0 ? "mb-6" : isConsecutive ? "mb-1" : "mb-3"}
        ${isHighlighted ? "rounded-3xl bg-base-200/40 px-2 py-2 ring-2 ring-primary/80 ring-offset-2 ring-offset-base-100 shadow-xl" : ""}
      `}
    >
      <div className={`flex items-end gap-2 max-w-[85%] md:max-w-[70%] ${isOwnMessage ? "flex-row-reverse" : ""}`}>
        
        {/* Avatar - Always show if showAvatar is true */}
        {showAvatar ? (
          <div className="shrink-0">
            <Avatar />
          </div>
        ) : (
          /* Spacer for alignment when avatar is hidden */
          <div className="size-8 shrink-0" />
        )}

        {/* Message Bubble */}
        <div
          data-bubble-content="true"
          className={`
            relative group
            ${isOwnMessage 
              ? isMedia || isCode || isFile || isCall
                ? "bg-transparent text-base-content" 
                : "bg-gradient-to-r from-primary to-secondary text-white shadow-sm"
              : isAIMessage
                ? "bg-transparent"
                : isMedia || isCode || isFile || isCall
                  ? "bg-transparent text-base-content"
                  : "bg-base-200 text-base-content shadow-sm"
            }
            ${!isMedia && !isCode && !isFile && !isCall && !isAIMessage ? "rounded-2xl px-4 py-2.5" : ""}
            ${isAIMessage && !isMedia && !isCode && !isFile && !isCall ? "py-1.5" : ""}
            transition-all duration-300
          `}
        >
          {isGroup && !isOwnMessage && message.senderInfo && (
            <p className="text-[11px] font-bold text-primary mb-0.5 opacity-90 truncate max-w-[200px]">
              {message.senderInfo.fullName}
            </p>
          )}
          {renderContent()}

          {/* Active Reactions Display */}
          {message.reactions && message.reactions.length > 0 && (
            <div className={`absolute -bottom-3 ${isOwnMessage ? 'right-2' : 'left-2'} flex items-center bg-base-100 ring-2 ring-base-100 shadow-sm rounded-full px-1.5 py-[1px] z-10 transition-all`}>
              {Object.entries(
                message.reactions.reduce((acc, r) => ({...acc, [r.emoji]: (acc[r.emoji] || 0) + 1}), {})
              ).map(([emoji, count]) => (
                <div key={emoji} className="flex items-center gap-0.5 mx-0.5">
                  <span className="text-[12px] leading-none">{emoji}</span>
                  {count > 1 && <span className="text-[10px] font-bold text-base-content/70 ml-0.5">{count}</span>}
                </div>
              ))}
            </div>
          )}

          {/* Message Actions (on hover) - Only for text messages */}
          <div 
            className={`absolute ${showReactions ? 'opacity-100 z-[60]' : 'opacity-0 group-hover:opacity-100 z-20'} transition-opacity -top-8 ${isOwnMessage ? 'left-0' : 'right-0'} bg-base-300 rounded-lg shadow-lg flex gap-1 p-1`}
            onMouseLeave={() => { setShowReactions(false); setShowFullPicker(false); }}
          >
            
            {/* Reaction Trigger */}
            <div className="relative flex items-center">
              <button 
                className="p-1.5 hover:bg-base-100 rounded text-base-content/70 hover:text-base-content transition-colors"
                title="React"
                onClick={(e) => { e.stopPropagation(); setShowReactions(!showReactions); }}
              >
                <SmilePlus className="size-3.5" />
              </button>
              
              <AnimatePresence>
                {showReactions && (
                  <div className="absolute bottom-full left-1/2 -translate-x-1/2 pb-2 z-[60]">
                    {!showFullPicker ? (
                      <motion.div 
                        initial={{ opacity: 0, y: 5, scale: 0.9 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.9 }}
                        className="bg-base-100 border border-base-300 shadow-xl rounded-full px-2 py-1.5 flex items-center gap-1.5"
                      >
                        {REACTION_EMOJIS.map(emoji => (
                          <button
                            key={emoji}
                            title={`React with ${emoji}`}
                            onClick={(e) => handleReaction(e, emoji)}
                            className="text-lg hover:scale-125 transition-transform origin-bottom px-1"
                          >
                            {emoji}
                          </button>
                        ))}
                        <button
                          onClick={(e) => { e.stopPropagation(); setShowFullPicker(true); }}
                          className="p-1 hover:bg-base-200 rounded-full text-base-content/60 transition-colors ml-1"
                          title="More Emojis"
                        >
                          <Plus className="size-4" />
                        </button>
                      </motion.div>
                    ) : (
                      <motion.div
                        initial={{ opacity: 0, scale: 0.9, y: 5 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.9, y: 5 }}
                        className="shadow-2xl rounded-2xl overflow-hidden pointer-events-auto origin-bottom"
                        onClick={(e) => e.stopPropagation()}
                      >
                         <Picker 
                           data={data} 
                           onEmojiSelect={(emoji) => handleReaction(null, emoji.native)} 
                           theme="auto" 
                           previewPosition="none" 
                           skinTonePosition="none" 
                           maxFrequentRows={1} 
                         />
                      </motion.div>
                    )}
                  </div>
                )}
              </AnimatePresence>
            </div>
            {isAIMessage && (
              <>
                <button 
                  className="p-1.5 hover:bg-base-100 rounded text-base-content/70 hover:text-base-content transition-colors" 
                  title="Copy"
                  onClick={handleCopy}
                >
                  <Copy className="size-3.5" />
                </button>
                <button 
                  className="p-1.5 hover:bg-base-100 rounded text-base-content/70 hover:text-base-content transition-colors" 
                  title="Regenerate"
                  onClick={handleRegenerate}
                >
                  <RefreshCw className="size-3.5" />
                </button>
                <button 
                  className="p-1.5 hover:bg-base-100 rounded text-base-content/70 hover:text-base-content transition-colors" 
                  title="Like"
                  onClick={handleLike}
                >
                  <ThumbsUp className="size-3.5" />
                </button>
                {context === "ai" && (
                  <button
                    onClick={openDeleteConfirm}
                    className="p-1.5 hover:bg-red-100/50 rounded text-base-content/70 hover:text-red-500 transition-colors"
                    title="Delete"
                  >
                    <Trash2 className="size-3.5" />
                  </button>
                )}
              </>
            )}
            {!isAIMessage && (
              <>
                <button 
                  className="p-1.5 hover:bg-base-100 rounded text-base-content/70 hover:text-base-content transition-colors" 
                  title="Reply"
                  onClick={handleReply}
                >
                  <Reply className="size-3.5" />
                </button>
                <button 
                  className="p-1.5 hover:bg-base-100 rounded text-base-content/70 hover:text-base-content transition-colors" 
                  title="Copy"
                  onClick={handleCopy}
                >
                  <Copy className="size-3.5" />
                </button>
                <button onClick={handleForward} className="p-1.5 hover:bg-base-100 rounded text-base-content/70 hover:text-base-content transition-colors" title="Forward">
                  <Forward className="size-3.5" />
                </button>
                <button onClick={openDeleteConfirm} className="p-1.5 hover:bg-red-100/50 rounded text-base-content/70 hover:text-red-500 transition-colors" title="Delete">
                  <Trash2 className="size-3.5" />
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      {typeof document !== "undefined" && createPortal(
        <AnimatePresence>
          {isDeleteOpen && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[9999] bg-black/40 backdrop-blur-sm flex items-center justify-center p-4"
              onClick={closeDeleteConfirm}
            >
                <motion.div
                  initial={{ scale: 0.96, opacity: 0, y: 8 }}
                  animate={{ scale: 1, opacity: 1, y: 0 }}
                  exit={{ scale: 0.96, opacity: 0, y: 8 }}
                  transition={{ type: "spring", damping: 22, stiffness: 280 }}
                className="relative w-full max-w-sm rounded-2xl bg-base-100 shadow-2xl border border-base-300 p-5"
                  onClick={(e) => e.stopPropagation()}
                  role="dialog"
                  aria-modal="true"
                  aria-labelledby={`delete-title-${message.id}`}
                >
                <button
                  type="button"
                  onClick={closeDeleteConfirm}
                  className="absolute right-3 top-3 size-8 rounded-full bg-base-200 text-base-content/60 hover:text-base-content hover:bg-base-300 transition-colors flex items-center justify-center"
                  aria-label="Close"
                >
                  <X className="size-4" />
                </button>
                <div className="flex items-start gap-3">
                  <div className="size-10 rounded-full bg-red-100/70 text-red-500 flex items-center justify-center">
                    <Trash2 className="size-5" />
                  </div>
                  <div className="flex-1">
                    <h3 id={`delete-title-${message.id}`} className="text-base font-semibold">
                      Delete this message?
                    </h3>
                    <p className="text-sm text-base-content/60 mt-1">
                      This action cannot be undone.
                    </p>
                  </div>
                </div>

                <div className="mt-5 flex items-center justify-end">
                  <div className="flex flex-col items-end gap-2">
                    {isAIContext ? (
                      <button
                        type="button"
                        onClick={() => confirmDelete("self")}
                        className="px-5 py-2 text-sm font-semibold rounded-full bg-error text-white hover:bg-error/90 shadow-sm"
                      >
                        Delete
                      </button>
                    ) : (
                      <>
                        <button
                          type="button"
                          onClick={() => confirmDelete("self")}
                          className="px-4 py-2 text-sm font-semibold rounded-full border border-base-300 text-base-content/80 hover:text-base-content hover:border-base-content/40 transition-colors"
                        >
                          Delete for me
                        </button>
                        <button
                          type="button"
                          onClick={() => confirmDelete("all")}
                          className="px-5 py-2 text-sm font-semibold rounded-full bg-error text-white hover:bg-error/90 shadow-sm"
                        >
                          Delete for everyone
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </motion.div>
            </motion.div>
          )}
          {isPreviewOpen && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[9999] bg-black/60 backdrop-blur-md flex items-center justify-center p-4"
              onClick={closePreview}
            >
              <button
                onClick={closePreview}
                className="absolute top-4 right-4 md:top-6 md:right-6 p-2 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors z-50"
                aria-label="Close preview"
              >
                <X className="size-6 md:size-8" />
              </button>

              <motion.div
                initial={{ scale: 0.95, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.95, opacity: 0 }}
                transition={{ type: "spring", damping: 25, stiffness: 300 }}
                className="max-w-4xl w-full flex flex-col items-center gap-4 mt-12"
                onClick={(e) => e.stopPropagation()}
              >
                <img
                  src={message.content}
                  alt={message.caption || "Preview"}
                  className="max-h-[80vh] w-auto rounded-2xl shadow-2xl"
                  onError={handleImageError}
                />
                <button
                  onClick={handleDownloadImage}
                  className="btn btn-primary px-8 py-2.5 rounded-full font-bold shadow-lg hover:scale-105 transition-transform"
                >
                  Download Image
                </button>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>,
        document.body
      )}
    </motion.div>
  );
});

MessageBubble.displayName = 'MessageBubble';

export default MessageBubble;
