import type { Metadata } from 'next'
import './globals.css'
import { NavBar } from '@/components/nav/NavBar'
import { TRPCProvider } from '@/components/providers/TRPCProvider'

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
        <TRPCProvider>
          <NavBar />
          <main className="flex-1 overflow-auto">{children}</main>
        </TRPCProvider>
      </body>
    </html>
  )
}
