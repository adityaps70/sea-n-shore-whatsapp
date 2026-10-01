import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isAdminRequest } from "@/lib/auth";

function parseCsv(input: string) {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;

  for (let i = 0; i < input.length; i++) {
    const ch = input[i];

    if (quoted) {
      if (ch === '"') {
        if (input[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          quoted = false;
        }
      } else {
        field += ch;
      }
      continue;
    }

    if (ch === '"') {
      quoted = true;
    } else if (ch === ",") {
      row.push(field.trim());
      field = "";
    } else if (ch === "\n") {
      row.push(field.trim());
      if (row.some(Boolean)) rows.push(row);
      row = [];
      field = "";
    } else if (ch !== "\r") {
      field += ch;
    }
  }

  row.push(field.trim());
  if (row.some(Boolean)) rows.push(row);
  return rows;
}

function normalizePhone(raw: string, country: string) {
  const value = raw.trim();
  let digits = value.replace(/\D/g, "");
  const countryHint = country.trim().toLowerCase();

  if (digits.startsWith("00")) digits = digits.slice(2);

  if (value.startsWith("+") && digits.length >= 7 && digits.length <= 15) {
    return `+${digits}`;
  }

  if (digits.startsWith("91") && digits.length === 12) {
    return `+${digits}`;
  }

  if (
    (countryHint.includes("india") || countryHint === "in" || countryHint === "indian") &&
    digits.length === 10 &&
    /^[6-9]/.test(digits)
  ) {
    return `+91${digits}`;
  }

  return null;
}

function truthy(value: string) {
  return ["1", "true", "yes", "y"].includes(value.trim().toLowerCase());
}

export async function POST(request: NextRequest) {
  if (!isAdminRequest(request)) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  const form = await request.formData();
  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.redirect(new URL("/contacts?error=no_file", request.url), 303);
  }

  const rows = parseCsv(await file.text());
  if (rows.length < 2) {
    return NextResponse.redirect(new URL("/contacts?error=empty_csv", request.url), 303);
  }

  const headers = rows[0].map((h) => h.trim().toLowerCase());
  const index = (names: string[]) => {
    for (const name of names) {
      const found = headers.indexOf(name);
      if (found >= 0) return found;
    }
    return -1;
  };

  const phoneIdx = index(["phone_e164", "number", "phone", "mobile", "whatsapp", "whatsapp_no"]);
  const nameIdx = index(["full_name", "name"]);
  const emailIdx = index(["email"]);
  const categoryIdx = index(["category", "categories"]);
  const countryIdx = index(["country", "nationality", "nationality / country"]);
  const oldWaIdx = index(["old_whatsapp_field", "whatsapp stored?", "whatsapp_stored"]);
  const consentSourceIdx = index(["consent_source"]);
  const consentAtIdx = index(["consent_at"]);

  if (phoneIdx < 0) {
    return NextResponse.redirect(new URL("/contacts?error=missing_phone_column", request.url), 303);
  }

  const contacts = [];
  let rejected = 0;

  for (const cells of rows.slice(1)) {
    const rawPhone = cells[phoneIdx] || "";
    const country = countryIdx >= 0 ? cells[countryIdx] || "" : "";
    const phone = normalizePhone(rawPhone, country);
    if (!phone) {
      rejected++;
      continue;
    }

    const consentSource = consentSourceIdx >= 0 ? cells[consentSourceIdx] || "" : "";
    const consentAt = consentAtIdx >= 0 ? cells[consentAtIdx] || "" : "";

    contacts.push({
      phone_e164: phone,
      full_name: nameIdx >= 0 ? cells[nameIdx] || null : null,
      email: emailIdx >= 0 ? (cells[emailIdx] || null)?.toLowerCase() : null,
      category: categoryIdx >= 0 ? cells[categoryIdx] || null : null,
      source: "csv_import",
      old_whatsapp_field: oldWaIdx >= 0 ? truthy(cells[oldWaIdx] || "") : false,
      consent_source: consentSource || null,
      consent_at: consentAt || null,
      marketing_status: consentSource && consentAt ? "eligible" : "unknown",
      metadata: { imported_from: file.name },
    });
  }

  const deduped = Array.from(new Map(contacts.map((c) => [c.phone_e164, c])).values());
  const supabase = createAdminClient();

  if (deduped.length) {
    const { error } = await supabase
      .from("contacts")
      .upsert(deduped, { onConflict: "phone_e164" });

    if (error) {
      return NextResponse.redirect(new URL("/contacts?error=database", request.url), 303);
    }
  }

  await supabase.from("audit_log").insert({
    action: "contacts.import",
    entity_type: "contacts",
    details: {
      file_name: file.name,
      imported: deduped.length,
      rejected,
    },
  });

  const url = new URL("/contacts", request.url);
  url.searchParams.set("imported", String(deduped.length));
  url.searchParams.set("rejected", String(rejected));
  return NextResponse.redirect(url, 303);
}
