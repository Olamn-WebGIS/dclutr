import { adminFetch, errorResponse, json, requireAdmin } from "@/lib/server/backend";

type AnalyticsDay = {
  day: string;
  visits: number;
  listing_views: number;
  listings: number;
  first_conversations: number;
  completed_orders: number;
  email_clicks: number;
};

export async function GET() {
  try {
    await requireAdmin();
    const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const days = await adminFetch<AnalyticsDay[]>("rest/v1/rpc/admin_marketplace_analytics", {
      method: "POST",
      body: JSON.stringify({ p_since: since }),
    });
    const totals = days.reduce((sum, day) => ({
      visits: sum.visits + Number(day.visits),
      listingViews: sum.listingViews + Number(day.listing_views),
      listings: sum.listings + Number(day.listings),
      firstConversations: sum.firstConversations + Number(day.first_conversations),
      completedOrders: sum.completedOrders + Number(day.completed_orders),
      emailClicks: sum.emailClicks + Number(day.email_clicks),
    }), { visits: 0, listingViews: 0, listings: 0, firstConversations: 0, completedOrders: 0, emailClicks: 0 });
    return json({ totals, days });
  } catch (error) { return errorResponse(error); }
}
