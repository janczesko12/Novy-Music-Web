import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

export const SESSION_COOKIE = "novy_youtube_session";
export const STATE_COOKIE = "novy_google_oauth_state";

function encryptionKey() {
  const secret = process.env.AUTH_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error("Brak AUTH_SECRET lub jest za krótkie (wymagane co najmniej 32 znaki).");
  }
  return createHash("sha256").update(secret).digest();
}

export function encryptSession(session) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(JSON.stringify(session), "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, ciphertext]).toString("base64url");
}

export function decryptSession(value) {
  if (!value) return null;
  try {
    const data = Buffer.from(value, "base64url");
    if (data.length < 29) return null;
    const iv = data.subarray(0, 12);
    const tag = data.subarray(12, 28);
    const ciphertext = data.subarray(28);
    const decipher = createDecipheriv("aes-256-gcm", encryptionKey(), iv);
    decipher.setAuthTag(tag);
    const plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString("utf8");
    const session = JSON.parse(plaintext);
    if (!session?.profile?.email || !session?.accessToken) return null;
    return session;
  } catch {
    return null;
  }
}

export function cookieOptions(maxAge) {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge,
  };
}

export function readSession(request) {
  return decryptSession(request.cookies.get(SESSION_COOKIE)?.value || "");
}

export function writeSession(response, session) {
  response.cookies.set(SESSION_COOKIE, encryptSession(session), cookieOptions(60 * 60 * 24 * 30));
}

export async function getUsableAccessToken(session) {
  if (session.accessToken && Number(session.expiresAt || 0) > Date.now() + 60_000) {
    return { session, accessToken: session.accessToken, refreshed: false };
  }
  if (!session.refreshToken) {
    return { session, accessToken: null, refreshed: false, error: "Brak tokenu odświeżania. Połącz ponownie konto YouTube." };
  }

  const body = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID || "",
    client_secret: process.env.GOOGLE_CLIENT_SECRET || "",
    refresh_token: session.refreshToken,
    grant_type: "refresh_token",
  });
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
    cache: "no-store",
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || !data.access_token) {
    return { session, accessToken: null, refreshed: false, error: "Nie udało się odświeżyć dostępu. Połącz ponownie konto YouTube." };
  }

  const updated = {
    ...session,
    accessToken: data.access_token,
    refreshToken: data.refresh_token || session.refreshToken,
    expiresAt: Date.now() + Number(data.expires_in || 3600) * 1000,
  };
  return { session: updated, accessToken: updated.accessToken, refreshed: true };
}

export function redirectUriFor(request) {
  return process.env.GOOGLE_REDIRECT_URI || `${new URL(request.url).origin}/api/auth/google/callback`;
}
