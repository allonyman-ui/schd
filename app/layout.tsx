import type { Metadata } from 'next'
import './globals.css'
import NavBar from '@/components/NavBar'
import EventReminderProvider from '@/components/EventReminderProvider'
import ChatWidget from '@/components/ChatWidget'

export const metadata: Metadata = {
  title: 'לוח זמנים משפחת אלוני',
  description: 'לוח הזמנים של משפחת אלוני',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="he" dir="rtl">
      <body className="min-h-screen bg-amber-50">
        <NavBar />
        <EventReminderProvider />
        <ChatWidget />
        <main className="container mx-auto px-4 py-6 max-w-7xl">
          {children}
        </main>
      </body>
    </html>
  )
}
