import { NextResponse } from "next/server";
import { getServerClient } from "@/lib/supabase";

type Body = { match_id: string; status: "confirmed" | "dismissed" };

export async function POST(req: Request) {
  const body = (await req.json()) as Body;
  if (!body.match_id || !["confirmed", "dismissed"].includes(body.status)) {
    return NextResponse.json({ error: "bad payload" }, { status: 400 });
  }

  const supabase = getServerClient();
  const { error } = await supabase
    .from("matches")
    .update({ status: body.status, reviewed_at: new Date().toISOString() })
    .eq("id", body.match_id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
