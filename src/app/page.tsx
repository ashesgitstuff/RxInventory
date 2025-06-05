
"use client";

import { useInventory } from '@/contexts/InventoryContext';
import DrugStockCard from '@/components/inventory/DrugStockCard';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { PlusCircle, Loader2, RotateCcw, AlertTriangle, KeyRound, FileSpreadsheet } from 'lucide-react';
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
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import ExportDataDialog from '@/components/dashboard/ExportDataDialog';

const RESET_PASSWORD = "12345"; 

export default function DashboardPage() {
  const { drugs, transactions, loading, getDrugGroupsForDisplay, resetInventoryData } = useInventory();
  const [isClient, setIsClient] = React.useState(false);
  const [isResetDialogOpen, setIsResetDialogOpen] = useState(false);
  const [isExportDialogOpen, setIsExportDialogOpen] = useState(false);
  const [passwordInput, setPasswordInput] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const { toast } = useToast();

  React.useEffect(() => {
    setIsClient(true);
  }, []);

  const groupedDrugsForDashboard = React.useMemo(() => {
    if (loading || !isClient) return [];
    return getDrugGroupsForDisplay();
  }, [loading, isClient, getDrugGroupsForDisplay]);

  const handleResetDataAttempt = () => {
    if (passwordInput === RESET_PASSWORD) {
      resetInventoryData();
      toast({
        title: "Data Reset Successful",
        description: "All inventory, transactions, and villages have been reset to their default state.",
      });
      setIsResetDialogOpen(false); 
      setPasswordInput(''); 
      setPasswordError(''); 
    } else {
      setPasswordError("Incorrect password. Please try again.");
    }
  };

  const openResetDialog = () => {
    setPasswordInput('');
    setPasswordError('');
    setIsResetDialogOpen(true);
  };

  const closeResetDialog = () => {
    setIsResetDialogOpen(false);
    setPasswordInput('');
    setPasswordError('');
  };


  if (!isClient || loading) {
    return (
      <div className="flex justify-center items-center min-h-[calc(100vh-200px)]">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
        <p className="ml-4 text-xl text-muted-foreground">Loading inventory...</p>
      </div>
    );
  }

  if (groupedDrugsForDashboard.length === 0 && isClient) {
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
              <Button variant="destructive" className="shadow-md hover:shadow-lg transition-shadow" onClick={openResetDialog}>
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
                  <br />
                  <strong className="text-destructive">Please enter the password to confirm.</strong>
                </AlertDialogDescription>
              </AlertDialogHeader>
              <div className="space-y-2 py-2">
                <Label htmlFor="resetPassword">Password</Label>
                <div className="flex items-center gap-2">
                  <KeyRound className="h-4 w-4 text-muted-foreground" />
                  <Input
                    id="resetPassword"
                    type="password"
                    value={passwordInput}
                    onChange={(e) => setPasswordInput(e.target.value)}
                    placeholder="Enter password"
                    className={passwordError ? "border-destructive ring-destructive" : ""}
                  />
                </div>
                {passwordError && <p className="text-sm text-destructive">{passwordError}</p>}
              </div>
              <AlertDialogFooter>
                <AlertDialogCancel onClick={closeResetDialog}>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={handleResetDataAttempt} className="bg-destructive hover:bg-destructive/90 text-destructive-foreground">
                  Yes, Reset Data
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
          <p className="text-xs text-muted-foreground mt-2">
            Use this to clear all data and start fresh. This action is password protected.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold font-headline text-foreground">Inventory Dashboard</h1>
        <Button variant="outline" onClick={() => setIsExportDialogOpen(true)} className="shadow-md hover:shadow-lg transition-shadow">
          <FileSpreadsheet className="mr-2 h-4 w-4" /> Export Data
        </Button>
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
        <AlertDialog open={isResetDialogOpen} onOpenChange={(open) => {
            if (!open) {
                closeResetDialog();
            } else {
                openResetDialog();
            }
        }}>
          <AlertDialogTrigger asChild>
            <Button variant="destructive" className="shadow-md hover:shadow-lg transition-shadow" onClick={openResetDialog}>
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
                <br />
                <strong className="text-destructive">Please enter the password to confirm.</strong>
              </AlertDialogDescription>
            </AlertDialogHeader>
             <div className="space-y-2 py-2">
                <Label htmlFor="resetPasswordConfirm">Password</Label>
                 <div className="flex items-center gap-2">
                    <KeyRound className="h-4 w-4 text-muted-foreground" />
                    <Input
                        id="resetPasswordConfirm"
                        type="password"
                        value={passwordInput}
                        onChange={(e) => {
                            setPasswordInput(e.target.value);
                            if (passwordError) setPasswordError(''); 
                        }}
                        placeholder="Enter password"
                        className={passwordError ? "border-destructive ring-destructive focus-visible:ring-destructive" : ""}
                    />
                 </div>
                {passwordError && <p className="text-sm text-destructive">{passwordError}</p>}
              </div>
            <AlertDialogFooter>
              <AlertDialogCancel onClick={closeResetDialog}>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={handleResetDataAttempt} className="bg-destructive hover:bg-destructive/90 text-destructive-foreground">
                Yes, Reset Data
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
        <p className="text-xs text-muted-foreground mt-2">
          Use this to clear all data and start fresh. This action is password protected.
        </p>
      </div>
      <ExportDataDialog
        isOpen={isExportDialogOpen}
        onClose={() => setIsExportDialogOpen(false)}
        allDrugs={drugs}
        allTransactions={transactions}
      />
    </div>
  );
}
