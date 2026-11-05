"use client";

import { CircleAlert, CircleCheck, Info, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { NotificationTone } from "@/lib/notifications";

type Toast = { id: number; message: string; tone: NotificationTone };
type ToastEvent = CustomEvent<{ message: string; tone: NotificationTone }>;

export function NotificationToasts() {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const timeouts = useRef(new Map<number, number>());

  function removeToast(id: number) {
    window.clearTimeout(timeouts.current.get(id));
    timeouts.current.delete(id);
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }

  useEffect(() => {
    let nextId = 0;
    const activeTimeouts = timeouts.current;
    const addToast = (event: Event) => {
      const { message, tone } = (event as ToastEvent).detail;
      const id = ++nextId;
      setToasts((current) => [...current.slice(-2), { id, message, tone }]);
      activeTimeouts.set(id, window.setTimeout(() => removeToast(id), 6000));
    };
    window.addEventListener("dclutr:toast", addToast);
    return () => {
      window.removeEventListener("dclutr:toast", addToast);
      activeTimeouts.forEach((timeout) => window.clearTimeout(timeout));
      activeTimeouts.clear();
    };
  }, []);

  return <div className="notification-toasts" aria-label="Notifications">
    {toasts.map((toast) => {
      const Icon = toast.tone === "error" ? CircleAlert : toast.tone === "success" ? CircleCheck : Info;
      return <div className={`notification-toast notification-toast-${toast.tone}`} key={toast.id} role={toast.tone === "error" ? "alert" : "status"} aria-live={toast.tone === "error" ? "assertive" : "polite"}>
        <Icon size={17} aria-hidden="true" />
        <span>{toast.message}</span>
        <button type="button" aria-label="Dismiss notification" onClick={() => removeToast(toast.id)}><X size={15} /></button>
      </div>;
    })}
  </div>;
}