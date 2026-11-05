export type NotificationTone = "success" | "error" | "info";

export function showToast(message: string, tone: NotificationTone = "success") {
  if (typeof window === "undefined" || !message.trim()) return;
  window.dispatchEvent(new CustomEvent("dclutr:toast", { detail: { message, tone } }));
}