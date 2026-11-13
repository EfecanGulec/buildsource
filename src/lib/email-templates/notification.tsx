import React from 'react'
import { Text } from '@react-email/components'
import type { TemplateEntry } from './registry'
import { Shell, text, quote } from './_layout'

interface Props { title?: string; intro?: string; body?: string; link?: string }
const Email = ({ title = 'Update on BuildSource LT', intro = 'There is an update for you.', body, link }: Props) => (
  <Shell preview={title} title={title} cta="Open in BuildSource" href={link}>
    <Text style={text}>{intro}</Text>
    {body ? <Text style={quote}>{body}</Text> : null}
  </Shell>
)
export const template = {
  component: Email,
  subject: (d: Record<string, any>) => d.title || 'Update on BuildSource LT',
  displayName: 'Platform notification',
  previewData: { title: 'New offer on RFQ-2026-0008', intro: 'You received a new offer.', body: 'Oak flooring, 120 m²', link: 'https://example.com/app/rfqs/1' },
} satisfies TemplateEntry
