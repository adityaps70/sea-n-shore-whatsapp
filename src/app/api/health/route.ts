import { NextResponse } from "next/server";
import { env, hasSupabaseServerEnv, hasWhatsAppEnv } from "@/lib/env";

export async function GET() {
  return NextResponse.json({
    ok: true,
    service: "sea-n-shore-whatsapp",
    release: "cloudflare-outbound-template-v1",
    features: ["production_service_reply", "launch_template_submission", "template_quality_monitoring"],
    supabaseConfigured: hasSupabaseServerEnv(),
    metaConfigured: hasWhatsAppEnv(),
    adminAuthConfigured: Boolean(process.env.ADMIN_EMAILS && process.env.DASHBOARD_ADMIN_PASSWORD && process.env.DASHBOARD_AUTH_SECRET),
    verifyTokenConfigured: Boolean(env.whatsappVerifyToken),
    appSecretConfigured: Boolean(env.whatsappAppSecret),
    timestamp: new Date().toISOString(),
  });
}
