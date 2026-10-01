export const env = {
  // La Shimti / Supabase
  supabaseUrl:
    process.env.NEXT_PUBLIC_SUPABASE_URL ||
    process.env.SUPABASE_URL ||
    "https://eamdiqtzbzkkdxvhxdqy.supabase.co",
  supabasePublishableKey:
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
    process.env.SUPABASE_PUBLISHABLE_KEY,
  supabaseSecretKey:
    process.env.SUPABASE_SECRET_KEY ||
    process.env.SUPABASE_SERVICE_ROLE_KEY,

  whatsappAccessToken: process.env.WHATSAPP_ACCESS_TOKEN,
  whatsappPhoneNumberId: process.env.WHATSAPP_PHONE_NUMBER_ID,
  whatsappBusinessAccountId: process.env.WHATSAPP_BUSINESS_ACCOUNT_ID,
  whatsappVerifyToken: process.env.WHATSAPP_VERIFY_TOKEN,
  whatsappAppSecret: process.env.WHATSAPP_APP_SECRET,
  whatsappGraphApiVersion: process.env.WHATSAPP_GRAPH_API_VERSION,
};

export function hasSupabaseServerEnv() {
  return Boolean(env.supabaseUrl && env.supabaseSecretKey);
}

export function assertSupabaseServerEnv() {
  if (!env.supabaseSecretKey) {
    throw new Error(
      "La Shimti database is not connected in Vercel. Add SUPABASE_SECRET_KEY (or SUPABASE_SERVICE_ROLE_KEY) to the Preview environment and redeploy."
    );
  }
  if (!env.supabaseUrl) {
    throw new Error(
      "La Shimti database URL is missing. Add NEXT_PUBLIC_SUPABASE_URL or SUPABASE_URL in Vercel and redeploy."
    );
  }
}

export function hasWhatsAppEnv() {
  return Boolean(
    env.whatsappAccessToken &&
    env.whatsappPhoneNumberId &&
    env.whatsappGraphApiVersion
  );
}
