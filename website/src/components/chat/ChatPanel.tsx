import {
  AlertTriangle,
  Flag,
  Keyboard,
  Search,
  Send,
  ShieldCheck,
  Wand2,
  Copy,
  MessageCircle,
} from "lucide-react";
import type { Message, PublicUser, SearchMode, Status } from "../../types/app";

type Props = {
  currentUser: PublicUser;
  isDark: boolean;
  status: Status;
  matchedMode: SearchMode | null;
  stranger: PublicUser | null;
  messages: Message[];
  input: string;
  strangerTyping: boolean;
  reportReason: string;
  reportStatus: string;
  sharedInterests: string[];
  bottomRef: React.RefObject<HTMLDivElement | null>;
  compactMode: boolean;
  showPrompts: boolean;
  setInput: (value: string) => void;
  setReportReason: (value: string) => void;
  sendMessage: (e: React.FormEvent<HTMLFormElement>) => void;
  handleInputChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  submitReport: () => void;
};

const prompts = [
  "What song are you obsessed with right now?",
  "What’s your most harmless controversial opinion?",
  "What’s underrated where you live?",
  "What would you do with a free weekend?",
];

const reportTemplates = [
  "Harassment",
  "Spam/scam",
  "Sexual content",
  "Hate speech",
  "Threatening behaviour",
];

export function ChatPanel({
  currentUser,
  isDark,
  status,
  matchedMode,
  stranger,
  messages,
  input,
  strangerTyping,
  reportReason,
  reportStatus,
  sharedInterests,
  bottomRef,
  compactMode,
  showPrompts,
  setInput,
  setReportReason,
  sendMessage,
  handleInputChange,
  submitReport,
}: Props) {
  return (
    <div className="space-y-4">
      <section
        className={`rounded-[2rem] border p-4 shadow-xl ${
          isDark ? "border-zinc-800 bg-zinc-950" : "border-white bg-white"
        }`}
      >
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-xl font-black">
              {status === "idle" && "Ready to connect"}
              {status === "waiting" && "Searching..."}
              {status === "matched" && `Connected to ${stranger?.username || "a stranger"}`}
            </p>

            <p className="text-sm opacity-60">Mode: {matchedMode || "none"}</p>
          </div>

          {sharedInterests.length > 0 && (
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
          )}
        </div>
      </section>

      {showPrompts && (
        <section
          className={`rounded-[2rem] border p-4 shadow-xl ${
            isDark ? "border-zinc-800 bg-zinc-950" : "border-white bg-white"
          }`}
        >
          <div className="mb-3 flex items-center gap-2 font-black">
            <Wand2 size={18} />
            Icebreakers
          </div>

          <div className="grid gap-2 md:grid-cols-4">
            {prompts.map((prompt) => (
              <button
                key={prompt}
                onClick={() => setInput(prompt)}
                className="rounded-2xl border border-blue-100 bg-blue-50 px-3 py-2 text-left text-xs font-bold text-blue-800 hover:bg-blue-100"
              >
                <Copy size={13} className="mb-1" />
                {prompt}
              </button>
            ))}
          </div>
        </section>
      )}

      <section
        className={`overflow-hidden rounded-[2rem] border shadow-xl ${
          isDark ? "border-zinc-800 bg-zinc-950" : "border-white bg-white"
        }`}
      >
        <div className={`${compactMode ? "h-[340px]" : "h-[520px]"} overflow-y-auto p-5`}>
          {status === "idle" && (
            <div className="flex h-full items-center justify-center text-center opacity-60">
              <div>
                <MessageCircle className="mx-auto mb-3" size={42} />
                <p className="font-black">Choose Text or Video to start.</p>
              </div>
            </div>
          )}

          {status === "waiting" && (
            <p className="flex items-center gap-2 font-black text-blue-600">
              <Search className="animate-pulse" size={18} />
              Looking for someone...
            </p>
          )}

          <div className="space-y-3">
            {messages.map((msg, index) => {
              if (msg.from === "system") {
                return (
                  <div key={index} className="text-center">
                    <span className="inline-flex rounded-full bg-blue-50 px-3 py-1 text-sm font-bold text-blue-700">
                      {msg.text}
                    </span>
                  </div>
                );
              }

              const isMe = msg.from === "me";
              const isModerator = msg.user?.role === "moderator";

              return (
                <div key={index} className={`flex ${isMe ? "justify-end" : "justify-start"}`}>
                  <div
                    className={`max-w-[82%] rounded-3xl px-4 py-3 shadow-sm ${
                      isMe
                        ? "rounded-br-md bg-blue-600 text-white"
                        : isDark
                        ? "rounded-bl-md bg-zinc-800"
                        : "rounded-bl-md bg-slate-100"
                    }`}
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
              <p className="flex items-center gap-2 italic opacity-60">
                <Keyboard size={14} />
                Stranger is typing...
              </p>
            )}

            <div ref={bottomRef} />
          </div>
        </div>

        {status === "matched" && (
          <div
            className={`border-t p-3 ${
              isDark ? "border-zinc-800 bg-zinc-900" : "border-slate-200 bg-slate-50"
            }`}
          >
            <div className="mb-2 flex flex-wrap gap-2">
              {reportTemplates.map((template) => (
                <button
                  key={template}
                  onClick={() => setReportReason(template)}
                  className="rounded-full border px-3 py-1 text-xs font-bold"
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
                className={`flex-1 rounded-2xl border px-4 py-2 outline-none ${
                  isDark ? "border-zinc-700 bg-zinc-950" : "border-slate-200 bg-white"
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
          className={`flex gap-2 border-t p-3 ${
            isDark ? "border-zinc-800 bg-zinc-900" : "border-slate-200 bg-white"
          }`}
        >
          <input
            value={input}
            onChange={handleInputChange}
            disabled={status !== "matched"}
            placeholder={status === "matched" ? "Type your message..." : "Match with someone to chat"}
            className={`flex-1 rounded-2xl border px-4 py-3 outline-none disabled:opacity-50 ${
              isDark ? "border-zinc-700 bg-zinc-950" : "border-slate-200 bg-white"
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
    </div>
  );
}