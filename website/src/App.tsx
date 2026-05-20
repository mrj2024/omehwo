import { useEffect, useRef, useState } from "react";
import type { Session } from "@supabase/supabase-js";
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
} from "lucide-react";

const socket: Socket = io(import.meta.env.VITE_SOCKET_URL, {
  transports: ["websocket", "polling"],
});

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
  const [, setSession] = useState<Session | null>(null);
  const [currentUser, setCurrentUser] = useState<PublicUser | null>(null);

  const [authMode, setAuthMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [status, setStatus] = useState<Status>("idle");
  const [, setMode] = useState<SearchMode>("chat");
  const [matchedMode, setMatchedMode] = useState<SearchMode | null>(null);

  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");

  const [onlineCount, setOnlineCount] = useState(0);
  const [strangerTyping, setStrangerTyping] = useState(false);

  const [interestInput, setInterestInput] = useState("");
  const [, setInterests] = useState<string[]>([]);
  const [sharedInterests, setSharedInterests] = useState<string[]>([]);

  const [reportReason, setReportReason] = useState("");
  const [reportStatus, setReportStatus] = useState("");

  const [showModPanel, setShowModPanel] = useState(false);
  const [reports, setReports] = useState<Report[]>([]);
  const [expandedReportId, setExpandedReportId] = useState<string | null>(null);

  const [notifications, setNotifications] = useState<Notification[]>([]);

  const [livekitToken, setLivekitToken] = useState<string | null>(null);
  const [livekitRoom, setLivekitRoom] = useState<string | null>(null);

  const bottomRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    async function initAuth() {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      setSession(session);

      if (session?.access_token) {
        serverLogin(session.access_token);
      }
    }

    initAuth();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);

      if (newSession?.access_token) {
        serverLogin(newSession.access_token);
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

    socket.on("banned", async () => {
      await supabase.auth.signOut();

      setCurrentUser(null);
      setSession(null);
      setStatus("idle");
      setMatchedMode(null);
      setLivekitToken(null);
      setLivekitRoom(null);

      setMessages([
        {
          from: "system",
          text: "You were banned by a moderator.",
        },
      ]);
    });

    socket.on("waiting", ({ mode }: { mode: SearchMode }) => {
      setStatus("waiting");
      setMatchedMode(mode);
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
        setMatchedMode(mode);
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

    socket.on(
      "receive-message",
      (payload: { text: string; user: PublicUser }) => {
        setStrangerTyping(false);

        setMessages((prev) => [
          ...prev,
          {
            from: "stranger",
            text: payload.text,
            user: payload.user,
          },
        ]);
      }
    );

    socket.on("stranger-typing", () => {
      setStrangerTyping(true);

      setTimeout(() => {
        setStrangerTyping(false);
      }, 1000);
    });

    socket.on("partner-left", () => {
      setStatus("idle");
      setMatchedMode(null);
      setLivekitToken(null);
      setLivekitRoom(null);

      setMessages((prev) => [
        ...prev,
        {
          from: "system",
          text: "Stranger disconnected.",
        },
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
  }, [messages]);

  async function serverLogin(accessToken: string) {
    socket.emit(
      "auth-login",
      accessToken,
      (
        response: {
          success: boolean;
          user?: PublicUser;
          error?: string;
        }
      ) => {
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
    if (authMode === "register") {
      const { data, error } = await supabase.auth.signUp({
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
    setSession(null);
    setStatus("idle");
    setMessages([]);
    setShowModPanel(false);
    setReports([]);
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

  function parseInterests() {
    return interestInput
      .split(",")
      .map((interest) => interest.trim().toLowerCase())
      .filter(Boolean)
      .slice(0, 8);
  }

  function startSearch(selectedMode: SearchMode) {
    const parsedInterests = parseInterests();

    setInterests(parsedInterests);
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

    setStatus("idle");
    setMatchedMode(null);
    setMessages([]);
    setSharedInterests([]);
    setLivekitToken(null);
    setLivekitRoom(null);
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
      (
        response: {
          success: boolean;
          reports?: Report[];
          error?: string;
        }
      ) => {
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

  function moderateUser(
    targetUserId: string,
    action: "warn" | "ban",
    reason: string
  ) {
    socket.emit(
      "moderation-action",
      {
        targetUserId,
        action,
        reason,
      },
      (response: { success: boolean; error?: string }) => {
        if (!response.success) {
          addNotification("error", response.error || "Action failed.");
          return;
        }

        addNotification(
          "success",
          action === "ban" ? "User banned." : "User warned."
        );
      }
    );
  }

  const unreadReports = reports.filter(
    (report) => report.status === "open"
  ).length;

  if (!currentUser) {
    return (
      <main className="min-h-screen bg-[#f3f3f3] flex items-center justify-center px-4">
        <div className="w-full max-w-md bg-white border border-gray-300 rounded p-6 shadow-sm">
          <h1 className="text-4xl font-bold">
            Ome<span className="text-orange-500">Clone</span>
          </h1>

          <div className="mt-6 flex gap-2">
            <button
              onClick={() => setAuthMode("login")}
              className={`flex-1 py-2 rounded font-bold ${
                authMode === "login" ? "bg-blue-600 text-white" : "border"
              }`}
            >
              Login
            </button>

            <button
              onClick={() => setAuthMode("register")}
              className={`flex-1 py-2 rounded font-bold ${
                authMode === "register" ? "bg-orange-500 text-white" : "border"
              }`}
            >
              Register
            </button>
          </div>

          <div className="mt-5 space-y-3">
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Email"
              className="w-full border px-3 py-2"
            />

            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Password"
              className="w-full border px-3 py-2"
            />

            <button
              onClick={handleAuth}
              className="w-full bg-blue-600 text-white font-bold py-2 rounded"
            >
              {authMode === "login" ? "Login" : "Create Account"}
            </button>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#f3f3f3] text-black">
      <div className="mx-auto max-w-6xl px-4 py-4">
        <header className="mb-4 border-b pb-3">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h1 className="text-5xl font-bold">
                Ome<span className="text-orange-500">Clone</span>
              </h1>

              <p className="mt-1 flex items-center gap-2 text-sm text-gray-600">
                <Users size={16} />
                {onlineCount} online now
              </p>
            </div>

            <div className="flex items-center gap-2">
              {currentUser.role === "moderator" && (
                <button
                  onClick={() => setShowModPanel((prev) => !prev)}
                  className="relative bg-blue-600 text-white px-3 py-2 rounded font-bold"
                >
                  <ShieldCheck size={16} className="inline mr-1" />
                  Mod Panel

                  {unreadReports > 0 && (
                    <span className="absolute -top-2 -right-2 bg-red-600 rounded-full px-2 text-xs">
                      {unreadReports}
                    </span>
                  )}
                </button>
              )}

              <div className="bg-white border rounded px-3 py-2 flex items-center gap-2">
                <User size={18} />

                <span className="font-bold">{currentUser.username}</span>

                {currentUser.role === "moderator" && (
                  <ShieldCheck size={18} className="text-blue-600" />
                )}

                <button
                  onClick={logout}
                  className="ml-2 border px-3 py-1 rounded text-sm"
                >
                  Logout
                </button>
              </div>
            </div>
          </div>
        </header>

        <section className="mb-4 bg-white border rounded p-4">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div className="flex-1">
              <label className="text-sm font-bold flex items-center gap-2 mb-2">
                <Tags size={16} />
                Interests
              </label>

              <input
                value={interestInput}
                onChange={(e) => setInterestInput(e.target.value)}
                placeholder="gaming, music, football..."
                className="w-full border px-3 py-2"
              />
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => startSearch("chat")}
                className="bg-blue-600 text-white px-4 py-2 rounded font-bold flex items-center gap-2"
              >
                <MessageCircle size={18} />
                Text
              </button>

              <button
                onClick={() => startSearch("video")}
                className="bg-orange-500 text-white px-4 py-2 rounded font-bold flex items-center gap-2"
              >
                <Video size={18} />
                Video
              </button>

              <button
                onClick={stopChat}
                className="border px-4 py-2 rounded flex items-center gap-2"
              >
                <Shuffle size={18} />
                Next
              </button>
            </div>
          </div>

          {sharedInterests.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-2">
              {sharedInterests.map((interest) => (
                <span
                  key={interest}
                  className="bg-blue-100 text-blue-700 px-3 py-1 rounded-full text-sm font-bold"
                >
                  #{interest}
                </span>
              ))}
            </div>
          )}
        </section>

        {matchedMode === "video" && livekitToken && livekitRoom && (
          <section className="mb-4 rounded border bg-white p-2">
            <LiveKitRoom
              token={livekitToken}
              serverUrl={import.meta.env.VITE_LIVEKIT_URL}
              connect={true}
              video={true}
              audio={true}
              data-lk-theme="default"
              className="min-h-[420px]"
            >
              <VideoConference />
              <RoomAudioRenderer />
            </LiveKitRoom>
          </section>
        )}

        <section className="bg-white border rounded shadow-sm">
          <div className="h-[420px] overflow-y-auto p-3">
            {status === "idle" && (
              <p className="text-gray-500">Start chatting with a stranger.</p>
            )}

            {status === "waiting" && (
              <p className="font-bold text-blue-600 flex items-center gap-2">
                <Search size={18} className="animate-pulse" />
                Looking for someone...
              </p>
            )}

            <div className="space-y-1">
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
                    <span
                      className={
                        msg.from === "me"
                          ? "font-bold text-red-600"
                          : "font-bold text-blue-600"
                      }
                    >
                      {msg.from === "me"
                        ? `${currentUser.username}: `
                        : `${msg.user?.username}: `}
                    </span>

                    {isModerator && (
                      <ShieldCheck
                        size={14}
                        className="inline mr-1 text-blue-600"
                      />
                    )}

                    {msg.text}
                  </p>
                );
              })}

              {strangerTyping && (
                <p className="italic text-gray-500 flex items-center gap-2">
                  <Keyboard size={14} />
                  Stranger is typing...
                </p>
              )}

              <div ref={bottomRef} />
            </div>
          </div>

          {status === "matched" && (
            <div className="border-t bg-yellow-50 p-2">
              <div className="flex gap-2">
                <input
                  value={reportReason}
                  onChange={(e) => setReportReason(e.target.value)}
                  placeholder="Report reason..."
                  className="flex-1 border px-3 py-2"
                />

                <button
                  onClick={submitReport}
                  className="bg-red-600 text-white px-4 py-2 rounded font-bold"
                >
                  <Flag size={16} className="inline mr-1" />
                  Report
                </button>
              </div>

              {reportStatus && (
                <p className="mt-1 text-red-700 text-sm font-bold">
                  <AlertTriangle size={14} className="inline mr-1" />
                  {reportStatus}
                </p>
              )}
            </div>
          )}

          <form
            onSubmit={sendMessage}
            className="flex gap-2 border-t bg-gray-100 p-2"
          >
            <input
              value={input}
              onChange={handleInputChange}
              disabled={status !== "matched"}
              placeholder="Type here..."
              className="flex-1 border px-3 py-2"
            />

            <button
              type="submit"
              disabled={status !== "matched"}
              className="bg-blue-600 text-white px-5 py-2 rounded font-bold flex items-center gap-2"
            >
              <Send size={16} />
              Send
            </button>
          </form>
        </section>

        {showModPanel && currentUser.role === "moderator" && (
          <section className="mt-4 bg-white border border-blue-300 rounded p-4">
            <div className="flex justify-between items-center mb-3">
              <h2 className="font-bold text-xl text-blue-700">
                Moderator Panel
              </h2>

              <button
                onClick={clearReports}
                className="border px-3 py-2 rounded text-sm"
              >
                <Trash2 size={16} className="inline mr-1" />
                Clear Reports
              </button>
            </div>

            <div className="space-y-2">
              {reports.map((report) => {
                const expanded = expandedReportId === report.id;

                return (
                  <div key={report.id} className="border rounded p-3 bg-gray-50">
                    <div className="flex flex-col gap-2 md:flex-row md:justify-between">
                      <div>
                        <p className="font-bold text-red-600">
                          Reported: {report.reported.username}
                        </p>

                        <p>Reporter: {report.reporter.username}</p>

                        <p className="mt-1">
                          <span className="font-bold">Reason:</span>{" "}
                          {report.reason}
                        </p>
                      </div>

                      <div className="flex flex-wrap gap-2">
                        <button
                          onClick={() =>
                            setExpandedReportId(expanded ? null : report.id)
                          }
                          className="border px-3 py-1 rounded"
                        >
                          <Eye size={15} className="inline mr-1" />
                          Snippet
                        </button>

                        <button
                          onClick={() => markReviewed(report.id)}
                          className="bg-green-600 text-white px-3 py-1 rounded"
                        >
                          <CheckCircle size={15} className="inline mr-1" />
                          Reviewed
                        </button>

                        <button
                          onClick={() =>
                            moderateUser(
                              report.reported.id,
                              "warn",
                              report.reason
                            )
                          }
                          className="bg-yellow-500 text-white px-3 py-1 rounded"
                        >
                          <Megaphone size={15} className="inline mr-1" />
                          Warn
                        </button>

                        <button
                          onClick={() =>
                            moderateUser(
                              report.reported.id,
                              "ban",
                              report.reason
                            )
                          }
                          className="bg-red-600 text-white px-3 py-1 rounded"
                        >
                          <Ban size={15} className="inline mr-1" />
                          Ban
                        </button>
                      </div>
                    </div>

                    {expanded && (
                      <div className="mt-3 bg-white border rounded p-3">
                        <p className="font-bold mb-2">Chat Snippet</p>

                        {report.snippet.map((msg, index) => (
                          <p key={index}>
                            <span className="font-bold">
                              {msg.from.username}:
                            </span>{" "}
                            {msg.text}
                          </p>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </section>
        )}

        <div className="fixed right-4 top-4 space-y-2 z-50">
          {notifications.map((notification) => (
            <div
              key={notification.id}
              className="bg-white border rounded shadow-lg px-4 py-3 min-w-[280px]"
            >
              <div className="flex justify-between gap-3">
                <div>
                  <p className="font-bold text-sm flex items-center gap-2">
                    <Bell size={15} />
                    {notification.message}
                  </p>
                </div>

                <button onClick={() => removeNotification(notification.id)}>
                  <X size={15} />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}