import {
  MessageCircle,
  Video,
  RefreshCcw,
  Settings,
  LogOut,
  ShieldCheck,
  Tags,
  User,
  Users,
} from "lucide-react";
import type { Mood, PublicUser } from "../../types/app";
import { Button } from "../ui/Button";

type Props = {
  user: PublicUser;
  isDark: boolean;
  onlineCount: number;
  matchCount: number;
  interestInput: string;
  mood: Mood;
  unreadReports: number;
  showModPanel: boolean;
  setInterestInput: (value: string) => void;
  setMood: (value: Mood) => void;
  startSearch: (mode: "chat" | "video") => void;
  stopChat: () => void;
  logout: () => void;
  openSettings: () => void;
  toggleModPanel: () => void;
};

const moods: Mood[] = ["chill", "funny", "deep", "gaming", "music", "advice"];

export function Sidebar({
  user,
  isDark,
  onlineCount,
  matchCount,
  interestInput,
  mood,
  unreadReports,
  setInterestInput,
  setMood,
  startSearch,
  stopChat,
  logout,
  openSettings,
  toggleModPanel,
}: Props) {
  return (
    <aside
      className={`rounded-[2rem] border p-4 shadow-xl ${
        isDark
          ? "border-zinc-800 bg-zinc-950"
          : "border-white bg-white"
      }`}
    >
      <div className="mb-6">
        <h1 className="text-3xl font-black">
          Ome<span className="text-orange-500">Clone</span>
        </h1>
        <p className={isDark ? "text-sm text-zinc-400" : "text-sm text-slate-500"}>
          Stranger chat, rebuilt.
        </p>
      </div>

      <div
        className={`mb-4 rounded-3xl border p-4 ${
          isDark
            ? "border-zinc-800 bg-zinc-900"
            : "border-slate-200 bg-slate-50"
        }`}
      >
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-600 text-white">
            <User />
          </div>

          <div>
            <p className="font-black">{user.username}</p>
            <p className="flex items-center gap-1 text-sm opacity-60">
              {user.role === "moderator" && <ShieldCheck size={14} />}
              {user.role}
            </p>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-2">
          <div className="rounded-2xl bg-blue-600/10 p-3">
            <p className="text-xl font-black">{onlineCount}</p>
            <p className="flex items-center gap-1 text-xs font-bold opacity-60">
              <Users size={13} />
              Online
            </p>
          </div>

          <div className="rounded-2xl bg-orange-500/10 p-3">
            <p className="text-xl font-black">{matchCount}</p>
            <p className="text-xs font-bold opacity-60">Matches</p>
          </div>
        </div>
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
            ? "border-zinc-700 bg-zinc-900 text-white"
            : "border-slate-200 bg-white"
        }`}
      />

      <label className="mb-2 block text-sm font-black">Mood</label>

      <div className="mb-4 grid grid-cols-3 gap-2">
        {moods.map((item) => (
          <button
            key={item}
            onClick={() => setMood(item)}
            className={`rounded-xl border px-2 py-2 text-xs font-black capitalize ${
              mood === item
                ? "border-blue-600 bg-blue-600 text-white"
                : isDark
                ? "border-zinc-700"
                : "border-slate-200"
            }`}
          >
            {item}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-2">
        <Button onClick={() => startSearch("chat")} variant="primary">
          <MessageCircle size={18} />
          Text
        </Button>

        <Button onClick={() => startSearch("video")} variant="orange">
          <Video size={18} />
          Video
        </Button>
      </div>

      <Button onClick={stopChat} className="mt-2 w-full">
        <RefreshCcw size={18} />
        Next / Stop
      </Button>

      {user.role === "moderator" && (
        <button
          onClick={toggleModPanel}
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

      <div className="mt-4 grid grid-cols-2 gap-2">
        <Button onClick={openSettings} className="w-full">
          <Settings size={18} />
          Settings
        </Button>

        <Button onClick={logout} className="w-full">
          <LogOut size={18} />
          Logout
        </Button>
      </div>
    </aside>
  );
}