
import type { Metadata } from 'next';
import './globals.css';
import { InventoryProvider } from '@/contexts/InventoryContext';
import Header from '@/components/layout/Header';
import { Toaster } from "@/components/ui/toaster";
import ServiceWorkerRegistration from '@/components/ServiceWorkerRegistration';

const manifest = {
  name: "RxInventory",
  short_name: "RxInventory",
  description: "Manage your rural health clinic pharmacy inventory efficiently.",
  start_url: "/",
  display: "standalone",
  background_color: "#ECF0F1",
  theme_color: "#111827",
  icons: [
    {
      "src": "/icons/icon-192x192.png",
      "sizes": "192x192",
      "type": "image/png",
      "purpose": "any"
    },
    {
      "src": "/icons/icon-512x512.png",
      "sizes": "512x512",
      "type": "image/png",
      "purpose": "any"
    },
    {
      "src": "/icons/icon-192x192.png",
      "sizes": "192x192",
      "type": "image/png",
      "purpose": "maskable"
    },
    {
      "src": "/icons/icon-512x512.png",
      "sizes": "512x512",
      "type": "image/png",
      "purpose": "maskable"
    }
  ]
};

const manifestDataUrl = `data:application/json;charset=utf-8,${encodeURIComponent(JSON.stringify(manifest))}`;

export const metadata: Metadata = {
  title: 'FORRADS MMU - Pharmacy Management',
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
        <meta name="theme-color" content="#111827" />
        <link rel="manifest" href={manifestDataUrl} />
      </head>
      <body className="font-body antialiased bg-background text-foreground min-h-screen flex flex-col">
        <InventoryProvider>
          <ServiceWorkerRegistration />
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
