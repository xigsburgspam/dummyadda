import express from "express";
import { createServer as createViteServer } from "vite";
import { createServer } from "http";
import { Server, Socket } from "socket.io";
import { v4 as uuidv4 } from "uuid";
import path from "path";
import rateLimit from "express-rate-limit";

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

interface Report {
  id: string;
  screenshot: string;
  ip: string;
  timestamp: string;
}

async function startServer() {
  const app = express();
  const PORT = 3000;
  
  app.set('trust proxy', 1);
  app.use(express.json({ limit: '10mb' }));

  const bannedIPs = new Set<string>();
  const reports: Report[] = [];

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

  app.use((req, res, next) => {
    if (bannedIPs.has(getReqIp(req))) {
      return res.status(403).send("Your IP has been banned.");
    }
    next();
  });

  const limiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 100,
    message: "Too many requests from this IP, please try again later.",
    validate: { xForwardedForHeader: false }
  });
  app.use("/api/", limiter);

  const httpServer = createServer(app);
  const io = new Server(httpServer, {
    cors: { origin: "*", methods: ["GET", "POST"] },
    maxHttpBufferSize: 1e8 // 100MB for screenshots
  });

  io.use((socket, next) => {
    if (bannedIPs.has(getSocketIp(socket))) {
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

    socket.on("report_18plus", (data: { roomId: string, screenshot: string }) => {
      const room = activeRooms.get(data.roomId);
      if (room) {
        const partner = room.users.find(u => u.id !== socket.id);
        if (partner) {
          reports.push({
            id: uuidv4(),
            screenshot: data.screenshot,
            ip: partner.ip,
            timestamp: new Date().toISOString()
          });
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

  // Admin API
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok", activeUsers: waitingUsers.size + activeRooms.size * 2 });
  });

  app.get("/api/admin/stats", (req, res) => {
    res.json({
      activeUsers: waitingUsers.size + activeRooms.size * 2,
      waitingUsers: waitingUsers.size,
      activeRooms: activeRooms.size,
      recentReports: reports.slice(-10).map(r => ({ id: r.id, user: r.ip, reason: "18+ Report", date: r.timestamp }))
    });
  });

  app.post("/api/xigadmin/reports", (req, res) => {
    const { username, password } = req.body;
    if (username === "xigy" && password === "xigymigy") {
      res.json({ reports, bannedIPs: Array.from(bannedIPs) });
    } else {
      res.status(401).json({ error: "Unauthorized" });
    }
  });

  app.post("/api/xigadmin/ban", (req, res) => {
    const { username, password, ip } = req.body;
    if (username === "xigy" && password === "xigymigy") {
      bannedIPs.add(ip);
      res.json({ success: true });
    } else {
      res.status(401).json({ error: "Unauthorized" });
    }
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
