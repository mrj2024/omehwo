import { useEffect, useMemo, useRef, useState } from "react";
import { io, Socket } from "socket.io-client";
import { supabase } from "./lib/supabase";

import "@livekit/components-styles";
import {
  LiveKitRoom,
  VideoConference,
  RoomAudioRenderer,
} from "@livekit/components-react";

import {
  AlertTriangle,
  Ban,
  Bell,
  CheckCircle,
  CircleDot,
  Clock,
  Copy,
  Eye,
  Flag,
  HeartHandshake,
  Keyboard,
  LockKeyhole,
  Megaphone,
  MessageCircle,
  Moon,
  PanelRightClose,
  PanelRightOpen,
  RefreshCcw,
  Search,
  Send,
  Settings,
  ShieldAlert,
  ShieldCheck,
  Shuffle,
  SlidersHorizontal,
  Sparkles,
  Sun,
  Tags,
  Trash2,
  User,
  Users,
  Video,
  Wand2,
  X,
  LogOut,
  Zap,
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
  focusMode: boolean;
  showSafetyNotice: boolean;
  showPromptDeck: boolean;
  showSessionStats: boolean;
};

const defaultSettings: SiteSettings = {
  theme: "light",
  compactMode: false,
  focusMode: false,
  showSafetyNotice: true,
  showPromptDeck: true,
  showSessionStats: true,
};

const promptDeck = [
  "What’s a song you’ve had on repeat lately?",
  "What’s your hottest harmless opinion?",
  "What’s something underrated where you live?",
  "What would you do with a completely free weekend?",
  "What’s a film or show you wish you could watch again for the first time?",
];

const reportTemplates = [
  "Harassment or abuse",
  "Spam or scam",
  "Sexual content",
  "Hate or discrimination",
  "Threats or unsafe behaviour",
];

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

