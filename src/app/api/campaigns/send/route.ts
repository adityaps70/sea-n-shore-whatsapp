import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendTemplateMessage } from "@/lib/meta";

const schema = z.object({
  campaignId: z.string().uuid(),
  limit: z.number().int().min(1).max(100).default(25),
});

export async function POST(request: NextRequest) {
  const secret = request.headers.get("x-internal-secret");
  if (!process.env.INTERNAL_API_SECRET || secret !== process.env.INTERNAL_API_SECRET) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  const parsed = schema.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ ok: false, error: parsed.error.flatten() }, { status: 400 });

  const supabase = createAdminClient();
  const { data: campaign, error: campaignError } = await supabase
    .from("campaigns")
    .select("id,name,template_name,language_code,status")
    .eq("id", parsed.data.campaignId)
    .single();

  if (campaignError || !campaign) return NextResponse.json({ ok: false, error: "campaign_not_found" }, { status: 404 });
  if (!["draft", "ready", "sending"].includes(campaign.status)) {
    return NextResponse.json({ ok: false, error: "campaign_not_sendable" }, { status: 409 });
  }

  const { data: contacts, error: contactsError } = await supabase
    .from("contacts")
    .select("id,phone_e164,full_name")
    .eq("marketing_status", "eligible")
    .is("opted_out_at", null)
    .limit(parsed.data.limit);

  if (contactsError) throw contactsError;

  let sent = 0;
  const failures: Array<{ contactId: string; error: string }> = [];

  for (const contact of contacts ?? []) {
    const { data: existing } = await supabase
      .from("messages")
      .select("id")
      .eq("campaign_id", campaign.id)
      .eq("contact_id", contact.id)
      .maybeSingle();
    if (existing) continue;

    try {
      const result = await sendTemplateMessage({
        to: contact.phone_e164.replace("+", ""),
        templateName: campaign.template_name,
        languageCode: campaign.language_code || "en",
        bodyParameters: contact.full_name ? [contact.full_name] : undefined,
      });
      const metaMessageId = result?.messages?.[0]?.id ?? null;
      await supabase.from("messages").insert({
        campaign_id: campaign.id,
        contact_id: contact.id,
        to_number: contact.phone_e164,
        meta_message_id: metaMessageId,
        status: "accepted",
        provider_response: result,
      });
      sent++;
    } catch (error) {
      failures.push({ contactId: contact.id, error: error instanceof Error ? error.message : "unknown_error" });
    }
  }

  await supabase.from("campaigns").update({ status: failures.length ? "sending" : "sending" }).eq("id", campaign.id);

  return NextResponse.json({ ok: true, sent, failures });
}
