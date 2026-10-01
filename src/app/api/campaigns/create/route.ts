import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isAdminRequest } from "@/lib/auth";

export async function POST(request: NextRequest) {
  if (!isAdminRequest(request)) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  const form = await request.formData();
  const name = String(form.get("name") || "").trim();
  const templateName = String(form.get("template_name") || "").trim();
  const languageCode = String(form.get("language_code") || "en").trim() || "en";
  const category = String(form.get("category") || "").trim();
  const useNameParameter = form.get("use_name_parameter") === "on";

  if (!name || !templateName) {
    return NextResponse.redirect(new URL("/campaigns?error=missing_fields", request.url), 303);
  }

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("campaigns")
    .insert({
      name,
      template_name: templateName,
      language_code: languageCode,
      status: "draft",
      target_filter: category ? { category } : {},
      use_name_parameter: useNameParameter,
    })
    .select("id")
    .single();

  if (error || !data) {
    return NextResponse.redirect(new URL("/campaigns?error=create_failed", request.url), 303);
  }

  await supabase.from("audit_log").insert({
    action: "campaign.create",
    entity_type: "campaign",
    entity_id: data.id,
    details: { name, template_name: templateName, category: category || "all" },
  });

  return NextResponse.redirect(new URL("/campaigns?created=1", request.url), 303);
}
