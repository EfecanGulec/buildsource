import { createFileRoute } from '@tanstack/react-router'
import { authenticateCronRequest } from '@/integrations/supabase/cron-auth'
import { dispatchNotificationEmails } from '@/lib/notify-email.server'

export const Route = createFileRoute('/api/public/notifications/dispatch')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const authFailure = await authenticateCronRequest(request)
        if (authFailure) return authFailure
        const result = await dispatchNotificationEmails(new URL(request.url).origin)
        return Response.json({ success: true, result })
      },
    },
  },
})
