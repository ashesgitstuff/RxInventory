
"use client";

import { useInventory } from '@/contexts/InventoryContext';
import DrugStockCard from '@/components/inventory/DrugStockCard';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { PlusCircle, Loader2 } from 'lucide-react';
import React from 'react';
import type { Drug } from '@/types';

interface GroupedDrug {
  groupKey: string;
  displayName: string; // For the card title: Brand Generic Dosage
  genericName: string;
  brandName?: string;
  dosage?: string;
  totalStock: number;
  lowStockThreshold: number; // Use threshold from the first batch in group for aggregate warning
  batches: Drug[];
}

export default function DashboardPage() {
  const { drugs, loading } = useInventory(); 
  const [isClient, setIsClient] = React.useState(false);

  React.useEffect(() => {
    setIsClient(true);
  }, []);

  const groupedDrugs = React.useMemo(() => {
    if (!drugs) return [];
    const groups: Record<string, GroupedDrug> = {};

    drugs.forEach(drug => {
      const groupKey = `${drug.name.toLowerCase()}-${(drug.brandName || '').toLowerCase()}-${(drug.dosage || '').toLowerCase()}`;
      
      let displayNameSegments: string[] = [];
      if (drug.brandName) {
        displayNameSegments.push(drug.brandName);
      }
      displayNameSegments.push(drug.name); // Generic name always present
      if (drug.dosage) {
        displayNameSegments.push(drug.dosage);
      }
      const displayName = displayNameSegments.join(' ');


      if (!groups[groupKey]) {
        groups[groupKey] = {
          groupKey,
          displayName,
          genericName: drug.name,
          brandName: drug.brandName,
          dosage: drug.dosage,
          totalStock: 0,
          lowStockThreshold: drug.lowStockThreshold, // Use first batch's threshold
          batches: [],
        };
      }
      groups[groupKey].totalStock += drug.stock;
      groups[groupKey].batches.push(drug);
      // Sort batches by expiry date (oldest first) if needed for display, or leave as is
      groups[groupKey].batches.sort((a, b) => {
        const dateA = a.dateOfExpiry ? new Date(a.dateOfExpiry).getTime() : Infinity;
        const dateB = b.dateOfExpiry ? new Date(b.dateOfExpiry).getTime() : Infinity;
        return dateA - dateB;
      });
    });
    return Object.values(groups);
  }, [drugs]);


  if (!isClient || loading) {
    return (
      <div className="flex justify-center items-center min-h-[calc(100vh-200px)]">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
        <p className="ml-4 text-xl text-muted-foreground">Loading inventory...</p>
      </div>
    );
  }

  if (groupedDrugs.length === 0) {
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
        {groupedDrugs.map((group) => (
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
