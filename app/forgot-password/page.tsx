"use client";

import { FormEvent, useState } from "react";
import { ArrowRight, Mail, ShieldCheck } from "lucide-react";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState(""); const [message, setMessage] = useState(""); const [loading, setLoading] = useState(false);
  async function submit(event: FormEvent) { event.preventDefault(); setLoading(true); setMessage(""); const response = await fetch("/api/auth/forgot-password", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email }) }); const payload = await response.json().catch(() => ({})); setLoading(false); setMessage(payload.message || "If a verified recovery email exists, a reset link has been sent."); }
  return <main className="auth-shell"><div className="auth-brand"><div className="brand-mark">L</div><div><strong>ledgerline</strong><span>shop operations</span></div></div><section className="auth-card"><div className="auth-icon"><Mail size={20} /></div><span className="eyebrow">ACCOUNT RECOVERY</span><h1>Reset access.</h1><p className="subtle">Enter the recovery email verified for this shop. We’ll send a single-use reset link.</p><form onSubmit={submit}><label>Recovery email<input autoFocus type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="owner@example.com" required /></label>{message && <p className="form-success"><ShieldCheck size={14} />{message}</p>}<button className="button primary full-button" disabled={loading}>{loading ? "Checking email..." : <>Send reset link <ArrowRight size={16} /></>}</button></form><a className="setup-link" href="/login">Back to sign in</a></section></main>;
}
