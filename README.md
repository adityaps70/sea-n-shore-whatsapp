# Sea N Shore WhatsApp

Standalone WhatsApp marketing operations platform for Sea N Shore.

## Stack

- Next.js App Router
- Netlify
- Supabase Postgres + Auth
- Meta WhatsApp Business Platform (Cloud API)

## MVP

- Contact import and segmentation
- Consent / opt-out tracking
- Campaign drafts and scheduling state
- WhatsApp template references
- Controlled batch sending
- Meta webhook verification + delivery/read/failure ingestion
- Dashboard metrics
- Audit trail

## Safety defaults

This app does **not** treat an old phone number as marketing consent. Contacts must be explicitly marked as eligible before campaign sending. Opted-out contacts are automatically excluded.

## Environment

Copy `.env.example` to `.env.local`. Never commit Meta or Supabase secret keys.

## Database

The dedicated Supabase project is provisioned. Migrations live under `supabase/migrations/`.

## Meta webhook

Configure Meta's webhook callback to:

`https://YOUR_NETLIFY_DOMAIN/api/meta/webhook`

Use the same secret value in Meta and `WHATSAPP_VERIFY_TOKEN`.

## Hosting

Netlify is the deployment target. Modern Next.js features are handled through Netlify's OpenNext adapter.

Keep the dashboard private until application-level admin authentication is complete because it will contain customer contact and campaign data.
