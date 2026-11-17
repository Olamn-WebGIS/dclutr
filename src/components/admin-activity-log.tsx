"use client";

import { useEffect, useState } from "react";

type Activity = {
  id: number;
  actor_name: string;
  actor_email: string;
  action: string;
  subject_name: string | null;
  subject_email: string | null;
  details: string | null;
  created_at: string;
};

const actionLabels: Record<string, string> = {
  allow_posting: "Posting access restored",
  ban: "Account banned",
  delete_student_account: "Student account deleted",
  dispute_marked_under_review: "Dispute moved to review",
  dispute_resolved_buyer: "Dispute resolved for buyer",
  dispute_resolved_seller: "Dispute resolved for seller",
  read_conversation: "Conversation accessed",
  read_conversation_messages: "Conversation messages viewed",
  restrict_posting: "Posting restricted",
  seller_payout_recorded: "Seller payout recorded",
  unban: "Account unbanned",
  verification_approved: "Student verification approved",
  verification_rejected: "Student verification rejected",
};

export function AdminActivityLog() {
  const [activities, setActivities] = useState<Activity[]>([]);
  const [visible, setVisible] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    fetch("/api/admin/activity")
      .then(async (response) => {
        if (response.status === 404 || response.status === 403) return null;
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || "Could not load the activity log.");
        return result as { activities: Activity[] };
      })
      .then((result) => {
        if (!active || !result) return;
        setActivities(result.activities);
        setVisible(true);
      })
      .catch((reason: unknown) => {
        if (active) setError(reason instanceof Error ? reason.message : "Could not load the activity log.");
      });
    return () => { active = false; };
  }, []);

  if (!visible && !error) return null;

  return (
    <section className="content-card admin-activity-card" aria-labelledby="admin-activity-heading">
      <h2 id="admin-activity-heading">Admin activity log</h2>
      <p className="condition-note">Recent administrator actions. Visible only to admin@dclutr.com.ng.</p>
      {error ? <p className="status-note error" role="alert">{error}</p> : activities.length ? (
        <div className="admin-activity-list">
          {activities.map((activity) => (
            <article className="admin-activity-item" key={activity.id}>
              <div className="admin-activity-main">
                <strong>{actionLabels[activity.action] ?? activity.action.replaceAll("_", " ")}</strong>
                <span>
                  {activity.subject_name
                    ? `${activity.subject_name}${activity.subject_email ? ` · ${activity.subject_email}` : ""}`
                    : activity.details}
                </span>
              </div>
              <div className="admin-activity-meta">
                <span>{activity.actor_name} · {activity.actor_email}</span>
                <time dateTime={activity.created_at}>{new Date(activity.created_at).toLocaleString("en-NG")}</time>
              </div>
            </article>
          ))}
        </div>
      ) : <p className="condition-note">No administrator actions have been recorded yet.</p>}
    </section>
  );
}
