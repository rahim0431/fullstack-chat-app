import { useState, useRef, useEffect } from "react";
import { useChatStore } from "../store/useChatStore.jsx";
import { useAuthStore } from "../store/useAuthStore";
import { Send, Bot, ArrowLeft, Loader2, MessageSquare, Image, Video, Mic, Paperclip, X, Square, MoreVertical, Trash2, Plus, Settings, History } from "lucide-react";
import { Link } from "react-router-dom";
import MessageBubble from "../components/MessageBubble.jsx";
import toast from "react-hot-toast";

// Mock AI user object for MessageBubble
const aiUser = {
  _id: "ai",
  fullName: "Chatty AI",
  profilePic: null 
};

const AIChatPage = () => {
  const { aiMessages, sendAIMessage, isAIThinking, isAITyping, getAIHistory, stopAIGeneration } = useChatStore();
  const isGenerating = isAIThinking || isAITyping;
  const { authUser } = useAuthStore();
  const [input, setInput] = useState("");
  const [isClearModalOpen, setIsClearModalOpen] = useState(false);
  const [mode, setMode] = useState("TEXT");
  const [style, setStyle] = useState("realistic");
  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const fileInputRef = useRef(null);
  const messagesEndRef = useRef(null);
  const modeLabelMap = {
    TEXT: "Text",
    IMAGE: "Image",
    VIDEO: "Video",
    AUDIO: "Voice",
  };
  const modeLabel = modeLabelMap[mode] || mode;

  const visualStyles = [
    { id: "realistic", label: "Realistic" },
    { id: "anime", label: "Anime" },
    { id: "cinematic", label: "Cinematic" },
    { id: "fantasy", label: "Fantasy" },
  ];

  const audioStyles = [
    { id: "english", label: "English" },
    { id: "tamil", label: "Tamil" },
  ];

  const activeStyles = mode === "AUDIO" ? audioStyles : visualStyles;

  useEffect(() => {
    const validIds = new Set(activeStyles.map((item) => item.id));
    if (!validIds.has(style)) {
      setStyle(mode === "AUDIO" ? "english" : "realistic");
    }
  }, [mode]);

  useEffect(() => {
    getAIHistory();
  }, []);

  // Cleanup image preview on unmount

  useEffect(() => {
    getAIHistory();
  }, []);

  // Cleanup image preview on unmount
  useEffect(() => {
    return () => {
      if (imagePreview) URL.revokeObjectURL(imagePreview);
    };
  }, [imagePreview]);

  const handleImageSelect = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) return toast.error("Please select an image file");
    if (file.size > 10 * 1024 * 1024) return toast.error("Image must be under 10MB");
    setImageFile(file);
    setImagePreview(URL.createObjectURL(file));
    setMode("IMAGE");
  };

  const removeImage = () => {
    setImageFile(null);
    if (imagePreview) { URL.revokeObjectURL(imagePreview); setImagePreview(null); }
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleSend = (e) => {
    e.preventDefault();
    if (!input.trim() && !imageFile) return;
    
    if (imageFile && mode !== "IMAGE") {
      toast.error("Switch to IMAGE mode to analyze images");
      return;
    }
    
    if (imageFile) {
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64 = reader.result;
        const base64Data = base64.split(",")[1];
        const imageData = {
          mimeType: imageFile.type,
          data: base64Data
        };
        sendAIMessage(input, mode, style, imageData);
        setInput("");
        removeImage();
      };
      reader.readAsDataURL(imageFile);
    } else {
      sendAIMessage(input, mode, style);
      setInput("");
    }
  };

  // Handle paste events for images
  useEffect(() => {
    const inputRef = document.getElementById("ai-input");
    if (!inputRef) return;

    const handlePaste = (e) => {
      const items = e.clipboardData?.items;
      if (!items) return;

      for (const item of items) {
        if (item.type.startsWith("image/")) {
          e.preventDefault();
          const file = item.getAsFile();
          if (file) {
            setImageFile(file);
            setImagePreview(URL.createObjectURL(file));
            toast.success("Image attached! Send with your message.");
          }
          return;
        }
      }
    };

    inputRef.addEventListener("paste", handlePaste);
    return () => inputRef.removeEventListener("paste", handlePaste);
  }, []);

  useEffect(() => {
    const scrollToBottom = () => {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    };

    scrollToBottom();

    window.addEventListener("chat-scroll", scrollToBottom);
    return () => window.removeEventListener("chat-scroll", scrollToBottom);
  }, [aiMessages, isAIThinking]);

  return (
    <div className="h-screen bg-base-100 pt-16 flex flex-col">
      {/* Header */}
      <div className="bg-base-100 border-b border-base-300 px-4 py-3 flex items-center justify-between shadow-sm z-10 mt-3">
        <div className="flex items-center gap-4">
          <Link to="/" className="btn btn-ghost btn-sm btn-circle">
            <ArrowLeft className="size-5" />
          </Link>
          <div className="flex items-center gap-3">
              <div className="size-10 rounded-full bg-primary/10 flex items-center justify-center">
                  <Bot className="size-6 text-primary" />
              </div>
              <div>
                  <h3 className="font-semibold">Chatty AI</h3>
                  <p className="text-xs text-base-content/60">Smart Assistant • Fast Responses</p>
              </div>
          </div>
        </div>

        {/* Dropdown Menu */}
        <div className="dropdown dropdown-end">
          <div tabIndex={0} role="button" className="btn btn-ghost btn-circle btn-sm">
            <MoreVertical className="size-5" />
          </div>
          <ul tabIndex={0} className="dropdown-content z-[1] menu p-2 shadow bg-base-200 rounded-box w-52 border border-base-300 mt-2">
            <li>
              <button 
                onClick={() => {
                  const el = document.activeElement;
                  if (el) el.blur();
                  useChatStore.getState().startNewAIChat();
                  toast.success("Started a new chat");
                }}
              >
                <Plus className="size-4" /> New Chat
              </button>
            </li>
            <li>
              <button 
                onClick={() => {
                  const el = document.activeElement;
                  if (el) el.blur();
                  useChatStore.getState().getAIHistory();
                  toast.success("History restored");
                }}
              >
                <History className="size-4" /> Restore History
              </button>
            </li>
            <li>
              <Link to="/settings" state={{ activeTab: "ai" }} onClick={() => {
                  const el = document.activeElement;
                  if (el) el.blur();
                }}>
                <Settings className="size-4" /> AI Settings
              </Link>
            </li>
            <div className="divider my-0"></div>
            <li>
              <button 
                onClick={() => {
                  const el = document.activeElement;
                  if (el) el.blur();
                  setIsClearModalOpen(true);
                }}
                className="text-error hover:bg-error/10 hover:text-error"
              >
                <Trash2 className="size-4" /> Clear History
              </button>
            </li>
          </ul>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {aiMessages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-base-content/50">
            <Bot className="size-16 mb-4 opacity-50" />
            <p>Start a conversation with Chatty AI</p>
          </div>
        )}
        
        {aiMessages.map((msg) => (
            <MessageBubble 
                key={msg.id} 
                message={msg} 
                authUser={authUser} 
                selectedUser={aiUser}
                context="ai"
            />
        ))}
        
        {isAIThinking && mode === "IMAGE" && (
          <div className="flex justify-start px-4">
            <div className="bg-base-200/70 border border-base-300 rounded-2xl p-4 w-72 sm:w-80">
              <p className="text-sm font-medium">Generating Image Preview</p>
              <p className="text-xs text-base-content/60 mt-1">AI is creating your image...</p>
              <div className="mt-3 h-40 rounded-xl bg-base-300/60 animate-pulse blur-[1px]" />
            </div>
          </div>
        )}

        {isAIThinking && mode === "VIDEO" && (
          <div className="flex justify-start px-4">
            <div className="bg-base-200/70 border border-base-300 rounded-2xl p-4 w-72 sm:w-80">
              <p className="text-sm font-medium">Generating Video Preview</p>
              <p className="text-xs text-base-content/60 mt-1">AI is rendering your video...</p>
              <div className="mt-3 h-40 rounded-xl bg-base-300/60 animate-pulse blur-[1px] flex items-center justify-center">
                <Video className="size-8 text-base-content/30" />
              </div>
            </div>
          </div>
        )}

        {isAIThinking && mode !== "IMAGE" && mode !== "VIDEO" && (
          <div className="flex justify-start px-4">
            <div className="text-gray-400 text-sm animate-pulse">
              {mode === "AUDIO" ? "Generating voice..." : "AI is typing..."}
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Image Preview */}
      {imagePreview && (
        <div className="px-4 pb-2">
          <div className="relative inline-block">
            <img src={imagePreview} alt="Preview" className="w-20 h-20 object-cover rounded-xl border border-base-300 shadow" />
            <button 
              onClick={removeImage}
              type="button" 
              className="absolute -top-2 -right-2 w-5 h-5 rounded-full bg-error text-white flex items-center justify-center shadow"
            >
              <X className="w-3 h-3" />
            </button>
          </div>
        </div>
      )}

      {/* Input */}
      <div className="p-4 bg-base-100 border-t border-base-300">
        <form onSubmit={handleSend} className="max-w-4xl mx-auto space-y-2">
          <div className="flex items-center gap-2 flex-wrap">
            <button
              type="button"
              className={`btn btn-circle btn-sm ${mode === "TEXT" ? "btn-primary" : "btn-ghost"}`}
              onClick={() => setMode("TEXT")}
              aria-pressed={mode === "TEXT"}
              title="Text AI"
              disabled={isAIThinking}
            >
              <MessageSquare className="size-4" />
            </button>
            <button
              type="button"
              className={`btn btn-circle btn-sm ${mode === "IMAGE" ? "btn-primary" : "btn-ghost"}`}
              onClick={() => setMode("IMAGE")}
              aria-pressed={mode === "IMAGE"}
              title="Image"
              disabled={isAIThinking}
            >
              <Image className="size-4" />
            </button>
            <button
              type="button"
              className={`btn btn-circle btn-sm ${mode === "VIDEO" ? "btn-primary" : "btn-ghost"}`}
              onClick={() => setMode("VIDEO")}
              aria-pressed={mode === "VIDEO"}
              title="Video"
              disabled={isAIThinking}
            >
              <Video className="size-4" />
            </button>
            <button
              type="button"
              className={`btn btn-circle btn-sm ${mode === "AUDIO" ? "btn-primary" : "btn-ghost"}`}
              onClick={() => setMode("AUDIO")}
              aria-pressed={mode === "AUDIO"}
              title="Voice Assistant"
              disabled={isAIThinking}
            >
              <Mic className="size-4" />
            </button>
            <span className="text-xs text-base-content/60 ml-2">
              Mode: <span className="font-semibold">{modeLabel}</span>
            </span>
          </div>

          <div
            className={`flex items-center gap-2 flex-wrap transition-all duration-300 ${
              mode === "IMAGE" || mode === "VIDEO" || mode === "AUDIO"
                ? "opacity-100 max-h-16"
                : "opacity-0 max-h-0 overflow-hidden pointer-events-none"
            }`}
          >
            <span className="text-xs text-base-content/60">
              {mode === "AUDIO" ? "Voice:" : "Style:"}
            </span>
            {activeStyles.map((item) => (
              <button
                key={item.id}
                type="button"
                className={`btn btn-xs ${style === item.id ? "btn-primary" : "btn-ghost"}`}
                onClick={() => setStyle(item.id)}
                aria-pressed={style === item.id}
                disabled={isAIThinking}
              >
                {item.label}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="btn btn-circle btn-ghost"
              disabled={isAIThinking}
              title="Attach image"
            >
              <Paperclip className="size-5" />
            </button>
            <input
              id="ai-input"
              type="text"
              className="input input-bordered flex-1 rounded-full focus:outline-none focus:border-primary"
              placeholder={`Prompt (${modeLabel.toUpperCase()})...`}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              disabled={isAIThinking}
            />
            {isGenerating ? (
              <button
                type="button"
                className="btn btn-circle btn-error"
                onClick={stopAIGeneration}
                title="Stop generation"
              >
                <Square className="size-5 fill-current" />
              </button>
            ) : (
              <button
                type="submit"
                className="btn btn-circle btn-primary"
                disabled={!input.trim() && !imageFile}
              >
                <Send className="size-5" />
              </button>
            )}
          </div>

          <input 
            type="file" 
            accept="image/*" 
            className="hidden" 
            ref={fileInputRef} 
            onChange={handleImageSelect}
            disabled={isAIThinking}
          />

        </form>
      </div>

      {isClearModalOpen && (
        <div className="modal modal-open bg-black/40 backdrop-blur-sm z-50 transition-all">
          <div className="modal-box bg-base-100 border border-base-300 shadow-2xl relative">
            <h3 className="font-bold text-xl text-error flex items-center gap-2 mb-2">
              <Trash2 className="size-6" /> Clear Chat History 
            </h3>
            <p className="py-2 text-base-content/80">
              Are you sure you want to completely clear your AI chat history? This will permanently delete all your interactions with Chatty AI and cannot be undone.
            </p>
            <div className="modal-action mt-6 gap-2">
              <button 
                className="btn btn-ghost hover:bg-base-200" 
                onClick={() => setIsClearModalOpen(false)}
              >
                Keep History
              </button>
              <button 
                className="btn btn-error text-white shadow-sm shadow-error border-error" 
                onClick={() => {
                  setIsClearModalOpen(false);
                  useChatStore.getState().clearAIHistory();
                }}
              >
                Delete Everything
              </button>
            </div>
            <button
              onClick={() => setIsClearModalOpen(false)}
              className="btn btn-sm btn-circle btn-ghost absolute right-3 top-3 border-none"
            >
              <X className="size-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default AIChatPage;
