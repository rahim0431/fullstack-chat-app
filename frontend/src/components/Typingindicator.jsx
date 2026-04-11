import { memo } from "react";

const TypingIndicator = memo(({ user }) => {
  return (
    <div className="flex items-start gap-2 animate-fade-in">
      <img
        src={user?.profilePic || "/avatar.png"}
        alt={user?.fullName}
        className="size-8 rounded-full object-cover ring-2 ring-base-200"
      />
      <div className="bg-base-200 rounded-2xl px-4 py-3 shadow-sm">
        <div className="flex items-center gap-2">
          <div className="flex gap-1">
            <div className="w-2 h-2 bg-primary rounded-full animate-bounce" 
                 style={{ animationDelay: "0ms" }} />
            <div className="w-2 h-2 bg-primary rounded-full animate-bounce" 
                 style={{ animationDelay: "150ms" }} />
            <div className="w-2 h-2 bg-primary rounded-full animate-bounce" 
                 style={{ animationDelay: "300ms" }} />
          </div>
          <span className="text-sm text-base-content/60">
            {user?.fullName?.split(' ')[0] || 'User'} is typing...
          </span>
        </div>
      </div>
    </div>
  );
});

TypingIndicator.displayName = 'TypingIndicator';

export default TypingIndicator;