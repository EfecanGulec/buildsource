// Server-only: turns new in-app notifications into emails. Called by the timed job and the admin button.
import { sendTemplateEmail } from '@/lib/email-templates/send-email'
import { planEmail, MAX_AGE_MS, type NotificationRow, type Recipient } from './notify-email'

export async function dispatchNotificationEmails(appUrl: string, limit = 50) {
  const { supabaseAdmin } = await import('@/integrations/supabase/client.server')
  const db = supabaseAdmin as any
  const since = new Date(Date.now() - MAX_AGE_MS).toISOString()
  // Expire anything older first so it is never sent late.
  await db.from('notifications').update({ email_status: 'skipped_old' }).is('email_status', null).lt('created_at', since)
  const { data: rows, error } = await db.from('notifications')
    .select('id, type, title, body, link, profile_id, company_id, created_at')
    .is('email_status', null).order('created_at').limit(limit)
  if (error) throw new Error(error.message)
  const tally: Record<string, number> = {}
  const emailCache = new Map<string, string | null>()
  const emailOf = async (pid: string) => {
    if (!emailCache.has(pid)) emailCache.set(pid, (await db.auth.admin.getUserById(pid)).data?.user?.email ?? null)
    return emailCache.get(pid)!
  }
  for (const n of (rows ?? []) as NotificationRow[]) {
    // Claim the row first so overlapping runs never double-send.
    const { data: claimed } = await db.from('notifications').update({ email_status: 'sending' }).eq('id', n.id).is('email_status', null).select('id')
    if (!claimed?.length) continue
    const recipients: Recipient[] = []
    try {
      if (n.profile_id) {
        const { data: p } = await db.from('profiles').select('company_id, companies(is_demo)').eq('id', n.profile_id).maybeSingle()
        const e = await emailOf(n.profile_id); if (e) recipients.push({ email: e, isDemo: !!p?.companies?.is_demo })
      } else if (n.company_id) {
        const { data: c } = await db.from('companies').select('is_demo, contact_email').eq('id', n.company_id).single()
        const { data: members } = await db.from('profiles').select('id').eq('company_id', n.company_id)
        for (const m of members ?? []) { const e = await emailOf(m.id); if (e) recipients.push({ email: e, isDemo: !!c?.is_demo }) }
        if (!recipients.length && c?.contact_email) {
          let magicToken: string | null = null
          const rfq = n.type === 'new_rfq' ? n.link?.split('/').pop() : null
          if (rfq) magicToken = (await db.from('rfq_recipients').select('magic_token').eq('rfq_id', rfq).eq('supplier_company_id', n.company_id).maybeSingle()).data?.magic_token ?? null
          recipients.push({ email: c.contact_email, isDemo: !!c.is_demo, magicToken })
        }
      }
      let status = 'skipped_no_recipient'
      for (const r of recipients) {
        const plan = planEmail(n, r, appUrl)
        if ('skip' in plan) { status = `skipped_${plan.skip}`; continue }
        const res = await sendTemplateEmail(plan.template, r.email, {
          templateData: { ...plan.data, link: plan.link },
          idempotencyKey: `notif-${n.id}-${r.email}`,
        })
        status = res.sent ? 'sent' : 'suppressed'
      }
      tally[status] = (tally[status] ?? 0) + 1
      await db.from('notifications').update({ email_status: status, emailed_at: status === 'sent' ? new Date().toISOString() : null, email_error: null }).eq('id', n.id)
    } catch (e: any) {
      // Domain not verified yet or a temporary failure: put it back so the next run retries (until it is a day old).
      tally['failed'] = (tally['failed'] ?? 0) + 1
      await db.from('notifications').update({ email_status: null, email_error: String(e?.code ?? e?.message ?? e).slice(0, 300) }).eq('id', n.id)
      if (e?.status === 429 || e?.code === 'domain_not_verified' || e?.code === 'emails_disabled') break
    }
  }
  return tally
}
