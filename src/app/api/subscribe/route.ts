import { NextRequest, NextResponse } from "next/server";
import { addSubscription, removeSubscription } from "@/lib/store";

interface SubscribeBody {
  endpoint?: string;
  keys?: { p256dh?: string; auth?: string };
}

export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => null)) as SubscribeBody | null;

  if (!body?.endpoint || !body.keys?.p256dh || !body.keys?.auth) {
    return NextResponse.json({ error: "invalid subscription payload" }, { status: 400 });
  }

  await addSubscription({
    endpoint: body.endpoint,
    keys: { p256dh: body.keys.p256dh, auth: body.keys.auth },
    registeredAt: new Date().toISOString(),
  });

  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest) {
  const body = (await req.json().catch(() => null)) as SubscribeBody | null;
  if (!body?.endpoint) {
    return NextResponse.json({ error: "endpoint is required" }, { status: 400 });
  }
  await removeSubscription(body.endpoint);
  return NextResponse.json({ ok: true });
}
