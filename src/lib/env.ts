export const env = {
  supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL,
  supabasePublishableKey: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  supabaseSecretKey: process.env.SUPABASE_SECRET_KEY,
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

export function hasWhatsAppEnv() {
  return Boolean(
    env.whatsappAccessToken &&
    env.whatsappPhoneNumberId &&
    env.whatsappGraphApiVersion
  );
}
