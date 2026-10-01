import { NextResponse } from "next/server";
import { hasSupabaseServerEnv, hasWhatsAppEnv } from "@/lib/env";

export async function GET() {
  return NextResponse.json({
    ok: true,
    service: "sea-n-shore-whatsapp",
    supabaseConfigured: hasSupabaseServerEnv(),
    metaConfigured: hasWhatsAppEnv(),
    timestamp: new Date().toISOString(),
  });
}
