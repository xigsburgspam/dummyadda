import express from "express";
import { createServer as createViteServer } from "vite";
import { createServer } from "http";
import { Server, Socket } from "socket.io";
import { v4 as uuidv4 } from "uuid";
import path from "path";
import rateLimit from "express-rate-limit";
import mongoose from "mongoose";

// --- MongoDB Setup ---
const reportSchema = new mongoose.Schema({
  screenshot: String,
  reportedIp: String,
  reporterId: String,
  timestamp: { type: Date, default: Date.now }
});

const bannedIpSchema = new mongoose.Schema({
  ip: String,
  reason: String,
  timestamp: { type: Date, default: Date.now }
});

const Report = mongoose.model('Report', reportSchema);
const BannedIP = mongoose.model('BannedIP', bannedIpSchema);

let useMongo = false;
async function connectDB() {
  if (process.env.MONGODB_URI) {
    try {
      await mongoose.connect(process.env.MONGODB_URI);
      console.log('Connected to MongoDB');
      useMongo = true;
    } catch (err) {
      console.error('MongoDB connection error:', err);
    }
  } else {
    console.warn('No MONGODB_URI provided. Using in-memory fallback for preview.');
  }
}

// --- Types ---
interface User {
  id: string;
  socket: Socket;
  mode: "text" | "video";
  interests: string[];
  ip: string;
}

interface Room {
  id: string;
  users: [User, User];
}

