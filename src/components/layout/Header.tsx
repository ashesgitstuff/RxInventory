
"use client";

import Link from 'next/link';
import { LayoutGrid, MinusCircle, PackagePlus, Edit3 as EditIcon, ListChecks, Tent } from 'lucide-react';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

const navItems = [
  { href: './dispense.html', label: 'Dispense Drugs', icon: MinusCircle },
  { href: './restock.html', label: 'Restock', icon: PackagePlus },
  { href: './index.html', label: 'Dashboard', icon: LayoutGrid },
  { href: './manage-drugs.html', label: 'Manage Drugs', icon: EditIcon },
  { href: './transactions.html', label: 'Transactions', icon: ListChecks },
  { href: './camps.html', label: 'Camps', icon: Tent },
];

export default function Header() {
  const pathname = usePathname();

  const isCurrentPage = (href: string) => {
    // Normalize href for comparison
    const normalizedHref = href.endsWith('index.html') ? '/' : href.replace('./', '/').replace('.html', '');
    const normalizedPathname = pathname.endsWith('/') ? pathname : `${pathname}/`.replace('//', '/');
    const simplePathname = pathname.endsWith('index.html') ? '/' : pathname;

    if (href === './index.html' && (simplePathname === '/' || simplePathname === '/index.html')) return true;
    
    // Check if the current path contains the link's path
    return pathname.includes(href.replace('./', '').replace('.html', ''));
  }

  return (
    <header className="bg-card border-b border-border shadow-sm sticky top-0 z-50">
      <div className="container mx-auto px-4 h-16 flex items-center justify-between">
        <Link href="./index.html" className="flex items-center gap-2 text-xl font-headline font-bold text-primary">
          <span>FORRADS MMU</span>
        </Link>
        <nav className="flex items-center gap-1 sm:gap-2">
          {navItems.map((item) => (
            <Button
              key={item.href}
              variant={isCurrentPage(item.href) ? 'default' : 'ghost'}
              size="sm"
              asChild
              className={cn(
                "transition-colors duration-200",
                isCurrentPage(item.href)
                  ? "bg-primary text-primary-foreground hover:bg-primary/90" 
                  : "text-foreground hover:bg-primary/10 hover:text-primary"
              )}
            >
              <Link href={item.href} className="flex items-center gap-2">
                <item.icon className="h-4 w-4" />
                <span className="hidden sm:inline">{item.label}</span>
              </Link>
            </Button>
          ))}
        </nav>
      </div>
    </header>
  );
}
