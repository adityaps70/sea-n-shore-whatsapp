import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isAdminRequest } from "@/lib/auth";
import { uploadWhatsAppImage } from "@/lib/meta";

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
  const headerImage = form.get("header_image");

  if (!name || !templateName) {
    return NextResponse.redirect(new URL("/campaigns?error=missing_fields", request.url), 303);
  }

  let headerMediaId: string | null = null;
  if (headerImage instanceof File && headerImage.size > 0) {
    if (!["image/jpeg", "image/png"].includes(headerImage.type)) {
      return NextResponse.redirect(new URL("/campaigns?error=invalid_header_image", request.url), 303);
    }
    if (headerImage.size > 5 * 1024 * 1024) {
      return NextResponse.redirect(new URL("/campaigns?error=header_image_too_large", request.url), 303);
    }
    try {
      headerMediaId = await uploadWhatsAppImage(headerImage, headerImage.name || "campaign-header.jpg");
    } catch {
      return NextResponse.redirect(new URL("/campaigns?error=header_upload_failed", request.url), 303);
    }
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
      header_media_id: headerMediaId,
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
    details: { name, template_name: templateName, category: category || "all", header_media: Boolean(headerMediaId) },
  });

  return NextResponse.redirect(new URL("/campaigns?created=1", request.url), 303);
}
