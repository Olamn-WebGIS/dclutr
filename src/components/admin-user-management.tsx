"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { formatNaira } from "@/lib/currency";
import { showToast } from "@/lib/notifications";

type ManagedUser = {
  id: string;
  display_name: string;
  email: string;
  verification_status: string;
  created_at: string;
  account_banned: boolean;
  posting_restricted: boolean;
  account_deleted: boolean;
};
type Listing = { id: string; title: string; category: string; price_ngn: number; status: string; created_at: string };
type Conversation = { id: string; listing_title_snapshot: string; buyer_id: string; seller_id: string; other_user_id: string; other_name: string; last_message_at: string };
type AdminMessage = { id: string; sender_id: string; sender_name: string; body: string; created_at: string };
type UserDetail = ManagedUser & { account_banned_at: string | null; posting_restricted_at: string | null; account_deleted_at: string | null; account_moderation_note: string | null };
type ModerationAction = "ban" | "unban" | "restrict_posting" | "allow_posting";

export function AdminUserManagement() {
  const [users, setUsers] = useState<ManagedUser[]>([]);
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState("");
  const [detail, setDetail] = useState<UserDetail | null>(null);
  const [listings, setListings] = useState<Listing[]>([]);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConversation, setActiveConversation] = useState("");
  const [messages, setMessages] = useState<AdminMessage[]>([]);
  const [moderationNote, setModerationNote] = useState("");
  const [confirmEmail, setConfirmEmail] = useState("");
  const [busy, setBusy] = useState("");

  const loadUsers = useCallback(async (search: string) => {
    setBusy("search");
    try {
      const response = await fetch(`/api/admin/users?q=${encodeURIComponent(search)}`);
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Could not load student accounts.");
      setUsers(result.users);
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Could not load student accounts.", "error");
    } finally { setBusy(""); }
  }, []);

  useEffect(() => { void loadUsers(""); }, [loadUsers]);

  const loadUser = useCallback(async (userId: string) => {
    const response = await fetch(`/api/admin/users/${userId}`);
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || "Could not load this student account.");
    setDetail(result.profile);
    setListings(result.listings);
    setConversations(result.conversations);
  }, []);

  async function selectUser(userId: string) {
    setSelectedId(userId);
    setActiveConversation("");
    setMessages([]);
    setConfirmEmail("");
    try { await loadUser(userId); }
    catch (error) { showToast(error instanceof Error ? error.message : "Could not load this student account.", "error"); }
  }

  async function moderate(action: ModerationAction) {
    if (!selectedId) return;
    setBusy(action);
    try {
      const response = await fetch(`/api/admin/users/${selectedId}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action, note: moderationNote }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Could not update this account.");
      showToast(result.message, "success");
      await Promise.all([loadUser(selectedId), loadUsers(query)]);
    } catch (error) { showToast(error instanceof Error ? error.message : "Could not update this account.", "error"); }
    finally { setBusy(""); }
  }

  async function removeAccount() {
    if (!selectedId || !detail) return;
    setBusy("delete");
    try {
      const response = await fetch(`/api/admin/users/${selectedId}`, {
        method: "DELETE",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ confirmEmail }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Could not remove this account.");
      showToast(result.message, "success");
      setSelectedId(""); setDetail(null); setListings([]); setConversations([]); setMessages([]); setConfirmEmail("");
      await loadUsers(query);
    } catch (error) { showToast(error instanceof Error ? error.message : "Could not remove this account.", "error"); }
    finally { setBusy(""); }
  }

  async function openConversation(conversationId: string) {
    if (!selectedId) return;
    setActiveConversation(conversationId);
    setMessages([]);
    try {
      const response = await fetch(`/api/admin/users/${selectedId}/conversations/${conversationId}`);
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Could not load this conversation.");
      setMessages(result.messages);
    } catch (error) { showToast(error instanceof Error ? error.message : "Could not load this conversation.", "error"); }
  }

  function search(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void loadUsers(query);
  }

  return <section className="admin-user-management">
    <h2>Student accounts</h2>
    <form className="admin-user-search" onSubmit={search}>
      <input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search name or email" aria-label="Search student accounts" />
      <button className="outline-button" type="submit" disabled={busy === "search"}>{busy === "search" ? "Searching…" : "Search"}</button>
    </form>
    <div className="admin-user-grid">
      <div className="admin-user-list" aria-label="Student account results">
        {users.map((user) => <button key={user.id} type="button" className={`admin-user-row${selectedId === user.id ? " is-selected" : ""}`} onClick={() => void selectUser(user.id)}>
          <strong>{user.display_name}</strong><span>{user.email}</span><small>{user.account_deleted ? "Deleted" : user.account_banned ? "Banned" : user.posting_restricted ? "Posting restricted" : user.verification_status}</small>
        </button>)}
        {!users.length && <p className="condition-note">{busy === "search" ? "Loading accounts…" : "No student accounts found."}</p>}
      </div>
      <div className="admin-user-detail">
        {!detail ? <p className="condition-note">Select a student account to review profile details, posts, and conversations.</p> : <>
          <div className="admin-user-profile">
            <span className="eyebrow">STUDENT PROFILE</span>
            <h3>{detail.display_name}</h3>
            <p>{detail.email}</p>
            <p className="condition-note">Joined {new Date(detail.created_at).toLocaleDateString("en-NG")} · Verification: {detail.verification_status}</p>
            {detail.account_deleted && <p className="notice">This account was previously anonymized. Remaining linked records can still be permanently deleted below.</p>}
            {detail.account_moderation_note && <p className="condition-note">Admin note: {detail.account_moderation_note}</p>}
          </div>
          {!detail.account_deleted && <>
            <label className="field"><span>Moderation note (optional)</span><textarea value={moderationNote} maxLength={500} onChange={(event) => setModerationNote(event.target.value)} rows={2} /></label>
            <div className="admin-user-actions">
              <button className="outline-button" type="button" disabled={Boolean(busy)} onClick={() => void moderate(detail.account_banned ? "unban" : "ban")}>{detail.account_banned ? "Unban account" : "Ban account"}</button>
              <button className="outline-button" type="button" disabled={Boolean(busy)} onClick={() => void moderate(detail.posting_restricted ? "allow_posting" : "restrict_posting")}>{detail.posting_restricted ? "Allow posting" : "Restrict posting"}</button>
            </div>
          </>}
          <div className="admin-delete-account">
            <strong>Permanently delete account</strong>
            <p>This permanently deletes the account, listings, stored files, chats, orders, disputes, and moderation history. This cannot be undone.</p>
            <label className="field"><span>Type {detail.email} to confirm</span><input value={confirmEmail} onChange={(event) => setConfirmEmail(event.target.value)} autoComplete="off" /></label>
            <button className="outline-button" type="button" disabled={Boolean(busy) || confirmEmail.trim().toLowerCase() !== detail.email.toLowerCase()} onClick={() => void removeAccount()}>{busy === "delete" ? "Permanently deleting…" : "Permanently delete account"}</button>
          </div>
          <div className="admin-user-section">
            <h4>Listings ({listings.length})</h4>
            {listings.length ? listings.map((listing) => <p className="admin-user-listing" key={listing.id}>{listing.title} · {formatNaira(listing.price_ngn)} · {listing.status}</p>) : <p className="condition-note">No listings found.</p>}
          </div>
          <div className="admin-user-section">
            <h4>Conversations ({conversations.length})</h4>
            {conversations.map((conversation) => <button className="admin-user-conversation" type="button" key={conversation.id} onClick={() => void openConversation(conversation.id)}>{conversation.listing_title_snapshot} · with {conversation.other_name}</button>)}
            {!conversations.length && <p className="condition-note">No conversations found.</p>}
          </div>
          {activeConversation && <div className="admin-conversation-messages" aria-live="polite">
            <h4>Conversation history</h4>
            {messages.length ? messages.map((message) => <article className="admin-message" key={message.id}><small>{message.sender_name} · {new Date(message.created_at).toLocaleString("en-NG")}</small><p>{message.body}</p></article>) : <p className="condition-note">No unexpired messages in this conversation.</p>}
          </div>}
        </>}
      </div>
    </div>
  </section>;
}