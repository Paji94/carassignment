import { NextRequest, NextResponse } from "next/server";
import { runCheckCycle } from "@/lib/checkCycle";

export const dynamic = "force-dynamic";

/**
 * 外部スケジューラ（Vercel Cron / GitHub Actions / cron-job.org 等）から
 * 5分おきに呼び出すためのエンドポイント。常時起動サーバーで `server.js` の
 * node-cron を使う場合はこのエンドポイントを叩く必要はない。
 */
async function handle(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const header = req.headers.get("authorization");
    if (header !== `Bearer ${secret}`) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }
  }

  try {
    const result = await runCheckCycle();
    return NextResponse.json(result);
  } catch (err) {
    console.error("[cron/check] failed", err);
    return NextResponse.json({ error: "check failed" }, { status: 500 });
  }
}

export const GET = handle;
export const POST = handle;
