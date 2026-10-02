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
        const value = change.value ?? change;
        await supabase.from("whatsapp_asset_events").insert({
          field: change.field,
          payload: value,
        });

        if (
          change.field === "message_template_status_update" ||
          change.field === "message_template_quality_update" ||
          change.field === "template_category_update"
        ) {
          const metaTemplateId =
            value?.message_template_id ??
            value?.message_template?.id ??
            value?.id ??
            null;
          const templateName =
            value?.message_template_name ??
            value?.message_template?.name ??
            value?.name ??
            null;
          const templateStatus =
            value?.event ??
            value?.status ??
            value?.quality_score?.score ??
            null;

          const updates: Record<string, unknown> = {
            updated_at: new Date().toISOString(),
            provider_response: value,
          };
          if (templateStatus) updates.status = String(templateStatus);

          if (metaTemplateId) {
            await supabase
              .from("meta_templates")
              .update(updates)
              .eq("meta_template_id", String(metaTemplateId));
          } else if (templateName) {
            await supabase
              .from("meta_templates")
              .update(updates)
              .eq("name", String(templateName));
          }
        }
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

        if (message.type === "text" && message.text?.body) {
          const command = String(message.text.body).trim().toUpperCase();
          const phoneE164 = `+${String(message.from).replace(/\\D/g, "")}`;
          const now = new Date().toISOString();

          const optOutCommands = new Set(["STOP", "UNSUBSCRIBE", "CANCEL", "END", "QUIT"]);
          const optInCommands = new Set(["START", "SUBSCRIBE"]);

          if (optOutCommands.has(command) || optInCommands.has(command)) {
            const existing = await supabase
              .from("contacts")
              .select("id")
              .eq("phone_e164", phoneE164)
              .maybeSingle();

            let contactId = existing.data?.id ?? null;

            if (optOutCommands.has(command)) {
              if (contactId) {
                await supabase
                  .from("contacts")
                  .update({
                    marketing_status: "opted_out",
                    opted_out_at: now,
                    updated_at: now,
                  })
                  .eq("id", contactId);
              } else {
                const inserted = await supabase
                  .from("contacts")
                  .insert({
                    phone_e164: phoneE164,
                    source: "whatsapp_inbound",
                    marketing_status: "opted_out",
                    opted_out_at: now,
                    metadata: { created_from: "whatsapp_opt_out_keyword" },
                  })
                  .select("id")
                  .single();
                contactId = inserted.data?.id ?? null;
              }

              await supabase.from("consent_events").insert({
                contact_id: contactId,
                phone_e164: phoneE164,
                event_type: "opt_out",
                source: "whatsapp_inbound_keyword",
                consent_text: command,
                metadata: { meta_message_id: message.id },
              });
            }

            if (optInCommands.has(command)) {
              if (contactId) {
                await supabase
                  .from("contacts")
                  .update({
                    marketing_status: "eligible",
                    consent_source: "whatsapp_inbound_keyword",
                    consent_at: now,
                    opted_out_at: null,
                    updated_at: now,
                  })
                  .eq("id", contactId);
              } else {
                const inserted = await supabase
                  .from("contacts")
                  .insert({
                    phone_e164: phoneE164,
                    source: "whatsapp_inbound",
                    marketing_status: "eligible",
                    consent_source: "whatsapp_inbound_keyword",
                    consent_at: now,
                    metadata: { created_from: "whatsapp_opt_in_keyword" },
                  })
                  .select("id")
                  .single();
                contactId = inserted.data?.id ?? null;
              }

              await supabase.from("consent_events").insert({
                contact_id: contactId,
                phone_e164: phoneE164,
                event_type: "opt_in",
                source: "whatsapp_inbound_keyword",
                consent_text: command,
                metadata: { meta_message_id: message.id },
              });
            }
          }
        }
      }
    }
  }

  return NextResponse.json({ ok: true });
}
