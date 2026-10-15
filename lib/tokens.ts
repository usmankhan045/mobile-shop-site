import { createHash, randomBytes } from "node:crypto";
import { getDb } from "./db";

export type AuthTokenPurpose = "email_verification" | "password_reset";

const hashToken = (token: string) => createHash("sha256").update(token).digest("hex");

export async function issueAuthToken(adminId: string, purpose: AuthTokenPurpose, minutes: number) {
  const token = randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + minutes * 60 * 1000);
  await getDb()`DELETE FROM auth_tokens WHERE admin_id = ${adminId} AND purpose = ${purpose}`;
  await getDb()`INSERT INTO auth_tokens (admin_id, token_hash, purpose, expires_at) VALUES (${adminId}, ${hashToken(token)}, ${purpose}, ${expiresAt.toISOString()})`;
  return token;
}

export async function consumeAuthToken(token: string, purpose: AuthTokenPurpose) {
  const rows = await getDb()`UPDATE auth_tokens SET used_at = now() WHERE token_hash = ${hashToken(token)} AND purpose = ${purpose} AND used_at IS NULL AND expires_at > now() RETURNING admin_id`;
  return rows[0]?.admin_id as string | undefined;
}
