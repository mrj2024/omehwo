export type SearchMode = "chat" | "video";
export type Status = "idle" | "waiting" | "matched";
export type Role = "user" | "moderator";
export type ThemeMode = "light" | "dark";
export type Mood = "chill" | "funny" | "deep" | "gaming" | "music" | "advice";

export type PublicUser = {
  id: string;
  username: string;
  role: Role;
};

export type Message = {
  from: "me" | "stranger" | "system";
  text: string;
  user?: PublicUser;
};

export type ChatMessage = {
  from: PublicUser;
  text: string;
  createdAt: string;
};

export type Report = {
  id: string;
  reporter: PublicUser;
  reported: PublicUser;
  reason: string;
  snippet: ChatMessage[];
  status: "open" | "reviewed";
  createdAt: string;
};

export type SiteSettings = {
  theme: ThemeMode;
  compactMode: boolean;
  showPrompts: boolean;
  showSafetyNotice: boolean;
};