
"use client";

import Link from 'next/link';
import { Pill, LayoutGrid, MinusCircle, PackagePlus, Edit3 as EditIcon, ListChecks, Tent } from 'lucide-react'; // Added Tent
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

const navItems = [
  { href: '/dispense', label: 'Dispense Drugs', icon: MinusCircle },
  { href: '/restock', label: 'Restock', icon: PackagePlus },
  { href: '/', label: 'Dashboard', icon: LayoutGrid },
  { href: '/manage-drugs', label: 'Manage Drugs', icon: EditIcon },
  { href: '/transactions', label: 'Transactions', icon: ListChecks },
  { href: '/camps', label: 'Camps', icon: Tent }, // Added Camps link
];

export default function Header() {
  const pathname = usePathname();

  return (
    <header className="bg-card border-b border-border shadow-sm sticky top-0 z-50">
      <div className="container mx-auto px-4 h-16 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2 text-xl font-headline font-bold text-primary">
          <Pill className="h-7 w-7" />
          <span>ChotusDrugBus</span>
        </Link>
        <nav className="flex items-center gap-1 sm:gap-2">
          {navItems.map((item) => (
            <Button
              key={item.href}
              variant={pathname === item.href ? 'default' : 'ghost'}
              size="sm"
              asChild
              className={cn(
                "transition-colors duration-200",
                pathname === item.href 
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
