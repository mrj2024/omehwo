import { useEffect, useState } from "react";
import type { PublicUser, SearchMode } from "../types/app";

export type MatchHistoryItem = {
  id: string;
  username: string;
  role: PublicUser["role"];
  mode: SearchMode;
  interests: string[];
  favorited: boolean;
  createdAt: string;
};

const STORAGE_KEY = "omeclone-match-history";

export function useMatchHistory() {
  const [history, setHistory] = useState<MatchHistoryItem[]>(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved ? JSON.parse(saved) : [];
  });

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(history));
  }, [history]);

  function addMatch(user: PublicUser, mode: SearchMode, interests: string[]) {
    setHistory((prev) => [
      {
        id: crypto.randomUUID(),
        username: user.username,
        role: user.role,
        mode,
        interests,
        favorited: false,
        createdAt: new Date().toISOString(),
      },
      ...prev.slice(0, 19),
    ]);
  }

  function toggleFavorite(id: string) {
    setHistory((prev) =>
      prev.map((item) =>
        item.id === id ? { ...item, favorited: !item.favorited } : item
      )
    );
  }

  function clearHistory() {
    setHistory([]);
  }

  return {
    history,
    addMatch,
    toggleFavorite,
    clearHistory,
  };
}