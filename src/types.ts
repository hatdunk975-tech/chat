export interface User {
  id: string;
  username: string;
  phoneNumber: string;
  avatar?: string;
  status: "online" | "offline";
  bio?: string;
  birthYear?: number;
  role?: "owner" | "user";
  joinedAt?: string;
  contacts?: string[];
}

export interface Message {
  id: string;
  text: string;
  senderPhone: string;
  receiverPhone?: string;
  roomId?: string;
  timestamp: string;
  type: "text" | "image" | "file" | "video";
  fileUrl?: string;
  fileName?: string;
}

export interface Chat {
  id: string;
  name: string;
  phoneNumber: string;
  type: "private" | "group";
  lastMessage?: Message;
  unreadCount: number;
  avatar?: string;
  role?: "owner" | "user";
  isContact?: boolean;
}

export interface CallState {
  isCalling: boolean;
  isReceiving: boolean;
  caller: User | null;
  signal: any;
  type: "voice" | "video";
  accepted: boolean;
}
