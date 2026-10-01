import { NextResponse } from "next/server";
import { env, hasSupabaseServerEnv, hasWhatsAppEnv } from "@/lib/env";

export async function GET() {
  return NextResponse.json({
    ok: true,
    service: "sea-n-shore-whatsapp",
    supabaseConfigured: hasSupabaseServerEnv(),
    metaConfigured: hasWhatsAppEnv(),
    webhookConfigured: Boolean(env.whatsappVerifyToken && env.whatsappAppSecret),
    timestamp: new Date().toISOString(),
  });
}
