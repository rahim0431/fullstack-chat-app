import { useRef, useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useChatStore } from "../store/useChatStore.jsx";
import { useAuthStore } from "../store/useAuthStore";
import { Send, X, Loader2, Mic, Smile, Paperclip, Image, Square, ShieldCheck } from "lucide-react";
import toast from "react-hot-toast";
import Picker from "@emoji-mart/react";
import data from "@emoji-mart/data";

const MessageInput = () => {
  const [text, setText] = useState("");
  const [imagePreview, setImagePreview] = useState(null);
  const [isSending, setIsSending] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [audioBlob, setAudioBlob] = useState(null);
  const [audioPreviewUrl, setAudioPreviewUrl] = useState(null);

  const imageInputRef = useRef(null);
  const fileInputRef = useRef(null);
  const textareaRef = useRef(null);
  const emojiPickerRef = useRef(null);
  const typingTimeoutRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const recordingTimerRef = useRef(null);
  const audioChunksRef = useRef([]);

  const { 
    sendMessage, 
    sendGroupMessage, 
    emitTyping, 
    emitStopTyping, 
    emitGroupTyping, 
    emitGroupStopTyping, 
    selectedUser, 
    selectedGroup, 
    replyMessage, 
    clearReplyMessage 
  } = useChatStore();
  const { authUser } = useAuthStore();
  const enterKeySendsMessage = authUser?.chatSettings?.enterKeySendsMessage ?? true;

  const isAdmin = selectedGroup?.admin?._id === authUser?._id || selectedGroup?.admin === authUser?._id;
  const isBroadcastOnly = selectedGroup?.settings?.sendMessages === "admin" && !isAdmin;

  // Close emoji picker on outside click
  useEffect(() => {
    const handle = (e) => {
      if (emojiPickerRef.current && !emojiPickerRef.current.contains(e.target)) {
        setShowEmojiPicker(false);
      }
    };
    document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, []);

  // Auto-resize textarea
  useEffect(() => {
    const ta = textareaRef.current;
    if (ta) {
      ta.style.height = "auto";
      ta.style.height = `${Math.min(ta.scrollHeight, 120)}px`;
    }
  }, [text]);

  // Auto-focus input when starting a reply
  useEffect(() => {
    if (replyMessage && textareaRef.current) {
      textareaRef.current.focus();
    }
  }, [replyMessage]);

  // Cleanup
  useEffect(() => {
    return () => {
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
      emitStopTyping();
      if (audioPreviewUrl) URL.revokeObjectURL(audioPreviewUrl);
    };
  }, [emitStopTyping, audioPreviewUrl]);

  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) return toast.error("Please select an image file");
    if (file.size > 5 * 1024 * 1024) return toast.error("Image must be under 5MB");
    const reader = new FileReader();
    reader.onloadend = () => setImagePreview(reader.result);
    reader.readAsDataURL(file);
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (file.size > 20 * 1024 * 1024) return toast.error("File must be under 20MB");
    const reader = new FileReader();
      reader.onloadend = async () => {
        try {
          setIsSending(true);
          if (selectedGroup) {
            await sendGroupMessage({
              type: "file",
              content: reader.result,
              fileName: file.name,
              fileSize: file.size
            });
          } else {
            await sendMessage({ 
              type: "file", 
              content: reader.result, 
              fileName: file.name,
              fileSize: file.size
            });
          }
          toast.success(`File "${file.name}" sent!`);
        } catch {
          toast.error("Failed to send file");
        } finally {
          setIsSending(false);
          if (fileInputRef.current) fileInputRef.current.value = "";
          window.setTimeout(() => {
            textareaRef.current?.focus();
          }, 0);
        }
      };
    reader.readAsDataURL(file);
  };
  const handleTextChange = (e) => {
    const value = e.target.value;
    setText(value);
    if (!selectedUser && !selectedGroup) return;
    
    // Combined typing indicator logic
    if (value.trim()) {
      if (!isTyping) {
        setIsTyping(true);
        if (selectedGroup) {
          emitGroupTyping(selectedGroup._id);
        } else {
          emitTyping();
        }
      }
      
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = setTimeout(() => {
        setIsTyping(false);
        if (selectedGroup) {
          emitGroupStopTyping(selectedGroup._id);
        } else {
          emitStopTyping();
        }
      }, 2000);
    } else {
      if (isTyping) {
        setIsTyping(false);
        if (selectedGroup) {
          emitGroupStopTyping(selectedGroup._id);
        } else {
          emitStopTyping();
        }
        if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      }
    }
  };

  const onEmojiSelect = (emoji) => {
    const native = emoji.native;
    const ta = textareaRef.current;
    if (ta) {
      const s = ta.selectionStart;
      const newText = text.slice(0, s) + native + text.slice(ta.selectionEnd);
      setText(newText);
      setTimeout(() => { ta.focus(); ta.setSelectionRange(s + native.length, s + native.length); }, 10);
    } else setText((p) => p + native);
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioChunksRef.current = [];
      const recorder = new MediaRecorder(stream);
      mediaRecorderRef.current = recorder;
      recorder.ondataavailable = (e) => { if (e.data.size > 0) audioChunksRef.current.push(e.data); };
      recorder.onstop = () => {
        const blob = new Blob(audioChunksRef.current, { type: "audio/webm" });
        setAudioBlob(blob);
        setAudioPreviewUrl(URL.createObjectURL(blob));
        stream.getTracks().forEach((t) => t.stop());
      };
      recorder.start();
      setIsRecording(true);
      setRecordingTime(0);
      recordingTimerRef.current = setInterval(() => setRecordingTime((t) => t + 1), 1000);
    } catch {
      toast.error("Microphone access denied");
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      clearInterval(recordingTimerRef.current);
    }
  };

  const removeAudio = () => {
    setAudioBlob(null);
    if (audioPreviewUrl) { URL.revokeObjectURL(audioPreviewUrl); setAudioPreviewUrl(null); }
    setRecordingTime(0);
  };

  const formatTime = (s) => `${Math.floor(s / 60).toString().padStart(2, "0")}:${(s % 60).toString().padStart(2, "0")}`;

  const handleSendMessage = async (e) => {
    e.preventDefault();
    const trimmedText = text.trim();
    if ((!trimmedText && !imagePreview && !audioBlob) || isSending || (!selectedUser && !selectedGroup)) return;
    
    try {
      setIsSending(true);
      
      // Immediately stop typing indicator
      if (selectedGroup) {
        emitGroupStopTyping(selectedGroup._id);
      } else {
        emitStopTyping();
      }
      setIsTyping(false);
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);

      const replyId = replyMessage ? (replyMessage._id || replyMessage.id) : null;
      const sendAction = selectedGroup ? sendGroupMessage : sendMessage;

      if (imagePreview) await sendAction({ type: "image", content: imagePreview, replyTo: replyId });
      if (audioBlob) {
        await new Promise((resolve) => {
          const reader = new FileReader();
          reader.onloadend = async () => { await sendAction({ type: "audio", content: reader.result, replyTo: replyId }); resolve(); };
          reader.readAsDataURL(audioBlob);
        });
      }
      if (trimmedText) {
        await sendAction({ type: "text", content: trimmedText, replyTo: replyId });
      }

      // Clear all inputs and state
      setText(""); 
      setImagePreview(null); 
      removeAudio();
      if (imageInputRef.current) imageInputRef.current.value = "";
      if (fileInputRef.current) fileInputRef.current.value = "";
      setShowEmojiPicker(false);
      clearReplyMessage();
    } catch (error) {
      toast.error("Failed to send message");
    } finally {
      setIsSending(false);
      window.setTimeout(() => {
        textareaRef.current?.focus();
      }, 0);
    }
  };

  const handleKeyDown = (e) => {
    if (e.isComposing) return;
    if (e.key !== "Enter") return;

    if (enterKeySendsMessage) {
      if (!e.shiftKey) {
        e.preventDefault();
        handleSendMessage(e);
      }
      return;
    }

    if (e.ctrlKey || e.metaKey) {
      e.preventDefault();
      handleSendMessage(e);
    }
  };

  const canSend = (text.trim() || imagePreview || audioBlob) && !isSending && (selectedUser || selectedGroup);
  const isDisabled = (!selectedUser && !selectedGroup) || isSending;

  if (isBroadcastOnly) {
    return (
      <div className="relative px-3 pb-3 mb-1">
        <div className="flex h-12 items-center justify-center bg-base-200/50 backdrop-blur-md rounded-2xl border border-base-300">
          <p className="text-sm font-medium text-base-content/50 flex items-center gap-2 italic">
            <ShieldCheck className="size-4" /> Only admins can send messages to this group
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative px-3 pb-3">

      {/* Emoji Picker */}
      {showEmojiPicker && (
        <div ref={emojiPickerRef} className="absolute bottom-full mb-2 left-3 z-50 shadow-2xl rounded-2xl overflow-hidden">
          <Picker data={data} onEmojiSelect={onEmojiSelect} theme="auto" previewPosition="none" skinTonePosition="none" maxFrequentRows={1} />
        </div>
      )}

      {/* Reply Preview */}
      <AnimatePresence>
        {replyMessage && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            className="mb-2 flex items-center justify-between bg-base-200/70 border-l-4 border-primary rounded-r-xl px-3 py-2 shadow-sm"
          >
            <div className="flex flex-col min-w-0 flex-1">
              <span className="text-xs font-bold text-primary">Replying to {replyMessage.sender === "user" ? "yourself" : "message"}</span>
              <span className="text-xs text-base-content/70 truncate">
                {replyMessage.type === "image" ? "📷 Photo" : 
                 replyMessage.type === "file" ? `📎 ${replyMessage.fileName}` :
                 replyMessage.type === "audio" ? "🎤 Voice message" :
                 replyMessage.content || "Media"}
              </span>
            </div>
            <button onClick={clearReplyMessage} type="button" className="text-base-content/50 hover:text-base-content ml-2 p-1"><X className="w-4 h-4" /></button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Image Preview */}
      <AnimatePresence>
        {imagePreview && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9, x: -10 }}
            animate={{ opacity: 1, scale: 1, x: 0 }}
            exit={{ opacity: 0, scale: 0.9, x: -10 }}
            className="mb-2 flex items-center gap-2"
          >
            <div className="relative">
              <img src={imagePreview} alt="Preview" className={`w-16 h-16 object-cover rounded-xl border border-base-300 shadow transition-opacity ${isSending ? "opacity-50" : ""}`} />
              {!isSending && (
                <button onClick={() => { setImagePreview(null); if (imageInputRef.current) imageInputRef.current.value = ""; }}
                  type="button" className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-error text-white flex items-center justify-center shadow hover:scale-110 transition-transform">
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>
            <span className="text-xs text-base-content/40">
              {isSending ? "Uploading image..." : "Image attached"}
            </span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Audio Preview */}
      {audioBlob && !isRecording && (
        <div className="mb-2 flex items-center gap-2 bg-base-200/70 rounded-xl px-3 py-1.5">
          <Mic className="w-3.5 h-3.5 text-primary shrink-0" />
          <audio src={audioPreviewUrl} controls className="h-7 flex-1" style={{ minWidth: 0 }} />
          <button onClick={removeAudio} type="button" className="text-error ml-1"><X className="w-3.5 h-3.5" /></button>
        </div>
      )}

      {/* Recording indicator */}
      {isRecording && (
        <div className="mb-2 flex items-center gap-2 bg-error/10 border border-error/20 rounded-xl px-3 py-1.5">
          <span className="w-2 h-2 rounded-full bg-error animate-pulse" />
          <span className="text-xs font-semibold text-error">REC {formatTime(recordingTime)}</span>
          <span className="text-xs text-base-content/40 ml-auto">Tap ■ to stop</span>
        </div>
      )}

      {/* Input Row */}
      <form onSubmit={handleSendMessage}>
        <div className={`flex items-center gap-2 ${isDisabled ? "opacity-60" : ""}`}>

          {/* Pill container */}
          <div className="flex-1 flex items-center bg-base-100 border border-base-300 rounded-full shadow-sm focus-within:border-primary/40 focus-within:shadow-md transition-all duration-200 px-2 gap-1">

            {/* Emoji */}
            <button type="button" onClick={() => setShowEmojiPicker((p) => !p)} disabled={isDisabled}
              className={`p-1.5 rounded-full transition-colors ${showEmojiPicker ? "text-primary" : "text-base-content/40 hover:text-primary"}`} title="Emoji">
              <Smile className="w-[18px] h-[18px]" />
            </button>

            {/* Image attach */}
            <button type="button" onClick={() => imageInputRef.current?.click()} disabled={isDisabled}
              className="p-1.5 rounded-full text-base-content/40 hover:text-primary transition-colors" title="Attach image">
              <Image className="w-[18px] h-[18px]" />
            </button>

            {/* File attach */}
            <button type="button" onClick={() => fileInputRef.current?.click()} disabled={isDisabled}
              className="p-1.5 rounded-full text-base-content/40 hover:text-primary transition-colors" title="Attach file">
              <Paperclip className="w-[17px] h-[17px]" />
            </button>

            {/* Textarea */}
            <textarea
              ref={textareaRef}
              className="flex-1 resize-none bg-transparent border-none focus:outline-none placeholder:text-base-content/30 text-base-content text-sm py-2.5 min-h-[36px] max-h-[120px] leading-snug"
              placeholder={selectedGroup ? `Message ${selectedGroup.name}...` : selectedUser ? `Message ${selectedUser.fullName}...` : "Select a chat to message"}
              value={text}
              onChange={handleTextChange}
              onKeyDown={handleKeyDown}
              disabled={isDisabled}
              rows={1}
            />

            {/* Mic / Stop */}
            {!isRecording ? (
              <button type="button" onClick={startRecording} disabled={isDisabled || !!audioBlob}
                className="p-1.5 rounded-full text-base-content/40 hover:text-error transition-colors" title="Record voice">
                <Mic className="w-[18px] h-[18px]" />
              </button>
            ) : (
              <button type="button" onClick={stopRecording}
                className="p-1.5 rounded-full text-error animate-pulse" title="Stop recording">
                <Square className="w-4 h-4 fill-current" />
              </button>
            )}
          </div>

          {/* Send Button */}
          <button
            type="submit"
            disabled={!canSend}
            onPointerDown={(e) => {
              if (canSend) e.preventDefault();
            }}
            className={`w-10 h-10 rounded-full flex items-center justify-center shadow transition-all duration-200 flex-shrink-0
              ${canSend ? "bg-primary text-primary-content hover:scale-105 hover:shadow-lg" : "bg-base-300 text-base-content/30 cursor-not-allowed"}`}>
            {isSending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          </button>
        </div>

        <input type="file" accept="image/*" className="hidden" ref={imageInputRef} onChange={handleImageChange} disabled={isDisabled} />
        <input type="file" className="hidden" ref={fileInputRef} onChange={handleFileChange} disabled={isDisabled} />
      </form>
    </div>
  );
};

export default MessageInput;
