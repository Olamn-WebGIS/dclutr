"use client";

import { Bell, Download, RefreshCw } from "lucide-react";
import { useEffect, useState } from "react";
import { showToast } from "@/lib/notifications";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
};

export function PwaAppControls() {
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isIOS, setIsIOS] = useState(false);
  const [installState, setInstallState] = useState<"loading" | "available" | "installed">("loading");
  const [notificationPermission, setNotificationPermission] = useState<NotificationPermission | "unsupported" | "loading">("loading");
  const [hasPushSubscription, setHasPushSubscription] = useState(false);
  const [notificationsBusy, setNotificationsBusy] = useState(false);
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

    const pushSupported = "Notification" in window && "PushManager" in window && "serviceWorker" in navigator;
    if (pushSupported) setNotificationPermission(Notification.permission);
    else setNotificationPermission("unsupported");

    const handleBeforeInstallPrompt = (event: Event) => {
      event.preventDefault();
      setInstallPrompt(event as BeforeInstallPromptEvent);
    };
    const handleAppInstalled = () => setInstallState("installed");

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    window.addEventListener("appinstalled", handleAppInstalled);

    let active = true;
    const syncPushSubscription = async () => {
      if (!pushSupported || Notification.permission !== "granted") return;
      try {
        const configResponse = await fetch("/api/push-subscriptions", { cache: "no-store" });
        if (configResponse.status === 401) return;
        if (!configResponse.ok) throw new Error("Could not load device notification settings.");
        const config = await configResponse.json() as { publicKey?: string };
        if (!config.publicKey) throw new Error("Web Push is not configured.");
        const registration = await navigator.serviceWorker.ready;
        const subscription = await registration.pushManager.getSubscription();
        if (!subscription) {
          if (active) setHasPushSubscription(false);
          return;
        }
        const response = await fetch("/api/push-subscriptions", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(subscription.toJSON()),
        });
        if (!response.ok) throw new Error("Could not save this device notification subscription.");
        if (active) setHasPushSubscription(true);
      } catch (error) {
        console.error("Could not sync D_clutr device notifications:", error);
      }
    };
    navigator.serviceWorker?.register("/sw.js")
      .then(() => { void syncPushSubscription(); })
      .catch((error: unknown) => console.error("Could not register the D_clutr service worker:", error));
    window.addEventListener("dclutr:auth-change", syncPushSubscription);
    const syncWhenVisible = () => { if (document.visibilityState === "visible") void syncPushSubscription(); };
    document.addEventListener("visibilitychange", syncWhenVisible);

    return () => {
      active = false;
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
      window.removeEventListener("appinstalled", handleAppInstalled);
      standaloneQuery.removeEventListener("change", updateInstallState);
      window.removeEventListener("dclutr:auth-change", syncPushSubscription);
      document.removeEventListener("visibilitychange", syncWhenVisible);
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

  async function handleInstall() {
    if (installPrompt) {
      installPrompt.prompt();
      const result = await installPrompt.userChoice;
      if (result.outcome === "accepted") {
        setInstallState("installed");
        showToast("D_clutr was added to your device.", "success");
      }
      else showToast("No problem. You can install D_clutr later.", "info");
      setInstallPrompt(null);
      return;
    }

    if (isIOS) {
      showToast("Tap the Share button, then Add to Home Screen.", "info");
      return;
    }

    showToast("You can’t install D_clutr on this device right now.", "error");
  }

  async function handleNotifications() {
    if (!("Notification" in window) || !("PushManager" in window) || !("serviceWorker" in navigator)) {
      showToast("This browser doesn’t support notifications. You can still check D_clutr for updates.", "info");
      return;
    }

    setNotificationsBusy(true);
    try {
      const permission = Notification.permission === "granted" ? "granted" : await Notification.requestPermission();
      setNotificationPermission(permission);
      if (permission !== "granted") {
        showToast("Notifications are off. You can turn them on in your browser settings.", "error");
        return;
      }
      const configResponse = await fetch("/api/push-subscriptions", { cache: "no-store" });
      const config = await configResponse.json() as { publicKey?: string; error?: string };
      if (!configResponse.ok || !config.publicKey) throw new Error(config.error || "Could not set up device notifications.");
      const registration = await navigator.serviceWorker.ready;
      let subscription = await registration.pushManager.getSubscription();
      if (!subscription) {
        const applicationServerKey = Uint8Array.from(
          atob(config.publicKey.replace(/-/g, "+").replace(/_/g, "/")),
          (character) => character.charCodeAt(0),
        );
        subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey,
        });
      }
      const saveResponse = await fetch("/api/push-subscriptions", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(subscription.toJSON()),
      });
      const result = await saveResponse.json() as { error?: string };
      if (!saveResponse.ok) throw new Error(result.error || "Could not save this device notification subscription.");
      setHasPushSubscription(true);
      await registration.showNotification("D_clutr notifications enabled", {
        body: "This device will alert you about new offers and messages.",
        icon: "/icon-192.png",
        tag: "dclutr-subscription-test",
      });
      showToast("This device will alert you about new offers and messages.", "success");
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Could not enable device notifications.", "error");
    } finally {
      setNotificationsBusy(false);
    }
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
          <strong id="pwa-update-title">A D_clutr update is available</strong>
          <span id="pwa-update-description">Update to get the latest version.</span>
        </div>
        <div className="pwa-update-actions">
          <button type="button" className="pwa-update-later" onClick={() => setDismissedUpdate(availableUpdate)}>Later</button>
          <button type="button" className="pwa-update-button" onClick={updateApp} disabled={updating}>
            <RefreshCw size={15} /> {updating ? "Updating…" : "Update app"}
          </button>
        </div>
      </div>}
      {(notificationPermission === "default" || notificationPermission === "granted" && !hasPushSubscription || installState === "available") && <div className="pwa-toolbar">
        {(notificationPermission === "default" || notificationPermission === "granted" && !hasPushSubscription) && <button type="button" className="pwa-action" onClick={handleNotifications} disabled={notificationsBusy} aria-label="Turn on notifications" title="Turn on notifications">
          <Bell size={15} />
          <span className="pwa-action-label">{notificationsBusy ? "Enabling…" : "Turn on notifications"}</span>
        </button>}
        {installState === "available" && <button type="button" className="pwa-action pwa-action-primary" onClick={handleInstall} aria-label={isIOS ? "Install D_clutr on this iPhone" : "Install D_clutr app"} title="Install D_clutr app">
          <Download size={15} />
          <span className="pwa-action-label">{isIOS ? "Install" : "Install app"}</span>
        </button>}
      </div>}
    </>
  );
}
