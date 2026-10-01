# Setup

## Supabase

Dedicated project:
- Name: Sea N Shore WhatsApp
- Region: ap-south-1 (Mumbai)

Migrations live in:
- `supabase/migrations/0001_initial.sql`
- `supabase/migrations/0002_harden_rls_and_indexes.sql`

Required Netlify environment variables:
- NEXT_PUBLIC_SUPABASE_URL
- NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
- SUPABASE_SECRET_KEY

## Meta

Create or select the Sea N Shore Meta app and WhatsApp Business Account.

Required Netlify environment variables:
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

## Netlify

Import the GitHub repository:
`adityaps70/sea-n-shore-whatsapp`

Netlify should auto-detect Next.js. Repository defaults are also declared in `netlify.toml`.

Before the first production publish, configure the required environment variables above.

Keep the site private until admin authentication is complete.
