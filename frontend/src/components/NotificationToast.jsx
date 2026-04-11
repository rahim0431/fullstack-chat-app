import toast from "react-hot-toast";

export const showCustomToast = ({ sender, senderName, groupName, body, onClick }) => {
  toast.custom((t) => (
    <div
      className={`${
        t.visible ? "animate-enter" : "animate-leave"
      } max-w-md w-full bg-base-100 shadow-2xl rounded-2xl pointer-events-auto flex ring-1 ring-base-300 border border-base-300/50 backdrop-blur-xl group hover:scale-[1.02] transition-all duration-300`}
      onClick={() => {
        onClick();
        toast.dismiss(t.id);
      }}
    >
      <div className="flex-1 w-0 p-4 cursor-pointer">
        <div className="flex items-start">
          <div className="flex-shrink-0 pt-0.5 relative">
            <img
              className="size-10 rounded-xl object-cover ring-2 ring-primary/10 shadow-lg group-hover:ring-primary/30 transition-all"
              src={sender?.profilePic || groupName ? (sender?.profilePic || "/avatar.png") : (sender?.profilePic || "/avatar.png")}
              alt=""
            />
          </div>
          <div className="ml-3 flex-1 overflow-hidden">
            {groupName && (
              <p className="text-[10px] font-bold text-primary uppercase tracking-widest mb-0.5">
                {groupName}
              </p>
            )}
            <p className="text-sm font-bold text-base-content truncate group-hover:text-primary transition-colors">
              {senderName}
            </p>
            <p className="mt-0.5 text-xs text-base-content/60 truncate italic">
              {body}
            </p>
          </div>
        </div>
      </div>
      <div className="flex border-l border-base-300/50">
        <button
          onClick={(e) => {
            e.stopPropagation();
            toast.dismiss(t.id);
          }}
          className="w-full border border-transparent rounded-none rounded-r-2xl p-4 flex items-center justify-center text-xs font-bold text-base-content/30 hover:text-primary transition-colors focus:outline-none"
        >
          Close
        </button>
      </div>
    </div>
  ), { duration: 4000 });
};
