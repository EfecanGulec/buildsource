import React from 'react'
import { Body, Button, Container, Head, Heading, Html, Preview, Section, Text } from '@react-email/components'

export function Shell({ preview, title, children, cta, href }: { preview: string; title: string; children: React.ReactNode; cta: string; href?: string | undefined }) {
  return (
    <Html lang="en" dir="ltr">
      <Head />
      <Preview>{preview}</Preview>
      <Body style={main}>
        <Container style={container}>
          <Section style={bar}><Text style={brand}>BuildSource LT</Text></Section>
          <Section style={content}>
            <Heading style={h1}>{title}</Heading>
            {children}
            {href ? <Button style={button} href={href}>{cta}</Button> : null}
          </Section>
        </Container>
      </Body>
    </Html>
  )
}
export const text = { fontSize: '15px', lineHeight: '24px', color: '#1A1A1A', margin: '0 0 16px' }
export const quote = { ...text, backgroundColor: '#F7F8F6', borderLeft: '3px solid #E8D5C4', padding: '12px 16px' }
const main = { backgroundColor: '#ffffff', fontFamily: 'Inter, Arial, sans-serif' }
const container = { maxWidth: '560px', margin: '0 auto' }
const bar = { backgroundColor: '#1F272E', padding: '16px 24px' }
const brand = { color: '#E8D5C4', fontSize: '16px', fontWeight: 700, margin: 0, fontFamily: "'Plus Jakarta Sans', Arial, sans-serif" }
const content = { padding: '28px 24px' }
const h1 = { fontSize: '20px', color: '#1A1A1A', margin: '0 0 16px', fontFamily: "'Plus Jakarta Sans', Arial, sans-serif" }
const button = { backgroundColor: '#0F5D3A', color: '#ffffff', borderRadius: '8px', padding: '12px 20px', fontSize: '15px', fontWeight: 600, textDecoration: 'none' }
