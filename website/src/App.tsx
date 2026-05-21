import { useEffect, useMemo, useRef, useState } from "react";
import toast from "react-hot-toast";
import confetti from "canvas-confetti";
import { io, Socket } from "socket.io-client";
import { supabase } from "./lib/supabase";

import type {
  Message,
  Mood,
  PublicUser,
  Report,
  SearchMode,
  Status,
} from "./types/app";

import { useSiteSettings } from "./hooks/useSiteSettings";
import { useMatchHistory } from "./hooks/useMatchHistory";
import { useSoundEffects } from "./hooks/useSoundEffects";

import { ToastProvider } from "./components/ui/ToastProvider";
import { AuthScreen } from "./components/layout/AuthScreen";
import { Sidebar } from "./components/layout/Sidebar";
import { ChatPanel } from "./components/chat/ChatPanel";
import { LiveKitVideoPanel } from "./components/video/LiveKitVideoPanel";
import { SettingsModal } from "./components/settings/SettingsModal";
import { ModeratorPanel } from "./components/moderation/ModeratorPanel";
import { AnimatedBackground } from "./components/layout/AnimatedBackground";
import { MatchHistoryPanel } from "./components/chat/MatchHistoryPanel";
import { ReactionBar } from "./components/chat/ReactionBar";
import { ReconnectBanner } from "./components/chat/ReconnectBanner";
import { SafetyPanel } from "./components/settings/SafetyPanel";

const socket: Socket = io(import.meta.env.VITE_SOCKET_URL, {
  transports: ["websocket", "polling"],
});

