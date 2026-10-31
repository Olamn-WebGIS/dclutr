import "server-only";
import { BackendError } from "@/lib/server/backend";

const blockedPatterns: Array<[RegExp, string]> = [
  [/\b(?:whats?app|telegram|signal|snap\s?chat|instagram|facebook|messenger|discord|wechat|imo)\b/i, "Please keep the conversation on D_clutr; external messaging handles are not allowed."],
  [/\b(?:text|call|sms|dm)\s+(?:me|you|them)\b|\b(?:contact|message)\s+me\s+(?:on|at)\b/i, "Please keep communication in the D_clutr conversation."],
  [/(?:https?:\/\/|www\.)\S+|\b[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}\b/i, "Links and email addresses are blocked in marketplace chat."],
  [/@[a-z0-9_.]{3,}/i, "Social media usernames are not allowed in marketplace chat."],
  [/(?:\+?234[\s().-]?)?(?:0[789][\s().-]?)?[0-9][0-9\s().-]{7,}[0-9]/, "Phone numbers are blocked. Keep communication and arrangements on D_clutr."],
  [/\b(?:bank\s*(?:account|acct|details|number|transfer)|account\s*(?:number|no\.?|details)|(?:send|share|drop|dm)\s+(?:me\s+)?(?:your\s+)?(?:number|digits|account)|(?:pay|transfer|send|settle)\s+(?:me\s+)?(?:outside|directly|off\s*platform|to\s+my\s+(?:bank|account|opay|palmpay))|(?:cash|transfer|payment)\s+(?:outside|off\s*platform))\b/i, "Bank details and attempts to move payment off-platform are blocked."],
  [/(?:\b(?:pay|transfer|deal|chat|contact|message)\b.{0,40}\b(?:outside|off[- ]platform|another app|privately)\b|\b(?:outside|off[- ]platform|another app|privately)\b.{0,40}\b(?:pay|transfer|deal|chat|contact|message)\b)/i, "Please keep the transaction and conversation on D_clutr."],
  [/\b(?:opay|palmpay|moniepoint|sendcash|bank transfer|cash payment)\b/i, "External wallets and direct payment arrangements are not allowed in D_clutr chat."],
  [/\b(?:make|do)\s+(?:the\s+)?(?:deal|transaction|payment)\s+(?:on|via|through)\s+(?:whatsapp|telegram|outside|another\s+app)\b/i, "Please keep the transaction and conversation on D_clutr."],
];

export function assertAllowedChatText(value: string, allowContactDetails = false) {
  const text = value.normalize("NFKC").trim();
  if (!text || text.length > 2000) throw new BackendError("Message must be 1–2,000 characters.");
  const contactSensitivePatterns = [
    /(https?:\/\/|www\.)\S+/i,
    /\b[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}\b/i,
    /(?:\+?234[\s().-]?)?(?:0[789][\s().-]?)?[0-9][0-9\s().-]{7,}[0-9]/,
    /\b(?:whats?app|telegram|signal|snap\s?chat|instagram|facebook|messenger|discord|wechat|imo)\b/i,
  ];
  const activeRules = allowContactDetails ? blockedPatterns.filter(([pattern]) => !contactSensitivePatterns.some((contactPattern) => contactPattern.source === pattern.source && contactPattern.flags === pattern.flags)) : blockedPatterns;
  for (const [pattern, reason] of activeRules) if (pattern.test(text)) throw new BackendError(reason, 422);
  return text;
}
