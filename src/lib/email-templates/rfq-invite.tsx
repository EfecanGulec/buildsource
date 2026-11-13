import React from 'react'
import { Text } from '@react-email/components'
import type { TemplateEntry } from './registry'
import { Shell, text, quote } from './_layout'

interface Props { title?: string; body?: string; link?: string }
const Email = ({ title = 'New request for quotation', body, link }: Props) => (
  <Shell preview={`${title} — reply without an account`} title={title} cta="View request and reply" href={link}>
    <Text style={text}>A construction buyer in Lithuania is looking for a supplier like you on BuildSource LT.</Text>
    {body ? <Text style={quote}>{body}</Text> : null}
    <Text style={text}>You can read the request, ask questions or send an offer straight from this link — no account needed.</Text>
  </Shell>
)
export const template = {
  component: Email,
  subject: (d: Record<string, any>) => d['title'] || 'New request for quotation',
  displayName: 'New RFQ (supplier invite)',
  previewData: { title: 'New RFQ RFQ-2026-0008', body: 'Café fitout, Vilnius', link: 'https://example.com/q/abc' },
} satisfies TemplateEntry
