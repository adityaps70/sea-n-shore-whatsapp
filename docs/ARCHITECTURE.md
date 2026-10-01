# Architecture

## Boundaries

This repository is completely separate from the main Sea N Shore website.

### Vercel
Runs the Next.js dashboard and API route handlers.

### Supabase
Stores:
- normalized contacts
- consent status
- opt-outs
- campaigns
- outbound message attempts
- incoming messages
- Meta webhook events
- audit records

### Meta WhatsApp Cloud API
Used only from server-side code. Tokens are never exposed to the browser.

## Sending rule

A contact is sendable only when:
1. `marketing_status = eligible`
2. `opted_out_at IS NULL`
3. the campaign uses an approved Meta template
4. an identical campaign/contact message has not already been recorded

## Webhook flow

Meta -> `/api/meta/webhook` -> signature verification -> raw event store -> message status update.

## Next phases

1. Admin authentication
2. CSV/XLSX import UI
3. contact segmentation and filters
4. template sync
5. campaign composer
6. batch queue
7. retries with bounded policy
8. analytics
9. export
10. role-based admin access
