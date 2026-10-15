"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, CircleAlert, LoaderCircle } from "lucide-react";

export default function VerifyEmailPage() {
  const [state, setState] = useState<"loading" | "success" | "error">("loading");
  const [message, setMessage] = useState("Verifying your recovery email...");
  useEffect(() => {
    const token = new URLSearchParams(window.location.search).get("token") || "";
    if (!token) { setState("error"); setMessage("This verification link is missing a token."); return; }
    fetch("/api/auth/verify-email", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token }) }).then(async (response) => {
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || "This verification link is invalid or expired.");
      setState("success"); setMessage("Recovery email verified. You can use it to reset access if needed.");
    }).catch((error) => { setState("error"); setMessage(error instanceof Error ? error.message : "Unable to verify this email."); });
  }, []);
  return <main className="auth-shell"><section className="auth-card auth-status-card"><div className={`auth-icon ${state === "error" ? "error" : ""}`}>{state === "loading" ? <LoaderCircle size={20} className="spin" /> : state === "success" ? <CheckCircle2 size={20} /> : <CircleAlert size={20} />}</div><span className="eyebrow">EMAIL VERIFICATION</span><h1>{state === "success" ? "You’re verified." : state === "error" ? "Link unavailable." : "One moment."}</h1><p className="subtle">{message}</p>{state !== "loading" && <a className="button primary full-button" href="/login">Return to sign in</a>}</section></main>;
}
