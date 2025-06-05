
import type { Metadata } from 'next';
import './globals.css';
import { InventoryProvider } from '@/contexts/InventoryContext';
import Header from '@/components/layout/Header';
import { Toaster } from "@/components/ui/toaster";

export const metadata: Metadata = {
  title: 'ChotusDrugBus - Pharmacy Management',
  description: 'Manage your rural health clinic pharmacy inventory efficiently.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=PT+Sans:ital,wght@0,400;0,700;1,400;1,700&display=swap" rel="stylesheet" />
      </head>
      <body className="font-body antialiased bg-background text-foreground min-h-screen flex flex-col">
        <InventoryProvider>
          <Header />
          <main className="flex-grow container mx-auto px-4 py-8">
            {children}
          </main>
          <Toaster />
        </InventoryProvider>
      </body>
    </html>
  );
}

