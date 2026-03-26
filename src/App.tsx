import React, { useState, useEffect, useRef } from "react";
import { io, Socket } from "socket.io-client";
import { motion, AnimatePresence } from "motion/react";
import Peer from "simple-peer";
import { 
  Search, 
  MoreVertical, 
  Paperclip, 
  Send, 
  Smile, 
  User as UserIcon, 
  Settings, 
  LogOut, 
  Menu,
  X,
  Phone,
  Video,
  Check,
  CheckCheck,
  Image as ImageIcon,
  FileText,
  Download,
  PhoneOff,
  VideoOff,
  Mic,
  MicOff,
  Camera,
  CameraOff,
  Calendar,
  Clock,
  Users,
  UserPlus,
  MousePointer2,
  MessageCircle,
  Copy
} from "lucide-react";
import EmojiPicker, { EmojiClickData } from "emoji-picker-react";
import { format } from "date-fns";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { User, Message, Chat, CallState } from "./types";

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export default function App() {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [isRegistering, setIsRegistering] = useState(false);
  
  // Auth Inputs
  const [usernameInput, setUsernameInput] = useState("");
  const [phoneInput, setPhoneInput] = useState("");
  const [passwordInput, setPasswordInput] = useState("");
  const [loginError, setLoginError] = useState("");

  // Chat State
  const [chats, setChats] = useState<Chat[]>([]);
  const [activeChat, setActiveChat] = useState<Chat | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState("");
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const [remoteTyping, setRemoteTyping] = useState<{ [key: string]: boolean }>({});
  const [searchQuery, setSearchQuery] = useState("");
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [selectedProfileUser, setSelectedProfileUser] = useState<User | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [editBio, setEditBio] = useState("");
  const [editBirthYear, setEditBirthYear] = useState("");
  const [editUsername, setEditUsername] = useState("");
  const [editAvatar, setEditAvatar] = useState("");
  const [isUpdatingProfile, setIsUpdatingProfile] = useState(false);
  const [showMembers, setShowMembers] = useState(false);
  const [onlineUsers, setOnlineUsers] = useState<any[]>([]);
  const [cursors, setCursors] = useState<{ [key: string]: { x: number, y: number, username: string } }>({});
  const [showAddPerson, setShowAddPerson] = useState(false);
  const [addPhone, setAddPhone] = useState("");

  // Call State
  const [callState, setCallState] = useState<CallState>({
    isCalling: false,
    isReceiving: false,
    caller: null,
    signal: null,
    type: "voice",
    accepted: false
  });
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [callDuration, setCallDuration] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const [isCameraOff, setIsCameraOff] = useState(false);

  const myVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const connectionRef = useRef<Peer.Instance | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const callTimerRef = useRef<NodeJS.Timeout | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const newSocket = io(window.location.origin);
    setSocket(newSocket);

    // Check for persisted session
    const savedUser = localStorage.getItem("chatzone_user");
    if (savedUser) {
      const credentials = JSON.parse(savedUser);
      newSocket.emit("login", credentials);
    }

    return () => {
      newSocket.close();
    };
  }, []);

  useEffect(() => {
    if (!socket) return;

    socket.on("login_success", (userData: any) => {
      const { onlineUsers: initialUsers, ...user } = userData;
      setCurrentUser(user);
      setIsLoggedIn(true);
      setEditBio(user.bio || "");
      setEditBirthYear(user.birthYear?.toString() || "");
      setEditUsername(user.username || "");
      setEditAvatar(user.avatar || "");
      
      if (initialUsers) {
        setOnlineUsers(initialUsers);
        const otherUsers = initialUsers.filter((u: any) => u.phoneNumber !== user.phoneNumber);
        const globalChat: Chat = {
          id: "global",
          name: "Global Chat",
          phoneNumber: "global",
          type: "group",
          avatar: "https://api.dicebear.com/7.x/shapes/svg?seed=Global",
          unreadCount: 0,
        };

        const myContacts = otherUsers.filter((u: any) => user.contacts?.includes(u.phoneNumber));
        const nonContacts = otherUsers.filter((u: any) => !user.contacts?.includes(u.phoneNumber));

        const newChats: Chat[] = [
          globalChat,
          ...myContacts.map((u: any) => ({
            id: u.phoneNumber,
            name: u.username,
            phoneNumber: u.phoneNumber,
            type: "private" as const,
            avatar: u.avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${u.username}`,
            unreadCount: 0,
            role: u.role,
            isContact: true
          })),
          ...nonContacts.map((u: any) => ({
            id: u.phoneNumber,
            name: u.username,
            phoneNumber: u.phoneNumber,
            type: "private" as const,
            avatar: u.avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${u.username}`,
            unreadCount: 0,
            role: u.role,
            isContact: false
          }))
        ];
        setChats(newChats);
        if (!activeChat) setActiveChat(globalChat);
      }

      // Persist session
      localStorage.setItem("chatzone_user", JSON.stringify({
        phoneNumber: user.phoneNumber,
        password: passwordInput || JSON.parse(localStorage.getItem("chatzone_user") || "{}").password
      }));
    });

    socket.on("login_error", (err: string) => {
      setLoginError(err);
    });

    socket.on("register_success", () => {
      setIsRegistering(false);
      setLoginError("");
      alert("Registration successful! Please login.");
    });

    socket.on("error", (err: string) => {
      alert(err);
    });

    socket.on("contact_added", (data: { phoneNumber: string }) => {
      alert(`Contact ${data.phoneNumber} added!`);
      setAddPhone("");
      setShowAddPerson(false);
    });

    socket.on("user_status_change", (users: any[]) => {
      setOnlineUsers(users);
      const otherUsers = users.filter(u => u.phoneNumber !== currentUser?.phoneNumber);
      
      const globalChat: Chat = {
        id: "global",
        name: "Global Chat",
        phoneNumber: "global",
        type: "group",
        avatar: "https://api.dicebear.com/7.x/shapes/svg?seed=Global",
        unreadCount: 0,
      };

      const myContacts = otherUsers.filter(u => currentUser?.contacts?.includes(u.phoneNumber));
      const nonContacts = otherUsers.filter(u => !currentUser?.contacts?.includes(u.phoneNumber));

      const newChats: Chat[] = [
        globalChat,
        ...myContacts.map(u => ({
          id: u.phoneNumber,
          name: u.username,
          phoneNumber: u.phoneNumber,
          type: "private" as const,
          avatar: u.avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${u.username}`,
          unreadCount: 0,
          role: u.role,
          isContact: true
        })),
        ...nonContacts.map(u => ({
          id: u.phoneNumber,
          name: u.username,
          phoneNumber: u.phoneNumber,
          type: "private" as const,
          avatar: u.avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${u.username}`,
          unreadCount: 0,
          role: u.role,
          isContact: false
        }))
      ];
      setChats(newChats);
      
      // Auto-select Global Chat if none active
      if (!activeChat) {
        setActiveChat(globalChat);
      }
    });

    socket.on("message_history", (history: Message[]) => {
      setMessages(history);
    });

    socket.on("new_message", (message: Message) => {
      setMessages(prev => [...prev, message]);
      scrollToBottom();
    });

    socket.on("user_typing", (data: { phoneNumber: string; isTyping: boolean }) => {
      setRemoteTyping(prev => ({ ...prev, [data.phoneNumber]: data.isTyping }));
    });

    socket.on("call_incoming", (data: { from: User; signal: any; type: "voice" | "video" }) => {
      setCallState({
        isCalling: false,
        isReceiving: true,
        caller: data.from,
        signal: data.signal,
        type: data.type,
        accepted: false
      });
    });

    socket.on("call_accepted", (signal: any) => {
      setCallState(prev => ({ ...prev, accepted: true }));
      connectionRef.current?.signal(signal);
    });

    socket.on("call_ended", () => {
      endCall();
    });

    socket.on("cursor_update", (data: { phoneNumber: string, username: string, pos: { x: number, y: number } }) => {
      setCursors(prev => ({
        ...prev,
        [data.phoneNumber]: { ...data.pos, username: data.username }
      }));
    });

    return () => {
      socket.off("login_success");
      socket.off("login_error");
      socket.off("register_success");
      socket.off("user_status_change");
      socket.off("message_history");
      socket.off("new_message");
      socket.off("user_typing");
      socket.off("call_incoming");
      socket.off("call_accepted");
      socket.off("call_ended");
      socket.off("cursor_update");
    };
  }, [socket, currentUser]);

  useEffect(() => {
    if (callState.accepted) {
      callTimerRef.current = setInterval(() => {
        setCallDuration(prev => prev + 1);
      }, 1000);
    } else {
      if (callTimerRef.current) clearInterval(callTimerRef.current);
      setCallDuration(0);
    }
    return () => {
      if (callTimerRef.current) clearInterval(callTimerRef.current);
    };
  }, [callState.accepted]);

  useEffect(() => {
    if (!socket || !isLoggedIn) return;

    const handleMouseMove = (e: MouseEvent) => {
      const pos = {
        x: (e.clientX / window.innerWidth) * 100,
        y: (e.clientY / window.innerHeight) * 100
      };
      socket.emit("cursor_move", pos);
    };

    window.addEventListener("mousemove", handleMouseMove);
    return () => window.removeEventListener("mousemove", handleMouseMove);
  }, [socket, isLoggedIn]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  const handleAuth = (e: React.FormEvent) => {
    e.preventDefault();
    if (!socket) return;

    if (isRegistering) {
      socket.emit("register", {
        username: usernameInput,
        phoneNumber: phoneInput,
        password: passwordInput,
        role: usernameInput === "Abdulloh" ? "owner" : "user"
      });
    } else {
      socket.emit("login", {
        phoneNumber: phoneInput,
        password: passwordInput
      });
    }
  };

  const handleSendMessage = (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!inputText.trim() || !socket || !activeChat) return;

    const messageData = {
      text: inputText,
      receiverPhone: activeChat.phoneNumber,
      type: "text",
      senderName: currentUser?.username
    };

    socket.emit("send_message", messageData);
    setInputText("");
    setShowEmojiPicker(false);
    
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    socket.emit("typing", { receiverPhone: activeChat.phoneNumber, isTyping: false });
    setIsTyping(false);
  };

  const handleTyping = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInputText(e.target.value);
    if (!socket || !activeChat) return;

    if (!isTyping) {
      setIsTyping(true);
      socket.emit("typing", { receiverPhone: activeChat.phoneNumber, isTyping: true });
    }

    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => {
      setIsTyping(false);
      socket.emit("typing", { receiverPhone: activeChat.phoneNumber, isTyping: false });
    }, 2000);
  };

  const onEmojiClick = (emojiData: EmojiClickData) => {
    setInputText(prev => prev + emojiData.emoji);
  };

  const handleFileClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !socket || !activeChat) return;

    const reader = new FileReader();
    reader.onload = () => {
      const base64Data = reader.result as string;
      let type: "image" | "video" | "file" = "file";
      if (file.type.startsWith("image/")) type = "image";
      else if (file.type.startsWith("video/")) type = "video";

      const messageData = {
        text: file.name,
        receiverPhone: activeChat.phoneNumber,
        type,
        fileUrl: base64Data,
        fileName: file.name,
        senderName: currentUser?.username
      };
      socket.emit("send_message", messageData);
    };
    reader.readAsDataURL(file);
    
    // Reset input
    e.target.value = "";
  };

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      setEditAvatar(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const renderMessageText = (text: string) => {
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    const parts = text.split(urlRegex);
    return parts.map((part, i) => {
      if (part.match(urlRegex)) {
        return (
          <a 
            key={i} 
            href={part} 
            target="_blank" 
            rel="noopener noreferrer" 
            className="text-blue-400 hover:underline break-all"
          >
            {part}
          </a>
        );
      }
      return part;
    });
  };

  const startCall = async (type: "voice" | "video") => {
    if (!activeChat || !socket) return;

    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: type === "video",
        audio: true
      });
      setStream(mediaStream);
      if (myVideoRef.current) myVideoRef.current.srcObject = mediaStream;

      const peer = new Peer({
        initiator: true,
        trickle: false,
        stream: mediaStream
      });

      peer.on("signal", (data) => {
        socket.emit("call_user", {
          userToCall: activeChat.phoneNumber,
          signalData: data,
          type
        });
      });

      peer.on("stream", (remoteStream) => {
        setRemoteStream(remoteStream);
        if (remoteVideoRef.current) remoteVideoRef.current.srcObject = remoteStream;
      });

      connectionRef.current = peer;
      setCallState({
        isCalling: true,
        isReceiving: false,
        caller: activeChat as any,
        signal: null,
        type,
        accepted: false
      });
    } catch (err) {
      console.error("Failed to get media devices", err);
      alert("Please allow camera and microphone access to make calls.");
    }
  };

  const answerCall = async () => {
    if (!socket || !callState.signal) return;

    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: callState.type === "video",
        audio: true
      });
      setStream(mediaStream);
      if (myVideoRef.current) myVideoRef.current.srcObject = mediaStream;

      const peer = new Peer({
        initiator: false,
        trickle: false,
        stream: mediaStream
      });

      peer.on("signal", (data) => {
        socket.emit("answer_call", { signal: data, to: callState.caller?.phoneNumber });
      });

      peer.on("stream", (remoteStream) => {
        setRemoteStream(remoteStream);
        if (remoteVideoRef.current) remoteVideoRef.current.srcObject = remoteStream;
      });

      peer.signal(callState.signal);
      connectionRef.current = peer;
      setCallState(prev => ({ ...prev, accepted: true }));
    } catch (err) {
      console.error("Failed to answer call", err);
      alert("Please allow camera and microphone access to answer calls.");
    }
  };

  const endCall = () => {
    if (socket && (callState.isCalling || callState.isReceiving)) {
      socket.emit("end_call", { to: callState.caller?.phoneNumber });
    }
    
    if (connectionRef.current) connectionRef.current.destroy();
    if (stream) stream.getTracks().forEach(track => track.stop());
    
    setCallState({
      isCalling: false,
      isReceiving: false,
      caller: null,
      signal: null,
      type: "voice",
      accepted: false
    });
    setStream(null);
    setRemoteStream(null);
  };

  const toggleMute = () => {
    if (stream) {
      stream.getAudioTracks()[0].enabled = isMuted;
      setIsMuted(!isMuted);
    }
  };

  const toggleCamera = () => {
    if (stream && callState.type === "video") {
      stream.getVideoTracks()[0].enabled = isCameraOff;
      setIsCameraOff(!isCameraOff);
    }
  };

  const handleUpdateProfile = (e: React.FormEvent) => {
    e.preventDefault();
    if (!socket || !currentUser) return;
    setIsUpdatingProfile(true);

    socket.emit("update_profile", {
      username: editUsername,
      bio: editBio,
      birthYear: parseInt(editBirthYear) || undefined,
      avatar: editAvatar
    });
    
    setTimeout(() => {
      setIsUpdatingProfile(false);
      setShowSettings(false);
    }, 500);
  };

  if (!isLoggedIn) {
    return (
      <div className="min-h-screen bg-[#0f172a] flex items-center justify-center p-4">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-[#1e293b] p-8 rounded-2xl shadow-2xl w-full max-w-md border border-slate-700"
        >
          <div className="flex flex-col items-center mb-8">
            <div className="w-20 h-20 bg-blue-500 rounded-3xl flex items-center justify-center mb-4 shadow-lg shadow-blue-500/20">
              <Send className="text-white w-10 h-10 transform -rotate-12" />
            </div>
            <h1 className="text-3xl font-bold text-white">ChatZone</h1>
            <p className="text-slate-400 mt-2">
              {isRegistering ? "Create your account" : "Welcome back"}
            </p>
          </div>

          <form onSubmit={handleAuth} className="space-y-4">
            {isRegistering && (
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1 uppercase tracking-wider">Username</label>
                <input
                  type="text"
                  value={usernameInput}
                  onChange={(e) => setUsernameInput(e.target.value)}
                  className="w-full bg-[#0f172a] border border-slate-700 rounded-xl px-4 py-3 text-white focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                  placeholder="e.g. Abdulloh"
                  required
                />
              </div>
            )}
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1 uppercase tracking-wider">Phone Number</label>
              <input
                type="tel"
                value={phoneInput}
                onChange={(e) => setPhoneInput(e.target.value)}
                className="w-full bg-[#0f172a] border border-slate-700 rounded-xl px-4 py-3 text-white focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                placeholder="+1 234 567 890"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1 uppercase tracking-wider">Password</label>
              <input
                type="password"
                value={passwordInput}
                onChange={(e) => setPasswordInput(e.target.value)}
                className="w-full bg-[#0f172a] border border-slate-700 rounded-xl px-4 py-3 text-white focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                placeholder="••••••••"
                required
              />
            </div>
            
            {loginError && (
              <p className="text-red-500 text-sm text-center font-medium">{loginError}</p>
            )}

            <button
              type="submit"
              className="w-full bg-blue-600 hover:bg-blue-500 text-white font-semibold py-3 rounded-xl transition-all shadow-lg shadow-blue-600/20 active:scale-[0.98]"
            >
              {isRegistering ? "Register" : "Login"}
            </button>
          </form>

          <div className="mt-6 text-center">
            <button 
              onClick={() => {
                setIsRegistering(!isRegistering);
                setLoginError("");
              }}
              className="text-blue-400 hover:text-blue-300 text-sm transition-colors"
            >
              {isRegistering ? "Already have an account? Login" : "Don't have an account? Register"}
            </button>
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="h-screen bg-[#0f172a] flex overflow-hidden font-sans text-slate-200">
      {/* Sidebar */}
      <motion.aside 
        initial={false}
        animate={{ width: isSidebarOpen ? "380px" : "0px", opacity: isSidebarOpen ? 1 : 0 }}
        className="bg-[#1e293b] border-r border-slate-700 flex flex-col relative z-20"
      >
        <div className="p-4 border-b border-slate-700 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={cn(
              "w-10 h-10 rounded-full flex items-center justify-center",
              currentUser?.role === "owner" ? "bg-red-500" : "bg-blue-500"
            )}>
              <UserIcon className="text-white w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                {currentUser?.role === "owner" && (
                  <span className="text-[10px] font-bold bg-red-500 text-white px-1.5 py-0.5 rounded uppercase">Owner</span>
                )}
                <h2 className={cn(
                  "font-semibold leading-tight",
                  currentUser?.role === "owner" ? "text-red-500" : "text-white"
                )}>
                  {currentUser?.username}
                </h2>
              </div>
              <span className="text-xs text-green-400">Online</span>
            </div>
          </div>
          <div className="flex gap-2">
            <button 
              onClick={() => setShowAddPerson(true)}
              className="p-2 hover:bg-blue-500/10 hover:text-blue-500 rounded-lg transition-colors"
              title="Add Person"
            >
              <UserPlus className="w-5 h-5 text-slate-400" />
            </button>
            <button 
              onClick={() => setShowSettings(true)}
              className="p-2 hover:bg-slate-700 rounded-lg transition-colors"
            >
              <Settings className="w-5 h-5 text-slate-400" />
            </button>
            <button 
              onClick={() => {
                setIsLoggedIn(false);
                localStorage.removeItem("chatzone_user");
                setCurrentUser(null);
                setActiveChat(null);
              }}
              className="p-2 hover:bg-red-500/10 hover:text-red-500 rounded-lg transition-colors"
            >
              <LogOut className="w-5 h-5 text-slate-400" />
            </button>
          </div>
        </div>

        <div className="p-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
            <input
              type="text"
              placeholder="Search by username or phone..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-[#0f172a] border border-slate-700 rounded-xl pl-10 pr-4 py-2 text-sm focus:ring-1 focus:ring-blue-500 outline-none transition-all"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto custom-scrollbar">
          {chats.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full p-8 text-center">
              <div className="w-16 h-16 bg-slate-800 rounded-full flex items-center justify-center mb-4">
                <UserIcon className="text-slate-600 w-8 h-8" />
              </div>
              <p className="text-slate-500 text-sm">No active users online right now.</p>
            </div>
          ) : (
            <div className="pb-4">
              {/* Global Section */}
              {chats.filter(c => c.id === "global").map(chat => (
                <ChatListItem key={chat.id} chat={chat} activeChat={activeChat} setActiveChat={setActiveChat} remoteTyping={remoteTyping} />
              ))}

              {/* Contacts Section */}
              {chats.filter(c => c.isContact && c.id !== "global").length > 0 && (
                <div className="px-4 py-3 mt-2 flex items-center gap-2 text-blue-400">
                  <MessageCircle className="w-4 h-4" />
                  <span className="text-[10px] font-bold uppercase tracking-widest">Mening Kontaktlarim</span>
                </div>
              )}
              {chats
                .filter(c => c.isContact && c.id !== "global")
                .filter(c => c.name.toLowerCase().includes(searchQuery.toLowerCase()) || c.phoneNumber.includes(searchQuery))
                .map((chat) => (
                  <ChatListItem key={chat.id} chat={chat} activeChat={activeChat} setActiveChat={setActiveChat} remoteTyping={remoteTyping} />
                ))}

              {/* Others Section */}
              {chats.filter(c => !c.isContact && c.id !== "global").length > 0 && (
                <div className="px-4 py-3 mt-4 flex items-center gap-2 text-slate-500">
                  <Users className="w-4 h-4" />
                  <span className="text-[10px] font-bold uppercase tracking-widest">Boshqa Foydalanuvchilar</span>
                </div>
              )}
              {chats
                .filter(c => !c.isContact && c.id !== "global")
                .filter(c => c.name.toLowerCase().includes(searchQuery.toLowerCase()) || c.phoneNumber.includes(searchQuery))
                .map((chat) => (
                  <ChatListItem key={chat.id} chat={chat} activeChat={activeChat} setActiveChat={setActiveChat} remoteTyping={remoteTyping} />
                ))}
            </div>
          )}
        </div>
      </motion.aside>

      {/* Main Chat Area */}
      <main className="flex-1 flex flex-col relative bg-[#0f172a]">
        {activeChat ? (
          <>
            {/* Chat Header */}
            <header className="h-16 bg-[#1e293b] border-b border-slate-700 flex items-center justify-between px-6 z-10">
              <div className="flex items-center gap-4">
                <button 
                  onClick={() => setIsSidebarOpen(!isSidebarOpen)}
                  className="lg:hidden p-2 hover:bg-slate-700 rounded-lg"
                >
                  <Menu className="w-5 h-5" />
                </button>
                <div className="relative">
                  <button 
                    onClick={() => setSelectedProfileUser(activeChat as any)}
                    className="relative block"
                  >
                    <img src={activeChat.avatar} alt={activeChat.name} className="w-10 h-10 rounded-full bg-slate-800" />
                    <div className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-green-500 border-2 border-[#1e293b] rounded-full"></div>
                  </button>
                </div>
                <button 
                  onClick={() => setSelectedProfileUser(activeChat as any)}
                  className="text-left"
                >
                  <div className="flex items-center gap-2">
                    {activeChat.role === "owner" && (
                      <span className="text-[10px] font-bold bg-red-500 text-white px-1.5 py-0.5 rounded uppercase">Owner</span>
                    )}
                    <h2 className={cn(
                      "font-semibold leading-tight",
                      activeChat.role === "owner" ? "text-red-500" : "text-white"
                    )}>
                      {activeChat.name}
                    </h2>
                  </div>
                  <p className="text-[10px] text-slate-400">
                    {activeChat.phoneNumber === "global" ? "Public Room" : (remoteTyping[activeChat.phoneNumber] ? "typing..." : "online")}
                  </p>
                </button>
              </div>
              <div className="flex items-center gap-4">
                {activeChat.phoneNumber === "global" && (
                  <button 
                    onClick={() => setShowMembers(true)}
                    className="p-2 hover:bg-slate-700 rounded-lg transition-colors text-slate-400 flex items-center gap-2"
                    title="View Members"
                  >
                    <Users className="w-5 h-5" />
                    <span className="text-xs font-bold bg-blue-600 text-white px-2 py-0.5 rounded-full">
                      {onlineUsers.length}
                    </span>
                  </button>
                )}
                {activeChat.phoneNumber !== "global" && (
                  <>
                    <button 
                      onClick={() => startCall("voice")}
                      className="p-2 hover:bg-slate-700 rounded-lg transition-colors text-slate-400"
                    >
                      <Phone className="w-5 h-5" />
                    </button>
                    <button 
                      onClick={() => startCall("video")}
                      className="p-2 hover:bg-slate-700 rounded-lg transition-colors text-slate-400"
                    >
                      <Video className="w-5 h-5" />
                    </button>
                  </>
                )}
                <button 
                  onClick={() => {
                    const chatContent = messages
                      .filter(m => m.senderPhone === activeChat.phoneNumber || m.receiverPhone === activeChat.phoneNumber)
                      .map(m => `[${format(new Date(m.timestamp), "yyyy-MM-dd HH:mm")}] ${m.senderPhone === currentUser?.phoneNumber ? "Me" : activeChat.name}: ${m.text}`)
                      .join("\n");
                    const blob = new Blob([chatContent], { type: "text/plain" });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement("a");
                    a.href = url;
                    a.download = `chat_with_${activeChat.name}.txt`;
                    a.click();
                  }}
                  className="flex items-center gap-2 px-2 sm:px-3 py-2 hover:bg-slate-700 rounded-xl transition-all text-slate-400 hover:text-blue-400 group"
                  title="Download Chat History"
                >
                  <Download className="w-5 h-5 group-hover:scale-110 transition-transform" />
                  <span className="hidden xs:inline text-xs font-bold uppercase tracking-wider">Download</span>
                </button>
                <button className="p-2 hover:bg-slate-700 rounded-lg transition-colors text-slate-400">
                  <MoreVertical className="w-5 h-5" />
                </button>
              </div>
            </header>

            {/* Messages Area */}
            <div className="flex-1 overflow-y-auto p-6 space-y-4 custom-scrollbar bg-[url('https://www.transparenttextures.com/patterns/cubes.png')]">
              {messages
                .filter(m => {
                  if (activeChat.phoneNumber === "global") {
                    return m.receiverPhone === "global";
                  }
                  return (m.senderPhone === activeChat.phoneNumber && m.receiverPhone === currentUser?.phoneNumber) || 
                         (m.senderPhone === currentUser?.phoneNumber && m.receiverPhone === activeChat.phoneNumber);
                })
                .map((msg) => {
                  const isMe = msg.senderPhone === currentUser?.phoneNumber;
                  return (
                    <motion.div
                      initial={{ opacity: 0, y: 10, scale: 0.95 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      key={msg.id}
                      className={cn(
                        "flex w-full",
                        isMe ? "justify-end" : "justify-start"
                      )}
                    >
                      <div className={cn(
                        "max-w-[70%] rounded-2xl px-4 py-2 shadow-sm relative group",
                        isMe 
                          ? "bg-blue-600 text-white rounded-tr-none" 
                          : "bg-[#1e293b] text-slate-200 rounded-tl-none border border-slate-700"
                      )}>
                        {!isMe && activeChat.phoneNumber === "global" && (
                          <p className="text-[10px] font-bold text-blue-400 mb-1 uppercase tracking-wider">
                            {msg.senderName || "Unknown"}
                          </p>
                        )}
                        {msg.type === "image" ? (
                          <div className="mb-1 relative group/img">
                            <img 
                              src={msg.fileUrl} 
                              alt={msg.fileName} 
                              className="rounded-lg max-w-full h-auto max-h-64 object-cover cursor-pointer"
                              onClick={() => window.open(msg.fileUrl, '_blank')}
                            />
                            <div className="absolute top-2 right-2 flex gap-2">
                              <a 
                                href={msg.fileUrl} 
                                download={msg.fileName || "image.png"}
                                className="flex items-center gap-1.5 px-2 py-1.5 bg-black/60 hover:bg-black/80 rounded-xl text-white backdrop-blur-md transition-all hover:scale-105 shadow-lg border border-white/10"
                                title="Download Image"
                                onClick={(e) => e.stopPropagation()}
                              >
                                <Download className="w-3.5 h-3.5" />
                                <span className="text-[10px] font-bold uppercase tracking-wider">Save</span>
                              </a>
                            </div>
                          </div>
                        ) : msg.type === "video" ? (
                          <div className="mb-1 relative group/video">
                            <video 
                              src={msg.fileUrl} 
                              controls 
                              className="rounded-lg max-w-full h-auto max-h-64 bg-black"
                            />
                            <div className="absolute top-2 right-2 flex gap-2">
                              <a 
                                href={msg.fileUrl} 
                                download={msg.fileName || "video.mp4"}
                                className="flex items-center gap-1.5 px-2 py-1.5 bg-black/60 hover:bg-black/80 rounded-xl text-white backdrop-blur-md transition-all hover:scale-105 shadow-lg border border-white/10"
                                title="Download Video"
                              >
                                <Download className="w-3.5 h-3.5" />
                                <span className="text-[10px] font-bold uppercase tracking-wider">Save</span>
                              </a>
                            </div>
                          </div>
                        ) : msg.type === "file" ? (
                          <a 
                            href={msg.fileUrl} 
                            download={msg.fileName}
                            className="flex items-center gap-3 bg-black/20 p-3 rounded-xl mb-1 hover:bg-black/30 transition-all cursor-pointer group/file border border-white/5"
                          >
                            <div className="w-12 h-12 bg-blue-500/20 rounded-xl flex items-center justify-center text-blue-400 group-hover/file:bg-blue-500/30 transition-colors shadow-inner">
                              <FileText className="w-7 h-7" />
                            </div>
                            <div className="flex-1 overflow-hidden">
                              <p className="text-sm font-semibold truncate text-slate-100">{msg.fileName}</p>
                              <div className="flex items-center gap-1.5 mt-0.5">
                                <Download className="w-3 h-3 text-blue-400" />
                                <p className="text-[10px] text-blue-400 font-bold uppercase tracking-wider">Download File</p>
                              </div>
                            </div>
                          </a>
                        ) : (
                          <p className="text-sm leading-relaxed">
                            {renderMessageText(msg.text)}
                          </p>
                        )}
                        <div className={cn(
                          "flex items-center gap-1 mt-1 justify-end",
                          isMe ? "text-blue-100" : "text-slate-500"
                        )}>
                          <span className="text-[10px]">
                            {format(new Date(msg.timestamp), "HH:mm")}
                          </span>
                          {isMe && <CheckCheck className="w-3 h-3" />}
                        </div>
                      </div>
                    </motion.div>
                  );
                })}
              <div ref={messagesEndRef} />
            </div>

            {/* Input Area */}
            <footer className="p-4 bg-[#1e293b] border-t border-slate-700">
              <form 
                onSubmit={handleSendMessage}
                className="max-w-4xl mx-auto flex items-end gap-3"
              >
                <div className="flex-1 bg-[#0f172a] border border-slate-700 rounded-2xl flex items-end p-2 transition-all focus-within:ring-1 focus-within:ring-blue-500">
                  <div className="relative">
                    <button 
                      type="button"
                      onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                      className="p-2 hover:bg-slate-800 rounded-xl text-slate-400 transition-colors"
                    >
                      <Smile className="w-6 h-6" />
                    </button>
                    <AnimatePresence>
                      {showEmojiPicker && (
                        <motion.div 
                          initial={{ opacity: 0, y: -20 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -20 }}
                          className="absolute bottom-14 left-0 z-50"
                        >
                          <EmojiPicker 
                            onEmojiClick={onEmojiClick}
                            theme={"dark" as any}
                            lazyLoadEmojis={true}
                          />
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                  <input
                    type="text"
                    value={inputText}
                    onChange={handleTyping}
                    placeholder="Type a message..."
                    className="flex-1 bg-transparent border-none outline-none py-2 px-3 text-white text-sm"
                  />
                  <input 
                    type="file" 
                    ref={fileInputRef} 
                    onChange={handleFileChange} 
                    className="hidden" 
                    accept="image/*, .pdf, .doc, .docx, .txt"
                  />
                  <button 
                    type="button"
                    onClick={handleFileClick}
                    className="p-2 hover:bg-slate-800 rounded-xl text-slate-400 transition-colors"
                  >
                    <ImageIcon className="w-6 h-6" />
                  </button>
                  <button 
                    type="button"
                    onClick={handleFileClick}
                    className="p-2 hover:bg-slate-800 rounded-xl text-slate-400 transition-colors"
                  >
                    <Paperclip className="w-6 h-6" />
                  </button>
                </div>
                <button
                  type="submit"
                  disabled={!inputText.trim()}
                  className="w-12 h-12 bg-blue-600 hover:bg-blue-500 disabled:bg-slate-700 disabled:text-slate-500 text-white rounded-2xl flex items-center justify-center transition-all shadow-lg shadow-blue-600/20 active:scale-90"
                >
                  <Send className="w-6 h-6" />
                </button>
              </form>
            </footer>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="w-32 h-32 bg-slate-800 rounded-[40px] flex items-center justify-center mb-8 shadow-2xl"
            >
              <Send className="text-slate-600 w-16 h-16 transform -rotate-12" />
            </motion.div>
            <h2 className="text-2xl font-bold text-white mb-2">Welcome to ChatZone</h2>
            <p className="text-slate-400 max-w-xs mx-auto">
              Select a chat from the sidebar to start messaging your friends and colleagues.
            </p>
          </div>
        )}
      </main>

      {/* Profile Modal */}
      <AnimatePresence>
        {selectedProfileUser && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[110] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
            onClick={() => setSelectedProfileUser(null)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="bg-[#1e293b] w-full max-w-sm rounded-[32px] overflow-hidden shadow-2xl border border-slate-700"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="relative h-48 bg-gradient-to-br from-blue-600 to-indigo-700">
                <button 
                  onClick={() => setSelectedProfileUser(null)}
                  className="absolute top-4 right-4 p-2 bg-black/20 hover:bg-black/40 rounded-full text-white transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
                <div className="absolute -bottom-12 left-8 group/avatar">
                  <div className="relative">
                    <img 
                      src={selectedProfileUser.avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${selectedProfileUser.username}`} 
                      alt={selectedProfileUser.username} 
                      className="w-24 h-24 rounded-3xl border-4 border-[#1e293b] bg-slate-800 shadow-xl"
                    />
                    <a 
                      href={selectedProfileUser.avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${selectedProfileUser.username}`}
                      download={`${selectedProfileUser.username}_avatar.svg`}
                      className="absolute bottom-0 right-0 p-2 bg-blue-600 hover:bg-blue-500 rounded-xl text-white shadow-lg transition-all hover:scale-110 border-2 border-[#1e293b] flex items-center justify-center"
                      title="Download Avatar"
                    >
                      <Download className="w-4 h-4" />
                    </a>
                  </div>
                </div>
              </div>
              <div className="pt-16 pb-8 px-8">
                <div className="flex items-center gap-2 mb-1">
                  {selectedProfileUser.role === "owner" && (
                    <span className="text-[10px] font-bold bg-red-500 text-white px-2 py-0.5 rounded uppercase">Owner</span>
                  )}
                  <h2 className={cn(
                    "text-2xl font-bold",
                    selectedProfileUser.role === "owner" ? "text-red-500" : "text-white"
                  )}>
                    {selectedProfileUser.username}
                  </h2>
                </div>
                <p className="text-slate-400 text-sm mb-6">@{selectedProfileUser.username.toLowerCase()}</p>
                
                <div className="space-y-4">
                  <div className="flex items-center gap-4 text-slate-300">
                    <div className="w-10 h-10 bg-slate-800 rounded-xl flex items-center justify-center">
                      <Phone className="w-5 h-5 text-blue-400" />
                    </div>
                    <div>
                      <p className="text-xs text-slate-500 uppercase font-bold tracking-wider">Phone Number</p>
                      <p className="text-sm font-medium">{selectedProfileUser.phoneNumber}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4 text-slate-300">
                    <div className="w-10 h-10 bg-slate-800 rounded-xl flex items-center justify-center">
                      <UserIcon className="text-blue-400 w-5 h-5" />
                    </div>
                    <div>
                      <p className="text-xs text-slate-500 uppercase font-bold tracking-wider">Bio</p>
                      <p className="text-sm font-medium">{selectedProfileUser.bio || "No bio available"}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4 text-slate-300">
                    <div className="w-10 h-10 bg-slate-800 rounded-xl flex items-center justify-center">
                      <div className={cn(
                        "w-3 h-3 rounded-full",
                        selectedProfileUser.status === "online" ? "bg-green-500" : "bg-slate-600"
                      )} />
                    </div>
                    <div>
                      <p className="text-xs text-slate-500 uppercase font-bold tracking-wider">Status</p>
                      <p className={cn(
                        "text-sm font-medium capitalize",
                        selectedProfileUser.status === "online" ? "text-green-400" : "text-slate-400"
                      )}>
                        {selectedProfileUser.status}
                      </p>
                    </div>
                  </div>
                  {selectedProfileUser.birthYear && (
                    <div className="flex items-center gap-4 text-slate-300">
                      <div className="w-10 h-10 bg-slate-800 rounded-xl flex items-center justify-center">
                        <Calendar className="text-blue-400 w-5 h-5" />
                      </div>
                      <div>
                        <p className="text-xs text-slate-500 uppercase font-bold tracking-wider">Birth Year</p>
                        <p className="text-sm font-medium">{selectedProfileUser.birthYear}</p>
                      </div>
                    </div>
                  )}
                  {selectedProfileUser.joinedAt && (
                    <div className="flex items-center gap-4 text-slate-300">
                      <div className="w-10 h-10 bg-slate-800 rounded-xl flex items-center justify-center">
                        <Clock className="text-blue-400 w-5 h-5" />
                      </div>
                      <div>
                        <p className="text-xs text-slate-500 uppercase font-bold tracking-wider">Joined At</p>
                        <p className="text-sm font-medium">{format(new Date(selectedProfileUser.joinedAt), "MMMM d, yyyy")}</p>
                      </div>
                    </div>
                  )}
                </div>
                
                <div className="mt-8 flex gap-3">
                  <button 
                    onClick={() => {
                      setSelectedProfileUser(null);
                      startCall("voice");
                    }}
                    className="flex-1 bg-blue-600 hover:bg-blue-500 text-white py-3 rounded-2xl font-semibold transition-all shadow-lg shadow-blue-600/20 active:scale-95 flex items-center justify-center gap-2"
                  >
                    <Phone className="w-4 h-4" /> Call
                  </button>
                  <button 
                    onClick={() => {
                      setSelectedProfileUser(null);
                      startCall("video");
                    }}
                    className="flex-1 bg-slate-700 hover:bg-slate-600 text-white py-3 rounded-2xl font-semibold transition-all active:scale-95 flex items-center justify-center gap-2"
                  >
                    <Video className="w-4 h-4" /> Video
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Members Modal */}
      <AnimatePresence>
        {showMembers && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[100] flex items-center justify-center p-4"
            onClick={() => setShowMembers(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="bg-[#1e293b] w-full max-w-md rounded-[32px] overflow-hidden shadow-2xl border border-slate-700"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="p-8">
                <div className="flex items-center justify-between mb-8">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 bg-blue-600/20 rounded-2xl flex items-center justify-center text-blue-400">
                      <Users className="w-6 h-6" />
                    </div>
                    <div>
                      <h2 className="text-2xl font-bold text-white">Online Members</h2>
                      <p className="text-sm text-slate-400">{onlineUsers.length} users online</p>
                    </div>
                  </div>
                  <button 
                    onClick={() => setShowMembers(false)}
                    className="p-2 hover:bg-slate-700 rounded-full text-slate-400"
                  >
                    <X className="w-6 h-6" />
                  </button>
                </div>

                <div className="space-y-2 max-h-[400px] overflow-y-auto custom-scrollbar pr-2">
                  {onlineUsers.map((user) => (
                    <button
                      key={user.phoneNumber}
                      onClick={() => {
                        setSelectedProfileUser({
                          phoneNumber: user.phoneNumber,
                          username: user.username,
                          name: user.username,
                          avatar: user.avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user.username}`,
                          status: user.status,
                          role: user.role,
                          bio: user.bio,
                          birthYear: user.birthYear,
                          joinedAt: user.joinedAt
                        } as any);
                        setShowMembers(false);
                      }}
                      className="w-full p-3 flex items-center gap-4 hover:bg-slate-700/50 rounded-2xl transition-all group"
                    >
                      <div className="relative">
                        <img 
                          src={user.avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user.username}`} 
                          alt={user.username} 
                          className="w-10 h-10 rounded-full bg-slate-800 object-cover" 
                        />
                        <div className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-green-500 border-2 border-[#1e293b] rounded-full"></div>
                      </div>
                      <div className="flex-1 text-left">
                        <div className="flex items-center gap-2">
                          {user.role === "owner" && (
                            <span className="text-[8px] font-bold bg-red-500 text-white px-1 rounded uppercase">Owner</span>
                          )}
                          <p className={cn(
                            "font-semibold text-sm",
                            user.role === "owner" ? "text-red-500" : "text-white"
                          )}>
                            {user.username}
                          </p>
                        </div>
                        <p className="text-[10px] text-slate-500">{user.phoneNumber}</p>
                      </div>
                      <div className="opacity-0 group-hover:opacity-100 transition-opacity">
                        <UserIcon className="w-4 h-4 text-blue-400" />
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Settings Modal */}
      <AnimatePresence>
        {showSettings && currentUser && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[120] bg-black/60 backdrop-blur-md flex items-center justify-center p-4"
            onClick={() => setShowSettings(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="bg-[#1e293b] w-full max-w-md rounded-[32px] overflow-hidden shadow-2xl border border-slate-700"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="p-8">
                <div className="flex items-center justify-between mb-8">
                  <h2 className="text-2xl font-bold text-white">Settings</h2>
                  <button 
                    onClick={() => setShowSettings(false)}
                    className="p-2 hover:bg-slate-700 rounded-full text-slate-400"
                  >
                    <X className="w-6 h-6" />
                  </button>
                </div>

                <form onSubmit={handleUpdateProfile} className="space-y-6">
                  <div className="flex flex-col items-center mb-6">
                    <div className="relative group">
                      <img 
                        src={editAvatar || currentUser.avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${currentUser.username}`} 
                        className="w-24 h-24 rounded-3xl bg-slate-800 border-4 border-slate-700 shadow-xl object-cover"
                      />
                      <label className="absolute inset-0 bg-black/40 rounded-3xl opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity cursor-pointer">
                        <Camera className="text-white w-8 h-8" />
                        <input 
                          type="file" 
                          accept="image/*" 
                          className="hidden" 
                          onChange={handleAvatarChange}
                        />
                      </label>
                    </div>
                    <p className="text-xs text-slate-500 mt-3 font-medium uppercase tracking-widest">Profile Picture</p>
                  </div>

                  <div className="space-y-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-1.5 ml-1">Username</label>
                      <input 
                        type="text" 
                        value={editUsername}
                        onChange={(e) => setEditUsername(e.target.value)}
                        className="w-full bg-[#0f172a] border border-slate-700 rounded-2xl px-4 py-3 text-white focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                        placeholder="Your username"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-1.5 ml-1">Birth Year</label>
                      <input 
                        type="number" 
                        value={editBirthYear}
                        onChange={(e) => setEditBirthYear(e.target.value)}
                        className="w-full bg-[#0f172a] border border-slate-700 rounded-2xl px-4 py-3 text-white focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                        placeholder="e.g. 1995"
                        min="1900"
                        max={new Date().getFullYear()}
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-1.5 ml-1">Bio</label>
                      <textarea 
                        value={editBio}
                        onChange={(e) => setEditBio(e.target.value)}
                        className="w-full bg-[#0f172a] border border-slate-700 rounded-2xl px-4 py-3 text-white focus:ring-2 focus:ring-blue-500 outline-none transition-all resize-none h-24"
                        placeholder="Tell us about yourself..."
                      />
                    </div>
                  </div>

                  <div className="bg-slate-800/50 rounded-2xl p-4 border border-slate-700/50">
                    <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2 flex items-center gap-2">
                      <FileText className="w-3 h-3" /> Chat Info
                    </h3>
                    <ul className="text-xs text-slate-500 space-y-1 ml-1">
                      <li>• End-to-end encryption active</li>
                      <li>• Real-time WebRTC voice/video calling</li>
                      <li>• Instant file & media sharing</li>
                      <li>• Version 1.0.4 (Stable)</li>
                    </ul>
                    <button 
                      type="button"
                      onClick={() => {
                        alert("To install ChatZone on your device:\n\n1. Open this page in your browser\n2. Tap the 'Share' or 'Menu' button\n3. Select 'Add to Home Screen' or 'Install App'");
                      }}
                      className="mt-4 w-full bg-slate-700/50 hover:bg-slate-700 text-blue-400 py-2 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 border border-blue-500/20"
                    >
                      <Download className="w-3 h-3" /> Download App (PWA)
                    </button>
                  </div>

                  <button 
                    type="submit"
                    disabled={isUpdatingProfile}
                    className="w-full bg-blue-600 hover:bg-blue-500 disabled:bg-blue-600/50 text-white py-4 rounded-2xl font-bold transition-all shadow-lg shadow-blue-600/20 active:scale-[0.98]"
                  >
                    {isUpdatingProfile ? "Saving..." : "Save Changes"}
                  </button>
                </form>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Call Overlay */}
      <AnimatePresence>
        {(callState.isCalling || callState.isReceiving) && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] bg-slate-900/95 flex flex-col items-center justify-center p-6"
          >
            <div className="relative w-full max-w-2xl aspect-video bg-slate-800 rounded-3xl overflow-hidden shadow-2xl border border-slate-700">
              {/* Remote Video */}
              {callState.type === "video" && (
                <video 
                  ref={remoteVideoRef} 
                  autoPlay 
                  playsInline 
                  className="w-full h-full object-cover"
                />
              )}
              
              {/* Local Video Mini */}
              {callState.type === "video" && (
                <div className="absolute top-4 right-4 w-48 aspect-video bg-slate-900 rounded-xl overflow-hidden border-2 border-slate-700 shadow-lg">
                  <video 
                    ref={myVideoRef} 
                    autoPlay 
                    muted 
                    playsInline 
                    className="w-full h-full object-cover"
                  />
                </div>
              )}

              {/* Call Info Overlay */}
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-gradient-to-t from-slate-900/80 via-transparent to-transparent">
                <div className="w-24 h-24 rounded-full bg-blue-500 flex items-center justify-center mb-4 shadow-xl">
                  <UserIcon className="text-white w-12 h-12" />
                </div>
                <h2 className="text-2xl font-bold text-white mb-1">{callState.caller?.username}</h2>
                <p className="text-slate-400 mb-8">
                  {callState.accepted 
                    ? `In Call - ${Math.floor(callDuration / 60)}:${(callDuration % 60).toString().padStart(2, '0')}`
                    : callState.isReceiving ? "Incoming Call..." : "Calling..."
                  }
                </p>

                <div className="flex items-center gap-6">
                  {callState.isReceiving && !callState.accepted ? (
                    <>
                      <button 
                        onClick={answerCall}
                        className="w-16 h-16 bg-green-500 hover:bg-green-400 text-white rounded-full flex items-center justify-center shadow-lg transition-transform active:scale-90"
                      >
                        <Phone className="w-8 h-8" />
                      </button>
                      <button 
                        onClick={endCall}
                        className="w-16 h-16 bg-red-500 hover:bg-red-400 text-white rounded-full flex items-center justify-center shadow-lg transition-transform active:scale-90"
                      >
                        <PhoneOff className="w-8 h-8" />
                      </button>
                    </>
                  ) : (
                    <>
                      <button 
                        onClick={toggleMute}
                        className={cn(
                          "w-12 h-12 rounded-full flex items-center justify-center transition-colors",
                          isMuted ? "bg-red-500 text-white" : "bg-slate-700 text-slate-300 hover:bg-slate-600"
                        )}
                      >
                        {isMuted ? <MicOff className="w-6 h-6" /> : <Mic className="w-6 h-6" />}
                      </button>
                      <button 
                        onClick={endCall}
                        className="w-16 h-16 bg-red-500 hover:bg-red-400 text-white rounded-full flex items-center justify-center shadow-lg transition-transform active:scale-90"
                      >
                        <PhoneOff className="w-8 h-8" />
                      </button>
                      {callState.type === "video" && (
                        <button 
                          onClick={toggleCamera}
                          className={cn(
                            "w-12 h-12 rounded-full flex items-center justify-center transition-colors",
                            isCameraOff ? "bg-red-500 text-white" : "bg-slate-700 text-slate-300 hover:bg-slate-600"
                          )}
                        >
                          {isCameraOff ? <VideoOff className="w-6 h-6" /> : <Camera className="w-6 h-6" />}
                        </button>
                      )}
                    </>
                  )}
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Add Person Modal */}
      <AnimatePresence>
        {showAddPerson && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[100] flex items-center justify-center p-4"
            onClick={() => setShowAddPerson(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="bg-[#1e293b] w-full max-w-md rounded-[32px] overflow-hidden shadow-2xl border border-slate-700"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="p-8">
                <div className="flex items-center justify-between mb-8">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 bg-blue-600/20 rounded-2xl flex items-center justify-center text-blue-400">
                      <UserPlus className="w-6 h-6" />
                    </div>
                    <div>
                      <h2 className="text-2xl font-bold text-white">Add Person</h2>
                      <p className="text-sm text-slate-400">Invite someone to ChatZone</p>
                    </div>
                  </div>
                  <button 
                    onClick={() => setShowAddPerson(false)}
                    className="p-2 hover:bg-slate-700 rounded-full text-slate-400"
                  >
                    <X className="w-6 h-6" />
                  </button>
                </div>

                <div className="space-y-6">
                  <div className="bg-[#0f172a] p-6 rounded-2xl border border-slate-700">
                    <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-4">Add by Phone Number</p>
                    <div className="flex items-center gap-3">
                      <div className="flex-1 bg-slate-800/50 rounded-xl px-4 py-3 flex items-center gap-3 border border-slate-700 focus-within:border-blue-500 transition-colors">
                        <Phone className="w-5 h-5 text-slate-500" />
                        <input 
                          type="text" 
                          placeholder="+998 90 123 45 67"
                          value={addPhone}
                          onChange={(e) => setAddPhone(e.target.value)}
                          className="bg-transparent border-none outline-none text-sm text-white w-full"
                        />
                      </div>
                      <button 
                        onClick={() => {
                          if (addPhone.trim()) {
                            socket?.emit("add_contact", { phoneNumber: addPhone.trim() });
                          }
                        }}
                        className="bg-blue-600 hover:bg-blue-500 text-white px-6 py-3 rounded-xl font-bold transition-all active:scale-95"
                      >
                        Add
                      </button>
                    </div>
                  </div>

                  <div className="bg-[#0f172a] p-4 rounded-2xl border border-slate-700">
                    <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">Invite Link</p>
                    <div className="flex items-center gap-2">
                      <input 
                        type="text" 
                        readOnly 
                        value={window.location.origin}
                        className="flex-1 bg-transparent border-none outline-none text-sm text-blue-400 font-medium"
                      />
                      <button 
                        onClick={() => {
                          navigator.clipboard.writeText(window.location.origin);
                          alert("Link copied to clipboard!");
                        }}
                        className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold rounded-lg transition-all"
                      >
                        Copy
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Cursors Overlay */}
      <div className="fixed inset-0 pointer-events-none z-[200] overflow-hidden">
        {Object.entries(cursors).map(([id, cursor]: [string, any]) => (
          id !== currentUser?.phoneNumber && (
            <motion.div
              key={id}
              initial={false}
              animate={{ x: `${cursor.x}vw`, y: `${cursor.y}vh` }}
              transition={{ type: "spring", damping: 30, stiffness: 200, mass: 0.5 }}
              className="absolute flex flex-col items-start gap-1"
            >
              <MousePointer2 className="w-5 h-5 text-blue-500 fill-blue-500 drop-shadow-lg" />
              <div className="bg-blue-600 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full shadow-lg whitespace-nowrap">
                {cursor.username}
              </div>
            </motion.div>
          )
        ))}
      </div>

      <style>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 6px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: #334155;
          border-radius: 10px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: #475569;
        }
      `}</style>
    </div>
  );
}

// Helper component for chat list items
const ChatListItem = ({ chat, activeChat, setActiveChat, remoteTyping }: { chat: Chat, activeChat: Chat | null, setActiveChat: (c: Chat) => void, remoteTyping: any, key?: any }) => (
  <button
    onClick={() => setActiveChat(chat)}
    className={cn(
      "w-full p-4 flex items-center gap-4 hover:bg-slate-700/50 transition-all border-l-4",
      activeChat?.id === chat.id ? "bg-slate-700/50 border-blue-500" : "border-transparent"
    )}
  >
    <div className="relative">
      <img src={chat.avatar} alt={chat.name} className="w-12 h-12 rounded-full bg-slate-800" />
      <div className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 border-2 border-[#1e293b] rounded-full"></div>
    </div>
    <div className="flex-1 text-left overflow-hidden">
      <div className="flex justify-between items-center mb-1">
        <div className="flex items-center gap-2">
          {chat.role === "owner" && (
            <span className="text-[8px] font-bold bg-red-500 text-white px-1 rounded uppercase">Owner</span>
          )}
          <h3 className={cn(
            "font-medium truncate",
            chat.role === "owner" ? "text-red-500" : "text-white"
          )}>
            {chat.name}
          </h3>
        </div>
        <span className="text-[10px] text-slate-500">12:45 PM</span>
      </div>
      <p className="text-xs text-slate-400 truncate">
        {remoteTyping[chat.phoneNumber] ? (
          <span className="text-blue-400 italic">typing...</span>
        ) : (
          chat.lastMessage?.text || chat.phoneNumber
        )}
      </p>
    </div>
  </button>
);
