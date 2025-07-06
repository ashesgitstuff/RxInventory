
"use client";

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
    const pageName = href.replace('./', '');
    // In a packaged app, the root pathname might be '/' or end with '/index.html'.
    if (pageName === 'index.html' && (pathname === '/' || pathname.endsWith('/index.html'))) {
      return true;
    }
    // For other pages, check if the pathname ends with the html file name.
    return pathname.endsWith(pageName);
  };

  return (
    <header className="bg-card border-b border-border shadow-sm sticky top-0 z-50">
      <div className="container mx-auto px-4 h-16 flex items-center justify-between">
        <a href="./index.html" className="flex items-center gap-2 text-xl font-headline font-bold text-primary">
          <span>FORRADS MMU</span>
        </a>
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
              <a href={item.href} className="flex items-center gap-2">
                <item.icon className="h-4 w-4" />
                <span className="hidden sm:inline">{item.label}</span>
              </a>
            </Button>
          ))}
        </nav>
      </div>
    </header>
  );
}
