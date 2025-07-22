
"use client";

import { LayoutGrid, MinusCircle, PackagePlus, Edit3 as EditIcon, ListChecks, Tent } from 'lucide-react';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import Link from 'next/link';

const navItems = [
  { href: './dispense', label: 'Dispense Drugs', icon: MinusCircle },
  { href: './restock', label: 'Restock', icon: PackagePlus },
  { href: '.', label: 'Dashboard', icon: LayoutGrid },
  { href: './manage-drugs', label: 'Manage Drugs', icon: EditIcon },
  { href: './transactions', label: 'Transactions', icon: ListChecks },
  { href: './camps', label: 'Camps', icon: Tent },
];

export default function Header() {
  const pathname = usePathname();

  const isCurrentPage = (href: string) => {
    const currentPath = pathname.substring(pathname.lastIndexOf('/') + 1);
    const linkPath = href.substring(href.lastIndexOf('/') + 1) || 'index.html'; // Handle root
    
    if (linkPath === '.' || linkPath === 'index.html') {
      return currentPath === 'index.html' || currentPath === '';
    }
    
    return currentPath === linkPath;
  };

  return (
    <header className="bg-card border-b border-border shadow-sm sticky top-0 z-50">
      <div className="container mx-auto px-4 h-16 flex items-center justify-between">
        <a href="./index.html" className="flex items-center gap-2 text-xl font-headline font-bold text-primary">
          <span>FORRADS MMU</span>
        </a>
        <nav className="flex items-center gap-1 sm:gap-2">
          {navItems.map((item) => {
            // Adjust href for electron build
            const finalHref = item.href.endsWith('.') ? './index.html' : `${item.href}.html`;
            return (
                <Button
                    key={item.href}
                    variant={isCurrentPage(finalHref) ? 'default' : 'ghost'}
                    size="sm"
                    asChild
                    className={cn(
                        "transition-colors duration-200",
                        isCurrentPage(finalHref)
                        ? "bg-primary text-primary-foreground hover:bg-primary/90" 
                        : "text-foreground hover:bg-primary/10 hover:text-primary"
                    )}
                    >
                    <a href={finalHref} className="flex items-center gap-2">
                        <item.icon className="h-4 w-4" />
                        <span className="hidden sm:inline">{item.label}</span>
                    </a>
                </Button>
            );
        })}
        </nav>
      </div>
    </header>
  );
}
