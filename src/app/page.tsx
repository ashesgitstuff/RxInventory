
"use client";

import { useInventory } from '@/contexts/InventoryContext';
import DrugStockCard from '@/components/inventory/DrugStockCard';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { PlusCircle, Loader2, RotateCcw, AlertTriangle } from 'lucide-react';
import React, { useState } from 'react';
import type { Drug } from '@/types';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { useToast } from '@/hooks/use-toast';

export default function DashboardPage() {
  const { drugs, loading, getDrugGroupsForDisplay, resetInventoryData } = useInventory();
  const [isClient, setIsClient] = React.useState(false);
  const [isResetDialogOpen, setIsResetDialogOpen] = useState(false);
  const { toast } = useToast();

  React.useEffect(() => {
    setIsClient(true);
  }, []);

  const groupedDrugsForDashboard = React.useMemo(() => {
    if (loading || !isClient) return [];
    return getDrugGroupsForDisplay();
  }, [loading, isClient, getDrugGroupsForDisplay]);

  const handleResetData = () => {
    resetInventoryData();
    toast({
      title: "Data Reset Successful",
      description: "All inventory, transactions, and villages have been reset to their default state.",
    });
    setIsResetDialogOpen(false); // Close the dialog after reset
  };

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

        <div className="mt-12 pt-8 border-t border-border">
          <AlertDialog open={isResetDialogOpen} onOpenChange={setIsResetDialogOpen}>
            <AlertDialogTrigger asChild>
              <Button variant="destructive" className="shadow-md hover:shadow-lg transition-shadow">
                <RotateCcw className="mr-2 h-4 w-4" /> Reset All Data
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle className="flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5 text-destructive" />
                  Are you absolutely sure?
                  </AlertDialogTitle>
                <AlertDialogDescription>
                  This action cannot be undone. This will permanently delete all your current
                  inventory, transaction, and village data, and reset it to the application defaults.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={handleResetData} className="bg-destructive hover:bg-destructive/90 text-destructive-foreground">
                  Yes, Reset Data
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
          <p className="text-xs text-muted-foreground mt-2">
            Use this to clear all data and start fresh.
          </p>
        </div>
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

      <div className="mt-12 pt-8 border-t border-border text-center">
        <AlertDialog open={isResetDialogOpen} onOpenChange={setIsResetDialogOpen}>
          <AlertDialogTrigger asChild>
            <Button variant="destructive" className="shadow-md hover:shadow-lg transition-shadow">
              <RotateCcw className="mr-2 h-4 w-4" /> Reset All Data
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-destructive" />
                Are you absolutely sure?
              </AlertDialogTitle>
              <AlertDialogDescription>
                This action cannot be undone. This will permanently delete all your current
                inventory, transaction, and village data, and reset it to the application defaults.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={handleResetData} className="bg-destructive hover:bg-destructive/90 text-destructive-foreground">
                Yes, Reset Data
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
        <p className="text-xs text-muted-foreground mt-2">
          Use this to clear all data and start fresh.
        </p>
      </div>
    </div>
  );
}
