
"use client";

import { useInventory } from '@/contexts/InventoryContext';
import DrugStockCard from '@/components/inventory/DrugStockCard';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { PlusCircle, Loader2 } from 'lucide-react';
import React from 'react';
import type { Drug } from '@/types';

// This interface can be simplified or aligned with GroupedDrugDisplay from types.ts if needed
// For now, keeping it separate as dashboard might have slightly different needs.
interface DashboardGroupedDrug {
  groupKey: string; // Should align with the key from getDrugGroupsForDisplay
  displayName: string; 
  genericName: string;
  brandName?: string;
  dosage?: string;
  totalStock: number;
  lowStockThreshold: number; 
  batches: Drug[];
}

export default function DashboardPage() {
  const { drugs, loading, getDrugGroupsForDisplay } = useInventory(); 
  const [isClient, setIsClient] = React.useState(false);

  React.useEffect(() => {
    setIsClient(true);
  }, []);

  // Use getDrugGroupsForDisplay from context to ensure consistency
  const groupedDrugsForDashboard = React.useMemo(() => {
    if (loading || !isClient) return []; // Prevent running if not loaded or not client
    return getDrugGroupsForDisplay(); // This now returns GroupedDrugDisplay[]
  }, [loading, isClient, getDrugGroupsForDisplay]);


  if (!isClient || loading) {
    return (
      <div className="flex justify-center items-center min-h-[calc(100vh-200px)]">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
        <p className="ml-4 text-xl text-muted-foreground">Loading inventory...</p>
      </div>
    );
  }

  if (groupedDrugsForDashboard.length === 0) {
    return (
      <div className="text-center py-10">
        <p className="text-xl text-muted-foreground mb-4">No drugs in inventory.</p>
        <p className="text-sm text-muted-foreground mb-6">Your inventory is currently empty. Add some stock to get started!</p>
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
        {groupedDrugsForDashboard.map((group) => (
          // DrugStockCard expects GroupedDrugDisplay which is what getDrugGroupsForDisplay returns
          <DrugStockCard key={group.groupKey} drugGroup={group} /> 
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


    