import { NextRequest, NextResponse } from "next/server";
import { isAdminRequest } from "@/lib/auth";
import { hasSupabaseServerEnv, hasWhatsAppEnv } from "@/lib/env";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendTextMessage } from "@/lib/meta";

const TEST_BODY = "Sea N Shore Cloudflare outbound production test ✅";

export async function POST(request: NextRequest) {
  if (!isAdminRequest(request)) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  if (!hasSupabaseServerEnv() || !hasWhatsAppEnv()) {
    return NextResponse.redirect(new URL("/?reply=missing_env", request.url), 303);
  }

  const supabase = createAdminClient();
  const windowStart = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  const latest = await supabase
    .from("inbound_messages")
    .select("from_number,received_at")
    .gte("received_at", windowStart)
    .order("received_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (latest.error || !latest.data?.from_number) {
    return NextResponse.redirect(new URL("/?reply=no_open_window", request.url), 303);
  }

  try {
    const provider = await sendTextMessage({
      to: latest.data.from_number,
      body: TEST_BODY,
    });

    const metaMessageId = provider?.messages?.[0]?.id ?? null;
    await supabase.from("service_messages").insert({
      to_number: latest.data.from_number,
      body: TEST_BODY,
      meta_message_id: metaMessageId,
      status: "sent",
      provider_response: provider,
    });

    await supabase.from("audit_log").insert({
      action: "meta.service_message.test",
      entity_type: "whatsapp_number",
      entity_id: latest.data.from_number,
      details: {
        ok: true,
        meta_message_id: metaMessageId,
        inbound_received_at: latest.data.received_at,
      },
    });

    return NextResponse.redirect(new URL("/?reply=sent", request.url), 303);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown Meta API error";
    await supabase.from("audit_log").insert({
      action: "meta.service_message.test",
      entity_type: "whatsapp_number",
      entity_id: latest.data.from_number,
      details: { ok: false, error: message },
    });

    const url = new URL("/", request.url);
    url.searchParams.set("reply", "error");
    return NextResponse.redirect(url, 303);
  }
}
