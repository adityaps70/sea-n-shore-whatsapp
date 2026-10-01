import crypto from "node:crypto";

export const ADMIN_COOKIE = "sns_admin_session";
const SESSION_HOURS = 8;

function authSecret() {
  const secret = process.env.DASHBOARD_AUTH_SECRET;
  if (!secret) throw new Error("DASHBOARD_AUTH_SECRET is not configured.");
  return secret;
}

function sign(payload: string) {
  return crypto.createHmac("sha256", authSecret()).update(payload).digest("hex");
}

export function createAdminSession(email: string) {
  const payload = Buffer.from(
    JSON.stringify({
      email: email.trim().toLowerCase(),
      exp: Date.now() + SESSION_HOURS * 60 * 60 * 1000,
    })
  ).toString("base64url");

  return `${payload}.${sign(payload)}`;
}

export function verifyAdminSession(token?: string | null) {
  if (!token) return null;

  const [payload, signature] = token.split(".");
  if (!payload || !signature) return null;

  const expected = sign(payload);
  if (signature.length !== expected.length) return null;

  const valid = crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expected)
  );
  if (!valid) return null;

  try {
    const parsed = JSON.parse(
      Buffer.from(payload, "base64url").toString("utf8")
    ) as { email?: string; exp?: number };

    if (!parsed.email || !parsed.exp || parsed.exp < Date.now()) return null;

    const allowed = (process.env.ADMIN_EMAILS || "")
      .split(",")
      .map((v) => v.trim().toLowerCase())
      .filter(Boolean);

    if (!allowed.includes(parsed.email)) return null;

    return parsed;
  } catch {
    return null;
  }
}

export function validateAdminCredentials(email: string, password: string) {
  const normalizedEmail = email.trim().toLowerCase();
  const allowed = (process.env.ADMIN_EMAILS || "")
    .split(",")
    .map((v) => v.trim().toLowerCase())
    .filter(Boolean);

  const expectedPassword = process.env.DASHBOARD_ADMIN_PASSWORD || "";
  if (!allowed.includes(normalizedEmail) || !expectedPassword) return false;

  const supplied = Buffer.from(password);
  const expected = Buffer.from(expectedPassword);
  if (supplied.length !== expected.length) return false;

  return crypto.timingSafeEqual(supplied, expected);
}
