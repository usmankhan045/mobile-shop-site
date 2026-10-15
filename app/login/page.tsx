"use client";

import { FormEvent, useState } from "react";
import { ArrowRight, KeyRound, LockKeyhole } from "lucide-react";

export default function LoginPage() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault(); setLoading(true); setError("");
    const response = await fetch("/api/auth/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ username, password }) });
    const payload = await response.json().catch(() => ({}));
    setLoading(false);
    if (!response.ok) { setError(payload.error || "Unable to sign in."); return; }
    window.location.replace("/?view=home");
  }

  return <main className="auth-shell"><div className="auth-brand"><div className="brand-mark">L</div><div><strong>ledgerline</strong><span>shop operations</span></div></div><section className="auth-card"><div className="auth-icon"><LockKeyhole size={20} /></div><span className="eyebrow">ADMIN ACCESS</span><h1>Welcome back.</h1><p className="subtle">Sign in to your shop workspace.</p><form onSubmit={submit}><label>Username<input autoFocus type="text" autoCapitalize="none" autoComplete="username" value={username} onChange={(event) => setUsername(event.target.value)} placeholder="admin" required /></label><label>Password<input type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="admin123" required /></label>{error && <p className="form-error">{error}</p>}<button className="button primary full-button" disabled={loading}>{loading ? "Signing in..." : <>Sign in <ArrowRight size={16} /></>}</button></form><a className="setup-link" href="/forgot-password">Forgot password?</a><a className="setup-link" href="/setup"><KeyRound size={14} /> First time here? Set up admin access</a></section><small className="auth-footer">Private shop workspace · Asia/Karachi</small></main>;
}
