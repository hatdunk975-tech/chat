import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import { createServer as createViteServer } from "vite";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const httpServer = createServer(app);
  const io = new Server(httpServer, {
    cors: {
      origin: "*",
    },
  });

  const PORT = 3000;
  const DB_FILE = path.join(__dirname, "database.json");

  // In-memory "Database" with persistence
  let db = {
    users: new Map<string, any>(), // phoneNumber -> user
    sockets: new Map<string, string>(), // socketId -> phoneNumber
    messages: [] as any[],
  };

  // Load database from file if exists
  if (fs.existsSync(DB_FILE)) {
    try {
      const data = JSON.parse(fs.readFileSync(DB_FILE, "utf-8"));
      db.messages = data.messages || [];
      if (data.users) {
        Object.entries(data.users).forEach(([phone, user]: [string, any]) => {
          db.users.set(phone, { ...user, status: "offline", socketId: null });
        });
      }
    } catch (err) {
      console.error("Error loading database:", err);
    }
  }

  const saveDb = () => {
    try {
      const data = {
        messages: db.messages,
        users: Object.fromEntries(db.users),
      };
      fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2));
    } catch (err) {
      console.error("Error saving database:", err);
    }
  };

  // Pre-populate Admin for convenience
  db.users.set("admin", {
    username: "Abdulloh",
    phoneNumber: "admin",
    password: "abdulloh2013",
    role: "owner",
    status: "offline",
    avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=Abdulloh"
  });

  io.on("connection", (socket) => {
    console.log("User connected:", socket.id);

    socket.on("register", (userData) => {
      const existing = db.users.get(userData.phoneNumber);
      if (existing) {
        socket.emit("error", "Phone number already registered");
        return;
      }
      db.users.set(userData.phoneNumber, { 
        ...userData, 
        status: "offline",
        joinedAt: new Date().toISOString(),
        contacts: [] // Initialize empty contacts list
      });
      saveDb();
      socket.emit("register_success");

      // Notify owner about new user
      const owner = Array.from(db.users.values()).find(u => u.role === "owner");
      if (owner) {
        const systemMessage = {
          id: Date.now().toString(),
          text: `New user registered: ${userData.username} (${userData.phoneNumber})`,
          senderPhone: "system",
          senderName: "System",
          receiverPhone: owner.phoneNumber,
          timestamp: new Date().toISOString(),
          type: "text"
        };
        db.messages.push(systemMessage);
        saveDb();
        if (owner.socketId) {
          io.to(owner.socketId).emit("new_message", systemMessage);
        }
      }
    });

    socket.on("login", (credentials) => {
      const user = db.users.get(credentials.phoneNumber);
      if (!user || user.password !== credentials.password) {
        socket.emit("login_error", "Incorrect phone number or password");
        return;
      }
      
      // Update socket mapping
      db.sockets.set(socket.id, user.phoneNumber);
      user.status = "online";
      user.socketId = socket.id;
      
      const onlineUsersList = Array.from(db.users.values()).map(u => ({
        username: u.username,
        phoneNumber: u.phoneNumber,
        status: u.status,
        role: u.role,
        avatar: u.avatar,
        bio: u.bio,
        birthYear: u.birthYear,
        joinedAt: u.joinedAt,
        contacts: u.contacts || []
      }));
      
      socket.emit("login_success", { ...user, onlineUsers: onlineUsersList });
      
      // Send message history
      const history = db.messages.filter(m => 
        m.senderPhone === user.phoneNumber || m.receiverPhone === user.phoneNumber || m.receiverPhone === "global"
      );
      socket.emit("message_history", history);
      
      // Notify others
      io.emit("user_status_change", Array.from(db.users.values()).map(u => ({
        username: u.username,
        phoneNumber: u.phoneNumber,
        status: u.status,
        role: u.role,
        avatar: u.avatar,
        bio: u.bio,
        birthYear: u.birthYear,
        joinedAt: u.joinedAt,
        contacts: u.contacts || []
      })));
    });

    socket.on("add_contact", (data: { phoneNumber: string }) => {
      const myPhone = db.sockets.get(socket.id);
      if (!myPhone) return;

      const me = db.users.get(myPhone);
      const target = db.users.get(data.phoneNumber);

      if (!target) {
        socket.emit("error", "User not found");
        return;
      }

      if (!me.contacts) me.contacts = [];
      if (!me.contacts.includes(data.phoneNumber)) {
        me.contacts.push(data.phoneNumber);
        saveDb();
        
        // Notify me with updated user list
        socket.emit("user_status_change", Array.from(db.users.values()).map(u => ({
          username: u.username,
          phoneNumber: u.phoneNumber,
          status: u.status,
          role: u.role,
          avatar: u.avatar,
          bio: u.bio,
          birthYear: u.birthYear,
          joinedAt: u.joinedAt,
          contacts: u.contacts || []
        })));
        
        socket.emit("contact_added", { phoneNumber: data.phoneNumber });
      }
    });

    socket.on("send_message", (messageData) => {
      const senderPhone = db.sockets.get(socket.id);
      if (!senderPhone) return;

      const message = {
        ...messageData,
        id: Date.now().toString(),
        timestamp: new Date().toISOString(),
        senderPhone,
      };
      
      db.messages.push(message);
      saveDb();
      
      if (message.receiverPhone === "global") {
        io.emit("new_message", message);
      } else {
        const receiver = Array.from(db.users.values()).find(u => u.phoneNumber === message.receiverPhone);
        if (receiver && receiver.socketId) {
          io.to(receiver.socketId).emit("new_message", message);
        }
        socket.emit("new_message", message); // Echo back to sender
      }
    });

    socket.on("typing", (data) => {
      const receiver = Array.from(db.users.values()).find(u => u.phoneNumber === data.receiverPhone);
      if (receiver && receiver.socketId) {
        socket.to(receiver.socketId).emit("user_typing", {
          phoneNumber: db.sockets.get(socket.id),
          isTyping: data.isTyping,
        });
      }
    });

    // WebRTC Signaling
    socket.on("call_user", (data) => {
      const receiver = Array.from(db.users.values()).find(u => u.phoneNumber === data.userToCall);
      const sender = db.users.get(db.sockets.get(socket.id)!);
      
      if (receiver && receiver.socketId) {
        io.to(receiver.socketId).emit("call_incoming", {
          signal: data.signalData,
          from: sender,
          type: data.type
        });
      }
    });

    socket.on("answer_call", (data) => {
      const caller = Array.from(db.users.values()).find(u => u.phoneNumber === data.to);
      if (caller && caller.socketId) {
        io.to(caller.socketId).emit("call_accepted", data.signal);
      }
    });

    socket.on("end_call", (data) => {
      const other = Array.from(db.users.values()).find(u => u.phoneNumber === data.to);
      if (other && other.socketId) {
        io.to(other.socketId).emit("call_ended");
      }
    });

    socket.on("update_profile", (data) => {
      const phone = db.sockets.get(socket.id);
      if (!phone) return;

      const user = db.users.get(phone);
      if (user) {
        Object.assign(user, data);
        saveDb();
        socket.emit("login_success", user); // Send updated user back
        
        // Notify others of name/avatar changes
        io.emit("user_status_change", Array.from(db.users.values()).map(u => ({
          username: u.username,
          phoneNumber: u.phoneNumber,
          status: u.status,
          role: u.role,
          avatar: u.avatar
        })));
      }
    });

    socket.on("cursor_move", (pos) => {
      const phoneNumber = db.sockets.get(socket.id);
      if (phoneNumber) {
        const user = db.users.get(phoneNumber);
        socket.broadcast.emit("cursor_update", {
          phoneNumber,
          username: user?.username || phoneNumber,
          pos
        });
      }
    });

    socket.on("disconnect", () => {
      const phone = db.sockets.get(socket.id);
      if (phone) {
        const user = db.users.get(phone);
        if (user) {
          user.status = "offline";
          user.socketId = null;
        }
        db.sockets.delete(socket.id);
        io.emit("user_status_change", Array.from(db.users.values()).map(u => ({
          username: u.username,
          phoneNumber: u.phoneNumber,
          status: u.status,
          role: u.role,
          avatar: u.avatar
        })));
      }
      console.log("User disconnected:", socket.id);
    });
  });

  // API Routes
  app.use(express.json());
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  httpServer.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
