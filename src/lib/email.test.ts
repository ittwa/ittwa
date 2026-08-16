import { describe, it, expect, vi, afterEach } from "vitest";
import { buildResultsEmail, sendAuctionResultsEmail } from "./email";

describe("buildResultsEmail", () => {
  const csv = "ID,Nominator,Owner,Player,Position,Years,Salary\n001,Clancy,Katz,Dyami Brown,WR,3,50.0";
  const base = { season: "2026", csv, from: "ITTWA Auction <auction@ittwa.com>", to: "ittwaffl@gmail.com" };

  it("addresses the configured from/to and names the season in the subject", () => {
    const p = buildResultsEmail(base);
    expect(p.from).toBe("ITTWA Auction <auction@ittwa.com>");
    expect(p.to).toEqual(["ittwaffl@gmail.com"]);
    expect(p.subject).toContain("2026");
  });

  it("attaches the CSV as a season-named file, base64-encoded", () => {
    const p = buildResultsEmail(base);
    expect(p.attachments).toHaveLength(1);
    const att = p.attachments[0];
    expect(att.filename).toBe("ittwa-fa-auction-2026.csv");
    // The attachment must decode back to the exact CSV bytes we passed in.
    expect(Buffer.from(att.content, "base64").toString("utf8")).toBe(csv);
  });

  it("carries the recipient override through unchanged", () => {
    const p = buildResultsEmail({ ...base, to: "someone-else@example.com" });
    expect(p.to).toEqual(["someone-else@example.com"]);
  });
});

describe("sendAuctionResultsEmail", () => {
  const csv = "ID,Nominator,Owner,Player,Position,Years,Salary\n001,Clancy,Katz,Dyami Brown,WR,3,50.0";

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it("skips (never calls fetch) when RESEND_API_KEY is unset", async () => {
    vi.stubEnv("RESEND_API_KEY", "");
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const r = await sendAuctionResultsEmail({ season: "2026", csv });
    expect(r).toEqual({ sent: false, skipped: expect.stringContaining("RESEND_API_KEY") });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("POSTs to Resend with the bearer key and the built payload on success", async () => {
    vi.stubEnv("RESEND_API_KEY", "re_test_key");
    vi.stubEnv("AUCTION_RESULTS_FROM", "ITTWA Auction <auction@ittwa.com>");
    vi.stubEnv("AUCTION_RESULTS_TO", "ittwaffl@gmail.com");
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ id: "abc" }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    const r = await sendAuctionResultsEmail({ season: "2026", csv });
    expect(r).toEqual({ sent: true });

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://api.resend.com/emails");
    expect(init.method).toBe("POST");
    expect(init.headers.Authorization).toBe("Bearer re_test_key");
    const body = JSON.parse(init.body);
    expect(body.to).toEqual(["ittwaffl@gmail.com"]);
    expect(body.attachments[0].filename).toBe("ittwa-fa-auction-2026.csv");
    expect(Buffer.from(body.attachments[0].content, "base64").toString("utf8")).toBe(csv);
  });

  it("returns an error (not a throw) when Resend responds non-2xx", async () => {
    vi.stubEnv("RESEND_API_KEY", "re_test_key");
    vi.stubGlobal("fetch", vi.fn(async () => new Response("nope", { status: 422 })));
    const r = await sendAuctionResultsEmail({ season: "2026", csv });
    expect(r).toEqual({ sent: false, error: expect.stringContaining("422") });
  });

  it("returns an error when fetch itself throws (network down)", async () => {
    vi.stubEnv("RESEND_API_KEY", "re_test_key");
    vi.stubGlobal("fetch", vi.fn(async () => { throw new Error("ECONNREFUSED"); }));
    const r = await sendAuctionResultsEmail({ season: "2026", csv });
    expect(r).toEqual({ sent: false, error: "ECONNREFUSED" });
  });
});
