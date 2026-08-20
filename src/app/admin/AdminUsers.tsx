"use client";

import { useState } from "react";
import styles from "./admin.module.css";

export type AdminRow = {
  id: string;
  email: string;
  full_name: string | null;
  job_title: string | null;
  role: "lab_admin" | "tribal_admin" | "tribal_staff";
  status: "invited" | "active" | "suspended";
  created_at: string;
  nation: string | null;
};

export default function AdminUsers({ rows }: { rows: AdminRow[] }) {
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [local, setLocal] = useState(rows);

  async function change(id: string, patch: { role?: AdminRow["role"]; status?: AdminRow["status"] }) {
    setBusy(id);
    setMsg(null);
    const r = await fetch("/api/admin/role", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ user_id: id, ...patch }),
    });
    const j = await r.json();
    setBusy(null);
    if (!r.ok) {
      setMsg(j.error ?? "Couldn't update that account.");
      return;
    }
    setLocal((cur) => cur.map((u) => (u.id === id ? { ...u, ...patch } : u)));
  }

  return (
    <main className={styles.page}>
      <header className={styles.head}>
        <h1 className={styles.title}>Accounts</h1>
        <p className={styles.sub}>
          Staff who signed up with an email at their nation&rsquo;s domain. Promote someone to
          nation admin so their nation can manage its own people.
        </p>
      </header>

      {msg && <p className={styles.error}>{msg}</p>}

      {local.length === 0 ? (
        <p className={styles.empty}>No accounts yet.</p>
      ) : (
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Person</th><th>Nation</th><th>Role</th><th>Status</th><th></th>
            </tr>
          </thead>
          <tbody>
            {local.map((u) => (
              <tr key={u.id}>
                <td>
                  <div className={styles.name}>{u.full_name ?? "—"}</div>
                  <div className={styles.meta}>{u.email}</div>
                  {u.job_title && <div className={styles.meta}>{u.job_title}</div>}
                </td>
                <td>{u.nation ?? <span className={styles.meta}>Lab</span>}</td>
                <td>
                  <span className={styles.role}>{u.role.replace("_", " ")}</span>
                </td>
                <td>
                  <span className={u.status === "active" ? styles.ok : styles.pending}>
                    {u.status}
                  </span>
                </td>
                <td className={styles.actions}>
                  {u.role === "tribal_staff" && (
                    <button disabled={busy === u.id} onClick={() => change(u.id, { role: "tribal_admin" })}>
                      Make nation admin
                    </button>
                  )}
                  {u.role === "tribal_admin" && (
                    <button disabled={busy === u.id} onClick={() => change(u.id, { role: "tribal_staff" })}>
                      Demote to staff
                    </button>
                  )}
                  {u.status !== "suspended" ? (
                    <button disabled={busy === u.id} onClick={() => change(u.id, { status: "suspended" })}>
                      Suspend
                    </button>
                  ) : (
                    <button disabled={busy === u.id} onClick={() => change(u.id, { status: "active" })}>
                      Restore
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </main>
  );
}
