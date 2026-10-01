create index if not exists messages_contact_idx on public.messages(contact_id);
create index if not exists campaigns_created_by_idx on public.campaigns(created_by);
create index if not exists audit_log_actor_idx on public.audit_log(actor_id);

create policy "deny client access contacts"
on public.contacts for all to anon, authenticated
using (false) with check (false);

create policy "deny client access campaigns"
on public.campaigns for all to anon, authenticated
using (false) with check (false);

create policy "deny client access messages"
on public.messages for all to anon, authenticated
using (false) with check (false);

create policy "deny client access inbound_messages"
on public.inbound_messages for all to anon, authenticated
using (false) with check (false);

create policy "deny client access webhook_events"
on public.webhook_events for all to anon, authenticated
using (false) with check (false);

create policy "deny client access audit_log"
on public.audit_log for all to anon, authenticated
using (false) with check (false);
