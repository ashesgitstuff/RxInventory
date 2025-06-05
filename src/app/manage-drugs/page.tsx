
"use client";

import React, { useState } from 'react';
import { useInventory } from '@/contexts/InventoryContext';
import type { Drug } from '@/types'; // Drug is a specific batch here
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from '@/components/ui/table';
import { Edit, Pill, Info } from 'lucide-react';
import EditDrugForm from '@/components/inventory/EditDrugForm';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { format, parseISO } from 'date-fns';

const formatDateSafe = (dateString?: string) => {
  if (!dateString) return 'N/A';
  try {
    return format(parseISO(dateString), 'PP'); // e.g., Aug 17, 2023
  } catch (error) {
    return dateString; 
  }
};

export default function ManageDrugsPage() {
  const { drugs } = useInventory(); // `drugs` is the list of all batches
  const [selectedDrugBatch, setSelectedDrugBatch] = useState<Drug | null>(null);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);

  const handleEdit = (drugBatch: Drug) => {
    setSelectedDrugBatch(drugBatch);
    setIsEditDialogOpen(true);
  };

  const handleSaveSuccess = () => {
    setIsEditDialogOpen(false);
    setSelectedDrugBatch(null);
  };

  // Sort drugs by generic name, then brand name, then batch number for consistent display
  const sortedDrugBatches = React.useMemo(() => {
    return [...drugs].sort((a, b) => {
      if (a.name.toLowerCase() < b.name.toLowerCase()) return -1;
      if (a.name.toLowerCase() > b.name.toLowerCase()) return 1;
      if ((a.brandName || '').toLowerCase() < (b.brandName || '').toLowerCase()) return -1;
      if ((a.brandName || '').toLowerCase() > (b.brandName || '').toLowerCase()) return 1;
      if ((a.batchNumber || '').toLowerCase() < (b.batchNumber || '').toLowerCase()) return -1;
      if ((a.batchNumber || '').toLowerCase() > (b.batchNumber || '').toLowerCase()) return 1;
      return 0;
    });
  }, [drugs]);

  return (
    <div className="container mx-auto py-8 space-y-8">
      <Card className="shadow-xl">
        <CardHeader>
          <CardTitle className="font-headline flex items-center gap-2 text-2xl">
            <Pill className="h-6 w-6 text-primary" />
            Manage Drug Batches
          </CardTitle>
          <CardDescription>View and edit details of individual drug batches in your inventory.</CardDescription>
        </CardHeader>
        <CardContent>
          {sortedDrugBatches.length === 0 ? (
            <p className="text-center text-muted-foreground py-10">No drug batches in inventory.</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Generic Name</TableHead>
                    <TableHead>Brand Name</TableHead>
                    <TableHead>Dosage</TableHead>
                    <TableHead>Batch No.</TableHead>
                    <TableHead>Mfg. Date</TableHead>
                    <TableHead>Exp. Date</TableHead>
                    <TableHead>Source</TableHead>
                    <TableHead className="text-right">Stock (Strips)</TableHead>
                    <TableHead className="text-right">Price/Strip (INR)</TableHead>
                    <TableHead className="text-right">Low Stock Threshold</TableHead>
                    <TableHead className="text-center">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sortedDrugBatches.map((batch) => (
                    <TableRow key={batch.id}>
                      <TableCell className="font-medium">{batch.name}</TableCell>
                      <TableCell>{batch.brandName || 'N/A'}</TableCell>
                      <TableCell>{batch.dosage || 'N/A'}</TableCell>
                      <TableCell>{batch.batchNumber || 'N/A'}</TableCell>
                      <TableCell>{formatDateSafe(batch.dateOfManufacture)}</TableCell>
                      <TableCell>{formatDateSafe(batch.dateOfExpiry)}</TableCell>
                      <TableCell>{batch.initialSource || 'N/A'}</TableCell>
                      <TableCell className="text-right">{batch.stock}</TableCell>
                      <TableCell className="text-right">INR {batch.purchasePricePerStrip.toFixed(2)}</TableCell>
                      <TableCell className="text-right">{batch.lowStockThreshold}</TableCell>
                      <TableCell className="text-center">
                        <Button variant="outline" size="sm" onClick={() => handleEdit(batch)}>
                          <Edit className="mr-2 h-4 w-4" /> Edit
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {selectedDrugBatch && (
        <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
          <DialogContent className="sm:max-w-md md:max-w-lg lg:max-w-xl">
            <DialogHeader>
              <DialogTitle>Edit Batch: {selectedDrugBatch.name} {selectedDrugBatch.dosage ? `(${selectedDrugBatch.dosage})` : ''} - Batch: {selectedDrugBatch.batchNumber}</DialogTitle>
              <DialogDescription>
                Make changes to this specific drug batch. Click save when you're done.
              </DialogDescription>
            </DialogHeader>
            <EditDrugForm
              drug={selectedDrugBatch}
              onSaveSuccess={handleSaveSuccess}
              onCancel={() => setIsEditDialogOpen(false)}
            />
             <div className="mt-2 p-3 bg-muted/50 rounded-md text-xs text-muted-foreground flex items-start gap-2">
                <Info className="h-4 w-4 shrink-0 mt-0.5" />
                <span>Modifying these details will only affect this specific batch ({selectedDrugBatch.batchNumber}).</span>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
