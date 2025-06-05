
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
import { Edit, Edit3 } from 'lucide-react';
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
            <Edit3 className="h-6 w-6 text-primary" />
            Manage Drugs
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
                    <TableHead>Name</TableHead>
                    <TableHead className="text-right">Current Stock (Strips)</TableHead>
                    <TableHead className="text-right">Purchase Price/Strip (INR)</TableHead>
                    <TableHead className="text-center">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {drugs.map((drug) => (
                    <TableRow key={drug.id}>
                      <TableCell className="font-medium">{drug.name}</TableCell>
                      <TableCell className="text-right">{drug.stock}</TableCell>
                      <TableCell className="text-right">INR {drug.purchasePricePerStrip.toFixed(2)}</TableCell>
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
          <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle>Edit Drug: {selectedDrug.name}</DialogTitle>
              <DialogDescription>
                Make changes to the drug details below. Click save when you're done.
              </DialogDescription>
            </DialogHeader>
            <EditDrugForm
              drug={selectedDrug}
              onSaveSuccess={handleSaveSuccess}
              onCancel={() => setIsEditDialogOpen(false)}
            />
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
