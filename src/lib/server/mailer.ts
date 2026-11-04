import "server-only";
import tls from "node:tls";
import { BackendError, adminFetch } from "@/lib/server/backend";
import { decryptPrivateValue, encryptPrivateValue } from "@/lib/server/secrets";

type SmtpMessage = { to: string; subject: string; text: string };
type SmtpConfig = { host: string; port: number; username: string; password: string; from: string };

function smtpConfig(): SmtpConfig | null {
  const { SMTP_HOST, SMTP_USER, SMTP_PASSWORD, SMTP_FROM } = process.env;
  if (!SMTP_HOST || !SMTP_USER || !SMTP_PASSWORD || !SMTP_FROM) return null;
  const port = Number(process.env.SMTP_PORT || 465);
  if (port !== 465) throw new BackendError("For this Zoho SMTP adapter use the SSL SMTP port 465.", 503);
  return { host: SMTP_HOST, port, username: SMTP_USER, password: SMTP_PASSWORD, from: SMTP_FROM };
}

function encodeSubject(value: string) { return `=?UTF-8?B?${Buffer.from(value, "utf8").toString("base64")}?=`; }
function wrapBase64(value: string) { return Buffer.from(value, "utf8").toString("base64").match(/.{1,76}/g)?.join("\r\n") ?? ""; }
function safeHeader(value: string) { return value.replace(/[\r\n<>]/g, ""); }
function escapeHtml(value: string) {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/\"/g, "&quot;").replace(/'/g, "&#39;");
}

function brandedEmailHtml(message: SmtpMessage) {
  const paragraphs = message.text.trim().split(/\n{2,}/).map((paragraph) =>
    `<p style="margin:0 0 16px;color:#405347;font-size:15px;line-height:1.7;">${escapeHtml(paragraph).replace(/\n/g, "<br>")}</p>`,
  ).join("");
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body style="margin:0;padding:0;background:#f8f7f1;color:#203b2e;font-family:Arial,Helvetica,sans-serif;"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:#f8f7f1;padding:32px 12px;"><tr><td align="center"><table role="presentation" width="600" cellspacing="0" cellpadding="0" border="0" style="width:100%;max-width:600px;background:#fffefa;border:1px solid #e6e7dc;border-radius:6px;overflow:hidden;"><tr><td style="padding:24px 30px;background:#244b39;color:#fffefa;"><div style="font-family:Georgia,'Times New Roman',serif;font-size:28px;font-weight:bold;">D_clutr<span style="color:#a8bda8;">.</span></div><div style="margin-top:5px;color:#dce7d9;font-size:12px;">Made for FUTA students in Akure</div></td></tr><tr><td style="padding:30px;"><h1 style="margin:0 0 22px;color:#203b2e;font-family:Georgia,'Times New Roman',serif;font-size:25px;font-weight:normal;line-height:1.3;">${escapeHtml(message.subject)}</h1>${paragraphs}</td></tr><tr><td style="padding:20px 30px;background:#edf1e9;color:#526357;font-size:12px;line-height:1.7;"><p style="margin:0 0 6px;">Need a hand? Email <a href="mailto:notification@dclutr.com.ng" style="color:#244b39;font-weight:bold;">notification@dclutr.com.ng</a>.</p><p style="margin:0;">D_clutr · A student marketplace for FUTA, Akure</p></td></tr></table></td></tr></table></body></html>`;
}

async function sendSmtp(message: SmtpMessage, config: SmtpConfig) {
  await new Promise<void>((resolve, reject) => {
    const socket = tls.connect({ host: config.host, port: config.port, servername: config.host });
    let buffer = "";
    const lines: string[] = [];
    const waiting: Array<(line: string) => void> = [];
    let failed = false;
    const fail = (error: Error) => { if (!failed) { failed = true; socket.destroy(); reject(error); } };
    socket.on("error", fail);
    socket.setTimeout(20_000, () => fail(new Error("Zoho SMTP timed out.")));
    socket.on("data", (chunk: Buffer) => {
      buffer += chunk.toString("utf8");
      let index = buffer.indexOf("\r\n");
      while (index >= 0) {
        const line = buffer.slice(0, index);
        buffer = buffer.slice(index + 2);
        const waiter = waiting.shift();
        if (waiter) waiter(line); else lines.push(line);
        index = buffer.indexOf("\r\n");
      }
    });
    const readLine = () => new Promise<string>((done) => { const line = lines.shift(); if (line !== undefined) done(line); else waiting.push(done); });
    const readReply = async () => {
      let line = await readLine();
      if (!/^\d{3}[ -]/.test(line)) throw new Error("Unexpected Zoho SMTP response.");
      const code = line.slice(0, 3);
      while (line[3] === "-") {
        line = await readLine();
        if (!line.startsWith(code)) throw new Error("Invalid multiline Zoho SMTP response.");
      }
      if (code[0] !== "2" && code[0] !== "3") throw new Error(`Zoho SMTP rejected the email (${code}).`);
      return code;
    };
    const command = async (value: string) => { socket.write(`${value}\r\n`); return readReply(); };
    socket.once("secureConnect", async () => {
      try {
        await readReply();
        await command(`EHLO ${safeHeader(process.env.NEXT_PUBLIC_APP_URL ? new URL(process.env.NEXT_PUBLIC_APP_URL).hostname : "dclutr.local")}`);
        await command("AUTH LOGIN");
        await command(Buffer.from(config.username).toString("base64"));
        await command(Buffer.from(config.password).toString("base64"));
        await command(`MAIL FROM:<${safeHeader(config.from)}>`);
        await command(`RCPT TO:<${safeHeader(message.to)}>`);
        await command("DATA");
        const boundary = `dclutr_${crypto.randomUUID().replaceAll("-", "")}`;
        const textBody = wrapBase64(message.text);
        const htmlBody = wrapBase64(brandedEmailHtml(message));
        const mail = [
          `From: D_clutr <${safeHeader(config.from)}>`,
          `To: <${safeHeader(message.to)}>`,
          `Subject: ${encodeSubject(message.subject)}`,
          `Date: ${new Date().toUTCString()}`,
          `Message-ID: <${crypto.randomUUID()}@dclutr.local>`,
          "MIME-Version: 1.0",
          `Content-Type: multipart/alternative; boundary="${boundary}"`,
          "",
          `--${boundary}`,
          "Content-Type: text/plain; charset=UTF-8",
          "Content-Transfer-Encoding: base64",
          "",
          textBody,
          `--${boundary}`,
          "Content-Type: text/html; charset=UTF-8",
          "Content-Transfer-Encoding: base64",
          "",
          htmlBody,
          `--${boundary}--`,
        ].join("\r\n").replace(/(^|\r\n)\./g, "$1..");
        socket.write(`${mail}\r\n.\r\n`);
        await readReply();
        await command("QUIT");
        socket.end();
        resolve();
      } catch (error) { fail(error instanceof Error ? error : new Error("Email delivery failed.")); }
    });
  });
}

