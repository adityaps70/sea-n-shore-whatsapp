import { NextRequest, NextResponse } from "next/server";
import { env, hasSupabaseServerEnv } from "@/lib/env";
import { createAdminClient } from "@/lib/supabase/admin";
import { verifyMetaSignature } from "@/lib/meta";

export async function GET(request: NextRequest) {
  const mode = request.nextUrl.searchParams.get("hub.mode");
  const token = request.nextUrl.searchParams.get("hub.verify_token");
  const challenge = request.nextUrl.searchParams.get("hub.challenge");
  const tokenMatch = Boolean(token && token === env.whatsappVerifyToken);
  const valid = mode === "subscribe" && tokenMatch && Boolean(challenge);

  if (hasSupabaseServerEnv()) {
    try {
      const supabase = createAdminClient();
      await supabase.from("webhook_events").insert({
        provider: "meta_whatsapp",
        event_type: "verification_attempt",
        payload: {
          mode,
          token_match: tokenMatch,
          challenge_present: Boolean(challenge),
          valid,
          user_agent: request.headers.get("user-agent"),
        },
      });
    } catch {
      // Diagnostics must never block the verification handshake.
    }
  }

  if (valid && challenge) {
    return new NextResponse(challenge, {
      status: 200,
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "no-store, max-age=0",
      },
    });
  }

  return new NextResponse("Forbidden", {
    status: 403,
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-store, max-age=0",
    },
  });
}

export async function POST(request: NextRequest) {
  const rawBody = await request.text();
  const signature = request.headers.get("x-hub-signature-256");

  if (!verifyMetaSignature(rawBody, signature)) {
    return NextResponse.json({ ok: false, error: "invalid_signature" }, { status: 401 });
  }

  const payload = JSON.parse(rawBody);

  if (hasSupabaseServerEnv()) {
    const supabase = createAdminClient();
    await supabase.from("webhook_events").insert({
      provider: "meta_whatsapp",
      event_type: "messages",
      payload,
    });

    const changes = payload?.entry?.flatMap((entry: any) => entry?.changes ?? []) ?? [];
    for (const change of changes) {
      if (change?.field && change.field !== "messages") {
        await supabase.from("whatsapp_asset_events").insert({
          field: change.field,
          payload: change.value ?? change,
        });
      }
      const statuses = change?.value?.statuses ?? [];
      for (const status of statuses) {
        const statusUpdate = {
          status: status.status,
          provider_status_payload: status,
          updated_at: new Date().toISOString(),
        };

        await supabase
          .from("messages")
          .update(statusUpdate)
          .eq("meta_message_id", status.id);

        await supabase
          .from("service_messages")
          .update(statusUpdate)
          .eq("meta_message_id", status.id);
      }

      const incoming = change?.value?.messages ?? [];
      for (const message of incoming) {
        await supabase.from("inbound_messages").insert({
          meta_message_id: message.id,
          from_number: message.from,
          message_type: message.type,
          payload: message,
        });
      }
    }
  }

  return NextResponse.json({ ok: true });
}
