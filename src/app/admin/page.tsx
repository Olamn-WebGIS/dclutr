import { AdminDashboard } from "@/components/admin-dashboard";
import { AdminAnalyticsPanel } from "@/components/admin-analytics-panel";

export const dynamic = "force-dynamic";

export default function AdminPage() {
  return <><AdminDashboard /><AdminAnalyticsPanel /></>;
}
