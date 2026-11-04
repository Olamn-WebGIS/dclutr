"use client";

import { Bell, Download, RefreshCw, X } from "lucide-react";
import { useEffect, useState } from "react";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
};

export function PwaAppControls() {
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isIOS, setIsIOS] = useState(false);
  const [installState, setInstallState] = useState<"loading" | "available" | "installed">("loading");
  const [notificationPermission, setNotificationPermission] = useState<NotificationPermission | "unsupported" | "loading">("loading");
  const [toast, setToast] = useState<string | null>(null);
  const [availableUpdate, setAvailableUpdate] = useState<string | null>(null);
  const [dismissedUpdate, setDismissedUpdate] = useState<string | null>(null);
  const [updating, setUpdating] = useState(false);

  useEffect(() => {
    const isAppleIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
    setIsIOS(isAppleIOS);
    const standaloneQuery = window.matchMedia("(display-mode: standalone)");
    const updateInstallState = () => {
      const isStandalone = standaloneQuery.matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;
      setInstallState(isStandalone ? "installed" : "available");
    };
    updateInstallState();
    standaloneQuery.addEventListener("change", updateInstallState);

    if ("Notification" in window) setNotificationPermission(Notification.permission);
    else setNotificationPermission("unsupported");

    const handleBeforeInstallPrompt = (event: Event) => {
      event.preventDefault();
      setInstallPrompt(event as BeforeInstallPromptEvent);
    };
    const handleAppInstalled = () => setInstallState("installed");

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    window.addEventListener("appinstalled", handleAppInstalled);

    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => undefined);
    }

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
      window.removeEventListener("appinstalled", handleAppInstalled);
      standaloneQuery.removeEventListener("change", updateInstallState);
    };
  }, []);

  useEffect(() => {
    if (installState !== "installed") return;
    let active = true;
    let currentVersion: string | null = null;

    async function checkForUpdate() {
      try {
        const response = await fetch("/api/app-version", { cache: "no-store" });
        if (!response.ok) return;
        const data = await response.json() as { version?: string };
        if (!active || !data.version) return;
        if (currentVersion === null) currentVersion = data.version;
        else if (data.version !== currentVersion) setAvailableUpdate(data.version);
      } catch { /* Retry on the next check. */ }
    }

    void checkForUpdate();
    const timer = window.setInterval(() => { void checkForUpdate(); }, 60_000);
    const handleVisibility = () => {
      if (document.visibilityState === "visible") void checkForUpdate();
    };
    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      active = false;
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [installState]);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 3200);
    return () => window.clearTimeout(timer);
  }, [toast]);

  async function handleInstall() {
    if (installPrompt) {
      installPrompt.prompt();
      const result = await installPrompt.userChoice;
      if (result.outcome === "accepted") {
        setInstallState("installed");
        setToast("D_clutr was added to your device.");
      }
      else setToast("No problem. You can install D_clutr later.");
      setInstallPrompt(null);
      return;
    }

    if (isIOS) {
      setToast("Tap the Share button, then Add to Home Screen.");
      return;
    }

    setToast("You can’t install D_clutr on this device right now.");
  }

  async function handleNotifications() {
    if (!("Notification" in window)) {
      setToast("This browser doesn’t support notifications. You can still check D_clutr for updates.");
      return;
    }

    if (Notification.permission === "granted") {
      setNotificationPermission("granted");
      new Notification("D_clutr alert", {
        body: "You are now receiving updates on this device.",
        icon: "/icon.svg",
      });
      setToast("You’ll get updates on this device.");
      return;
    }

    const permission = await Notification.requestPermission();
    setNotificationPermission(permission);

    if (permission === "granted") {
      new Notification("D_clutr alert", {
        body: "You are now receiving updates on this device.",
        icon: "/icon.svg",
      });
      setToast("You’ll get updates on this device.");
      return;
    }

    setToast("Notifications are off. You can turn them on in your browser settings.");
  }

  function updateApp() {
    setUpdating(true);
    window.location.reload();
  }

  const showUpdatePrompt = installState === "installed" && availableUpdate !== null && availableUpdate !== dismissedUpdate;

  return (
    <>
      {showUpdatePrompt && <div className="pwa-update-prompt" role="dialog" aria-labelledby="pwa-update-title" aria-describedby="pwa-update-description">
        <div className="pwa-update-copy">
          <strong id="pwa-update-title">A D_clutr update is ready</strong>
          <span id="pwa-update-description">Refresh to get the latest version.</span>
        </div>
        <div className="pwa-update-actions">
          <button type="button" className="pwa-update-later" onClick={() => setDismissedUpdate(availableUpdate)}>Later</button>
          <button type="button" className="pwa-update-button" onClick={updateApp} disabled={updating}>
            <RefreshCw size={15} /> {updating ? "Updating…" : "Update app"}
          </button>
        </div>
      </div>}
      {toast && (
        <div className="pwa-toast" role="status" aria-live="polite">
          <span>{toast}</span>
          <button type="button" aria-label="Dismiss notification" onClick={() => setToast(null)}>
            <X size={14} />
          </button>
        </div>
      )}
      {(notificationPermission !== "granted" && notificationPermission !== "unsupported" && notificationPermission !== "loading" || installState === "available") && <div className="pwa-toolbar">
        {notificationPermission !== "granted" && notificationPermission !== "unsupported" && notificationPermission !== "loading" && <button type="button" className="pwa-action" onClick={handleNotifications} aria-label="Turn on notifications" title="Turn on notifications">
          <Bell size={15} />
          <span className="pwa-action-label">Turn on notifications</span>
        </button>}
        {installState === "available" && <button type="button" className="pwa-action pwa-action-primary" onClick={handleInstall} aria-label={isIOS ? "Install D_clutr on this iPhone" : "Install D_clutr app"} title="Install D_clutr app">
          <Download size={15} />
          <span className="pwa-action-label">{isIOS ? "Install" : "Install app"}</span>
        </button>}
      </div>}
    </>
  );
}
