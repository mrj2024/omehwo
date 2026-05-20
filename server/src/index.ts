import "dotenv/config";
import express from "express";
import http from "http";
import cors from "cors";
import { Server, Socket } from "socket.io";
import { supabaseAdmin } from "./supabase";

const CLIENT_URL = process.env.CLIENT_URL || "http://localhost:5173";
const PORT = Number(process.env.PORT) || 3001;

type SearchMode = "chat" | "video";
type Role = "user" | "moderator";

type PublicUser = {
  id: string;
  username: string;
  role: Role;
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

const socketUsers = new Map<string, PublicUser>();
const partners = new Map<string, string>();
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

async function getProfile(
  userId: string
): Promise<(PublicUser & { banned: boolean }) | null> {
  const { data, error } = await supabaseAdmin
    .from("profiles")
    .select("id, username, role, banned")
    .eq("id", userId)
    .single();

  if (error || !data) {
    console.log("GET PROFILE ERROR:", error);
    return null;
  }

  return {
    id: data.id,
    username: data.username,
    role: data.role,
    banned: data.banned,
  };
}

async function getReports(): Promise<Report[]> {
  const { data, error } = await supabaseAdmin
    .from("reports")
    .select(
      `
      id,
      reason,
      snippet,
      status,
      created_at,
      reporter:reporter_id(id, username, role),
      reported:reported_id(id, username, role)
    `
    )
    .order("created_at", { ascending: false });

  if (error || !data) {
    console.log("GET REPORTS ERROR:", error);
    return [];
  }

  return data.map((report: any) => ({
    id: report.id,
    reason: report.reason,
    snippet: report.snippet || [],
    status: report.status,
    createdAt: report.created_at,
    reporter: report.reporter ?? {
      id: "unknown",
      username: "Unknown",
      role: "user",
    },
    reported: report.reported ?? {
      id: "unknown",
      username: "Unknown",
      role: "user",
    },
  }));
}

io.on("connection", (socket: Socket) => {
  console.log("Connected:", socket.id);
  emitOnlineCount();

  socket.on("supabase-login", async (profile: PublicUser) => {
    console.log("SUPABASE LOGIN EVENT:", profile);

    const dbProfile = await getProfile(profile.id);

    console.log("DB PROFILE:", dbProfile);

    if (!dbProfile) {
      pushNotification(socket.id, {
        id: crypto.randomUUID(),
        type: "error",
        message: "Profile not found.",
        createdAt: new Date().toISOString(),
      });
      return;
    }

    if (dbProfile.banned) {
      socket.emit("banned");
      return;
    }

    socketUsers.set(socket.id, {
      id: dbProfile.id,
      username: dbProfile.username,
      role: dbProfile.role,
    });

    console.log("USER STORED IN SOCKET MAP");

    pushNotification(socket.id, {
      id: crypto.randomUUID(),
      type: "success",
      message: `Connected as ${dbProfile.username}`,
      createdAt: new Date().toISOString(),
    });
  });

  socket.on("logout", () => {
    disconnectPair(socket.id);
    socketUsers.delete(socket.id);
  });

  socket.on("find-match", async (mode: SearchMode = "chat") => {
    const user = socketUsers.get(socket.id);

    if (!user) {
      pushNotification(socket.id, {
        id: crypto.randomUUID(),
        type: "error",
        message: "You must be logged in.",
        createdAt: new Date().toISOString(),
      });
      return;
    }

    const profile = await getProfile(user.id);

    if (!profile || profile.banned) {
      socket.emit("banned");
      return;
    }

    const waitingUser = waitingUsers.get(mode);

    if (waitingUser && waitingUser !== socket.id) {
      const partnerId = waitingUser;
      waitingUsers.set(mode, null);

      partners.set(socket.id, partnerId);
      partners.set(partnerId, socket.id);

      chatLogs.set(getChatKey(socket.id, partnerId), []);

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

  socket.on("submit-report", async (reason: string, callback) => {
    const partnerId = partners.get(socket.id);

    if (!partnerId) {
      callback?.({ success: false, error: "No active stranger to report." });
      return;
    }

    const reporter = getPublicUser(socket.id);
    const reported = getPublicUser(partnerId);
    const snippet = chatLogs.get(getChatKey(socket.id, partnerId))?.slice(-10) || [];

    const { error } = await supabaseAdmin.from("reports").insert({
      reporter_id: reporter.id,
      reported_id: reported.id,
      reason: String(reason || "No reason provided").trim(),
      snippet,
      status: "open",
    });

    if (error) {
      callback?.({ success: false, error: "Could not save report." });
      return;
    }

    const reports = await getReports();

    io.emit("reports-updated", reports);
    notifyMods(`New report against ${reported.username}`);

    callback?.({ success: true });
  });

  socket.on("get-reports", async (callback) => {
    const user = socketUsers.get(socket.id);

    if (user?.role !== "moderator") {
      callback({ success: false, error: "Moderator only." });
      return;
    }

    callback({ success: true, reports: await getReports() });
  });

  socket.on("mark-report-reviewed", async (reportId: string, callback) => {
    const user = socketUsers.get(socket.id);

    if (user?.role !== "moderator") {
      callback({ success: false, error: "Moderator only." });
      return;
    }

    const { error } = await supabaseAdmin
      .from("reports")
      .update({ status: "reviewed" })
      .eq("id", reportId);

    if (error) {
      callback({ success: false, error: "Could not update report." });
      return;
    }

    io.emit("reports-updated", await getReports());
    callback({ success: true });
  });

  socket.on("clear-reports", async (callback) => {
    const user = socketUsers.get(socket.id);

    if (user?.role !== "moderator") {
      callback({ success: false, error: "Moderator only." });
      return;
    }

    const { error } = await supabaseAdmin
      .from("reports")
      .delete()
      .neq("id", "00000000-0000-0000-0000-000000000000");

    if (error) {
      callback({ success: false, error: "Could not clear reports." });
      return;
    }

    io.emit("reports-updated", []);
    callback({ success: true });
  });

  socket.on(
    "moderation-action",
    async (
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

      const targetProfile = await getProfile(data.targetUserId);

      if (!targetProfile) {
        callback({ success: false, error: "User not found." });
        return;
      }

      if (targetProfile.role === "moderator") {
        callback({
          success: false,
          error: "You cannot action another moderator.",
        });
        return;
      }

      if (data.action === "ban") {
        const { error } = await supabaseAdmin
          .from("profiles")
          .update({ banned: true })
          .eq("id", data.targetUserId);

        if (error) {
          callback({ success: false, error: "Could not ban user." });
          return;
        }
      }

      await supabaseAdmin.from("moderation_actions").insert({
        moderator_id: moderator.id,
        target_id: data.targetUserId,
        action: data.action,
        reason: data.reason,
      });

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
          targetProfile.username
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