export async function queueEmail({ to, subject, text, dedupeKey }: SmtpMessage & { dedupeKey: string }) {
  const email = to.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new BackendError("Notification email address is invalid.", 400);
  const existing = await adminFetch<Array<{ id: string; status: string }>>("rest/v1/email_outbox?select=id,status", { method: "POST", headers: { Prefer: "resolution=ignore-duplicates,return=representation" }, body: JSON.stringify({ dedupe_key: dedupeKey, recipient: email, subject: subject.slice(0, 250), body_text: encryptPrivateValue(text), body_encrypted: true }) });
  const item = existing[0];
  if (!item || item.status === "sent") return;
  await deliverQueuedEmail(item.id);
}

export async function deliverQueuedEmail(id: string) {
  const config = smtpConfig();
  if (!config) return false;
  const rows = await adminFetch<Array<{ id: string; recipient: string; subject: string; body_text: string; body_encrypted: boolean; attempts: number }>>(`rest/v1/email_outbox?id=eq.${id}&status=eq.queued&select=id,recipient,subject,body_text,body_encrypted,attempts`);
  const item = rows[0];
  if (!item) return false;
  try {
    await sendSmtp({ to: item.recipient, subject: item.subject, text: item.body_encrypted ? decryptPrivateValue(item.body_text) : item.body_text }, config);
    await adminFetch(`rest/v1/email_outbox?id=eq.${id}`, { method: "PATCH", headers: { Prefer: "return=minimal" }, body: JSON.stringify({ status: "sent", attempts: item.attempts + 1, sent_at: new Date().toISOString(), last_error: null }) });
    return true;
  } catch (error) {
    const detail = error instanceof Error ? error.message.slice(0, 300) : "SMTP delivery failed.";
    await adminFetch(`rest/v1/email_outbox?id=eq.${id}`, { method: "PATCH", headers: { Prefer: "return=minimal" }, body: JSON.stringify({ status: item.attempts + 1 >= 8 ? "failed" : "queued", attempts: item.attempts + 1, last_error: detail }) });
    return false;
  }
}

export async function notifyUser(userId: string, subject: string, text: string, dedupeKey: string) {
  try {
    const profiles = await adminFetch<Array<{ email: string }>>(`rest/v1/profiles?id=eq.${userId}&select=email`);
    if (profiles[0]?.email) await queueEmail({ to: profiles[0].email, subject, text, dedupeKey });
  } catch (error) { console.error("Unable to enqueue D_clutr notification:", error); }
}

export async function notifyOrderParticipants(buyerId: string, sellerId: string, subject: string, text: string, dedupeKey: string) {
  await Promise.all([
    notifyUser(buyerId, subject, text, `${dedupeKey}:buyer`),
    notifyUser(sellerId, subject, text, `${dedupeKey}:seller`),
  ]);
}

export async function notifyOrderParticipantsByRole(buyerId: string, sellerId: string, subject: string, buyerText: string, sellerText: string, dedupeKey: string) {
  await Promise.all([
    notifyUser(buyerId, subject, buyerText, `${dedupeKey}:buyer`),
    notifyUser(sellerId, subject, sellerText, `${dedupeKey}:seller`),
  ]);
}

export async function notifyAdmin(subject: string, text: string, dedupeKey: string) {
  const to = process.env.ADMIN_NOTIFICATION_EMAIL;
  if (!to) return;
  try { await queueEmail({ to, subject, text, dedupeKey }); }
  catch (error) { console.error("Unable to enqueue D_clutr admin notification:", error); }
}
