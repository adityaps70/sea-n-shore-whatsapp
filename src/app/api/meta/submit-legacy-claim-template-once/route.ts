import { NextRequest, NextResponse } from "next/server";
import { env, hasWhatsAppEnv } from "@/lib/env";
import { createAdminClient } from "@/lib/supabase/admin";
import { isAdminRequest } from "@/lib/auth";

const TEMPLATE_NAME = "sea_n_shore_legacy_claim_2026_v1";
const LANGUAGE = "en_US";

async function audit(details: Record<string, unknown>) {
  try {
    const supabase = createAdminClient();
    await supabase.from("audit_log").insert({
      action: "meta.template.create.legacy_claim",
      entity_type: "message_template",
      entity_id: TEMPLATE_NAME,
      details,
    });
  } catch {}
}

export async function POST(request: NextRequest) {
  if (!isAdminRequest(request)) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  if (!hasWhatsAppEnv() || !env.whatsappBusinessAccountId || !env.metaAppId) {
    return NextResponse.redirect(new URL("/campaigns?legacy_template=missing_env", request.url), 303);
  }

  const supabase = createAdminClient();
  const existing = await supabase
    .from("meta_templates")
    .select("meta_template_id,name,status")
    .eq("name", TEMPLATE_NAME)
    .maybeSingle();

  if (existing.data) {
    return NextResponse.redirect(new URL(`/campaigns?legacy_template=existing&status=${encodeURIComponent(existing.data.status || "UNKNOWN")}`, request.url), 303);
  }

  try {
    const baseUrl = env.publicAppUrl && !env.publicAppUrl.includes("netlify.app")
      ? env.publicAppUrl
      : "https://sea-n-shore-whatsapp.hunupunu.workers.dev";

    const imageResponse = await fetch(`${baseUrl}/legacy-claim-header.jpg`, { cache: "no-store" });
    if (!imageResponse.ok) {
      throw new Error(`header_image_fetch_failed_${imageResponse.status}`);
    }

    const imageBytes = new Uint8Array(await imageResponse.arrayBuffer());
    const uploadParams = new URLSearchParams({
      file_length: String(imageBytes.byteLength),
      file_type: "image/jpeg",
      file_name: "sea-n-shore-legacy-claim.jpg",
    });

    const sessionResponse = await fetch(
      `https://graph.facebook.com/${env.whatsappGraphApiVersion}/${env.metaAppId}/uploads?${uploadParams.toString()}`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${env.whatsappAccessToken}`,
        },
        cache: "no-store",
      }
    );

    const sessionPayload = await sessionResponse.json();
    if (!sessionResponse.ok || !sessionPayload?.id) {
      throw new Error(`upload_session_failed:${JSON.stringify(sessionPayload)}`);
    }

    const uploadResponse = await fetch(
      `https://graph.facebook.com/${env.whatsappGraphApiVersion}/${sessionPayload.id}`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${env.whatsappAccessToken}`,
          "Content-Type": "image/jpeg",
          file_offset: "0",
        },
        body: imageBytes,
        cache: "no-store",
      }
    );

    const uploadPayload = await uploadResponse.json();
    if (!uploadResponse.ok || !uploadPayload?.h) {
      throw new Error(`image_upload_failed:${JSON.stringify(uploadPayload)}`);
    }

    const bodyText = [
      "Welcome back to Sea N Shore, {{1}}! ⚓",
      "",
      "You were part of the earlier Sea N Shore community, and your old account is ready to be reclaimed on our completely upgraded platform.",
      "",
      "Your previous account was linked to {{2}}.",
      "",
      "Claim your account and discover everything the new Sea N Shore offers:",
      "👤 Build your professional maritime profile",
      "🌊 Join the maritime community feed",
      "🤝 Connect with professionals & organisations",
      "💬 Direct messaging & networking",
      "💼 Discover and apply for maritime jobs",
      "🎓 Join courses & training opportunities",
      "📅 Explore industry events",
      "",
      "The old Sea N Shore was only the beginning. The new platform is built to help you stay visible, connected and closer to new opportunities.",
      "",
      "Don't leave your old profile behind — reclaim it and join the new Sea N Shore today.",
      "",
      "Reply STOP to opt out."
    ].join("\n");

    const templatePayload = {
      name: TEMPLATE_NAME,
      language: LANGUAGE,
      category: "MARKETING",
      components: [
        {
          type: "HEADER",
          format: "IMAGE",
          example: {
            header_handle: [uploadPayload.h],
          },
        },
        {
          type: "BODY",
          text: bodyText,
          example: {
            body_text: [["Rahul", "ra***@gmail.com"]],
          },
        },
        {
          type: "FOOTER",
          text: "Sea N Shore - Global Shipping Community",
        },
        {
          type: "BUTTONS",
          buttons: [
            {
              type: "URL",
              text: "Claim My Account",
              url: "https://seanshore.in/auth/sign-in?email={{1}}",
              example: ["rahulsharma1988%40gmail.com"],
            },
          ],
        },
      ],
    };

    const response = await fetch(
      `https://graph.facebook.com/${env.whatsappGraphApiVersion}/${env.whatsappBusinessAccountId}/message_templates`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${env.whatsappAccessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(templatePayload),
        cache: "no-store",
      }
    );

    const payload = await response.json();

    await audit({
      ok: response.ok,
      status: payload?.status ?? null,
      category: payload?.category ?? "MARKETING",
      meta_template_id: payload?.id ?? null,
      error: payload?.error ?? null,
    });

    if (!response.ok) {
      const url = new URL("/campaigns", request.url);
      url.searchParams.set("legacy_template", "error");
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
      new URL(`/campaigns?legacy_template=submitted&status=${encodeURIComponent(payload?.status || "PENDING")}`, request.url),
      303
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown_error";
    await audit({ ok: false, exception: message });
    const url = new URL("/campaigns", request.url);
    url.searchParams.set("legacy_template", "exception");
    return NextResponse.redirect(url, 303);
  }
}
