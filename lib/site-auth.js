export const SITE_SESSION_COOKIE = "novy_music_session";
export const SITE_SESSION_TTL = 60 * 60 * 24 * 7;

const encoder = new TextEncoder();

async function signatureFor(value, secret) {
  const key = await globalThis.crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const signature = await globalThis.crypto.subtle.sign("HMAC", key, encoder.encode(value));
  let binary = "";
  for (const byte of new Uint8Array(signature)) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function constantTimeTextEqual(a, b) {
  if (typeof a !== "string" || typeof b !== "string" || a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export async function createSiteSessionToken(secret, now = Date.now()) {
  if (!secret) throw new Error("Brak sekretu podpisującego sesję.");
  const issuedAt = String(Math.floor(now / 1000));
  return issuedAt + "." + await signatureFor(issuedAt, secret);
}

export async function verifySiteSessionToken(token, secret, now = Date.now()) {
  if (!token || !secret || typeof token !== "string") return false;
  const pieces = token.split(".");
  if (pieces.length !== 2 || !/^\d{10}$/.test(pieces[0])) return false;

  const issuedAt = Number(pieces[0]);
  const currentTime = Math.floor(now / 1000);
  if (!Number.isSafeInteger(issuedAt) || issuedAt > currentTime + 60) return false;
  if (currentTime - issuedAt > SITE_SESSION_TTL) return false;

  try {
    const expected = await signatureFor(pieces[0], secret);
    return constantTimeTextEqual(pieces[1], expected);
  } catch {
    return false;
  }
}
