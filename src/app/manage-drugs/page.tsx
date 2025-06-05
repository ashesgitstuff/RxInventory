
"use client";

import React, { useState } from 'react';
import { useInventory } from '@/contexts/InventoryContext';
import type { Drug } from '@/types';
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
import { Edit, Edit3, Info, Pill } from 'lucide-react'; // Added Pill
import EditDrugForm from '@/components/inventory/EditDrugForm';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogDescription,
  DialogClose
} from "@/components/ui/dialog";
import { format, parseISO } from 'date-fns';

// Helper to format date strings, handling undefined or invalid dates
const formatDateSafe = (dateString?: string) => {
  if (!dateString) return 'N/A';
  try {
    return format(parseISO(dateString), 'PP'); // e.g., Aug 17, 2023
  } catch (error) {
    return dateString; // Return original if parsing fails
  }
};


export default function ManageDrugsPage() {
  const { drugs } = useInventory();
  const [selectedDrug, setSelectedDrug] = useState<Drug | null>(null);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);

  const handleEdit = (drug: Drug) => {
    setSelectedDrug(drug);
    setIsEditDialogOpen(true);
  };

  const handleSaveSuccess = () => {
    setIsEditDialogOpen(false);
    setSelectedDrug(null);
  };

  return (
    <div className="container mx-auto py-8 space-y-8">
      <Card className="shadow-xl">
        <CardHeader>
          <CardTitle className="font-headline flex items-center gap-2 text-2xl">
            <Pill className="h-6 w-6 text-primary" /> {/* Changed Icon */}
            Manage Drug Details
          </CardTitle>
          <CardDescription>View and edit details of drugs in your inventory.</CardDescription>
        </CardHeader>
        <CardContent>
          {drugs.length === 0 ? (
            <p className="text-center text-muted-foreground py-10">No drugs in inventory to manage.</p>
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
                    <TableHead>Initial Source</TableHead>
                    <TableHead className="text-right">Current Stock (Strips)</TableHead>
                    <TableHead className="text-right">Purchase Price/Strip (INR)</TableHead>
                    <TableHead className="text-right">Low Stock Threshold (Strips)</TableHead>
                    <TableHead className="text-center">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {drugs.map((drug) => (
                    <TableRow key={drug.id}>
                      <TableCell className="font-medium">{drug.name}</TableCell>
                      <TableCell>{drug.brandName || 'N/A'}</TableCell>
                      <TableCell>{drug.dosage || 'N/A'}</TableCell>
                      <TableCell>{drug.batchNumber || 'N/A'}</TableCell>
                      <TableCell>{formatDateSafe(drug.dateOfManufacture)}</TableCell>
                      <TableCell>{formatDateSafe(drug.dateOfExpiry)}</TableCell>
                      <TableCell>{drug.initialSource || 'N/A'}</TableCell>
                      <TableCell className="text-right">{drug.stock}</TableCell>
                      <TableCell className="text-right">INR {drug.purchasePricePerStrip.toFixed(2)}</TableCell>
                      <TableCell className="text-right">{drug.lowStockThreshold}</TableCell>
                      <TableCell className="text-center">
                        <Button variant="outline" size="sm" onClick={() => handleEdit(drug)}>
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

      {selectedDrug && (
        <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
          <DialogContent className="sm:max-w-md md:max-w-lg lg:max-w-xl"> {/* Adjusted width */}
            <DialogHeader>
              <DialogTitle>Edit Drug: {selectedDrug.name} {selectedDrug.dosage ? `(${selectedDrug.dosage})` : ''}</DialogTitle>
              <DialogDescription>
                Make changes to the drug details below. Click save when you're done.
              </DialogDescription>
            </DialogHeader>
            <EditDrugForm
              drug={selectedDrug}
              onSaveSuccess={handleSaveSuccess}
              onCancel={() => setIsEditDialogOpen(false)}
            />
             <div className="mt-2 p-3 bg-muted/50 rounded-md text-xs text-muted-foreground flex items-start gap-2">
                <Info className="h-4 w-4 shrink-0 mt-0.5" />
                <span>All fields can be updated here. This will reflect across the application.</span>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
