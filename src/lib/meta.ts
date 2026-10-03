import crypto from "node:crypto";
import { env } from "@/lib/env";

export type TemplateSend = {
  to: string;
  templateName: string;
  languageCode?: string;
  bodyParameters?: string[];
  headerImageId?: string;
  headerImageUrl?: string;
  urlButtonParameter?: string;
  urlButtonIndex?: number;
};

export type TextSend = {
  to: string;
  body: string;
};

function assertWhatsAppSendEnv() {
  if (
    !env.whatsappAccessToken ||
    !env.whatsappPhoneNumberId ||
    !env.whatsappGraphApiVersion
  ) {
    throw new Error("WhatsApp Cloud API environment is not configured.");
  }
}

async function postMessage(payload: Record<string, unknown>) {
  assertWhatsAppSendEnv();

  const response = await fetch(
    `https://graph.facebook.com/${env.whatsappGraphApiVersion}/${env.whatsappPhoneNumberId}/messages`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.whatsappAccessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    }
  );

  const result = await response.json();
  if (!response.ok) {
    throw new Error(`Meta API error ${response.status}: ${JSON.stringify(result)}`);
  }
  return result;
}

export async function uploadWhatsAppImage(file: Blob, filename: string) {
  assertWhatsAppSendEnv();

  const form = new FormData();
  form.set("messaging_product", "whatsapp");
  form.set("type", file.type || "image/jpeg");
  form.set("file", file, filename);

  const response = await fetch(
    `https://graph.facebook.com/${env.whatsappGraphApiVersion}/${env.whatsappPhoneNumberId}/media`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.whatsappAccessToken}`,
      },
      body: form,
    }
  );

  const result = await response.json();
  if (!response.ok || !result?.id) {
    throw new Error(`Meta media upload error ${response.status}: ${JSON.stringify(result)}`);
  }
  return String(result.id);
}

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

export async function sendTextMessage(input: TextSend) {
  return postMessage({
    messaging_product: "whatsapp",
    recipient_type: "individual",
    to: input.to,
    type: "text",
    text: {
      preview_url: false,
      body: input.body,
    },
  });
}

export async function sendTemplateMessage(input: TemplateSend) {
  const components: Array<Record<string, unknown>> = [];

  if (input.headerImageId || input.headerImageUrl) {
    components.push({
      type: "header",
      parameters: [{
        type: "image",
        image: input.headerImageId
          ? { id: input.headerImageId }
          : { link: input.headerImageUrl },
      }],
    });
  }

  if (input.bodyParameters?.length) {
    components.push({
      type: "body",
      parameters: input.bodyParameters.map((text) => ({ type: "text", text })),
    });
  }

  if (input.urlButtonParameter) {
    components.push({
      type: "button",
      sub_type: "url",
      index: String(input.urlButtonIndex ?? 0),
      parameters: [{ type: "text", text: input.urlButtonParameter }],
    });
  }

  return postMessage({
    messaging_product: "whatsapp",
    recipient_type: "individual",
    to: input.to,
    type: "template",
    template: {
      name: input.templateName,
      language: { code: input.languageCode || "en" },
      ...(components.length ? { components } : {}),
    },
  });
}
