// Email delivery via Resend's REST API (https://resend.com/docs/api-reference).
//
// Kept as a thin fetch wrapper to match lib/sleeper.ts and lib/sheets.ts — no
// SDK dependency. Server-side only: RESEND_API_KEY must never be exposed to the
// client (no NEXT_PUBLIC_ prefix).
//
// Config (Vercel env vars):
//   RESEND_API_KEY        required to actually send; absent → send is skipped.
//   AUCTION_RESULTS_FROM  the From address. MUST be on a domain verified in
//                         Resend (ittwa.com). Defaults to auction@ittwa.com.
//   AUCTION_RESULTS_TO    recipient; defaults to the league inbox below.

const RESEND_ENDPOINT = "https://api.resend.com/emails";
const DEFAULT_TO = "ittwaffl@gmail.com";
const DEFAULT_FROM = "ITTWA Auction <auction@ittwa.com>";

export interface ResultsEmailInput {
  season: string;
  csv: string;
  from: string;
  to: string;
}

// Resend's /emails payload. Attachment `content` is a base64 string.
interface ResendPayload {
  from: string;
  to: string[];
  subject: string;
  text: string;
  attachments: { filename: string; content: string }[];
}

// Pure — builds the exact request body. Split out from the network call so it
// can be unit-tested without a key or outbound access.
export function buildResultsEmail(input: ResultsEmailInput): ResendPayload {
  const filename = `ittwa-fa-auction-${input.season}.csv`;
  return {
    from: input.from,
    to: [input.to],
    subject: `ITTWA ${input.season} Free Agent Auction — Final Results`,
    text:
      `The ${input.season} ITTWA Free Agent Auction is complete.\n\n` +
      `The full results are attached as ${filename}.\n\n` +
      `— sent automatically when the auction was marked complete.`,
    attachments: [
      {
        filename,
        content: Buffer.from(input.csv, "utf8").toString("base64"),
      },
    ],
  };
}

export type EmailResult =
  | { sent: true }
  | { sent: false; skipped: string }
  | { sent: false; error: string };

// Sends the auction results CSV. Never throws — returns a result object so the
// caller (the Mark Complete route) can report the outcome without letting an
// email failure block completing the auction.
export async function sendAuctionResultsEmail(args: {
  season: string;
  csv: string;
}): Promise<EmailResult> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.warn("RESEND_API_KEY not set — skipping auction results email");
    return { sent: false, skipped: "RESEND_API_KEY not configured" };
  }

  const payload = buildResultsEmail({
    season: args.season,
    csv: args.csv,
    from: process.env.AUCTION_RESULTS_FROM || DEFAULT_FROM,
    to: process.env.AUCTION_RESULTS_TO || DEFAULT_TO,
  });

  try {
    const res = await fetch(RESEND_ENDPOINT, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      console.error(`Resend API error: ${res.status} ${detail}`);
      return { sent: false, error: `Resend returned ${res.status}` };
    }
    return { sent: true };
  } catch (err) {
    console.error("Failed to send auction results email:", err);
    return { sent: false, error: err instanceof Error ? err.message : "send failed" };
  }
}
