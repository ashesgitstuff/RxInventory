
"use client";

import { useInventory } from '@/contexts/InventoryContext';
import DrugStockCard from '@/components/inventory/DrugStockCard';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { PlusCircle } from 'lucide-react';

export default function DashboardPage() {
  const { drugs } = useInventory(); // Removed lowStockThreshold from here

  if (!drugs || drugs.length === 0) {
    return (
      <div className="text-center py-10">
        <p className="text-xl text-muted-foreground mb-4">No drugs in inventory.</p>
        <Button asChild>
          <Link href="/restock">
            <PlusCircle className="mr-2 h-4 w-4" /> Add Initial Stock
          </Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold font-headline text-foreground">Inventory Dashboard</h1>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {drugs.map((drug) => (
          <DrugStockCard key={drug.id} drug={drug} /> 
        ))}
      </div>
      
      <div className="mt-8 flex flex-col sm:flex-row gap-4 justify-center">
        <Button size="lg" asChild className="shadow-md hover:shadow-lg transition-shadow">
          <Link href="/dispense">Dispense Drugs</Link>
        </Button>
        <Button size="lg" variant="outline" asChild className="shadow-md hover:shadow-lg transition-shadow">
          <Link href="/restock">Restock Inventory</Link>
        </Button>
      </div>
    </div>
  );
}
