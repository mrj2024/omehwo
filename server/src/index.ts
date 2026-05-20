import express from "express";
import http from "http";
import cors from "cors";
import { Server, Socket } from "socket.io";

const CLIENT_URL = process.env.CLIENT_URL || "http://localhost:5173";
const PORT = Number(process.env.PORT) || 3001;

type SearchMode = "chat" | "video";
type Role = "user" | "moderator";

type PublicUser = {
  id: string;
  username: string;
  role: Role;
};

type Account = PublicUser & {
  password: string;
  banned: boolean;
};

type ChatMessage = {
  from: PublicUser;
  text: string;
  createdAt: string;
};

type Report = {
  id: string;
  reporter: PublicUser;
  reported: PublicUser;
  reason: string;
  snippet: ChatMessage[];
  status: "open" | "reviewed";
  createdAt: string;
};

type Notification = {
  id: string;
  type: "info" | "warning" | "success" | "error";
  message: string;
  createdAt: string;
};

const accounts: Account[] = [
  { id: "1", username: "mod", password: "mod123", role: "moderator", banned: false },
  { id: "2", username: "user", password: "user123", role: "user", banned: false },
];

const socketUsers = new Map<string, PublicUser>();
const partners = new Map<string, string>();
const reports: Report[] = [];
const chatLogs = new Map<string, ChatMessage[]>();

const waitingUsers = new Map<SearchMode, string | null>([
  ["chat", null],
  ["video", null],
]);

const app = express();
app.use(cors({ origin: CLIENT_URL }));

const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: CLIENT_URL,
    methods: ["GET", "POST"],
  },
});

function emitOnlineCount() {
  io.emit("online-count", io.engine.clientsCount);
}

function getPublicUser(socketId: string): PublicUser {
  return (
    socketUsers.get(socketId) ?? {
      id: socketId,
      username: "Anonymous",
      role: "user",
    }
  );
}

function getChatKey(a: string, b: string) {
  return [a, b].sort().join(":");
}

function pushNotification(socketId: string, notification: Notification) {
  io.to(socketId).emit("notification", notification);
}

function notifyMods(message: string) {
  for (const [socketId, user] of socketUsers.entries()) {
    if (user.role === "moderator") {
      pushNotification(socketId, {
        id: crypto.randomUUID(),
        type: "warning",
        message,
        createdAt: new Date().toISOString(),
      });
    }
  }
}

function disconnectPair(socketId: string) {
  const partnerId = partners.get(socketId);

  if (partnerId) {
    partners.delete(socketId);
    partners.delete(partnerId);

    io.to(partnerId).emit("partner-left");
  }

  for (const [mode, waitingUser] of waitingUsers.entries()) {
    if (waitingUser === socketId) {
      waitingUsers.set(mode, null);
    }
  }
}

