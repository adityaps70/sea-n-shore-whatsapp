import { NextRequest, NextResponse } from "next/server";
import { env, hasMetaWebhookConfigEnv } from "@/lib/env";
import { isAdminRequest } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(request: NextRequest) {
  if (!isAdminRequest(request)) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  if (!hasMetaWebhookConfigEnv()) {
    return NextResponse.redirect(new URL("/?webhook=missing_env", request.url), 303);
  }

  const callbackUrl = new URL("/api/meta/webhook", request.url).toString();

  const response = await fetch(
    `https://graph.facebook.com/${env.whatsappGraphApiVersion}/${env.whatsappBusinessAccountId}/subscribed_apps`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.whatsappAccessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        override_callback_uri: callbackUrl,
        verify_token: env.whatsappVerifyToken,
      }),
      cache: "no-store",
    }
  );

  const payload = await response.json();

  try {
    const supabase = createAdminClient();
    await supabase.from("audit_log").insert({
      action: "meta.webhook.configure_waba",
      entity_type: "whatsapp_business_account",
      entity_id: env.whatsappBusinessAccountId,
      details: {
        ok: response.ok,
        callback_url: callbackUrl,
        graph_version: env.whatsappGraphApiVersion,
        meta_error_code: payload?.error?.code ?? null,
        meta_error_subcode: payload?.error?.error_subcode ?? null,
        meta_error_type: payload?.error?.type ?? null,
        meta_error_message: payload?.error?.message ?? null,
      },
    });
  } catch {
    // Audit logging must not hide Meta's response.
  }

  if (!response.ok || payload?.success === false) {
    const url = new URL("/", request.url);
    url.searchParams.set("webhook", "error");
    if (payload?.error?.code) url.searchParams.set("code", String(payload.error.code));
    return NextResponse.redirect(url, 303);
  }

  return NextResponse.redirect(new URL("/?webhook=success", request.url), 303);
}