export default function App() {
  const { settings, setSettings } = useSiteSettings();

  const { history, addMatch, toggleFavorite, clearHistory } =
    useMatchHistory();

  const sounds = useSoundEffects(true);

  const [currentUser, setCurrentUser] = useState<PublicUser | null>(null);

  const [authMode, setAuthMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [status, setStatus] = useState<Status>("idle");
  const [, setMode] = useState<SearchMode>("chat");
  const [matchedMode, setMatchedMode] = useState<SearchMode | null>(null);
  const [stranger, setStranger] = useState<PublicUser | null>(null);

  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");

  const [onlineCount, setOnlineCount] = useState(0);
  const [strangerTyping, setStrangerTyping] = useState(false);

  const [interestInput, setInterestInput] = useState("");
  const [mood, setMood] = useState<Mood>("chill");
  const [sharedInterests, setSharedInterests] = useState<string[]>([]);
  const [matchCount, setMatchCount] = useState(0);

  const [livekitToken, setLivekitToken] = useState<string | null>(null);
  const [livekitRoom, setLivekitRoom] = useState<string | null>(null);

  const [reportReason, setReportReason] = useState("");
  const [reportStatus, setReportStatus] = useState("");

  const [showSettings, setShowSettings] = useState(false);
  const [showModPanel, setShowModPanel] = useState(false);
  const [showReconnect, setShowReconnect] = useState(true);

  const [reports, setReports] = useState<Report[]>([]);
  const [expandedReportId, setExpandedReportId] = useState<string | null>(null);

  const bottomRef = useRef<HTMLDivElement | null>(null);

  const isDark = settings.theme === "dark";

  const parsedInterests = useMemo(() => {
    return interestInput
      .split(",")
      .map((item) => item.trim().toLowerCase())
      .filter(Boolean)
      .slice(0, 8);
  }, [interestInput]);

  const unreadReports = reports.filter(
    (report) => report.status === "open"
  ).length;

  useEffect(() => {
    async function initAuth() {
      const { data } = await supabase.auth.getSession();

      if (data.session?.access_token) {
        serverLogin(data.session.access_token);
      }
    }

    initAuth();

    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.access_token) {
        serverLogin(session.access_token);
      } else {
        setCurrentUser(null);
      }
    });

    return () => data.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    socket.on("online-count", setOnlineCount);

    socket.on(
      "notification",
      (notification: { type: string; message: string }) => {
        if (notification.type === "error") {
          toast.error(notification.message);
        } else if (notification.type === "success") {
          toast.success(notification.message);
        } else {
          toast(notification.message);
        }
      }
    );

    socket.on("banned", async () => {
      await supabase.auth.signOut();

      setCurrentUser(null);
      resetChat();

      setMessages([
        {
          from: "system",
          text: "You were banned by a moderator.",
        },
      ]);

      toast.error("You were banned by a moderator.");
      sounds.playAlert();
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
        setReportStatus("");
        setShowReconnect(true);

        addMatch(stranger, mode, interests || []);
        sounds.playPop();

        confetti({
          particleCount: 80,
          spread: 70,
          origin: { y: 0.7 },
        });

        setMessages([
          {
            from: "system",
            text: `You're now chatting with ${stranger.username}.`,
          },
        ]);

        toast.success("Matched with a stranger.");
      }
    );

    socket.on("receive-message", (payload: { text: string; user: PublicUser }) => {
      setStrangerTyping(false);

      setMessages((prev) => [
        ...prev,
        {
          from: "stranger",
          text: payload.text,
          user: payload.user,
        },
      ]);
    });

    socket.on("stranger-typing", () => {
      setStrangerTyping(true);

      setTimeout(() => {
        setStrangerTyping(false);
      }, 1000);
    });

    socket.on("partner-left", () => {
      resetChat();

      setMessages((prev) => [
        ...prev,
        {
          from: "system",
          text: "Stranger disconnected.",
        },
      ]);

      toast("Stranger disconnected.");
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
  }, [addMatch, sounds]);

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
  }

  function serverLogin(accessToken: string) {
    socket.emit(
      "auth-login",
      accessToken,
      (response: { success: boolean; user?: PublicUser; error?: string }) => {
        if (!response.success || !response.user) {
          toast.error(response.error || "Server login failed.");
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
      toast.error("Enter your email and password.");
      return;
    }

    if (authMode === "register") {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
      });

      if (error) {
        toast.error(error.message);
        return;
      }

      if (data.session?.access_token) {
        serverLogin(data.session.access_token);
      }

      toast.success("Account created.");
      return;
    }

    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      toast.error(error.message);
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
    setMessages([]);
    setReports([]);
    setShowModPanel(false);

    resetChat();
  }

  function startSearch(selectedMode: SearchMode) {
    const interestsWithMood = [...parsedInterests, mood];

    setMode(selectedMode);
    setMatchedMode(selectedMode);
    setMessages([]);
    setSharedInterests([]);
    setLivekitToken(null);
    setLivekitRoom(null);

    socket.emit("find-match", {
      mode: selectedMode,
      interests: interestsWithMood,
    });
  }

  function stopChat() {
    socket.emit("next");

    setMessages([]);

    resetChat();
  }

  function sendMessage(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();

    const trimmed = input.trim();

    if (!trimmed || status !== "matched") return;

    socket.emit("send-message", trimmed);

    sounds.playSend();

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

  function sendReaction(emoji: string) {
    if (status !== "matched") return;

    socket.emit("send-message", emoji);

    sounds.playSend();

    setMessages((prev) => [
      ...prev,
      {
        from: "me",
        text: emoji,
        user: currentUser || undefined,
      },
    ]);
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
        toast.success("Report submitted.");
      }
    );
  }

  function loadReports() {
    socket.emit(
      "get-reports",
      (response: { success: boolean; reports?: Report[]; error?: string }) => {
        if (!response.success) {
          toast.error(response.error || "Could not load reports.");
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
          toast.error(response.error || "Could not clear reports.");
          return;
        }

        setReports([]);
        toast.success("Reports cleared.");
      }
    );
  }

  function markReviewed(reportId: string) {
    socket.emit(
      "mark-report-reviewed",
      reportId,
      (response: { success: boolean; error?: string }) => {
        if (!response.success) {
          toast.error(response.error || "Could not review report.");
          return;
        }

        toast.success("Report reviewed.");
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
          toast.error(response.error || "Action failed.");
          return;
        }

        toast.success(action === "ban" ? "User banned." : "User warned.");
      }
    );
  }

  const pageClass = isDark
    ? "min-h-screen bg-[#0b0f19] text-white"
    : "min-h-screen bg-[#f5f7fb] text-slate-950";

  if (!currentUser) {
    return (
      <>
        <ToastProvider />

        <AuthScreen
          email={email}
          password={password}
          authMode={authMode}
          isDark={isDark}
          setEmail={setEmail}
          setPassword={setPassword}
          setAuthMode={setAuthMode}
          handleAuth={handleAuth}
          setSettings={setSettings}
        />
      </>
    );
  }

  return (
    <main className={pageClass}>
      <ToastProvider />
      <AnimatedBackground isDark={isDark} />

      <div className="mx-auto grid min-h-screen max-w-[1500px] gap-4 p-4 lg:grid-cols-[340px_1fr]">
        <Sidebar
          user={currentUser}
          isDark={isDark}
          onlineCount={onlineCount}
          matchCount={matchCount}
          interestInput={interestInput}
          mood={mood}
          unreadReports={unreadReports}
          showModPanel={showModPanel}
          setInterestInput={setInterestInput}
          setMood={setMood}
          startSearch={startSearch}
          stopChat={stopChat}
          logout={logout}
          openSettings={() => setShowSettings(true)}
          toggleModPanel={() => {
            setShowModPanel((prev) => !prev);
            loadReports();
          }}
        />

        <section className="space-y-4">
          {showReconnect && history.length > 0 && (
            <ReconnectBanner
              lastMatch={history[0]}
              isDark={isDark}
              onDismiss={() => setShowReconnect(false)}
              onReconnect={() => {
                setShowReconnect(false);

                const last = history[0];

                if (last) {
                  startSearch(last.mode);
                }
              }}
            />
          )}

          {matchedMode === "video" && (
            <LiveKitVideoPanel
              token={livekitToken}
              room={livekitRoom}
              isDark={isDark}
            />
          )}

          <ChatPanel
            currentUser={currentUser}
            isDark={isDark}
            status={status}
            matchedMode={matchedMode}
            stranger={stranger}
            messages={messages}
            input={input}
            strangerTyping={strangerTyping}
            reportReason={reportReason}
            reportStatus={reportStatus}
            sharedInterests={sharedInterests}
            bottomRef={bottomRef}
            compactMode={settings.compactMode}
            showPrompts={settings.showPrompts}
            setInput={setInput}
            setReportReason={setReportReason}
            sendMessage={sendMessage}
            handleInputChange={handleInputChange}
            submitReport={submitReport}
          />

          <ReactionBar disabled={status !== "matched"} onReact={sendReaction} />

          <MatchHistoryPanel
            history={history}
            isDark={isDark}
            toggleFavorite={toggleFavorite}
            clearHistory={clearHistory}
          />

          {settings.showSafetyNotice && <SafetyPanel isDark={isDark} />}

          {showModPanel && currentUser.role === "moderator" && (
            <ModeratorPanel
              reports={reports}
              expandedReportId={expandedReportId}
              isDark={isDark}
              setExpandedReportId={setExpandedReportId}
              clearReports={clearReports}
              markReviewed={markReviewed}
              moderateUser={moderateUser}
            />
          )}
        </section>
      </div>

      {showSettings && (
        <SettingsModal
          settings={settings}
          setSettings={setSettings}
          isDark={isDark}
          onClose={() => setShowSettings(false)}
        />
      )}
    </main>
  );
}