io.on("connection", (socket: Socket) => {
  console.log("Connected:", socket.id);
  emitOnlineCount();

  socket.on("login", (data, callback) => {
    const username = String(data.username || "").trim();
    const password = String(data.password || "").trim();

    const account = accounts.find(
      (acc) =>
        acc.username.toLowerCase() === username.toLowerCase() &&
        acc.password === password
    );

    if (!account) {
      callback({ success: false, error: "Invalid username or password." });
      return;
    }

    if (account.banned) {
      callback({ success: false, error: "This account is banned." });
      return;
    }

    const user: PublicUser = {
      id: account.id,
      username: account.username,
      role: account.role,
    };

    socketUsers.set(socket.id, user);
    callback({ success: true, user });
  });

  socket.on("register", (data, callback) => {
    const username = String(data.username || "").trim();
    const password = String(data.password || "").trim();

    if (username.length < 3 || password.length < 4) {
      callback({
        success: false,
        error: "Username must be 3+ characters and password 4+ characters.",
      });
      return;
    }

    const exists = accounts.some(
      (acc) => acc.username.toLowerCase() === username.toLowerCase()
    );

    if (exists) {
      callback({ success: false, error: "Username already exists." });
      return;
    }

    const account: Account = {
      id: crypto.randomUUID(),
      username,
      password,
      role: "user",
      banned: false,
    };

    accounts.push(account);

    const user: PublicUser = {
      id: account.id,
      username: account.username,
      role: account.role,
    };

    socketUsers.set(socket.id, user);
    callback({ success: true, user });
  });

  socket.on("logout", () => {
    disconnectPair(socket.id);
    socketUsers.delete(socket.id);
  });

  socket.on("find-match", (mode: SearchMode = "chat") => {
    const user = socketUsers.get(socket.id);

    if (!user) {
      socket.emit("notification", {
        id: crypto.randomUUID(),
        type: "error",
        message: "You must be logged in.",
        createdAt: new Date().toISOString(),
      });
      return;
    }

    const account = accounts.find((acc) => acc.id === user.id);

    if (account?.banned) {
      socket.emit("banned");
      return;
    }

    const waitingUser = waitingUsers.get(mode);

    if (waitingUser && waitingUser !== socket.id) {
      const partnerId = waitingUser;
      waitingUsers.set(mode, null);

      partners.set(socket.id, partnerId);
      partners.set(partnerId, socket.id);

      const key = getChatKey(socket.id, partnerId);
      chatLogs.set(key, []);

      socket.emit("match-found", {
        mode,
        stranger: getPublicUser(partnerId),
      });

      io.to(partnerId).emit("match-found", {
        mode,
        stranger: getPublicUser(socket.id),
      });

      return;
    }

    waitingUsers.set(mode, socket.id);
    socket.emit("waiting", { mode });
  });

  socket.on("send-message", (message: string) => {
    const partnerId = partners.get(socket.id);
    if (!partnerId) return;

    const text = String(message || "").trim();
    if (!text) return;

    const user = getPublicUser(socket.id);

    const chatMessage: ChatMessage = {
      from: user,
      text,
      createdAt: new Date().toISOString(),
    };

    const key = getChatKey(socket.id, partnerId);
    const existing = chatLogs.get(key) || [];
    existing.push(chatMessage);
    chatLogs.set(key, existing.slice(-20));

    io.to(partnerId).emit("receive-message", {
      text,
      user,
    });
  });

  socket.on("typing", () => {
    const partnerId = partners.get(socket.id);
    if (!partnerId) return;

    io.to(partnerId).emit("stranger-typing");
  });

  socket.on("submit-report", (reason: string, callback) => {
    const partnerId = partners.get(socket.id);

    if (!partnerId) {
      callback?.({ success: false, error: "No active stranger to report." });
      return;
    }

    const key = getChatKey(socket.id, partnerId);
    const snippet = chatLogs.get(key)?.slice(-10) || [];

    const report: Report = {
      id: crypto.randomUUID(),
      reporter: getPublicUser(socket.id),
      reported: getPublicUser(partnerId),
      reason: String(reason || "No reason provided").trim(),
      snippet,
      status: "open",
      createdAt: new Date().toISOString(),
    };

    reports.unshift(report);

    io.emit("reports-updated", reports);
    notifyMods(`New report against ${report.reported.username}`);

    callback?.({ success: true });
  });

  socket.on("get-reports", (callback) => {
    const user = socketUsers.get(socket.id);

    if (user?.role !== "moderator") {
      callback({ success: false, error: "Moderator only." });
      return;
    }

    callback({ success: true, reports });
  });

  socket.on("mark-report-reviewed", (reportId: string, callback) => {
    const user = socketUsers.get(socket.id);

    if (user?.role !== "moderator") {
      callback({ success: false, error: "Moderator only." });
      return;
    }

    const report = reports.find((item) => item.id === reportId);

    if (report) {
      report.status = "reviewed";
    }

    io.emit("reports-updated", reports);
    callback({ success: true });
  });

  socket.on("clear-reports", (callback) => {
    const user = socketUsers.get(socket.id);

    if (user?.role !== "moderator") {
      callback({ success: false, error: "Moderator only." });
      return;
    }

    reports.length = 0;
    io.emit("reports-updated", reports);
    callback({ success: true });
  });

  socket.on(
    "moderation-action",
    (
      data: {
        targetUserId: string;
        action: "warn" | "ban";
        reason: string;
      },
      callback
    ) => {
      const moderator = socketUsers.get(socket.id);

      if (moderator?.role !== "moderator") {
        callback({ success: false, error: "Moderator only." });
        return;
      }

      const targetAccount = accounts.find((acc) => acc.id === data.targetUserId);

      if (!targetAccount) {
        callback({ success: false, error: "User not found." });
        return;
      }

      if (targetAccount.role === "moderator") {
        callback({ success: false, error: "You cannot action another moderator." });
        return;
      }

      if (data.action === "ban") {
        targetAccount.banned = true;
      }

      for (const [targetSocketId, user] of socketUsers.entries()) {
        if (user.id === data.targetUserId) {
          pushNotification(targetSocketId, {
            id: crypto.randomUUID(),
            type: data.action === "ban" ? "error" : "warning",
            message:
              data.action === "ban"
                ? `You have been banned: ${data.reason}`
                : `Moderator warning: ${data.reason}`,
            createdAt: new Date().toISOString(),
          });

          if (data.action === "ban") {
            disconnectPair(targetSocketId);
            io.to(targetSocketId).emit("banned");
          }
        }
      }

      notifyMods(
        `${moderator.username} ${data.action === "ban" ? "banned" : "warned"} ${
          targetAccount.username
        }`
      );

      callback({ success: true });
    }
  );

  socket.on("next", () => {
    disconnectPair(socket.id);
  });

  socket.on("disconnect", () => {
    disconnectPair(socket.id);
    socketUsers.delete(socket.id);
    emitOnlineCount();
  });
});

app.get("/", (_req, res) => {
  res.send("Server running");
});

server.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});