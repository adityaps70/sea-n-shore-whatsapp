import { NextRequest, NextResponse } from "next/server";
import { env, hasMetaWebhookConfigEnv } from "@/lib/env";
import { isAdminRequest } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";

async function audit(details: Record<string, unknown>) {
  try {
    const supabase = createAdminClient();
    await supabase.from("audit_log").insert({
      action: "meta.webhook.configure_waba",
      entity_type: "whatsapp_business_account",
      entity_id: env.whatsappBusinessAccountId,
      details,
    });
  } catch {
    // Audit logging must not hide Meta's response.
  }
}

export async function POST(request: NextRequest) {
  if (!isAdminRequest(request)) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  if (!hasMetaWebhookConfigEnv()) {
    return NextResponse.redirect(new URL("/?webhook=missing_env", request.url), 303);
  }

  const callbackUrl = new URL("/api/meta/webhook", request.url).toString();
  const endpoint =
    `https://graph.facebook.com/${env.whatsappGraphApiVersion}/${env.whatsappBusinessAccountId}/subscribed_apps`;

  const headers = {
    Authorization: `Bearer ${env.whatsappAccessToken}`,
    "Content-Type": "application/json",
  };

  // Step 1: establish the app-to-WABA subscription first.
  const subscribeResponse = await fetch(endpoint, {
    method: "POST",
    headers,
    body: JSON.stringify({}),
    cache: "no-store",
  });

  const subscribePayload = await subscribeResponse.json();

  if (!subscribeResponse.ok || subscribePayload?.success === false) {
    await audit({
      stage: "subscribe",
      ok: false,
      callback_url: callbackUrl,
      graph_version: env.whatsappGraphApiVersion,
      meta_error_code: subscribePayload?.error?.code ?? null,
      meta_error_subcode: subscribePayload?.error?.error_subcode ?? null,
      meta_error_type: subscribePayload?.error?.type ?? null,
      meta_error_message: subscribePayload?.error?.message ?? null,
    });

    const url = new URL("/", request.url);
    url.searchParams.set("webhook", "error");
    url.searchParams.set("stage", "subscribe");
    if (subscribePayload?.error?.code) {
      url.searchParams.set("code", String(subscribePayload.error.code));
    }
    return NextResponse.redirect(url, 303);
  }

  // Step 2: once subscribed, override the WABA callback to our Netlify endpoint.
  const overrideResponse = await fetch(endpoint, {
    method: "POST",
    headers,
    body: JSON.stringify({
      override_callback_uri: callbackUrl,
      verify_token: env.whatsappVerifyToken,
    }),
    cache: "no-store",
  });

  const overridePayload = await overrideResponse.json();

  await audit({
    stage: "override",
    ok: overrideResponse.ok && overridePayload?.success !== false,
    callback_url: callbackUrl,
    graph_version: env.whatsappGraphApiVersion,
    subscribe_result: subscribePayload,
    meta_error_code: overridePayload?.error?.code ?? null,
    meta_error_subcode: overridePayload?.error?.error_subcode ?? null,
    meta_error_type: overridePayload?.error?.type ?? null,
    meta_error_message: overridePayload?.error?.message ?? null,
  });

  if (!overrideResponse.ok || overridePayload?.success === false) {
    const url = new URL("/", request.url);
    url.searchParams.set("webhook", "error");
    url.searchParams.set("stage", "override");
    if (overridePayload?.error?.code) {
      url.searchParams.set("code", String(overridePayload.error.code));
    }
    return NextResponse.redirect(url, 303);
  }

  return NextResponse.redirect(new URL("/?webhook=success", request.url), 303);
}
