import { useEffect, useRef, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { io, Socket } from "socket.io-client";
import { supabase } from "./lib/supabase";
import {
  MessageCircle,
  Video,
  Send,
  Shuffle,
  User,
  X,
  Search,
  Users,
  Keyboard,
  ShieldCheck,
  LogIn,
  UserPlus,
  Flag,
  AlertTriangle,
  Trash2,
  Bell,
  Eye,
  CheckCircle,
  Ban,
  Megaphone,
} from "lucide-react";

const socket: Socket = io(import.meta.env.VITE_SOCKET_URL);

type SearchMode = "chat" | "video";
type Status = "idle" | "waiting" | "matched";
type Role = "user" | "moderator";

type PublicUser = {
  id: string;
  username: string;
  role: Role;
};

type Message = {
  from: "me" | "stranger" | "system";
  text: string;
  user?: PublicUser;
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

export default function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [currentUser, setCurrentUser] = useState<PublicUser | null>(null);
  const [authMode, setAuthMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [status, setStatus] = useState<Status>("idle");
  const [mode, setMode] = useState<SearchMode>("chat");
  const [matchedMode, setMatchedMode] = useState<SearchMode | null>(null);
  const [stranger, setStranger] = useState<PublicUser | null>(null);

  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [onlineCount, setOnlineCount] = useState(0);
  const [strangerTyping, setStrangerTyping] = useState(false);

  const [reportReason, setReportReason] = useState("");
  const [reportStatus, setReportStatus] = useState("");

  const [showModPanel, setShowModPanel] = useState(false);
  const [reports, setReports] = useState<Report[]>([]);
  const [expandedReportId, setExpandedReportId] = useState<string | null>(null);
  const [notifications, setNotifications] = useState<Notification[]>([]);

  const bottomRef = useRef<HTMLDivElement | null>(null);
  const typingTimeoutRef = useRef<number | null>(null);

  useEffect(() => {
    async function initAuth() {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      setSession(session);

      if (session?.user) {
        await loadProfile(session.user.id);
      }
    }

    initAuth();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event, newSession) => {
      setSession(newSession);

      if (newSession?.user) {
        await loadProfile(newSession.user.id);
      } else {
        setCurrentUser(null);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    socket.on("online-count", (count: number) => setOnlineCount(count));

    socket.on("notification", (notification: Notification) => {
      setNotifications((prev) => [notification, ...prev.slice(0, 4)]);
    });

    socket.on("banned", () => {
      setStatus("idle");
      setMatchedMode(null);
      setStranger(null);
      setMessages([{ from: "system", text: "You were banned by a moderator." }]);
    });

    socket.on("waiting", ({ mode }: { mode: SearchMode }) => {
      setStatus("waiting");
      setMatchedMode(mode);
      setStranger(null);
    });

    socket.on(
      "match-found",
      ({ mode, stranger }: { mode: SearchMode; stranger: PublicUser }) => {
        setStatus("matched");
        setMatchedMode(mode);
        setStranger(stranger);
        setReportStatus("");
        setReportReason("");
        setMessages([
          {
            from: "system",
            text: `You're now chatting with ${stranger.username}.`,
          },
        ]);
      }
    );

    socket.on("receive-message", (payload: { text: string; user: PublicUser }) => {
      setStrangerTyping(false);
      setMessages((prev) => [
        ...prev,
        { from: "stranger", text: payload.text, user: payload.user },
      ]);
    });

    socket.on("stranger-typing", () => {
      setStrangerTyping(true);

      if (typingTimeoutRef.current) {
        window.clearTimeout(typingTimeoutRef.current);
      }

      typingTimeoutRef.current = window.setTimeout(() => {
        setStrangerTyping(false);
      }, 1200);
    });

    socket.on("partner-left", () => {
      setStatus("idle");
      setMatchedMode(null);
      setStranger(null);
      setStrangerTyping(false);
      setMessages((prev) => [
        ...prev,
        { from: "system", text: "Stranger disconnected." },
      ]);
    });

    socket.on("reports-updated", (updatedReports: Report[]) => {
      setReports(updatedReports);
    });

    return () => {
      socket.off("online-count");
      socket.off("notification");
      socket.off("banned");
      socket.off("waiting");
      socket.off("match-found");
      socket.off("receive-message");
      socket.off("stranger-typing");
      socket.off("partner-left");
      socket.off("reports-updated");

      if (typingTimeoutRef.current) {
        window.clearTimeout(typingTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView();
  }, [messages, strangerTyping]);

  async function loadProfile(userId: string) {
  console.log("LOADING PROFILE:", userId);

  const { data, error } = await supabase
    .from("profiles")
    .select("id, username, role, banned")
    .eq("id", userId)
    .single();

  console.log("PROFILE DATA:", data);
  console.log("PROFILE ERROR:", error);

  if (error || !data) {
    addLocalNotification(
      "error",
      error?.message || "Could not load profile."
    );

    return;
  }

  if (data.banned) {
    await supabase.auth.signOut();

    addLocalNotification(
      "error",
      "This account is banned."
    );

    return;
  }

  const profile: PublicUser = {
    id: data.id,
    username: data.username,
    role: data.role,
  };

  console.log("SETTING USER:", profile);

  setCurrentUser(profile);

  console.log("EMITTING SOCKET LOGIN");

  socket.emit("supabase-login", profile);

  if (profile.role === "moderator") {
    loadReports();
  }
}

  async function handleAuth() {
    if (authMode === "register") {
      const { error } = await supabase.auth.signUp({
        email,
        password,
      });

      if (error) {
        addLocalNotification("error", error.message);
        return;
      }

      addLocalNotification("success", "Account created. You can now log in.");
      setAuthMode("login");
      return;
    }

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      addLocalNotification("error", error.message);
    }
  }

  async function logout() {
    socket.emit("logout");
    await supabase.auth.signOut();

    setCurrentUser(null);
    setSession(null);
    setStatus("idle");
    setMessages([]);
    setStranger(null);
    setShowModPanel(false);
    setReports([]);
  }

  function addLocalNotification(type: Notification["type"], message: string) {
    setNotifications((prev) => [
      {
        id: crypto.randomUUID(),
        type,
        message,
        createdAt: new Date().toISOString(),
      },
      ...prev.slice(0, 4),
    ]);
  }

  function removeNotification(id: string) {
    setNotifications((prev) => prev.filter((item) => item.id !== id));
  }

  function startSearch(selectedMode: SearchMode) {
    setMode(selectedMode);
    setMatchedMode(selectedMode);
    setMessages([]);
    setStranger(null);
    setStrangerTyping(false);
    setReportStatus("");
    setReportReason("");

    socket.emit("find-match", selectedMode);
  }

  function stopChat() {
    socket.emit("next");
    setStatus("idle");
    setMatchedMode(null);
    setMessages([]);
    setStranger(null);
    setStrangerTyping(false);
  }

  function sendMessage(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();

    const trimmed = input.trim();
    if (!trimmed || status !== "matched") return;

    socket.emit("send-message", trimmed);

    setMessages((prev) => [
      ...prev,
      {
        from: "me",
        text: trimmed,
        user: currentUser || undefined,
      },
    ]);

    setInput("");
  }

  function handleInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    setInput(e.target.value);

    if (status === "matched") {
      socket.emit("typing");
    }
  }

  function submitReport() {
    const reason = reportReason.trim();

    if (!reason) {
      setReportStatus("Please enter a report reason.");
      return;
    }

    socket.emit(
      "submit-report",
      reason,
      (response: { success: boolean; error?: string }) => {
        if (!response.success) {
          setReportStatus(response.error || "Could not submit report.");
          return;
        }

        setReportReason("");
        setReportStatus("Report submitted.");
        addLocalNotification("success", "Report submitted to moderators.");
      }
    );
  }

  function loadReports() {
    socket.emit(
      "get-reports",
      (response: { success: boolean; reports?: Report[] }) => {
        if (response.success && response.reports) {
          setReports(response.reports);
        }
      }
    );
  }

  function clearReports() {
    socket.emit("clear-reports", (response: { success: boolean }) => {
      if (response.success) {
        setReports([]);
        addLocalNotification("success", "Reports cleared.");
      }
    });
  }

  function markReviewed(reportId: string) {
    socket.emit("mark-report-reviewed", reportId, (response: { success: boolean }) => {
      if (response.success) {
        addLocalNotification("success", "Report marked reviewed.");
      }
    });
  }

  function moderateUser(targetUserId: string, action: "warn" | "ban", reason: string) {
    socket.emit(
      "moderation-action",
      { targetUserId, action, reason },
      (response: { success: boolean; error?: string }) => {
        if (!response.success) {
          addLocalNotification("error", response.error || "Action failed.");
          return;
        }

        addLocalNotification(
          "success",
          action === "ban" ? "User banned." : "User warned."
        );
      }
    );
  }

  const unreadReports = reports.filter((report) => report.status === "open").length;

  if (!session || !currentUser) {
    return (
      <main className="min-h-screen bg-[#f3f3f3] text-black">
        <NotificationStack notifications={notifications} onClose={removeNotification} />

        <div className="mx-auto flex min-h-screen max-w-md items-center justify-center px-4">
          <section className="w-full rounded border border-gray-300 bg-white p-6 shadow-sm">
            <h1 className="text-4xl font-bold">
              Ome<span className="text-orange-500">Clone</span>
            </h1>

            <p className="mt-1 text-sm text-gray-600">
              Sign in with Supabase Auth.
            </p>

            <div className="mt-6 flex gap-2">
              <button
                onClick={() => setAuthMode("login")}
                className={`flex-1 rounded px-4 py-2 font-bold ${
                  authMode === "login"
                    ? "bg-blue-600 text-white"
                    : "border border-gray-300 bg-white"
                }`}
              >
                <div className="flex items-center justify-center gap-2">
                  <LogIn size={18} />
                  Login
                </div>
              </button>

              <button
                onClick={() => setAuthMode("register")}
                className={`flex-1 rounded px-4 py-2 font-bold ${
                  authMode === "register"
                    ? "bg-orange-500 text-white"
                    : "border border-gray-300 bg-white"
                }`}
              >
                <div className="flex items-center justify-center gap-2">
                  <UserPlus size={18} />
                  Register
                </div>
              </button>
            </div>

            <div className="mt-5 space-y-3">
<input
  name="email"
  id="email"
  type="email"
  autoComplete="email"
  value={email}
  onChange={(e) => setEmail(e.target.value)}
  placeholder="Email"
  className="w-full border border-gray-400 px-3 py-2 outline-none focus:border-blue-500"
/>

<input
  name="password"
  id="password"
  type="password"
  autoComplete="current-password"
  value={password}
  onChange={(e) => setPassword(e.target.value)}
  placeholder="Password"
  className="w-full border border-gray-400 px-3 py-2 outline-none focus:border-blue-500"
/>

              <button
                onClick={handleAuth}
                className="w-full rounded bg-blue-600 py-2 font-bold text-white hover:bg-blue-700"
              >
                {authMode === "login" ? "Login" : "Create Account"}
              </button>
            </div>
          </section>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#f3f3f3] text-black">
      <NotificationStack notifications={notifications} onClose={removeNotification} />

      <div className="mx-auto max-w-5xl px-4 py-4">
        <header className="mb-4 border-b border-gray-300 pb-3">
          <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
            <div>
              <h1 className="text-5xl font-bold tracking-tight">
                Ome<span className="text-orange-500">Clone</span>
              </h1>

              <p className="mt-1 flex items-center gap-2 text-sm text-gray-600">
                <Users size={16} />
                {onlineCount} online now
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {currentUser.role === "moderator" && (
                <button
                  onClick={() => {
                    setShowModPanel((prev) => !prev);
                    loadReports();
                  }}
                  className="relative flex items-center gap-2 rounded bg-blue-600 px-3 py-2 text-sm font-bold text-white hover:bg-blue-700"
                >
                  <ShieldCheck size={17} />
                  Mod Panel
                  {unreadReports > 0 && (
                    <span className="absolute -right-2 -top-2 rounded-full bg-red-600 px-2 py-0.5 text-xs">
                      {unreadReports}
                    </span>
                  )}
                </button>
              )}

              <div className="flex items-center gap-3 rounded border border-gray-300 bg-white px-3 py-2 shadow-sm">
                <User size={18} className="text-gray-500" />
                <span className="font-bold">{currentUser.username}</span>

                {currentUser.role === "moderator" && (
                  <ShieldCheck size={18} className="text-blue-600" />
                )}

                <button
                  onClick={logout}
                  className="rounded border border-gray-300 bg-gray-100 px-3 py-1 text-sm hover:bg-gray-200"
                >
                  Logout
                </button>
              </div>
            </div>
          </div>
        </header>

        {showModPanel && currentUser.role === "moderator" && (
          <section className="mb-4 rounded border border-blue-300 bg-white p-4 shadow-sm">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="flex items-center gap-2 text-xl font-bold text-blue-700">
                <ShieldCheck size={22} />
                Moderator Panel
              </h2>

              <button
                onClick={clearReports}
                className="flex items-center gap-2 rounded border border-gray-400 bg-gray-100 px-3 py-2 text-sm hover:bg-gray-200"
              >
                <Trash2 size={16} />
                Clear Reports
              </button>
            </div>

            {reports.length === 0 ? (
              <p className="text-sm text-gray-600">No reports yet.</p>
            ) : (
              <div className="space-y-2">
                {reports.map((report) => {
                  const expanded = expandedReportId === report.id;

                  return (
                    <div key={report.id} className="rounded border border-gray-300 bg-gray-50 p-3 text-sm">
                      <div className="flex flex-col justify-between gap-2 sm:flex-row">
                        <div>
                          <p className="font-bold text-red-600">
                            Reported: {report.reported.username}
                          </p>
                          <p>Reporter: {report.reporter.username}</p>
                          <p className="mt-1">
                            <span className="font-bold">Reason:</span>{" "}
                            {report.reason}
                          </p>
                          <p className="mt-1 text-xs text-gray-500">
                            {new Date(report.createdAt).toLocaleString()} •{" "}
                            {report.status}
                          </p>
                        </div>

                        <div className="flex flex-wrap gap-2">
                          <button
                            onClick={() => setExpandedReportId(expanded ? null : report.id)}
                            className="flex items-center gap-1 rounded border border-gray-400 bg-white px-3 py-1 font-bold hover:bg-gray-100"
                          >
                            <Eye size={15} />
                            Snippet
                          </button>

                          <button
                            onClick={() => markReviewed(report.id)}
                            className="flex items-center gap-1 rounded bg-green-600 px-3 py-1 font-bold text-white hover:bg-green-700"
                          >
                            <CheckCircle size={15} />
                            Reviewed
                          </button>

                          <button
                            onClick={() => moderateUser(report.reported.id, "warn", report.reason)}
                            className="flex items-center gap-1 rounded bg-yellow-500 px-3 py-1 font-bold text-white hover:bg-yellow-600"
                          >
                            <Megaphone size={15} />
                            Warn
                          </button>

                          <button
                            onClick={() => moderateUser(report.reported.id, "ban", report.reason)}
                            className="flex items-center gap-1 rounded bg-red-600 px-3 py-1 font-bold text-white hover:bg-red-700"
                          >
                            <Ban size={15} />
                            Ban
                          </button>
                        </div>
                      </div>

                      {expanded && (
                        <div className="mt-3 rounded border border-gray-300 bg-white p-3">
                          <p className="mb-2 font-bold">Reported chat snippet</p>

                          {report.snippet.length === 0 ? (
                            <p className="text-gray-500">No messages were captured.</p>
                          ) : (
                            <div className="space-y-1">
                              {report.snippet.map((msg, index) => (
                                <p key={index}>
                                  <span
                                    className={
                                      msg.from.id === report.reported.id
                                        ? "font-bold text-red-600"
                                        : "font-bold text-blue-600"
                                    }
                                  >
                                    {msg.from.username}:{" "}
                                  </span>
                                  {msg.text}
                                </p>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        )}

        <section className="mb-4 rounded border border-gray-300 bg-white p-4 shadow-sm">
          <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
            <div>
              <p className="font-bold">
                {status === "idle" && "You are not connected."}
                {status === "waiting" && `Looking for someone in ${mode}...`}
                {status === "matched" &&
                  `Connected to ${stranger?.username || "a stranger"}.`}
              </p>

              <p className="text-sm text-gray-600">
                Mode: {matchedMode ?? "none"}
              </p>
            </div>

            {status === "idle" ? (
              <div className="flex gap-2">
                <button
                  onClick={() => startSearch("chat")}
                  className="flex items-center gap-2 rounded bg-blue-600 px-4 py-2 font-bold text-white hover:bg-blue-700"
                >
                  <MessageCircle size={18} />
                  Text
                </button>

                <button
                  onClick={() => startSearch("video")}
                  className="flex items-center gap-2 rounded bg-orange-500 px-4 py-2 font-bold text-white hover:bg-orange-600"
                >
                  <Video size={18} />
                  Video
                </button>
              </div>
            ) : (
              <button
                onClick={stopChat}
                className="flex items-center gap-2 rounded border border-gray-400 bg-gray-100 px-4 py-2 hover:bg-gray-200"
              >
                <X size={18} />
                Stop
              </button>
            )}
          </div>
        </section>

        <section className="rounded border border-gray-300 bg-white shadow-sm">
          <div className="h-[430px] overflow-y-auto bg-white p-3 text-sm">
            {status === "idle" && (
              <div className="flex items-center gap-2 text-gray-500">
                <Shuffle size={18} />
                <span>Click Text or Video to start.</span>
              </div>
            )}

            {status === "waiting" && (
              <div className="flex items-center gap-2 font-bold text-blue-600">
                <Search size={18} className="animate-pulse" />
                <span>Finding someone you can chat with...</span>
              </div>
            )}

            <div className="mt-2 space-y-1">
              {messages.map((msg, index) => {
                if (msg.from === "system") {
                  return (
                    <p key={index} className="text-left font-bold text-blue-600">
                      {msg.text}
                    </p>
                  );
                }

                const isModerator = msg.user?.role === "moderator";

                return (
                  <p key={index} className="text-left leading-6">
                    <span
                      className={
                        msg.from === "me"
                          ? "font-bold text-red-600"
                          : "font-bold text-blue-600"
                      }
                    >
                      {msg.from === "me"
                        ? `${currentUser.username}: `
                        : `${msg.user?.username || "Stranger"}: `}
                    </span>

                    {isModerator && (
                      <ShieldCheck size={15} className="mr-1 inline text-blue-600" />
                    )}

                    <span>{msg.text}</span>
                  </p>
                );
              })}

              {strangerTyping && (
                <p className="flex items-center gap-2 text-left italic text-gray-500">
                  <Keyboard size={15} />
                  Stranger is typing...
                </p>
              )}
            </div>

            <div ref={bottomRef} />
          </div>

          {status === "matched" && (
            <div className="border-t border-gray-300 bg-yellow-50 p-2">
              <div className="flex flex-col gap-2 sm:flex-row">
                <input
                  value={reportReason}
                  onChange={(e) => setReportReason(e.target.value)}
                  placeholder="Report reason..."
                  className="flex-1 border border-gray-300 bg-white px-3 py-2 text-sm outline-none focus:border-red-500"
                />

                <button
                  onClick={submitReport}
                  type="button"
                  className="flex items-center justify-center gap-2 rounded bg-red-600 px-4 py-2 text-sm font-bold text-white hover:bg-red-700"
                >
                  <Flag size={16} />
                  Report
                </button>
              </div>

              {reportStatus && (
                <p className="mt-1 flex items-center gap-1 text-sm font-bold text-red-700">
                  <AlertTriangle size={14} />
                  {reportStatus}
                </p>
              )}
            </div>
          )}

          <form
            onSubmit={sendMessage}
            className="flex gap-2 border-t border-gray-300 bg-gray-100 p-2"
          >
            <button
              type="button"
              onClick={stopChat}
              disabled={status === "idle"}
              className="flex items-center gap-2 rounded border border-gray-400 bg-white px-4 py-2 hover:bg-gray-200 disabled:opacity-50"
            >
              <Shuffle size={17} />
              New
            </button>

            <input
              value={input}
              onChange={handleInputChange}
              disabled={status !== "matched"}
              placeholder={
                status === "matched"
                  ? "Type here..."
                  : "You are not chatting with anyone."
              }
              className="flex-1 border border-gray-400 bg-white px-3 py-2 outline-none focus:border-blue-500 disabled:bg-gray-200"
            />

            <button
              type="submit"
              disabled={status !== "matched"}
              className="flex items-center gap-2 rounded bg-blue-600 px-5 py-2 font-bold text-white hover:bg-blue-700 disabled:bg-gray-400"
            >
              <Send size={17} />
              Send
            </button>
          </form>
        </section>
      </div>
    </main>
  );
}

function NotificationStack({
  notifications,
  onClose,
}: {
  notifications: Notification[];
  onClose: (id: string) => void;
}) {
  return (
    <div className="fixed right-4 top-4 z-50 space-y-2">
      {notifications.map((notification) => (
        <div
          key={notification.id}
          className={`min-w-[280px] rounded border px-4 py-3 shadow-lg ${
            notification.type === "success"
              ? "border-green-300 bg-green-50"
              : notification.type === "warning"
              ? "border-yellow-300 bg-yellow-50"
              : notification.type === "error"
              ? "border-red-300 bg-red-50"
              : "border-gray-300 bg-white"
          }`}
        >
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="flex items-center gap-2 text-sm font-bold">
                <Bell size={15} />
                {notification.message}
              </p>

              <p className="mt-1 text-xs text-gray-500">
                {new Date(notification.createdAt).toLocaleTimeString()}
              </p>
            </div>

            <button
              onClick={() => onClose(notification.id)}
              className="text-gray-500 hover:text-black"
            >
              <X size={15} />
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}