import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Search, Loader2, UserPlus, X, UserCheck, Clock, XCircle, MessageSquare } from "lucide-react";
import { axiosInstance } from "../lib/axios.js";
import toast from "react-hot-toast";
import { useChatStore } from "../store/useChatStore.jsx";

const SearchUsersModal = ({ isOpen, onClose, initialTab = "discover" }) => {
  const [activeTab, setActiveTab] = useState("discover"); // "connections" | "discover" | "sent"
  const [searchTerm, setSearchTerm] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  
  const { 
    sendConnectionRequest, 
    users, 
    sentRequests, 
    getSentRequests, 
    cancelConnectionRequest,
    setSelectedUser
  } = useChatStore();

  const validSentRequests = sentRequests?.filter(req => req.receiverId) || [];

  const [recentSearches, setRecentSearches] = useState(() => {
    const saved = localStorage.getItem("chat_recent_searches");
    return saved ? JSON.parse(saved) : [];
  });

  const addToRecentSearches = (user) => {
    setRecentSearches(prev => {
      const filtered = prev.filter(u => u._id !== user._id);
      const updated = [user, ...filtered].slice(0, 10);
      localStorage.setItem("chat_recent_searches", JSON.stringify(updated));
      return updated;
    });
  };

  const removeFromRecentSearches = (userId, e) => {
    e.stopPropagation();
    setRecentSearches(prev => {
      const updated = prev.filter(u => u._id !== userId);
      localStorage.setItem("chat_recent_searches", JSON.stringify(updated));
      return updated;
    });
  };
  
  const debounceRef = useRef(null);

  useEffect(() => {
    if (isOpen) {
      setActiveTab(initialTab);
      getSentRequests();
    } else {
      setSearchTerm("");
      setSearchResults([]);
      setHasSearched(false);
      setActiveTab("discover");
    }
  }, [isOpen, initialTab, getSentRequests]);

  const performSearch = async (normalized) => {
    setIsSearching(true);
    setHasSearched(true);
    try {
      const res = await axiosInstance.get(`/messages/search?q=${encodeURIComponent(normalized)}`);
      setSearchResults(res.data);
    } catch (error) {
      toast.error("Failed to search users");
    } finally {
      setIsSearching(false);
    }
  };

  const handleSearch = async (e) => {
    e.preventDefault();
    const normalized = searchTerm.trim().replace(/^@+/, "");
    if (!normalized) {
      setSearchResults([]);
      setHasSearched(false);
      return;
    }
    if (debounceRef.current) clearTimeout(debounceRef.current);
    await performSearch(normalized);
  };

  useEffect(() => {
    const normalized = searchTerm.trim().replace(/^@+/, "");

    if (!normalized) {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      setSearchResults([]);
      setHasSearched(false);
      setIsSearching(false);
      return;
    }

    if (debounceRef.current) clearTimeout(debounceRef.current);

    debounceRef.current = setTimeout(() => {
      performSearch(normalized);
    }, 250);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [searchTerm]);

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="fixed inset-0 bg-base-300/50 backdrop-blur-sm z-[100] flex items-center justify-center p-4"
        >
          <motion.div
            initial={{ scale: 0.95, opacity: 0, y: 15 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.95, opacity: 0, y: 15 }}
            transition={{ type: "spring", stiffness: 300, damping: 25 }}
            className="bg-base-100 rounded-2xl w-full max-w-md shadow-xl flex flex-col max-h-[85vh] overflow-hidden"
          >
        <div className="flex flex-col border-b border-base-300">
          <div className="flex items-center justify-between p-4 pb-2">
            <h2 className="font-bold text-lg">Find Users</h2>
            <button onClick={onClose} className="p-1 hover:bg-base-200 rounded-lg transition-colors">
              <X className="size-5" />
            </button>
          </div>
          
          <div className="flex px-4 gap-4">
            <button 
              className={`pb-2 text-sm font-medium transition-colors relative ${activeTab === "connections" ? "text-primary" : "text-base-content/60 hover:text-base-content"}`}
              onClick={() => setActiveTab("connections")}
            >
              Connections
              {users?.length > 0 && (
                <span className="bg-primary/10 text-primary text-[10px] px-1.5 py-0.5 rounded-full font-bold ml-2">
                  {users.length}
                </span>
              )}
              {activeTab === "connections" && (
                <span className="absolute bottom-0 left-0 w-full h-[2px] bg-primary rounded-t-full" />
              )}
            </button>
            <button 
              className={`pb-2 text-sm font-medium transition-colors relative ${activeTab === "discover" ? "text-primary" : "text-base-content/60 hover:text-base-content"}`}
              onClick={() => setActiveTab("discover")}
            >
              Discover Users
              {activeTab === "discover" && (
                <span className="absolute bottom-0 left-0 w-full h-[2px] bg-primary rounded-t-full" />
              )}
            </button>
            <button 
              className={`pb-2 text-sm font-medium transition-colors relative flex items-center gap-2 ${activeTab === "sent" ? "text-primary" : "text-base-content/60 hover:text-base-content"}`}
              onClick={() => setActiveTab("sent")}
            >
              Sent Requests
              {validSentRequests.length > 0 && (
                <span className="bg-primary/10 text-primary text-[10px] px-1.5 py-0.5 rounded-full font-bold">
                  {validSentRequests.length}
                </span>
              )}
              {activeTab === "sent" && (
                <span className="absolute bottom-0 left-0 w-full h-[2px] bg-primary rounded-t-full" />
              )}
            </button>
          </div>
        </div>
        
        {activeTab === "connections" && (
          <div className="flex-1 overflow-y-auto p-2 min-h-[300px]">
            {(!users || users.length === 0) && (
              <div className="flex flex-col items-center justify-center text-center text-base-content/40 py-12">
                <UserCheck className="size-10 mb-3 opacity-20" />
                <p>No connections yet.</p>
                <p className="text-xs mt-1">Use “Find People” to connect.</p>
              </div>
            )}

            <div className="space-y-1">
              {users?.map((user) => (
                <div 
                  key={user._id} 
                  className="flex items-center justify-between p-3 hover:bg-base-200 rounded-xl transition-colors cursor-pointer"
                  onClick={() => {
                    setSelectedUser(user);
                    onClose();
                  }}
                >
                  <div className="flex items-center gap-3">
                    <img src={user.profilePic || "/avatar.png"} alt={user.fullName} className="size-10 rounded-full object-cover ring-1 ring-base-300" />
                    <div>
                      <p className="font-medium text-sm">{user.fullName}</p>
                      <p className="text-xs text-base-content/60">@{user.username}</p>
                    </div>
                  </div>
                  <button className="btn btn-sm text-xs px-3 btn-primary">
                    <MessageSquare className="size-3.5 mr-1" />
                    Start Chat
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === "discover" && (
          <>
            <div className="p-4 border-b border-base-300">
              <form onSubmit={handleSearch} className="relative">
                <input
                  type="text"
                  placeholder="Search by username or name"
                  className="input input-bordered w-full pr-10"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  autoFocus
                />
                <button type="submit" className="absolute right-3 top-1/2 -translate-y-1/2 text-base-content/50 hover:text-primary transition-colors" disabled={isSearching}>
                  {isSearching ? <Loader2 className="size-4 animate-spin" /> : <Search className="size-4" />}
                </button>
              </form>
            </div>

            <div className="flex-1 overflow-y-auto p-2 min-h-[300px]">
              {searchResults.length === 0 && hasSearched && !isSearching && (
                <p className="text-center text-base-content/60 py-12">No users found.</p>
              )}
              {searchResults.length === 0 && !searchTerm && recentSearches.length === 0 && (
                 <div className="flex flex-col items-center justify-center text-center text-base-content/40 py-12">
                   <Search className="size-10 mb-3 opacity-20" />
                   <p>Type a username to find people.</p>
                 </div>
              )}
              
              {/* Recent Searches */}
              {searchResults.length === 0 && !searchTerm && recentSearches.length > 0 && (
                <div className="space-y-1">
                  <div className="flex items-center justify-between px-2 pb-2">
                    <p className="text-xs font-semibold text-base-content/50">Recent Searches</p>
                    <button 
                      onClick={() => {
                        setRecentSearches([]);
                        localStorage.removeItem("chat_recent_searches");
                      }}
                      className="text-[10px] font-medium text-base-content/40 hover:text-base-content transition-colors"
                    >
                      Clear All
                    </button>
                  </div>
                  {recentSearches.map((user) => {
                    const isConnected = users.some(u => u._id === user._id);
                    const isRequested = validSentRequests.some(req => req.receiverId?._id === user._id || req.receiverId === user._id);

                    return (
                      <div 
                        key={user._id} 
                        className="flex items-center justify-between p-3 hover:bg-base-200 rounded-xl transition-colors cursor-pointer group"
                        onClick={() => {
                          if (isConnected) {
                            setSelectedUser(user);
                            onClose();
                          }
                        }}
                      >
                        <div className="flex items-center gap-3">
                          <img src={user.profilePic || "/avatar.png"} alt={user.fullName} className="size-10 rounded-full object-cover ring-1 ring-base-300" />
                          <div>
                            <p className="font-medium text-sm">{user.fullName}</p>
                            <p className="text-xs text-base-content/60">@{user.username}</p>
                          </div>
                        </div>
                        
                        <div className="flex items-center gap-2">
                          {isConnected ? (
                            <button className="btn btn-sm text-xs px-3 btn-ghost pointer-events-none opacity-70 hidden sm:flex">
                              <UserCheck className="size-3.5 mr-1" />
                              Following
                            </button>
                          ) : isRequested ? (
                            <button className="btn btn-sm text-xs px-3 btn-ghost pointer-events-none opacity-70 hidden sm:flex">
                              <Clock className="size-3.5 mr-1" />
                              Pending
                            </button>
                          ) : (
                            <button 
                              onClick={(e) => {
                                e.stopPropagation();
                                sendConnectionRequest(user._id);
                              }} 
                              className="btn btn-sm text-xs px-3 btn-primary hidden sm:flex"
                            >
                              <UserPlus className="size-3.5 mr-1" />
                              Connect
                            </button>
                          )}
                          <button 
                            onClick={(e) => removeFromRecentSearches(user._id, e)}
                            className="p-1.5 rounded-lg text-base-content/40 hover:text-base-content hover:bg-base-300 transition-colors opacity-0 group-hover:opacity-100"
                            title="Remove from recent"
                          >
                            <X className="size-4" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
              {/* Search Results */}
              <div className="space-y-1">
                {searchResults.map((user) => {
                  const isConnected = users.some(u => u._id === user._id);
                  const isRequested = validSentRequests.some(req => req.receiverId?._id === user._id || req.receiverId === user._id);

                  return (
                  <div 
                    key={user._id} 
                    className="flex items-center justify-between p-3 hover:bg-base-200 rounded-xl transition-colors cursor-pointer"
                    onClick={() => {
                      addToRecentSearches(user);
                      if (isConnected) {
                        setSelectedUser(user);
                        onClose();
                      }
                    }}
                  >
                    <div className="flex items-center gap-3">
                      <img src={user.profilePic || "/avatar.png"} alt={user.fullName} className="size-10 rounded-full object-cover ring-1 ring-base-300" />
                      <div>
                        <p className="font-medium text-sm">{user.fullName}</p>
                        <p className="text-xs text-base-content/60">@{user.username}</p>
                      </div>
                    </div>
                    
                    {isConnected ? (
                      <button className="btn btn-sm text-xs px-3 btn-ghost pointer-events-none opacity-70">
                        <UserCheck className="size-3.5 mr-1" />
                        Following
                      </button>
                    ) : isRequested ? (
                      <button className="btn btn-sm text-xs px-3 btn-ghost pointer-events-none opacity-70">
                        <Clock className="size-3.5 mr-1" />
                        Pending
                      </button>
                    ) : (
                      <button 
                        onClick={(e) => {
                          e.stopPropagation();
                          addToRecentSearches(user);
                          sendConnectionRequest(user._id);
                        }} 
                        className="btn btn-sm text-xs px-3 btn-primary"
                      >
                        <UserPlus className="size-3.5 mr-1" />
                        Connect
                      </button>
                    )}
                  </div>
                );
              })}
              </div>
            </div>
          </>
        )}

        {activeTab === "sent" && (
          <div className="flex-1 overflow-y-auto p-2 min-h-[300px]">
             {(!validSentRequests || validSentRequests.length === 0) && (
               <div className="flex flex-col items-center justify-center text-center text-base-content/40 py-12">
                 <Clock className="size-10 mb-3 opacity-20" />
                 <p>No pending requests sent.</p>
               </div>
             )}
             
             <div className="space-y-1">
               {validSentRequests.map((req) => {
                 const user = req.receiverId;
                 if (!user) return null;
                 
                 return (
                   <div key={req._id} className="flex items-center justify-between p-3 hover:bg-base-200 rounded-xl transition-colors">
                     <div className="flex items-center gap-3">
                       <img src={user.profilePic || "/avatar.png"} alt={user.fullName} className="size-10 rounded-full object-cover ring-1 ring-base-300" />
                       <div>
                         <p className="font-medium text-sm">{user.fullName}</p>
                         <p className="text-xs text-base-content/60">@{user.username}</p>
                       </div>
                     </div>
                     <button 
                       onClick={() => cancelConnectionRequest(user._id)}
                       className="btn btn-sm text-xs px-3 btn-outline btn-error"
                     >
                       <XCircle className="size-3.5 mr-1" />
                       Withdraw
                     </button>
                   </div>
                 );
               })}
             </div>
          </div>
        )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
export default SearchUsersModal;
