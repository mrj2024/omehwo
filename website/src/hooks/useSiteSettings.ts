import { useEffect, useState } from "react";
import type { SiteSettings } from "../types/app";

const defaultSettings: SiteSettings = {
  theme: "light",
  compactMode: false,
  showPrompts: true,
  showSafetyNotice: true,
};

export function useSiteSettings() {
  const [settings, setSettings] = useState<SiteSettings>(() => {
    const saved = localStorage.getItem("omeclone-settings");
    return saved ? { ...defaultSettings, ...JSON.parse(saved) } : defaultSettings;
  });

  useEffect(() => {
    localStorage.setItem("omeclone-settings", JSON.stringify(settings));
  }, [settings]);

  return { settings, setSettings };
}