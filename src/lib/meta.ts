import crypto from "node:crypto";
import { env } from "@/lib/env";

export type TemplateSend = {
  to: string;
  templateName: string;
  languageCode?: string;
  bodyParameters?: string[];
};

export function verifyMetaSignature(rawBody: string, signatureHeader: string | null) {
  if (!env.whatsappAppSecret || !signatureHeader?.startsWith("sha256=")) return false;
  const expected = crypto
    .createHmac("sha256", env.whatsappAppSecret)
    .update(rawBody)
    .digest("hex");
  const received = signatureHeader.slice("sha256=".length);
  if (received.length !== expected.length) return false;
  return crypto.timingSafeEqual(Buffer.from(received), Buffer.from(expected));
}

export async function sendTemplateMessage(input: TemplateSend) {
  if (!env.whatsappAccessToken || !env.whatsappPhoneNumberId) {
    throw new Error("WhatsApp Cloud API environment is not configured.");
  }

  const components = input.bodyParameters?.length
    ? [{
        type: "body",
        parameters: input.bodyParameters.map((text) => ({ type: "text", text })),
      }]
    : undefined;

  const response = await fetch(
    `https://graph.facebook.com/${env.whatsappGraphApiVersion}/${env.whatsappPhoneNumberId}/messages`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.whatsappAccessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        recipient_type: "individual",
        to: input.to,
        type: "template",
        template: {
          name: input.templateName,
          language: { code: input.languageCode || "en" },
          ...(components ? { components } : {}),
        },
      }),
    }
  );

  const payload = await response.json();
  if (!response.ok) {
    throw new Error(`Meta API error ${response.status}: ${JSON.stringify(payload)}`);
  }
  return payload;
}
