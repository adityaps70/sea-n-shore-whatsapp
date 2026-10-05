import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendTemplateMessage } from "@/lib/meta";
import { isAdminRequest } from "@/lib/auth";

function isLegacyClaimTemplate(templateName: string) {
  return templateName.startsWith("sea_n_shore_legacy_claim_");
}

function maskEmail(email: string) {
  const [local, domain] = email.trim().toLowerCase().split("@");
  if (!local || !domain) return email;
  const visible = local.slice(0, Math.min(2, local.length));
  return `${visible}***@${domain}`;
}

const schema = z.object({
  campaignId: z.string().uuid(),
  limit: z.number().int().min(1).max(100).default(25),
});

async function readInput(request: NextRequest) {
  const type = request.headers.get("content-type") || "";
  if (type.includes("application/json")) {
    return { data: await request.json(), browserForm: false };
  }
  const form = await request.formData();
  return {
    data: {
      campaignId: String(form.get("campaignId") || ""),
      limit: Number(form.get("limit") || 25),
    },
    browserForm: true,
  };
}

export async function POST(request: NextRequest) {
  const secret = request.headers.get("x-internal-secret");
  const internalAuthorized = Boolean(
    process.env.INTERNAL_API_SECRET && secret === process.env.INTERNAL_API_SECRET
  );
  const adminAuthorized = isAdminRequest(request);

  if (!internalAuthorized && !adminAuthorized) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  const input = await readInput(request);
  const parsed = schema.safeParse(input.data);
  if (!parsed.success) {
    if (input.browserForm) return NextResponse.redirect(new URL("/campaigns?error=invalid_request", request.url), 303);
    return NextResponse.json({ ok: false, error: parsed.error.flatten() }, { status: 400 });
  }

  const supabase = createAdminClient();
  const { data: campaign, error: campaignError } = await supabase
    .from("campaigns")
    .select("id,name,template_name,language_code,status,target_filter,use_name_parameter,header_media_id")
    .eq("id", parsed.data.campaignId)
    .single();

  if (campaignError || !campaign) {
    if (input.browserForm) return NextResponse.redirect(new URL("/campaigns?error=campaign_not_found", request.url), 303);
    return NextResponse.json({ ok: false, error: "campaign_not_found" }, { status: 404 });
  }

  if (!["draft", "ready", "sending"].includes(campaign.status)) {
    if (input.browserForm) return NextResponse.redirect(new URL("/campaigns?error=campaign_not_sendable", request.url), 303);
    return NextResponse.json({ ok: false, error: "campaign_not_sendable" }, { status: 409 });
  }

  const legacyClaimTemplate = isLegacyClaimTemplate(campaign.template_name);
  if (legacyClaimTemplate && !campaign.header_media_id) {
    if (input.browserForm) return NextResponse.redirect(new URL("/campaigns?error=missing_header_image", request.url), 303);
    return NextResponse.json({ ok: false, error: "missing_header_image" }, { status: 409 });
  }

  // Supabase/PostgREST commonly caps a single response at 1,000 rows.
  // Read every existing campaign message in pages so already-processed contacts
  // stay excluded after a campaign grows beyond the first 1,000 recipients.
  const sentIds = new Set<string>();
  const pageSize = 1000;
  for (let from = 0; ; from += pageSize) {
    const { data: page, error } = await supabase
      .from("messages")
      .select("id,contact_id")
      .eq("campaign_id", campaign.id)
      .order("id", { ascending: true })
      .range(from, from + pageSize - 1);

    if (error) throw error;
    for (const row of page ?? []) sentIds.add(row.contact_id);
    if (!page || page.length < pageSize) break;
  }

  const category = (campaign.target_filter as { category?: string } | null)?.category;
  const contacts: Array<{ id: string; phone_e164: string; full_name: string | null; email: string | null }> = [];

  // Page through the whole eligible audience rather than repeatedly receiving
  // only Supabase's first 1,000 rows.
  for (let from = 0; contacts.length < parsed.data.limit; from += pageSize) {
    let contactQuery = supabase
      .from("contacts")
      .select("id,phone_e164,full_name,email")
      .eq("marketing_status", "eligible")
      .not("consent_source", "is", null)
      .not("consent_at", "is", null)
      .is("opted_out_at", null)
      .order("id", { ascending: true })
      .range(from, from + pageSize - 1);

    if (category) contactQuery = contactQuery.eq("category", category);

    const { data: page, error: contactsError } = await contactQuery;
    if (contactsError) throw contactsError;

    for (const contact of page ?? []) {
      if (!sentIds.has(contact.id)) {
        contacts.push(contact);
        if (contacts.length >= parsed.data.limit) break;
      }
    }

    if (!page || page.length < pageSize) break;
  }

  if (contacts.length === 0) {
    await supabase.from("campaigns").update({
      status: "completed",
      completed_at: new Date().toISOString(),
    }).eq("id", campaign.id);

    if (input.browserForm) return NextResponse.redirect(new URL("/campaigns?sent=0&failed=0", request.url), 303);
    return NextResponse.json({ ok: true, sent: 0, failures: [], completed: true });
  }

  if (campaign.status !== "sending") {
    await supabase.from("campaigns").update({
      status: "sending",
      started_at: campaign.status === "ready" ? new Date().toISOString() : undefined,
      completed_at: null,
    }).eq("id", campaign.id);
  }

  let sent = 0;
  const failures: Array<{ contactId: string; error: string }> = [];

  for (const contact of contacts) {
    try {
      if (legacyClaimTemplate && !contact.email) {
        throw new Error("legacy_claim_contact_missing_email");
      }

      const bodyParameters = legacyClaimTemplate
        ? [
            contact.full_name?.trim() || "Sea N Shore member",
            maskEmail(contact.email || ""),
          ]
        : campaign.use_name_parameter && contact.full_name
          ? [contact.full_name]
          : undefined;

      const result = await sendTemplateMessage({
        to: contact.phone_e164.replace("+", ""),
        templateName: campaign.template_name,
        languageCode: campaign.language_code || "en",
        bodyParameters,
        headerImageId: legacyClaimTemplate ? campaign.header_media_id || undefined : undefined,
        urlButtonParameter: legacyClaimTemplate && contact.email ? encodeURIComponent(contact.email) : undefined,
        urlButtonIndex: 0,
      });

      const metaMessageId = result?.messages?.[0]?.id ?? null;
      const { error: insertError } = await supabase.from("messages").insert({
        campaign_id: campaign.id,
        contact_id: contact.id,
        to_number: contact.phone_e164,
        meta_message_id: metaMessageId,
        status: "accepted",
        provider_response: result,
      });
      if (insertError) throw insertError;
      sent++;
    } catch (error) {
      const message = error instanceof Error ? error.message : "unknown_error";
      failures.push({ contactId: contact.id, error: message });

      // Record an immediate send failure so automatic sending can move forward
      // instead of retrying the same bad contact forever.
      await supabase.from("messages").insert({
        campaign_id: campaign.id,
        contact_id: contact.id,
        to_number: contact.phone_e164,
        meta_message_id: null,
        status: "failed",
        provider_response: { error: message, stage: "send_request" },
      });
    }
  }

  await supabase.from("audit_log").insert({
    action: "campaign.send_batch",
    entity_type: "campaign",
    entity_id: campaign.id,
    details: { requested: contacts.length, sent, failed: failures.length, legacy_claim: legacyClaimTemplate },
  });

  if (input.browserForm) {
    return NextResponse.redirect(
      new URL(`/campaigns?sent=${sent}&failed=${failures.length}`, request.url),
      303
    );
  }

  return NextResponse.json({ ok: true, sent, failures, completed: false });
}
