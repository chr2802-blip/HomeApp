import { NextResponse } from "next/server";
import { timingSafeEqual } from "crypto";
import { getHealth } from "@/lib/observability";

export const dynamic = "force-dynamic";

/**
 * Two audiences, one endpoint.
 *
 * An uptime monitor needs to reach this without credentials, so the public answer is
 * just the verdict and a timestamp — enough to alert on, and nothing an outsider can
 * learn from. Presenting the cron secret returns the detail behind that verdict.
 */
export async function GET(request: Request) {
  const health = await getHealth();
  const httpStatus = health.status === "down" ? 503 : 200;

  if (!authorized(request)) {
    return NextResponse.json(
      { status: health.status, at: new Date().toISOString() },
      { status: httpStatus, headers: { "cache-control": "no-store" } },
    );
  }

  return NextResponse.json(
    { ...health, at: new Date().toISOString() },
    { status: httpStatus, headers: { "cache-control": "no-store" } },
  );
}

function authorized(request: Request) {
  const expected = process.env.CRON_SECRET;
  if (!expected) return false;

  const header = request.headers.get("authorization") ?? "";
  const provided = header.startsWith("Bearer ") ? header.slice(7) : "";
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}
