# Setup

## Supabase
Create a dedicated Supabase project in the same preferred region as the rest of your stack, then apply:

`supabase/migrations/0001_initial.sql`

Required Vercel variables:
- NEXT_PUBLIC_SUPABASE_URL
- NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
- SUPABASE_SECRET_KEY

## Meta
Create or select the Sea N Shore Meta app and WhatsApp Business Account.

Required Vercel variables:
- WHATSAPP_ACCESS_TOKEN
- WHATSAPP_PHONE_NUMBER_ID
- WHATSAPP_BUSINESS_ACCOUNT_ID
- WHATSAPP_VERIFY_TOKEN
- WHATSAPP_APP_SECRET
- WHATSAPP_GRAPH_API_VERSION
- INTERNAL_API_SECRET

Webhook callback:
`https://<production-domain>/api/meta/webhook`

Subscribe the WhatsApp business account to message-related webhook events.

## Vercel
Import this GitHub repository as its own Vercel project. Do not attach the main Sea N Shore project's environment variables by default.
