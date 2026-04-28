import type { Metadata } from 'next'
import './globals.css'
import { NavBar } from '@/components/nav/NavBar'

export const metadata: Metadata = {
  title: 'Bath House — Carbon Reporting',
  description: 'Internal carbon reporting system for Bath House',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" className="h-full">
      <body className="h-full flex flex-col bg-bh-stone antialiased">
        <NavBar />
        <main className="flex-1 overflow-auto">{children}</main>
      </body>
    </html>
  )
}
