const statusLabels: Record<string, string> = {
  accepted: "Accepted",
  approved: "Verified",
  awaiting_payment: "Waiting for payment",
  cancelled: "Cancelled",
  completed: "Complete",
  delivered: "Delivery confirmed",
  dispatched: "Handed over",
  expired: "Expired",
  not_submitted: "Not yet verified",
  open: "Waiting for review",
  paid: "Paid",
  pending: "Waiting for a response",
  rejected: "Declined",
  resolved_buyer: "Resolved for the buyer",
  resolved_seller: "Resolved for the seller",
  terms_pending: "Waiting for you both to agree",
  under_review: "Being reviewed",
};

export function formatMarketplaceStatus(status: string) {
  return statusLabels[status] ?? status.replaceAll("_", " ").replace(/^\w/, (letter) => letter.toUpperCase());
}