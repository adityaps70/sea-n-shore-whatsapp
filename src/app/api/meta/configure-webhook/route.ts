import { NextRequest, NextResponse } from "next/server";
import { env, hasMetaWebhookConfigEnv } from "@/lib/env";
import { isAdminRequest } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";

async function audit(details: Record<string, unknown>) {
  try {
    const supabase = createAdminClient();
    await supabase.from("audit_log").insert({
      action: "meta.webhook.configure_standard",
      entity_type: "meta_app",
      entity_id: env.metaAppId,
      details,
    });
  } catch {
    // Diagnostics must never hide Meta's response.
  }
}

function errorRedirect(request: NextRequest, stage: string, payload: any) {
  const url = new URL("/", request.url);
  url.searchParams.set("webhook", "error");
  url.searchParams.set("stage", stage);
  if (payload?.error?.code) {
    url.searchParams.set("code", String(payload.error.code));
  }
  return NextResponse.redirect(url, 303);
}

export async function POST(request: NextRequest) {
  if (!isAdminRequest(request)) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  if (
    !hasMetaWebhookConfigEnv() ||
    !env.metaAppId ||
    !env.whatsappAppSecret ||
    !env.whatsappBusinessAccountId
  ) {
    return NextResponse.redirect(new URL("/?webhook=missing_env", request.url), 303);
  }

  const baseUrl = env.publicAppUrl || "https://dapper-kitsune-a4a298.netlify.app";
  const callbackUrl = new URL("/api/meta/webhook", baseUrl).toString();

  // Step 1: obtain a fresh App Access Token from Meta.
  const tokenUrl = new URL("https://graph.facebook.com/oauth/access_token");
  tokenUrl.searchParams.set("client_id", env.metaAppId);
  tokenUrl.searchParams.set("client_secret", env.whatsappAppSecret);
  tokenUrl.searchParams.set("grant_type", "client_credentials");

  const tokenResponse = await fetch(tokenUrl, { cache: "no-store" });
  const tokenPayload = await tokenResponse.json();

  if (!tokenResponse.ok || !tokenPayload?.access_token) {
    await audit({
      stage: "app_token",
      ok: false,
      callback_url: callbackUrl,
      graph_version: env.whatsappGraphApiVersion,
      meta_error_code: tokenPayload?.error?.code ?? null,
      meta_error_subcode: tokenPayload?.error?.error_subcode ?? null,
      meta_error_type: tokenPayload?.error?.type ?? null,
      meta_error_message: tokenPayload?.error?.message ?? null,
    });
    return errorRedirect(request, "app_token", tokenPayload);
  }

  // Step 2: configure the app-level WhatsApp Business Account webhook.
  // Meta will perform the GET verification handshake against callbackUrl here.
  const appSubscriptionBody = new URLSearchParams({
    object: "whatsapp_business_account",
    callback_url: callbackUrl,
    verify_token: env.whatsappVerifyToken!,
    fields: "messages",
    access_token: tokenPayload.access_token,
  });

  const appSubscriptionResponse = await fetch(
    `https://graph.facebook.com/${env.whatsappGraphApiVersion}/${env.metaAppId}/subscriptions`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: appSubscriptionBody,
      cache: "no-store",
    }
  );

  const appSubscriptionPayload = await appSubscriptionResponse.json();

  if (!appSubscriptionResponse.ok || appSubscriptionPayload?.success === false) {
    await audit({
      stage: "app_subscription",
      ok: false,
      callback_url: callbackUrl,
      graph_version: env.whatsappGraphApiVersion,
      meta_error_code: appSubscriptionPayload?.error?.code ?? null,
      meta_error_subcode: appSubscriptionPayload?.error?.error_subcode ?? null,
      meta_error_type: appSubscriptionPayload?.error?.type ?? null,
      meta_error_message: appSubscriptionPayload?.error?.message ?? null,
    });
    return errorRedirect(request, "app_subscription", appSubscriptionPayload);
  }

  // Step 3: attach this WABA to the already-configured app webhook.
  const wabaResponse = await fetch(
    `https://graph.facebook.com/${env.whatsappGraphApiVersion}/${env.whatsappBusinessAccountId}/subscribed_apps`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.whatsappAccessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({}),
      cache: "no-store",
    }
  );

  const wabaPayload = await wabaResponse.json();

  await audit({
    stage: "complete",
    ok: wabaResponse.ok && wabaPayload?.success !== false,
    callback_url: callbackUrl,
    graph_version: env.whatsappGraphApiVersion,
    app_subscription_result: appSubscriptionPayload,
    waba_subscription_result: wabaPayload,
    meta_error_code: wabaPayload?.error?.code ?? null,
    meta_error_subcode: wabaPayload?.error?.error_subcode ?? null,
    meta_error_type: wabaPayload?.error?.type ?? null,
    meta_error_message: wabaPayload?.error?.message ?? null,
  });

  if (!wabaResponse.ok || wabaPayload?.success === false) {
    return errorRedirect(request, "waba_subscription", wabaPayload);
  }

  return NextResponse.redirect(new URL("/?webhook=success", request.url), 303);
}
