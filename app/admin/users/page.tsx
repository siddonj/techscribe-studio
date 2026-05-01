"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { PageHeader, SurfaceNotice } from "@/components/DashboardPrimitives";
import type { UserRow } from "@/lib/db";

const STATUS_STYLES: Record<string, string> = {
  approved: "border-emerald-300/60 bg-emerald-50 text-emerald-700",
  pending:  "border-amber-300/60 bg-amber-50 text-amber-700",
  rejected: "border-red-300/60 bg-red-50 text-red-700",
};

const ROLE_STYLES: Record<string, string> = {
  admin: "border-accent/30 bg-accent/10 text-accent",
  user: "border-slate-300/60 bg-slate-100/80 text-slate-600",
};

export default function AdminUsersPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [users, setUsers] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const isAdmin = (session?.user as Record<string, unknown> | undefined)?.role === "admin";

  useEffect(() => {
    if (status === "unauthenticated") { router.replace("/login"); return; }
    if (status === "authenticated" && !isAdmin) { router.replace("/"); return; }
  }, [status, isAdmin, router]);

  useEffect(() => {
    if (!isAdmin) return;
    fetch("/api/admin/users")
      .then((r) => r.json())
      .then((data) => { setUsers(data.users ?? []); setLoading(false); })
      .catch(() => { setError("Failed to load users."); setLoading(false); });
  }, [isAdmin]);

  async function patch(id: number, body: Record<string, unknown>) {
    setMessage(null); setError(null);
    const res = await fetch("/api/admin/users", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, ...body }),
    });
    if (!res.ok) { setError("Action failed."); return; }
    setMessage("Updated.");
    const data = (await fetch("/api/admin/users").then((r) => r.json())) as { users: UserRow[] };
    setUsers(data.users ?? []);
  }

  const pending = users.filter((u) => u.status === "pending");
  const others  = users.filter((u) => u.status !== "pending");

  if (status === "loading" || loading) {
    return <div className="p-8 text-sm text-muted font-mono animate-pulse">Loading…</div>;
  }

  return (
    <div className="p-6 lg:p-8 max-w-4xl mx-auto space-y-8">
      <PageHeader
        eyebrow="Admin"
        title="User Management"
        description="Approve or reject access requests, and manage user roles."
        icon="👥"
        stats={[
          { label: "Total",    value: String(users.length) },
          { label: "Pending",  value: String(pending.length) },
          { label: "Approved", value: String(users.filter((u) => u.status === "approved").length) },
        ]}
      />

      {error   && <SurfaceNotice tone="error">{error}</SurfaceNotice>}
      {message && <SurfaceNotice tone="success">{message}</SurfaceNotice>}

      {/* Pending requests */}
      {pending.length > 0 && (
        <section>
          <h2 className="font-mono text-[11px] uppercase tracking-[0.24em] text-muted mb-3">
            Pending Requests ({pending.length})
          </h2>
          <div className="shell-panel rounded-2xl divide-y divide-border">
            {pending.map((user) => (
              <UserRow key={user.id} user={user} onPatch={patch} highlight />
            ))}
          </div>
        </section>
      )}

      {/* All other users */}
      <section>
        <h2 className="font-mono text-[11px] uppercase tracking-[0.24em] text-muted mb-3">
          All Users ({users.length})
        </h2>
        {users.length === 0 ? (
          <div className="shell-panel rounded-2xl p-8 text-center text-sm text-muted">
            No users yet. The first person to sign in becomes admin.
          </div>
        ) : (
          <div className="shell-panel rounded-2xl divide-y divide-border">
            {[...pending, ...others].map((user) => (
              <UserRow key={user.id} user={user} onPatch={patch} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function UserRow({
  user,
  onPatch,
  highlight,
}: {
  user: UserRow;
  onPatch: (id: number, body: Record<string, unknown>) => Promise<void>;
  highlight?: boolean;
}) {
  const isSelf = false; // can't easily check without passing session

  return (
    <div className={`flex items-center gap-4 p-4 ${highlight ? "bg-amber-50/40" : ""}`}>
      {user.avatar ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={user.avatar} alt="" className="h-9 w-9 rounded-full border border-border shrink-0" />
      ) : (
        <div className="h-9 w-9 rounded-full bg-subtle border border-border flex items-center justify-center text-sm font-semibold text-muted shrink-0">
          {(user.name ?? user.email).slice(0, 1).toUpperCase()}
        </div>
      )}

      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-slate-900 truncate">{user.name ?? "—"}</p>
        <p className="text-xs text-muted truncate">{user.email}</p>
        <p className="text-xs text-muted mt-0.5">Joined {new Date(user.created_at).toLocaleDateString()}</p>
      </div>

      <div className="flex items-center gap-2 shrink-0 flex-wrap justify-end">
        <span className={`status-badge ${STATUS_STYLES[user.status] ?? ""}`}>
          {user.status}
        </span>
        <span className={`status-badge ${ROLE_STYLES[user.role] ?? ""}`}>
          {user.role}
        </span>

        {user.status === "pending" && (
          <>
              <button
                onClick={() => onPatch(user.id, { status: "approved" })}
                className="btn-secondary text-emerald-700 border-emerald-300/70 hover:border-emerald-400/70 hover:bg-emerald-50"
              >
                Approve
              </button>
              <button
                onClick={() => onPatch(user.id, { status: "rejected" })}
                className="btn-danger"
              >
                Reject
              </button>
          </>
        )}

        {user.status === "approved" && !isSelf && (
          <button
            onClick={() => onPatch(user.id, { status: "rejected" })}
            className="btn-secondary hover:text-red-700 hover:border-red-300/70"
          >
            Revoke
          </button>
        )}

        {user.status === "rejected" && (
          <button
            onClick={() => onPatch(user.id, { status: "approved" })}
            className="btn-secondary hover:text-emerald-700 hover:border-emerald-300/70"
          >
            Re-approve
          </button>
        )}

        {user.status === "approved" && user.role === "user" && (
          <button
            onClick={() => onPatch(user.id, { role: "admin" })}
            className="btn-secondary"
          >
            Make admin
          </button>
        )}

        {user.role === "admin" && user.status === "approved" && (
          <button
            onClick={() => onPatch(user.id, { role: "user" })}
            className="btn-secondary"
          >
            Remove admin
          </button>
        )}
      </div>
    </div>
  );
}