function formatClock(seconds: number) {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

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
  const [matchCount, setMatchCount] = useState(0);
  const [sessionSeconds, setSessionSeconds] = useState(0);

  const [reportReason, setReportReason] = useState("");
  const [reportStatus, setReportStatus] = useState("");

  const [showModPanel, setShowModPanel] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);

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
  const unreadReports = reports.filter((report) => report.status === "open").length;

  const parsedInterests = useMemo(() => {
    return interestInput
      .split(",")
      .map((interest) => interest.trim().toLowerCase())
      .filter(Boolean)
      .slice(0, 8);
  }, [interestInput]);

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
        setMatchCount((prev) => prev + 1);
        setSessionSeconds(0);
        setReportStatus("");

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
    if (status !== "matched") return;

    const interval = window.setInterval(() => {
      setSessionSeconds((prev) => prev + 1);
    }, 1000);

    return () => window.clearInterval(interval);
  }, [status]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, strangerTyping]);

  function resetChat() {
    setStatus("idle");
    setMatchedMode(null);
    setStranger(null);
    setSharedInterests([]);
    setLivekitToken(null);
    setLivekitRoom(null);
    setSessionSeconds(0);
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

  function startSearch(selectedMode: SearchMode) {
    setMode(selectedMode);
    setMatchedMode(selectedMode);
    setMessages([]);
    setSharedInterests([]);
    setLivekitToken(null);
    setLivekitRoom(null);

    socket.emit("find-match", {
      mode: selectedMode,
      interests: parsedInterests,
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

  async function copyPrompt(prompt: string) {
    await navigator.clipboard.writeText(prompt);
    setInput(prompt);
    addNotification("success", "Prompt copied into chat box.");
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

  const theme = {
    page: isDark
      ? "min-h-screen bg-[radial-gradient(circle_at_top_left,#172554,#09090b_40%,#020617)] text-zinc-100"
      : "min-h-screen bg-[radial-gradient(circle_at_top_left,#dbeafe,#f8fafc_38%,#fff7ed)] text-slate-950",
    card: isDark
      ? "border-zinc-800 bg-zinc-950/82 shadow-black/30"
      : "border-white/80 bg-white/85 shadow-slate-200/80",
    inner: isDark
      ? "border-zinc-800 bg-zinc-900"
      : "border-slate-200 bg-white",
    muted: isDark ? "text-zinc-400" : "text-slate-500",
    soft: isDark ? "bg-zinc-900/70" : "bg-slate-50",
    input: isDark
      ? "border-zinc-700 bg-zinc-950 text-zinc-100 placeholder:text-zinc-500"
      : "border-slate-200 bg-white text-slate-950 placeholder:text-slate-400",
  };

  if (!currentUser) {
    return (
      <main className={theme.page}>
        <ToastStack
          notifications={notifications}
          onClose={removeNotification}
          isDark={isDark}
        />

        <div className="mx-auto grid min-h-screen max-w-6xl items-center gap-8 px-4 py-10 lg:grid-cols-[1.05fr_420px]">
          <section className="hidden lg:block">
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-blue-200 bg-white/70 px-4 py-2 text-sm font-bold text-blue-700 shadow-sm">
              <Zap size={16} />
              Real-time stranger chat with safety tooling
            </div>

            <h1 className="max-w-3xl text-7xl font-black tracking-tight">
              Meet people by vibe, not by algorithm.
            </h1>

            <p className={`mt-6 max-w-2xl text-lg leading-8 ${theme.muted}`}>
              A modern stranger-chat experience with interests, moderation,
              LiveKit video rooms, safety notices, reports, and settings that
              actually feel like a product.
            </p>

            <div className="mt-8 grid max-w-3xl grid-cols-3 gap-4">
              {[
                ["Interest Matching", Tags],
                ["Live Video Rooms", Video],
                ["Moderator Tools", ShieldCheck],
              ].map(([label, Icon]) => (
                <div
                  key={String(label)}
                  className={`rounded-3xl border p-5 backdrop-blur-xl ${theme.card}`}
                >
                  <Icon className="mb-4 text-blue-600" size={28} />
                  <p className="font-black">{String(label)}</p>
                </div>
              ))}
            </div>
          </section>

          <section className={`rounded-[2rem] border p-6 shadow-2xl backdrop-blur-xl ${theme.card}`}>
            <div className="mb-8 text-center">
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-3xl bg-gradient-to-br from-orange-500 to-blue-600 text-white shadow-xl">
                <Sparkles />
              </div>

              <h2 className="text-4xl font-black">
                Ome<span className="text-orange-500">Clone</span>
              </h2>

              <p className={`mt-2 text-sm ${theme.muted}`}>
                Sign in to start matching.
              </p>
            </div>

            <div className={`mb-5 grid grid-cols-2 rounded-2xl p-1 ${isDark ? "bg-zinc-900" : "bg-slate-100"}`}>
              <button
                onClick={() => setAuthMode("login")}
                className={cx(
                  "rounded-xl py-3 font-black transition",
                  authMode === "login" ? "bg-blue-600 text-white shadow" : theme.muted
                )}
              >
                Login
              </button>

              <button
                onClick={() => setAuthMode("register")}
                className={cx(
                  "rounded-xl py-3 font-black transition",
                  authMode === "register" ? "bg-orange-500 text-white shadow" : theme.muted
                )}
              >
                Register
              </button>
            </div>

            <div className="space-y-3">
              <input
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Email address"
                className={`w-full rounded-2xl border px-4 py-3 outline-none ${theme.input}`}
              />

              <input
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Password"
                className={`w-full rounded-2xl border px-4 py-3 outline-none ${theme.input}`}
              />

              <button
                onClick={handleAuth}
                className="w-full rounded-2xl bg-blue-600 py-3 font-black text-white shadow-lg shadow-blue-600/20 transition hover:bg-blue-700"
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
              className={`mt-5 flex w-full items-center justify-center gap-2 rounded-2xl border py-3 font-bold ${isDark ? "border-zinc-700" : "border-slate-200"}`}
            >
              {isDark ? <Sun size={18} /> : <Moon size={18} />}
              {isDark ? "Use Light Theme" : "Use Dark Theme"}
            </button>
          </section>
        </div>
      </main>
    );
  }

  return (
    <main className={theme.page}>
      <ToastStack
        notifications={notifications}
        onClose={removeNotification}
        isDark={isDark}
      />

      <div className="mx-auto grid min-h-screen max-w-[1500px] gap-4 p-4 lg:grid-cols-[auto_1fr]">
        {sidebarOpen && (
          <aside className={`w-full rounded-[2rem] border p-4 shadow-xl backdrop-blur-xl lg:w-[340px] ${theme.card}`}>
            <div className="mb-6 flex items-center justify-between">
              <div>
                <h1 className="text-3xl font-black">
                  Ome<span className="text-orange-500">Clone</span>
                </h1>
                <p className={`text-sm ${theme.muted}`}>Production style shell</p>
              </div>

              <button
                onClick={() => setSidebarOpen(false)}
                className={`rounded-2xl border p-2 ${isDark ? "border-zinc-700" : "border-slate-200"}`}
              >
                <PanelRightClose size={19} />
              </button>
            </div>

            <ProfileCard
              user={currentUser}
              onlineCount={onlineCount}
              matchCount={matchCount}
              theme={theme}
            />

            <div className={`mt-4 rounded-3xl border p-4 ${theme.inner}`}>
              <label className="mb-2 flex items-center gap-2 text-sm font-black">
                <Tags size={16} />
                Match Interests
              </label>

              <input
                value={interestInput}
                onChange={(e) => setInterestInput(e.target.value)}
                placeholder="gaming, music, football..."
                className={`w-full rounded-2xl border px-4 py-3 outline-none ${theme.input}`}
              />

              {parsedInterests.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-2">
                  {parsedInterests.map((interest) => (
                    <span
                      key={interest}
                      className="rounded-full bg-blue-100 px-3 py-1 text-xs font-black text-blue-700"
                    >
                      #{interest}
                    </span>
                  ))}
                </div>
              )}
            </div>

            <div className="mt-4 grid grid-cols-2 gap-2">
              <button
                onClick={() => startSearch("chat")}
                className="flex items-center justify-center gap-2 rounded-2xl bg-blue-600 py-3 font-black text-white shadow-lg shadow-blue-600/20"
              >
                <MessageCircle size={18} />
                Text
              </button>

              <button
                onClick={() => startSearch("video")}
                className="flex items-center justify-center gap-2 rounded-2xl bg-orange-500 py-3 font-black text-white shadow-lg shadow-orange-500/20"
              >
                <Video size={18} />
                Video
              </button>
            </div>

            <button
              onClick={stopChat}
              className={`mt-2 flex w-full items-center justify-center gap-2 rounded-2xl border py-3 font-bold ${isDark ? "border-zinc-700" : "border-slate-200"}`}
            >
              <RefreshCcw size={18} />
              Next / Stop
            </button>

            {settings.showSafetyNotice && (
              <div className={`mt-4 rounded-3xl border p-4 text-sm ${isDark ? "border-yellow-800 bg-yellow-950/30 text-yellow-200" : "border-yellow-200 bg-yellow-50 text-yellow-800"}`}>
                <div className="flex items-start gap-2">
                  <ShieldAlert size={18} />
                  <p>
                    Chats may be reported and reviewed for safety. Do not share
                    private information with strangers.
                  </p>
                </div>
              </div>
            )}

            <div className="mt-4 grid grid-cols-2 gap-2">
              <button
                onClick={() => setShowSettings(true)}
                className={`flex items-center justify-center gap-2 rounded-2xl border py-3 font-bold ${isDark ? "border-zinc-700" : "border-slate-200"}`}
              >
                <Settings size={18} />
                Settings
              </button>

              <button
                onClick={logout}
                className={`flex items-center justify-center gap-2 rounded-2xl border py-3 font-bold ${isDark ? "border-zinc-700" : "border-slate-200"}`}
              >
                <LogOut size={18} />
                Logout
              </button>
            </div>

            {currentUser.role === "moderator" && (
              <button
                onClick={() => {
                  setShowModPanel((prev) => !prev);
                  loadReports();
                }}
                className="relative mt-4 flex w-full items-center justify-center gap-2 rounded-2xl bg-indigo-600 py-3 font-black text-white"
              >
                <ShieldCheck size={18} />
                Moderator Dashboard
                {unreadReports > 0 && (
                  <span className="absolute right-3 rounded-full bg-red-600 px-2 text-xs">
                    {unreadReports}
                  </span>
                )}
              </button>
            )}
          </aside>
        )}

        <section className="min-w-0 space-y-4">
          <div className={`rounded-[2rem] border p-4 shadow-xl backdrop-blur-xl ${theme.card}`}>
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div className="flex items-center gap-3">
                {!sidebarOpen && (
                  <button
                    onClick={() => setSidebarOpen(true)}
                    className={`rounded-2xl border p-2 ${isDark ? "border-zinc-700" : "border-slate-200"}`}
                  >
                    <PanelRightOpen size={19} />
                  </button>
                )}

                <div>
                  <p className="flex items-center gap-2 text-xl font-black">
                    <CircleDot
                      size={16}
                      className={cx(
                        status === "matched" && "text-green-500",
                        status === "waiting" && "text-yellow-500",
                        status === "idle" && theme.muted
                      )}
                    />
                    {status === "idle" && "Ready to connect"}
                    {status === "waiting" && `Searching for ${mode}...`}
                    {status === "matched" &&
                      `Connected to ${stranger?.username || "a stranger"}`}
                  </p>

                  <p className={`mt-1 flex items-center gap-3 text-sm ${theme.muted}`}>
                    <span>Mode: {matchedMode || "none"}</span>
                    {settings.showSessionStats && status === "matched" && (
                      <span className="flex items-center gap-1">
                        <Clock size={14} />
                        {formatClock(sessionSeconds)}
                      </span>
                    )}
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                {sharedInterests.map((interest) => (
                  <span
                    key={interest}
                    className="rounded-full bg-blue-100 px-3 py-1 text-sm font-black text-blue-700"
                  >
                    #{interest}
                  </span>
                ))}
              </div>
            </div>
          </div>

          {matchedMode === "video" && livekitToken && livekitRoom && (
            <section className={`overflow-hidden rounded-[2rem] border shadow-xl ${theme.card}`}>
              <LiveKitRoom
                token={livekitToken}
                serverUrl={import.meta.env.VITE_LIVEKIT_URL}
                connect={true}
                video={true}
                audio={true}
                data-lk-theme="default"
                className="min-h-[480px]"
              >
                <VideoConference />
                <RoomAudioRenderer />
              </LiveKitRoom>
            </section>
          )}

          {settings.showPromptDeck && (
            <PromptDeck
              prompts={promptDeck}
              copyPrompt={copyPrompt}
              theme={theme}
            />
          )}

          <section className={`overflow-hidden rounded-[2rem] border shadow-xl backdrop-blur-xl ${theme.card}`}>
            <div
              className={cx(
                "overflow-y-auto p-5",
                settings.compactMode ? "h-[340px]" : "h-[520px]"
              )}
            >
              {status === "idle" && (
                <div className={`flex h-full items-center justify-center text-center ${theme.muted}`}>
                  <div>
                    <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-3xl bg-blue-600 text-white">
                      <HeartHandshake />
                    </div>
                    <p className="text-lg font-black">Start a match from the sidebar.</p>
                    <p className="mt-1 text-sm">
                      Add interests first for better matches.
                    </p>
                  </div>
                </div>
              )}

              {status === "waiting" && (
                <div className="flex items-center gap-3 font-black text-blue-600">
                  <Search className="animate-pulse" size={20} />
                  Looking for someone with compatible interests...
                </div>
              )}

              <div className="space-y-3">
                {messages.map((msg, index) => {
                  if (msg.from === "system") {
                    return (
                      <div key={index} className="text-center">
                        <span className={`inline-flex rounded-full px-3 py-1 text-sm font-bold ${isDark ? "bg-blue-950 text-blue-300" : "bg-blue-50 text-blue-700"}`}>
                          {msg.text}
                        </span>
                      </div>
                    );
                  }

                  const isMe = msg.from === "me";
                  const isModerator = msg.user?.role === "moderator";

                  return (
                    <div key={index} className={cx("flex", isMe ? "justify-end" : "justify-start")}>
                      <div
                        className={cx(
                          "max-w-[82%] rounded-3xl px-4 py-3 shadow-sm",
                          isMe
                            ? "rounded-br-md bg-blue-600 text-white"
                            : isDark
                              ? "rounded-bl-md bg-zinc-800 text-zinc-100"
                              : "rounded-bl-md bg-slate-100 text-slate-900"
                        )}
                      >
                        <p className="mb-1 flex items-center gap-1 text-xs font-black opacity-80">
                          {isMe ? currentUser.username : msg.user?.username || "Stranger"}
                          {isModerator && <ShieldCheck size={13} />}
                        </p>
                        <p>{msg.text}</p>
                      </div>
                    </div>
                  );
                })}

                {strangerTyping && (
                  <p className={`flex items-center gap-2 italic ${theme.muted}`}>
                    <Keyboard size={14} />
                    Stranger is typing...
                  </p>
                )}

                <div ref={bottomRef} />
              </div>
            </div>

            {status === "matched" && (
              <div className={`border-t p-3 ${isDark ? "border-zinc-800 bg-zinc-950" : "border-slate-200 bg-slate-50"}`}>
                <div className="grid gap-2 md:grid-cols-[1fr_auto]">
                  <div className="flex flex-wrap gap-2">
                    {reportTemplates.map((template) => (
                      <button
                        key={template}
                        onClick={() => setReportReason(template)}
                        className={`rounded-full border px-3 py-1 text-xs font-bold ${isDark ? "border-zinc-700" : "border-slate-200"}`}
                      >
                        {template}
                      </button>
                    ))}
                  </div>

                  <div className="flex gap-2">
                    <input
                      value={reportReason}
                      onChange={(e) => setReportReason(e.target.value)}
                      placeholder="Report reason..."
                      className={`min-w-0 flex-1 rounded-2xl border px-4 py-2 outline-none md:w-72 ${theme.input}`}
                    />

                    <button
                      onClick={submitReport}
                      className="flex items-center gap-2 rounded-2xl bg-red-600 px-4 py-2 font-bold text-white"
                    >
                      <Flag size={16} />
                      Report
                    </button>
                  </div>
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
              className={`flex gap-2 border-t p-3 ${isDark ? "border-zinc-800 bg-zinc-950" : "border-slate-200 bg-white"}`}
            >
              <input
                value={input}
                onChange={handleInputChange}
                disabled={status !== "matched"}
                placeholder={status === "matched" ? "Type your message..." : "Match with someone to chat"}
                className={`flex-1 rounded-2xl border px-4 py-3 outline-none disabled:opacity-50 ${theme.input}`}
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

function ProfileCard({
  user,
  onlineCount,
  matchCount,
  theme,
}: {
  user: PublicUser;
  onlineCount: number;
  matchCount: number;
  theme: {
    inner: string;
    muted: string;
  };
}) {
  return (
    <div className={`rounded-3xl border p-4 ${theme.inner}`}>
      <div className="flex items-center gap-3">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-600 text-white">
          <User />
        </div>

        <div>
          <p className="font-black">{user.username}</p>
          <p className={`flex items-center gap-1 text-sm ${theme.muted}`}>
            {user.role === "moderator" && <ShieldCheck size={14} />}
            {user.role}
          </p>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2">
        <div className="rounded-2xl bg-blue-600/10 p-3">
          <p className="text-xl font-black">{onlineCount}</p>
          <p className={`text-xs font-bold ${theme.muted}`}>Online</p>
        </div>

        <div className="rounded-2xl bg-orange-500/10 p-3">
          <p className="text-xl font-black">{matchCount}</p>
          <p className={`text-xs font-bold ${theme.muted}`}>Matches</p>
        </div>
      </div>
    </div>
  );
}

function PromptDeck({
  prompts,
  copyPrompt,
  theme,
}: {
  prompts: string[];
  copyPrompt: (prompt: string) => void;
  theme: {
    card: string;
    muted: string;
  };
}) {
  return (
    <section className={`rounded-[2rem] border p-4 shadow-xl backdrop-blur-xl ${theme.card}`}>
      <div className="mb-3 flex items-center justify-between">
        <h2 className="flex items-center gap-2 font-black">
          <Wand2 size={18} />
          Icebreakers
        </h2>
        <p className={`text-xs font-bold ${theme.muted}`}>Click to copy</p>
      </div>

      <div className="grid gap-2 md:grid-cols-5">
        {prompts.map((prompt) => (
          <button
            key={prompt}
            onClick={() => copyPrompt(prompt)}
            className="rounded-2xl border border-blue-100 bg-blue-50 px-3 py-2 text-left text-xs font-bold text-blue-800 transition hover:bg-blue-100"
          >
            <Copy size={13} className="mb-1" />
            {prompt}
          </button>
        ))}
      </div>
    </section>
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
          className={cx(
            "min-w-[300px] rounded-2xl border px-4 py-3 shadow-2xl",
            isDark ? "border-zinc-700 bg-zinc-900" : "border-white bg-white"
          )}
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
  const panelClass = isDark
    ? "border-zinc-700 bg-zinc-900 text-zinc-100"
    : "border-white bg-white text-slate-950";

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
      <section className={`w-full max-w-lg rounded-[2rem] border p-6 shadow-2xl ${panelClass}`}>
        <div className="mb-5 flex items-center justify-between">
          <div>
            <h2 className="flex items-center gap-2 text-2xl font-black">
              <SlidersHorizontal />
              Site Settings
            </h2>
            <p className="text-sm opacity-60">Personalize the experience.</p>
          </div>

          <button onClick={onClose}>
            <X />
          </button>
        </div>

        <div className="space-y-3">
          <button
            onClick={() =>
              setSettings((prev) => ({
                ...prev,
                theme: prev.theme === "light" ? "dark" : "light",
              }))
            }
            className="flex w-full items-center justify-between rounded-2xl border p-4 font-bold"
          >
            Theme
            <span className="flex items-center gap-2">
              {settings.theme === "light" ? <Sun size={18} /> : <Moon size={18} />}
              {settings.theme}
            </span>
          </button>

          {[
            ["Compact chat height", "compactMode"],
            ["Focus mode", "focusMode"],
            ["Safety notice", "showSafetyNotice"],
            ["Icebreaker prompts", "showPromptDeck"],
            ["Session stats", "showSessionStats"],
          ].map(([label, key]) => (
            <label
              key={key}
              className="flex cursor-pointer items-center justify-between rounded-2xl border p-4 font-bold"
            >
              {label}
              <input
                type="checkbox"
                checked={Boolean(settings[key as keyof SiteSettings])}
                onChange={(e) =>
                  setSettings((prev) => ({
                    ...prev,
                    [key]: e.target.checked,
                  }))
                }
              />
            </label>
          ))}
        </div>

        <div className="mt-5 rounded-2xl border border-blue-200 bg-blue-50 p-4 text-sm font-bold text-blue-800">
          <LockKeyhole size={16} className="mr-1 inline" />
          Settings are saved locally on this device.
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
    <section
      className={cx(
        "rounded-[2rem] border p-4 shadow-xl",
        isDark ? "border-indigo-900 bg-zinc-950" : "border-indigo-200 bg-white"
      )}
    >
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
        <div className="grid gap-3">
          {reports.map((report) => {
            const expanded = expandedReportId === report.id;

            return (
              <div
                key={report.id}
                className={cx(
                  "rounded-3xl border p-4",
                  isDark ? "border-zinc-800 bg-zinc-900" : "border-slate-200 bg-slate-50"
                )}
              >
                <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                  <div>
                    <p className="font-black text-red-600">
                      Reported: {report.reported.username}
                    </p>
                    <p>Reporter: {report.reporter.username}</p>
                    <p className="mt-1">
                      <span className="font-black">Reason:</span> {report.reason}
                    </p>
                    <p className="mt-1 text-xs opacity-60">
                      Status: {report.status}
                    </p>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <button
                      onClick={() => setExpandedReportId(expanded ? null : report.id)}
                      className="rounded-xl border px-3 py-2 font-bold"
                    >
                      <Eye size={15} className="mr-1 inline" />
                      Snippet
                    </button>

                    <button
                      onClick={() => markReviewed(report.id)}
                      className="rounded-xl bg-green-600 px-3 py-2 font-bold text-white"
                    >
                      <CheckCircle size={15} className="mr-1 inline" />
                      Reviewed
                    </button>

                    <button
                      onClick={() =>
                        moderateUser(report.reported.id, "warn", report.reason)
                      }
                      className="rounded-xl bg-yellow-500 px-3 py-2 font-bold text-white"
                    >
                      <Megaphone size={15} className="mr-1 inline" />
                      Warn
                    </button>

                    <button
                      onClick={() =>
                        moderateUser(report.reported.id, "ban", report.reason)
                      }
                      className="rounded-xl bg-red-600 px-3 py-2 font-bold text-white"
                    >
                      <Ban size={15} className="mr-1 inline" />
                      Ban
                    </button>
                  </div>
                </div>

                {expanded && (
                  <div
                    className={cx(
                      "mt-3 rounded-2xl border p-3",
                      isDark ? "border-zinc-700 bg-zinc-950" : "border-slate-200 bg-white"
                    )}
                  >
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