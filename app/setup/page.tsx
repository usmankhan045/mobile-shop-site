"use client";

import { FormEvent, useState } from "react";
import { ArrowRight, ShieldCheck } from "lucide-react";

export default function SetupPage() {
  const [form, setForm] = useState({ name: "", email: "", password: "" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  async function submit(event: FormEvent) {
    event.preventDefault(); setLoading(true); setError("");
    const response = await fetch("/api/auth/setup", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
    const payload = await response.json().catch(() => ({})); setLoading(false);
    if (!response.ok) { setError(payload.error || "Unable to complete setup."); return; }
    window.location.replace("/?view=home");
  }
  return <main className="auth-shell"><div className="auth-brand"><div className="brand-mark">L</div><div><strong>ledgerline</strong><span>shop operations</span></div></div><section className="auth-card"><div className="auth-icon"><ShieldCheck size={20} /></div><span className="eyebrow">FIRST-RUN SETUP</span><h1>Make it yours.</h1><p className="subtle">Create the private admin account for your shop.</p><form onSubmit={submit}><label>Your name<input autoFocus value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} placeholder="Asad Khan" required /></label><label>Email address<input type="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} placeholder="you@example.com" required /></label><label>Password<input type="password" minLength={8} value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })} placeholder="At least 8 characters" required /></label>{error && <p className="form-error">{error}</p>}<button className="button primary full-button" disabled={loading}>{loading ? "Creating access..." : <>Create admin access <ArrowRight size={16} /></>}</button></form><a className="setup-link" href="/login">Already set up? Sign in</a></section><small className="auth-footer">Private shop workspace · Asia/Karachi</small></main>;
}
