import { NextRequest, NextResponse } from "next/server";
import { env, hasWhatsAppEnv } from "@/lib/env";
import { isAdminRequest } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";

const TEMPLATE_NAME = "sea_n_shore_launch_2026_v1";
const LANGUAGE = "en_US";

export async function POST(request: NextRequest) {
  if (!isAdminRequest(request)) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  if (!hasWhatsAppEnv() || !env.whatsappBusinessAccountId) {
    return NextResponse.redirect(new URL("/campaigns?template=missing_env", request.url), 303);
  }

  const supabase = createAdminClient();
  const existing = await supabase
    .from("meta_templates")
    .select("name,status")
    .eq("name", TEMPLATE_NAME)
    .maybeSingle();

  if (existing.data) {
    return NextResponse.redirect(
      new URL(`/campaigns?template=existing&status=${encodeURIComponent(existing.data.status || "UNKNOWN")}`, request.url),
      303
    );
  }

  const response = await fetch(
    `https://graph.facebook.com/${env.whatsappGraphApiVersion}/${env.whatsappBusinessAccountId}/message_templates`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.whatsappAccessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name: TEMPLATE_NAME,
        language: LANGUAGE,
        category: "MARKETING",
        components: [
          {
            type: "HEADER",
            format: "TEXT",
            text: "Sea N Shore is live ⚓",
          },
          {
            type: "BODY",
            text:
              "The new Sea N Shore maritime community is now live. Build your profile, connect with maritime professionals, explore jobs, events and learning opportunities, and stay visible to the industry. Join early and set up your profile today.",
          },
          {
            type: "FOOTER",
            text: "Reply STOP to opt out.",
          },
          {
            type: "BUTTONS",
            buttons: [
              {
                type: "URL",
                text: "Join Sea N Shore",
                url: "https://seanshore.in",
              },
            ],
          },
        ],
      }),
      cache: "no-store",
    }
  );

  const payload = await response.json();

  await supabase.from("audit_log").insert({
    action: "meta.template.create",
    entity_type: "message_template",
    entity_id: TEMPLATE_NAME,
    details: {
      ok: response.ok,
      status: payload?.status ?? null,
      category: payload?.category ?? "MARKETING",
      meta_template_id: payload?.id ?? null,
      error_code: payload?.error?.code ?? null,
      error_message: payload?.error?.message ?? null,
    },
  });

  if (!response.ok) {
    const url = new URL("/campaigns", request.url);
    url.searchParams.set("template", "error");
    if (payload?.error?.code) url.searchParams.set("code", String(payload.error.code));
    return NextResponse.redirect(url, 303);
  }

  await supabase.from("meta_templates").insert({
    meta_template_id: payload?.id ?? null,
    name: TEMPLATE_NAME,
    language: LANGUAGE,
    category: payload?.category ?? "MARKETING",
    status: payload?.status ?? "PENDING",
    provider_response: payload,
  });

  return NextResponse.redirect(
    new URL(`/campaigns?template=submitted&status=${encodeURIComponent(payload?.status || "PENDING")}`, request.url),
    303
  );
}
