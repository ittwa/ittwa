// Single-PIN admin auth for the auction console. No accounts — the
// commissioner enters AUCTION_ADMIN_PIN once and gets a signed, httpOnly
// cookie. All mutating routes verify the signature server-side; viewers of
// /auction need nothing.

import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";

export const ADMIN_COOKIE_NAME = "ittwa_auction_admin";
const COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 60; // 60 days

function getPin(): string {
  const pin = process.env.AUCTION_ADMIN_PIN;
  if (!pin) throw new Error("AUCTION_ADMIN_PIN is not set");
  return pin;
}

function sign(payload: string, pin: string): string {
  return createHmac("sha256", pin).update(payload).digest("hex");
}

export function checkPin(candidate: string): boolean {
  const pin = getPin();
  const a = Buffer.from(candidate.padEnd(64, "\0"));
  const b = Buffer.from(pin.padEnd(64, "\0"));
  return a.length === b.length && timingSafeEqual(a, b) && candidate === pin;
}

// Builds a signed token: "<issuedAt>.<hmac>". Verified by recomputing the
// HMAC over the same payload — no server-side session storage needed.
export function createAdminToken(): string {
  const pin = getPin();
  const issuedAt = Date.now().toString();
  return `${issuedAt}.${sign(issuedAt, pin)}`;
}

export function verifyAdminToken(token: string | undefined | null): boolean {
  if (!token) return false;
  const pin = process.env.AUCTION_ADMIN_PIN;
  if (!pin) return false;

  const dot = token.indexOf(".");
  if (dot === -1) return false;
  const issuedAt = token.slice(0, dot);
  const signature = token.slice(dot + 1);
  const expected = sign(issuedAt, pin);

  const a = Buffer.from(signature);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return false;

  const age = Date.now() - Number(issuedAt);
  return Number.isFinite(age) && age >= 0 && age < COOKIE_MAX_AGE_SECONDS * 1000;
}

// Server-side check for use inside Route Handlers — reads the httpOnly
// cookie set at login and verifies its signature.
export async function isAdminRequest(): Promise<boolean> {
  const store = await cookies();
  return verifyAdminToken(store.get(ADMIN_COOKIE_NAME)?.value);
}

export const ADMIN_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/",
  maxAge: COOKIE_MAX_AGE_SECONDS,
};
