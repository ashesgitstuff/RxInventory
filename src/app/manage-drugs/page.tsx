
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
import { Edit, Pill, Info, Trash2, AlertTriangle, Replace } from 'lucide-react';
import EditDrugForm from '@/components/inventory/EditDrugForm';
import AdjustStockDialog from '@/components/inventory/AdjustStockDialog';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { format, parseISO } from 'date-fns';
import { useToast } from '@/hooks/use-toast';

const formatDateSafe = (dateString?: string) => {
  if (!dateString) return 'N/A';
  try {
    return format(parseISO(dateString), 'PP'); // e.g., Aug 17, 2023
  } catch (error) {
    return dateString; 
  }
};

export default function ManageDrugsPage() {
  const { drugs, deleteDrugBatch } = useInventory(); 
  const [selectedDrugBatch, setSelectedDrugBatch] = useState<Drug | null>(null);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isAdjustStockDialogOpen, setIsAdjustStockDialogOpen] = useState(false);
  const [drugToDelete, setDrugToDelete] = useState<Drug | null>(null);
  const { toast } = useToast();

  const handleEdit = (drugBatch: Drug) => {
    setSelectedDrugBatch(drugBatch);
    setIsEditDialogOpen(true);
  };
  
  const handleAdjustStock = (drugBatch: Drug) => {
    setSelectedDrugBatch(drugBatch);
    setIsAdjustStockDialogOpen(true);
  };

  const handleSaveSuccess = () => {
    setIsEditDialogOpen(false);
    setIsAdjustStockDialogOpen(false);
    setSelectedDrugBatch(null);
  };

  const openDeleteDialog = (drugBatch: Drug) => {
    setDrugToDelete(drugBatch);
    setIsDeleteDialogOpen(true);
  };

  const confirmDelete = async () => {
    if (!drugToDelete) return;

    const result = await deleteDrugBatch(drugToDelete.id);
    if (result.success) {
      toast({
        title: "Batch Deleted",
        description: result.message,
      });
    } else {
      toast({
        variant: "destructive",
        title: "Deletion Failed",
        description: result.message || "Could not delete the drug batch.",
      });
    }
    setIsDeleteDialogOpen(false);
    setDrugToDelete(null);
  };


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
          <CardDescription>View, edit, or delete details of individual drug batches in your inventory.</CardDescription>
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
                    <TableHead className="text-right">Stock (Tablets)</TableHead>
                    <TableHead className="text-right">Price/Tablet (INR)</TableHead>
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
                      <TableCell className="text-right">INR {batch.purchasePricePerTablet.toFixed(2)}</TableCell>
                      <TableCell className="text-right">{batch.lowStockThreshold}</TableCell>
                      <TableCell className="text-center space-x-1">
                        <Button variant="outline" size="sm" onClick={() => handleAdjustStock(batch)} className="h-8 px-2">
                          <Replace className="mr-1 h-4 w-4" /> Adjust Stock
                        </Button>
                        <Button variant="outline" size="sm" onClick={() => handleEdit(batch)} className="h-8 px-2">
                          <Edit className="mr-1 h-4 w-4" /> Edit
                        </Button>
                        <Button variant="destructive" size="sm" onClick={() => openDeleteDialog(batch)} className="h-8 px-2">
                          <Trash2 className="mr-1 h-4 w-4" /> Delete
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

      {selectedDrugBatch && isEditDialogOpen && (
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

      {selectedDrugBatch && isAdjustStockDialogOpen && (
        <AdjustStockDialog
          drug={selectedDrugBatch}
          isOpen={isAdjustStockDialogOpen}
          onClose={() => setIsAdjustStockDialogOpen(false)}
          onSaveSuccess={handleSaveSuccess}
        />
      )}

      {drugToDelete && (
        <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-destructive" />
                Confirm Deletion
              </AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to permanently delete the batch: 
                <span className="font-semibold"> {drugToDelete.name} {drugToDelete.brandName ? `[${drugToDelete.brandName}]` : ''} {drugToDelete.dosage ? `(${drugToDelete.dosage})` : ''} (Batch: {drugToDelete.batchNumber || 'N/A'})</span>? 
                This action cannot be undone and will remove it from inventory.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel onClick={() => setDrugToDelete(null)}>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={confirmDelete} className="bg-destructive hover:bg-destructive/90 text-destructive-foreground">
                Yes, Delete Batch
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
    </div>
  );
}
