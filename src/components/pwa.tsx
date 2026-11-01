"use client";

import { Bell, Download, X } from "lucide-react";
import { useEffect, useState } from "react";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
};

export function PwaAppControls() {
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isIOS, setIsIOS] = useState(false);
  const [notificationPermission, setNotificationPermission] = useState<NotificationPermission | "unsupported">("default");
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    const isAppleIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
    setIsIOS(isAppleIOS);
    if ("Notification" in window) setNotificationPermission(Notification.permission);
    else setNotificationPermission("unsupported");

    const handleBeforeInstallPrompt = (event: Event) => {
      event.preventDefault();
      setInstallPrompt(event as BeforeInstallPromptEvent);
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);

    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => undefined);
    }

    return () => window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
  }, []);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 3200);
    return () => window.clearTimeout(timer);
  }, [toast]);

  async function handleInstall() {
    if (installPrompt) {
      installPrompt.prompt();
      const result = await installPrompt.userChoice;
      if (result.outcome === "accepted") setToast("D_clutr was added to your device.");
      else setToast("Install was dismissed.");
      setInstallPrompt(null);
      return;
    }

    if (isIOS) {
      setToast("Tap the Share button, then Add to Home Screen.");
      return;
    }

    setToast("This device is not eligible for an install prompt right now.");
  }

  async function handleNotifications() {
    if (!("Notification" in window)) {
      setToast("Browser notifications are not supported here.");
      return;
    }

    if (Notification.permission === "granted") {
      setNotificationPermission("granted");
      new Notification("D_clutr alert", {
        body: "You are now receiving updates on this device.",
        icon: "/icon.svg",
      });
      setToast("Browser alerts are enabled.");
      return;
    }

    const permission = await Notification.requestPermission();
    setNotificationPermission(permission);

    if (permission === "granted") {
      new Notification("D_clutr alert", {
        body: "You are now receiving updates on this device.",
        icon: "/icon.svg",
      });
      setToast("Browser alerts are enabled.");
      return;
    }

    setToast("Browser notifications were not allowed.");
  }

  return (
    <>
      {toast && (
        <div className="pwa-toast" role="status" aria-live="polite">
          <span>{toast}</span>
          <button type="button" aria-label="Dismiss notification" onClick={() => setToast(null)}>
            <X size={14} />
          </button>
        </div>
      )}
      <div className="pwa-toolbar">
        <button type="button" className="pwa-action" onClick={handleNotifications} aria-label="Enable browser alerts" title="Enable browser alerts">
          <Bell size={15} />
          <span className="pwa-action-label">{notificationPermission === "granted" ? "Alerts on" : "Enable alerts"}</span>
        </button>
        <button type="button" className="pwa-action pwa-action-primary" onClick={handleInstall} aria-label={isIOS ? "Install D_clutr on this iPhone" : "Install D_clutr app"} title="Install D_clutr app">
          <Download size={15} />
          <span className="pwa-action-label">{isIOS ? "Install" : "Install app"}</span>
        </button>
      </div>
    </>
  );
}
