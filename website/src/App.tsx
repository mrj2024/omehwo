import { useEffect, useRef, useState } from "react";
import { io, Socket } from "socket.io-client";
import { supabase } from "./lib/supabase";

import "@livekit/components-styles";
import {
  LiveKitRoom,
  VideoConference,
  RoomAudioRenderer,
} from "@livekit/components-react";

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
  Flag,
  AlertTriangle,
  Trash2,
  Bell,
  Eye,
  CheckCircle,
  Ban,
  Megaphone,
  Tags,
  Settings,
  Moon,
  Sun,
  LogOut,
  Sparkles,
} from "lucide-react";

const socket: Socket = io(import.meta.env.VITE_SOCKET_URL, {
  transports: ["websocket", "polling"],
});

type SearchMode = "chat" | "video";
type Status = "idle" | "waiting" | "matched";
type Role = "user" | "moderator";
type ThemeMode = "light" | "dark";

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

type SiteSettings = {
  theme: ThemeMode;
  compactMode: boolean;
  showSafetyNotice: boolean;
};

const defaultSettings: SiteSettings = {
  theme: "light",
  compactMode: false,
  showSafetyNotice: true,
};

export default function App() {
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

  const [interestInput, setInterestInput] = useState("");
  const [sharedInterests, setSharedInterests] = useState<string[]>([]);

  const [reportReason, setReportReason] = useState("");
  const [reportStatus, setReportStatus] = useState("");

  const [showModPanel, setShowModPanel] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [reports, setReports] = useState<Report[]>([]);
  const [expandedReportId, setExpandedReportId] = useState<string | null>(null);

  const [notifications, setNotifications] = useState<Notification[]>([]);

  const [livekitToken, setLivekitToken] = useState<string | null>(null);
  const [livekitRoom, setLivekitRoom] = useState<string | null>(null);

  const [settings, setSettings] = useState<SiteSettings>(() => {
    const saved = localStorage.getItem("omeclone-settings");
    return saved ? { ...defaultSettings, ...JSON.parse(saved) } : defaultSettings;
  });

  const bottomRef = useRef<HTMLDivElement | null>(null);

  const isDark = settings.theme === "dark";

  useEffect(() => {
    localStorage.setItem("omeclone-settings", JSON.stringify(settings));
  }, [settings]);

  useEffect(() => {
    async function initAuth() {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (session?.access_token) {
        serverLogin(session.access_token);
      }
    }

    initAuth();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.access_token) {
        serverLogin(session.access_token);
      } else {
        setCurrentUser(null);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    socket.on("online-count", setOnlineCount);

    socket.on("notification", (notification: Notification) => {
      setNotifications((prev) => [notification, ...prev.slice(0, 4)]);
    });

    socket.on("banned", async () => {
      await supabase.auth.signOut();
      setCurrentUser(null);
      resetChat();
      setMessages([{ from: "system", text: "You were banned by a moderator." }]);
    });

    socket.on("waiting", ({ mode }: { mode: SearchMode }) => {
      setStatus("waiting");
      setMode(mode);
      setMatchedMode(mode);
      setStranger(null);
      setLivekitToken(null);
      setLivekitRoom(null);
    });

    socket.on(
      "match-found",
      ({
        mode,
        stranger,
        interests,
        livekitToken,
        livekitRoom,
      }: {
        mode: SearchMode;
        stranger: PublicUser;
        interests: string[];
        livekitToken?: string | null;
        livekitRoom?: string | null;
      }) => {
        setStatus("matched");
        setMode(mode);
        setMatchedMode(mode);
        setStranger(stranger);
        setSharedInterests(interests || []);
        setLivekitToken(livekitToken || null);
        setLivekitRoom(livekitRoom || null);

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
      setTimeout(() => setStrangerTyping(false), 1000);
    });

    socket.on("partner-left", () => {
      resetChat();
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
    };
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView();
  }, [messages, strangerTyping]);

  function resetChat() {
    setStatus("idle");
    setMatchedMode(null);
    setStranger(null);
    setSharedInterests([]);
    setLivekitToken(null);
    setLivekitRoom(null);
  }

  function addNotification(type: Notification["type"], message: string) {
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

  function serverLogin(accessToken: string) {
    socket.emit(
      "auth-login",
      accessToken,
      (response: { success: boolean; user?: PublicUser; error?: string }) => {
        if (!response.success || !response.user) {
          addNotification("error", response.error || "Server login failed.");
          return;
        }

        setCurrentUser(response.user);

        if (response.user.role === "moderator") {
          loadReports();
        }
      }
    );
  }

  async function handleAuth() {
    if (!email.trim() || !password.trim()) {
      addNotification("error", "Enter your email and password.");
      return;
    }

    if (authMode === "register") {
      const { data, error } = await supabase.auth.signUp({ email, password });

      if (error) {
        addNotification("error", error.message);
        return;
      }

      if (data.session?.access_token) {
        serverLogin(data.session.access_token);
      }

      addNotification("success", "Account created.");
      return;
    }

    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      addNotification("error", error.message);
      return;
    }

    if (data.session?.access_token) {
      serverLogin(data.session.access_token);
    }
  }

  async function logout() {
    socket.emit("logout");
    await supabase.auth.signOut();

    setCurrentUser(null);
    resetChat();
    setMessages([]);
    setReports([]);
    setShowModPanel(false);
  }

  function parseInterests() {
    return interestInput
      .split(",")
      .map((interest) => interest.trim().toLowerCase())
      .filter(Boolean)
      .slice(0, 8);
  }

  function startSearch(selectedMode: SearchMode) {
    const interests = parseInterests();

    setMode(selectedMode);
    setMatchedMode(selectedMode);
    setMessages([]);
    setSharedInterests([]);
    setLivekitToken(null);
    setLivekitRoom(null);

    socket.emit("find-match", {
      mode: selectedMode,
      interests,
    });
  }

  function stopChat() {
    socket.emit("next");
    resetChat();
    setMessages([]);
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
      setReportStatus("Please enter a reason.");
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
        addNotification("success", "Report submitted.");
      }
    );
  }

  function loadReports() {
    socket.emit(
      "get-reports",
      (response: { success: boolean; reports?: Report[]; error?: string }) => {
        if (!response.success) {
          addNotification("error", response.error || "Could not load reports.");
          return;
        }

        setReports(response.reports || []);
      }
    );
  }

  function clearReports() {
    socket.emit(
      "clear-reports",
      (response: { success: boolean; error?: string }) => {
        if (!response.success) {
          addNotification("error", response.error || "Could not clear reports.");
          return;
        }

        setReports([]);
        addNotification("success", "Reports cleared.");
      }
    );
  }

  function markReviewed(reportId: string) {
    socket.emit(
      "mark-report-reviewed",
      reportId,
      (response: { success: boolean; error?: string }) => {
        if (!response.success) {
          addNotification("error", response.error || "Could not review report.");
          return;
        }

        addNotification("success", "Report reviewed.");
      }
    );
  }

  function moderateUser(targetUserId: string, action: "warn" | "ban", reason: string) {
    socket.emit(
      "moderation-action",
      { targetUserId, action, reason },
      (response: { success: boolean; error?: string }) => {
        if (!response.success) {
          addNotification("error", response.error || "Action failed.");
          return;
        }

        addNotification("success", action === "ban" ? "User banned." : "User warned.");
      }
    );
  }

  const pageClass = isDark
    ? "min-h-screen bg-zinc-950 text-zinc-100"
    : "min-h-screen bg-slate-100 text-slate-950";

  const cardClass = isDark
    ? "bg-zinc-900 border-zinc-800"
    : "bg-white border-slate-200";

  const mutedText = isDark ? "text-zinc-400" : "text-slate-500";
  const unreadReports = reports.filter((report) => report.status === "open").length;

  if (!currentUser) {
    return (
      <main className={pageClass}>
        <ToastStack
          notifications={notifications}
          onClose={removeNotification}
          isDark={isDark}
        />

        <div className="flex min-h-screen items-center justify-center px-4">
          <section className={`w-full max-w-md rounded-3xl border p-6 shadow-xl ${cardClass}`}>
            <div className="mb-8 text-center">
              <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-orange-500 text-white">
                <Sparkles />
              </div>

              <h1 className="text-4xl font-black">
                Ome<span className="text-orange-500">Clone</span>
              </h1>

              <p className={`mt-2 text-sm ${mutedText}`}>
                Meet strangers by text or video.
              </p>
            </div>

            <div className={`mb-4 grid grid-cols-2 rounded-2xl p-1 ${isDark ? "bg-zinc-800" : "bg-slate-100"}`}>
              <button
                onClick={() => setAuthMode("login")}
                className={`rounded-xl py-2 font-bold ${
                  authMode === "login"
                    ? "bg-blue-600 text-white"
                    : mutedText
                }`}
              >
                Login
              </button>

              <button
                onClick={() => setAuthMode("register")}
                className={`rounded-xl py-2 font-bold ${
                  authMode === "register"
                    ? "bg-orange-500 text-white"
                    : mutedText
                }`}
              >
                Register
              </button>
            </div>

            <div className="space-y-3">
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Email"
                className={`w-full rounded-2xl border px-4 py-3 outline-none ${
                  isDark
                    ? "border-zinc-700 bg-zinc-950"
                    : "border-slate-300 bg-white"
                }`}
              />

              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Password"
                className={`w-full rounded-2xl border px-4 py-3 outline-none ${
                  isDark
                    ? "border-zinc-700 bg-zinc-950"
                    : "border-slate-300 bg-white"
                }`}
              />

              <button
                onClick={handleAuth}
                className="w-full rounded-2xl bg-blue-600 py-3 font-black text-white hover:bg-blue-700"
              >
                {authMode === "login" ? "Login" : "Create Account"}
              </button>
            </div>

            <button
              onClick={() =>
                setSettings((prev) => ({
                  ...prev,
                  theme: prev.theme === "light" ? "dark" : "light",
                }))
              }
              className={`mt-5 flex w-full items-center justify-center gap-2 rounded-2xl border py-3 font-bold ${
                isDark ? "border-zinc-700" : "border-slate-300"
              }`}
            >
              {isDark ? <Sun size={18} /> : <Moon size={18} />}
              {isDark ? "Light Mode" : "Dark Mode"}
            </button>
          </section>
        </div>
      </main>
    );
  }

  return (
    <main className={pageClass}>
      <ToastStack notifications={notifications} onClose={removeNotification} isDark={isDark} />

      <div className="mx-auto grid min-h-screen max-w-7xl gap-4 p-4 lg:grid-cols-[320px_1fr]">
        <aside className={`rounded-3xl border p-4 shadow-sm ${cardClass}`}>
          <div className="mb-6 flex items-center justify-between">
            <h1 className="text-3xl font-black">
              Ome<span className="text-orange-500">Clone</span>
            </h1>

            <button
              onClick={() => setShowSettings(true)}
              className={`rounded-xl border p-2 ${isDark ? "border-zinc-700" : "border-slate-300"}`}
            >
              <Settings size={20} />
            </button>
          </div>

          <div className={`mb-4 rounded-2xl border p-4 ${isDark ? "border-zinc-800 bg-zinc-950" : "border-slate-200 bg-slate-50"}`}>
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-blue-600 text-white">
                <User />
              </div>

              <div>
                <p className="font-black">{currentUser.username}</p>
                <p className={`flex items-center gap-1 text-sm ${mutedText}`}>
                  {currentUser.role === "moderator" && <ShieldCheck size={14} />}
                  {currentUser.role}
                </p>
              </div>
            </div>

            <p className={`mt-4 flex items-center gap-2 text-sm ${mutedText}`}>
              <Users size={16} />
              {onlineCount} online now
            </p>
          </div>

          <label className="mb-2 flex items-center gap-2 text-sm font-black">
            <Tags size={16} />
            Interests
          </label>

          <input
            value={interestInput}
            onChange={(e) => setInterestInput(e.target.value)}
            placeholder="gaming, music, football..."
            className={`mb-4 w-full rounded-2xl border px-4 py-3 outline-none ${
              isDark
                ? "border-zinc-700 bg-zinc-950"
                : "border-slate-300 bg-white"
            }`}
          />

          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => startSearch("chat")}
              className="flex items-center justify-center gap-2 rounded-2xl bg-blue-600 py-3 font-black text-white hover:bg-blue-700"
            >
              <MessageCircle size={18} />
              Text
            </button>

            <button
              onClick={() => startSearch("video")}
              className="flex items-center justify-center gap-2 rounded-2xl bg-orange-500 py-3 font-black text-white hover:bg-orange-600"
            >
              <Video size={18} />
              Video
            </button>
          </div>

          <button
            onClick={stopChat}
            className={`mt-2 flex w-full items-center justify-center gap-2 rounded-2xl border py-3 font-bold ${
              isDark ? "border-zinc-700" : "border-slate-300"
            }`}
          >
            <Shuffle size={18} />
            Next / Stop
          </button>

          {settings.showSafetyNotice && (
            <div className={`mt-4 rounded-2xl border p-3 text-sm ${isDark ? "border-yellow-700 bg-yellow-950/30 text-yellow-200" : "border-yellow-200 bg-yellow-50 text-yellow-800"}`}>
              Chats may be reported and reviewed for safety.
            </div>
          )}

          {currentUser.role === "moderator" && (
            <button
              onClick={() => {
                setShowModPanel((prev) => !prev);
                loadReports();
              }}
              className="relative mt-4 flex w-full items-center justify-center gap-2 rounded-2xl bg-indigo-600 py-3 font-black text-white"
            >
              <ShieldCheck size={18} />
              Moderator Panel
              {unreadReports > 0 && (
                <span className="absolute right-3 rounded-full bg-red-600 px-2 text-xs">
                  {unreadReports}
                </span>
              )}
            </button>
          )}

          <button
            onClick={logout}
            className={`mt-4 flex w-full items-center justify-center gap-2 rounded-2xl border py-3 font-bold ${
              isDark ? "border-zinc-700" : "border-slate-300"
            }`}
          >
            <LogOut size={18} />
            Logout
          </button>
        </aside>

        <section className="space-y-4">
          <div className={`rounded-3xl border p-4 shadow-sm ${cardClass}`}>
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div>
                <p className="text-lg font-black">
                  {status === "idle" && "Ready to connect"}
                  {status === "waiting" && `Searching for ${mode}...`}
                  {status === "matched" && `Connected to ${stranger?.username || "a stranger"}`}
                </p>

                <p className={`text-sm ${mutedText}`}>
                  Mode: {matchedMode || "none"}
                </p>
              </div>

              {sharedInterests.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {sharedInterests.map((interest) => (
                    <span key={interest} className="rounded-full bg-blue-100 px-3 py-1 text-sm font-bold text-blue-700">
                      #{interest}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>

          {matchedMode === "video" && livekitToken && livekitRoom && (
            <section className={`overflow-hidden rounded-3xl border shadow-sm ${cardClass}`}>
              <LiveKitRoom
                token={livekitToken}
                serverUrl={import.meta.env.VITE_LIVEKIT_URL}
                connect={true}
                video={true}
                audio={true}
                data-lk-theme={isDark ? "default" : "default"}
                className="min-h-[420px]"
              >
                <VideoConference />
                <RoomAudioRenderer />
              </LiveKitRoom>
            </section>
          )}

          <section className={`overflow-hidden rounded-3xl border shadow-sm ${cardClass}`}>
            <div className={`${settings.compactMode ? "h-[340px]" : "h-[470px]"} overflow-y-auto p-4`}>
              {status === "idle" && (
                <div className={`flex h-full items-center justify-center text-center ${mutedText}`}>
                  <div>
                    <MessageCircle className="mx-auto mb-3" size={44} />
                    <p className="font-bold">Choose Text or Video to start.</p>
                  </div>
                </div>
              )}

              {status === "waiting" && (
                <p className="flex items-center gap-2 font-black text-blue-600">
                  <Search className="animate-pulse" size={18} />
                  Looking for someone...
                </p>
              )}

              <div className="space-y-2">
                {messages.map((msg, index) => {
                  if (msg.from === "system") {
                    return (
                      <p key={index} className="font-bold text-blue-600">
                        {msg.text}
                      </p>
                    );
                  }

                  const isModerator = msg.user?.role === "moderator";

                  return (
                    <p key={index}>
                      <span className={msg.from === "me" ? "font-black text-red-600" : "font-black text-blue-600"}>
                        {msg.from === "me"
                          ? `${currentUser.username}: `
                          : `${msg.user?.username || "Stranger"}: `}
                      </span>

                      {isModerator && <ShieldCheck size={14} className="mr-1 inline text-blue-600" />}

                      {msg.text}
                    </p>
                  );
                })}

                {strangerTyping && (
                  <p className={`flex items-center gap-2 italic ${mutedText}`}>
                    <Keyboard size={14} />
                    Stranger is typing...
                  </p>
                )}

                <div ref={bottomRef} />
              </div>
            </div>

            {status === "matched" && (
              <div className={`border-t p-3 ${isDark ? "border-zinc-800 bg-zinc-950" : "border-slate-200 bg-yellow-50"}`}>
                <div className="flex gap-2">
                  <input
                    value={reportReason}
                    onChange={(e) => setReportReason(e.target.value)}
                    placeholder="Report reason..."
                    className={`flex-1 rounded-2xl border px-4 py-2 ${
                      isDark
                        ? "border-zinc-700 bg-zinc-900"
                        : "border-slate-300 bg-white"
                    }`}
                  />

                  <button
                    onClick={submitReport}
                    className="flex items-center gap-2 rounded-2xl bg-red-600 px-4 py-2 font-bold text-white"
                  >
                    <Flag size={16} />
                    Report
                  </button>
                </div>

                {reportStatus && (
                  <p className="mt-2 flex items-center gap-1 text-sm font-bold text-red-600">
                    <AlertTriangle size={14} />
                    {reportStatus}
                  </p>
                )}
              </div>
            )}

            <form
              onSubmit={sendMessage}
              className={`flex gap-2 border-t p-3 ${isDark ? "border-zinc-800 bg-zinc-950" : "border-slate-200 bg-slate-50"}`}
            >
              <input
                value={input}
                onChange={handleInputChange}
                disabled={status !== "matched"}
                placeholder="Type here..."
                className={`flex-1 rounded-2xl border px-4 py-3 outline-none disabled:opacity-50 ${
                  isDark
                    ? "border-zinc-700 bg-zinc-900"
                    : "border-slate-300 bg-white"
                }`}
              />

              <button
                type="submit"
                disabled={status !== "matched"}
                className="flex items-center gap-2 rounded-2xl bg-blue-600 px-5 py-3 font-black text-white disabled:opacity-50"
              >
                <Send size={16} />
                Send
              </button>
            </form>
          </section>

          {showModPanel && currentUser.role === "moderator" && (
            <ModeratorPanel
              reports={reports}
              expandedReportId={expandedReportId}
              setExpandedReportId={setExpandedReportId}
              clearReports={clearReports}
              markReviewed={markReviewed}
              moderateUser={moderateUser}
              isDark={isDark}
            />
          )}
        </section>
      </div>

      {showSettings && (
        <SettingsPanel
          settings={settings}
          setSettings={setSettings}
          onClose={() => setShowSettings(false)}
          isDark={isDark}
        />
      )}
    </main>
  );
}

function ToastStack({
  notifications,
  onClose,
  isDark,
}: {
  notifications: Notification[];
  onClose: (id: string) => void;
  isDark: boolean;
}) {
  return (
    <div className="fixed right-4 top-4 z-50 space-y-2">
      {notifications.map((notification) => (
        <div
          key={notification.id}
          className={`min-w-[280px] rounded-2xl border px-4 py-3 shadow-xl ${
            isDark ? "border-zinc-700 bg-zinc-900" : "border-slate-200 bg-white"
          }`}
        >
          <div className="flex justify-between gap-3">
            <p className="flex items-center gap-2 text-sm font-black">
              <Bell size={15} />
              {notification.message}
            </p>

            <button onClick={() => onClose(notification.id)}>
              <X size={15} />
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}

function SettingsPanel({
  settings,
  setSettings,
  onClose,
  isDark,
}: {
  settings: SiteSettings;
  setSettings: React.Dispatch<React.SetStateAction<SiteSettings>>;
  onClose: () => void;
  isDark: boolean;
}) {
  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 p-4">
      <section className={`w-full max-w-md rounded-3xl border p-6 shadow-2xl ${
        isDark ? "border-zinc-700 bg-zinc-900" : "border-slate-200 bg-white"
      }`}>
        <div className="mb-5 flex items-center justify-between">
          <h2 className="text-2xl font-black">Site Settings</h2>
          <button onClick={onClose}>
            <X />
          </button>
        </div>

        <div className="space-y-4">
          <button
            onClick={() =>
              setSettings((prev) => ({
                ...prev,
                theme: prev.theme === "light" ? "dark" : "light",
              }))
            }
            className="flex w-full items-center justify-between rounded-2xl border p-4 font-bold"
          >
            <span>Theme</span>
            <span className="flex items-center gap-2">
              {settings.theme === "light" ? <Sun size={18} /> : <Moon size={18} />}
              {settings.theme}
            </span>
          </button>

          <label className="flex cursor-pointer items-center justify-between rounded-2xl border p-4 font-bold">
            Compact chat mode
            <input
              type="checkbox"
              checked={settings.compactMode}
              onChange={(e) =>
                setSettings((prev) => ({
                  ...prev,
                  compactMode: e.target.checked,
                }))
              }
            />
          </label>

          <label className="flex cursor-pointer items-center justify-between rounded-2xl border p-4 font-bold">
            Show safety notice
            <input
              type="checkbox"
              checked={settings.showSafetyNotice}
              onChange={(e) =>
                setSettings((prev) => ({
                  ...prev,
                  showSafetyNotice: e.target.checked,
                }))
              }
            />
          </label>
        </div>
      </section>
    </div>
  );
}

function ModeratorPanel({
  reports,
  expandedReportId,
  setExpandedReportId,
  clearReports,
  markReviewed,
  moderateUser,
  isDark,
}: {
  reports: Report[];
  expandedReportId: string | null;
  setExpandedReportId: (id: string | null) => void;
  clearReports: () => void;
  markReviewed: (id: string) => void;
  moderateUser: (targetUserId: string, action: "warn" | "ban", reason: string) => void;
  isDark: boolean;
}) {
  return (
    <section className={`rounded-3xl border p-4 shadow-sm ${
      isDark ? "border-indigo-900 bg-zinc-900" : "border-indigo-200 bg-white"
    }`}>
      <div className="mb-4 flex items-center justify-between">
        <h2 className="flex items-center gap-2 text-xl font-black text-indigo-600">
          <ShieldCheck />
          Moderator Dashboard
        </h2>

        <button
          onClick={clearReports}
          className="flex items-center gap-2 rounded-2xl border px-3 py-2 text-sm font-bold"
        >
          <Trash2 size={16} />
          Clear
        </button>
      </div>

      {reports.length === 0 ? (
        <p className="text-sm opacity-60">No reports yet.</p>
      ) : (
        <div className="space-y-3">
          {reports.map((report) => {
            const expanded = expandedReportId === report.id;

            return (
              <div key={report.id} className={`rounded-2xl border p-3 ${
                isDark ? "border-zinc-700 bg-zinc-950" : "border-slate-200 bg-slate-50"
              }`}>
                <p className="font-black text-red-600">
                  Reported: {report.reported.username}
                </p>
                <p>Reporter: {report.reporter.username}</p>
                <p className="mt-1">
                  <span className="font-black">Reason:</span> {report.reason}
                </p>

                <div className="mt-3 flex flex-wrap gap-2">
                  <button onClick={() => setExpandedReportId(expanded ? null : report.id)} className="rounded-xl border px-3 py-1 font-bold">
                    <Eye size={15} className="mr-1 inline" />
                    Snippet
                  </button>

                  <button onClick={() => markReviewed(report.id)} className="rounded-xl bg-green-600 px-3 py-1 font-bold text-white">
                    <CheckCircle size={15} className="mr-1 inline" />
                    Reviewed
                  </button>

                  <button onClick={() => moderateUser(report.reported.id, "warn", report.reason)} className="rounded-xl bg-yellow-500 px-3 py-1 font-bold text-white">
                    <Megaphone size={15} className="mr-1 inline" />
                    Warn
                  </button>

                  <button onClick={() => moderateUser(report.reported.id, "ban", report.reason)} className="rounded-xl bg-red-600 px-3 py-1 font-bold text-white">
                    <Ban size={15} className="mr-1 inline" />
                    Ban
                  </button>
                </div>

                {expanded && (
                  <div className={`mt-3 rounded-2xl border p-3 ${
                    isDark ? "border-zinc-700 bg-zinc-900" : "border-slate-200 bg-white"
                  }`}>
                    <p className="mb-2 font-black">Chat Snippet</p>

                    {report.snippet.length === 0 ? (
                      <p className="opacity-60">No messages captured.</p>
                    ) : (
                      report.snippet.map((msg, index) => (
                        <p key={index}>
                          <span className="font-black">{msg.from.username}: </span>
                          {msg.text}
                        </p>
                      ))
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}