async function startServer() {
  await connectDB();

  const app = express();
  const PORT = 3000;
  
  app.set('trust proxy', 1);
  app.use(express.json({ limit: '10mb' }));

  // In-memory fallbacks
  const memoryBannedIPs = new Set<string>();
  const memoryReports: any[] = [];

  const getReqIp = (req: express.Request) => {
    const forwarded = req.headers['x-forwarded-for'];
    if (forwarded) return typeof forwarded === 'string' ? forwarded.split(',')[0] : forwarded[0];
    return req.ip || req.socket?.remoteAddress || 'unknown';
  };

  const getSocketIp = (socket: Socket) => {
    const forwarded = socket.handshake.headers['x-forwarded-for'];
    if (forwarded) return typeof forwarded === 'string' ? forwarded.split(',')[0] : forwarded[0];
    return socket.handshake.address || 'unknown';
  };

  const isIpBanned = async (ip: string) => {
    if (useMongo) {
      const ban = await BannedIP.findOne({ ip });
      return !!ban;
    }
    return memoryBannedIPs.has(ip);
  };

  app.use(async (req, res, next) => {
    if (await isIpBanned(getReqIp(req))) {
      return res.status(403).send("Your IP has been banned.");
    }
    next();
  });

  const httpServer = createServer(app);
  const io = new Server(httpServer, {
    cors: { origin: "*", methods: ["GET", "POST"] },
    maxHttpBufferSize: 1e8 // 100MB for screenshots
  });

  io.use(async (socket, next) => {
    if (await isIpBanned(getSocketIp(socket))) {
      return next(new Error("Banned"));
    }
    next();
  });

  const waitingUsers = new Map<string, User>();
  const activeRooms = new Map<string, Room>();
  const userToRoom = new Map<string, string>();

  io.on("connection", (socket) => {
    const userIp = getSocketIp(socket);
    console.log(`User connected: ${socket.id} (IP: ${userIp})`);

    socket.on("find_match", (data: { mode: "text" | "video"; interests: string[] }) => {
      cleanupUser(socket.id);
      const { mode, interests } = data;
      const user: User = { id: socket.id, socket, mode, interests: interests || [], ip: userIp };

      let matchedUser: User | null = null;
      for (const [waitingId, waitingUser] of waitingUsers.entries()) {
        if (waitingUser.mode === mode) {
          if (user.interests.length > 0 && waitingUser.interests.length > 0) {
            if (user.interests.some((i) => waitingUser.interests.includes(i))) {
              matchedUser = waitingUser;
              break;
            }
          } else {
            matchedUser = waitingUser;
            break;
          }
        }
      }

      if (matchedUser) {
        waitingUsers.delete(matchedUser.id);
        const roomId = uuidv4();
        const room: Room = { id: roomId, users: [matchedUser, user] };
        activeRooms.set(roomId, room);
        userToRoom.set(matchedUser.id, roomId);
        userToRoom.set(user.id, roomId);

        matchedUser.socket.join(roomId);
        user.socket.join(roomId);

        matchedUser.socket.emit("match_found", { roomId, partnerId: user.id, initiator: true });
        user.socket.emit("match_found", { roomId, partnerId: matchedUser.id, initiator: false });
      } else {
        waitingUsers.set(user.id, user);
        socket.emit("waiting");
      }
    });

    socket.on("offer", (data) => socket.to(data.roomId).emit("offer", data.offer));
    socket.on("answer", (data) => socket.to(data.roomId).emit("answer", data.answer));
    socket.on("ice_candidate", (data) => socket.to(data.roomId).emit("ice_candidate", data.candidate));
    socket.on("webrtc_ready", (data) => socket.to(data.roomId).emit("webrtc_ready"));
    socket.on("send_message", (data) => {
      socket.to(data.roomId).emit("receive_message", {
        message: data.message,
        senderId: socket.id,
        timestamp: new Date().toISOString(),
      });
    });
    socket.on("typing", (data) => socket.to(data.roomId).emit("partner_typing", data.isTyping));
    
    socket.on("skip", () => {
      cleanupUser(socket.id);
      socket.emit("skipped");
    });

    socket.on("report_18plus", async (data: { roomId: string, screenshot: string }) => {
      const room = activeRooms.get(data.roomId);
      if (room) {
        const partner = room.users.find(u => u.id !== socket.id);
        if (partner) {
          const reportData = {
            screenshot: data.screenshot,
            reportedIp: partner.ip,
            reporterId: socket.id,
            timestamp: new Date()
          };
          
          if (useMongo) {
            await new Report(reportData).save();
          } else {
            memoryReports.push({ _id: uuidv4(), ...reportData });
          }
          
          console.log(`User ${socket.id} reported partner ${partner.id} (IP: ${partner.ip}) for 18+`);
          
          // Disconnect partner
          partner.socket.emit("banned_warning");
          partner.socket.disconnect(true);
        }
      }
      cleanupUser(socket.id);
      socket.emit("skipped");
    });

    socket.on("disconnect", () => cleanupUser(socket.id));

    function cleanupUser(socketId: string) {
      waitingUsers.delete(socketId);
      const roomId = userToRoom.get(socketId);
      if (roomId) {
        const room = activeRooms.get(roomId);
        if (room) {
          const partner = room.users.find((u) => u.id !== socketId);
          if (partner) {
            partner.socket.emit("partner_left");
            partner.socket.leave(roomId);
            userToRoom.delete(partner.id);
          }
          activeRooms.delete(roomId);
        }
        userToRoom.delete(socketId);
      }
    }
  });

  // --- Admin API ---
  const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin123';

  const authMiddleware = (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.split(' ')[1] === ADMIN_PASSWORD) {
      next();
    } else {
      res.status(401).json({ error: "Unauthorized" });
    }
  };

  app.post("/api/admin/login", (req, res) => {
    const { password } = req.body;
    if (password === ADMIN_PASSWORD) {
      res.json({ success: true });
    } else {
      res.status(401).json({ error: "Unauthorized" });
    }
  });

  app.get("/api/admin/data", authMiddleware, async (req, res) => {
    const reports = useMongo ? await Report.find().sort({ timestamp: -1 }).limit(50) : memoryReports.slice(-50).reverse();
    const bannedIPs = useMongo ? await BannedIP.find().sort({ timestamp: -1 }) : Array.from(memoryBannedIPs).map(ip => ({ _id: ip, ip, reason: 'Manual Ban', timestamp: new Date() }));
    
    res.json({
      stats: {
        activeUsers: waitingUsers.size + activeRooms.size * 2,
        waitingUsers: waitingUsers.size,
        activeRooms: activeRooms.size,
        totalReports: useMongo ? await Report.countDocuments() : memoryReports.length
      },
      reports,
      bannedIPs
    });
  });

  app.post("/api/admin/ban", authMiddleware, async (req, res) => {
    const { ip, reason } = req.body;
    if (useMongo) {
      await new BannedIP({ ip, reason }).save();
    } else {
      memoryBannedIPs.add(ip);
    }
    
    // Disconnect any active users with this IP
    for (const [id, user] of waitingUsers.entries()) {
      if (user.ip === ip) user.socket.disconnect(true);
    }
    for (const [id, room] of activeRooms.entries()) {
      room.users.forEach(u => {
        if (u.ip === ip) u.socket.disconnect(true);
      });
    }
    
    res.json({ success: true });
  });

  app.delete("/api/admin/reports/:id", authMiddleware, async (req, res) => {
    if (useMongo) {
      await Report.findByIdAndDelete(req.params.id);
    } else {
      const idx = memoryReports.findIndex(r => r._id === req.params.id);
      if (idx > -1) memoryReports.splice(idx, 1);
    }
    res.json({ success: true });
  });

  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({ server: { middlewareMode: true }, appType: "spa" });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => res.sendFile(path.join(distPath, "index.html")));
  }

  httpServer.listen(PORT, "0.0.0.0", () => console.log(`Server running on http://localhost:${PORT}`));
}

startServer().catch(console.error);
