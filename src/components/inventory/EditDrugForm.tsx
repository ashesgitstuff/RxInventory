
"use client";

import React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { useInventory } from '@/contexts/InventoryContext';
import type { Drug, EditDrugFormData } from '@/types'; // Drug is a specific batch here
import { useToast } from '@/hooks/use-toast';
import { CheckCircle } from 'lucide-react';

const editDrugFormSchema = z.object({
  name: z.string().min(2, { message: "Generic name must be at least 2 characters." }),
  brandName: z.string().optional(),
  dosage: z.string().optional(),
  batchNumber: z.string().min(1, { message: "Batch number is required." }),
  dateOfManufacture: z.string().optional().refine(val => !val || !isNaN(Date.parse(val)), { message: "Invalid manufacture date" }),
  dateOfExpiry: z.string().min(1, { message: "Expiry date is required." }).refine(val => !val || !isNaN(Date.parse(val)), { message: "Invalid expiry date" }),
  initialSource: z.string().optional(),
  purchasePricePerTablet: z.coerce.number().min(0, { message: "Price must be non-negative." }),
  lowStockThreshold: z.coerce.number().int().min(0, { message: "Threshold must be zero or a positive number." }),
}).refine(data => {
    if (data.dateOfManufacture && data.dateOfExpiry) {
        const mfgDate = new Date(data.dateOfManufacture);
        const expDate = new Date(data.dateOfExpiry);
        if (!isNaN(mfgDate.getTime()) && !isNaN(expDate.getTime())) {
            return mfgDate < expDate;
        }
    }
    return true;
}, { message: "Expiry date must be after manufacture date.", path: ["dateOfExpiry"] });


interface EditDrugFormProps {
  drug: Drug; // This is a specific batch
  onSaveSuccess: () => void;
  onCancel: () => void;
}

export default function EditDrugForm({ drug: drugBatch, onSaveSuccess, onCancel }: EditDrugFormProps) {
  const { updateDrugDetails, drugs } = useInventory(); // drugs is for checking conflicts
  const { toast } = useToast();

  const form = useForm<EditDrugFormData>({
    resolver: zodResolver(editDrugFormSchema),
    defaultValues: {
      name: drugBatch.name,
      brandName: drugBatch.brandName || '',
      dosage: drugBatch.dosage || '',
      batchNumber: drugBatch.batchNumber || '',
      dateOfManufacture: drugBatch.dateOfManufacture || '',
      dateOfExpiry: drugBatch.dateOfExpiry || '',
      initialSource: drugBatch.initialSource || '',
      purchasePricePerTablet: drugBatch.purchasePricePerTablet,
      lowStockThreshold: drugBatch.lowStockThreshold,
    },
  });

  async function onSubmit(data: EditDrugFormData) {
    // Check for uniqueness: generic name + brand + dosage + batch number
    const conflictingBatch = drugs.find(d =>
        d.id !== drugBatch.id && // Exclude the current batch being edited
        d.name.toLowerCase() === data.name.toLowerCase() &&
        (d.brandName || '').toLowerCase() === (data.brandName || '').toLowerCase() &&
        (d.dosage || '').toLowerCase() === (data.dosage || '').toLowerCase() &&
        (d.batchNumber || '').toLowerCase() === (data.batchNumber || '').toLowerCase()
    );

    if (conflictingBatch) {
        form.setError("batchNumber", { // Or a general form error
            type: "manual",
            message: "A batch with the same generic name, brand, dosage, and batch number already exists. Please ensure uniqueness.",
        });
        toast({
            variant: "destructive",
            title: "Validation Error",
            description: "A batch with these identifying details already exists.",
        });
        return;
    }

    const result = await updateDrugDetails(drugBatch.id, data);

    if (result.success) {
      toast({
        title: "Drug Batch Updated",
        description: `Details for ${result.updatedDrug?.name} (Batch: ${result.updatedDrug?.batchNumber}) have been saved.`,
        action: <CheckCircle className="text-green-500" />,
      });
      onSaveSuccess();
    } else {
      toast({
        variant: "destructive",
        title: "Update Failed",
        description: result.message || "An unexpected error occurred.",
      });
    }
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 py-4 max-h-[70vh] overflow-y-auto pr-2">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FormField
            control={form.control}
            name="name"
            render={({ field }) => (
                <FormItem>
                <FormLabel>Generic Name</FormLabel>
                <FormControl>
                    <Input placeholder="Enter generic drug name" {...field} />
                </FormControl>
                <FormMessage />
                </FormItem>
            )}
            />
            <FormField
            control={form.control}
            name="brandName"
            render={({ field }) => (
                <FormItem>
                <FormLabel>Brand Name (Optional)</FormLabel>
                <FormControl>
                    <Input placeholder="Enter brand name" {...field} />
                </FormControl>
                <FormMessage />
                </FormItem>
            )}
            />
            <FormField
            control={form.control}
            name="dosage"
            render={({ field }) => (
                <FormItem>
                <FormLabel>Dosage (e.g., 500mg)</FormLabel>
                <FormControl>
                    <Input placeholder="e.g., 500mg, 10ml" {...field} />
                </FormControl>
                <FormMessage />
                </FormItem>
            )}
            />
            <FormField
            control={form.control}
            name="batchNumber"
            render={({ field }) => (
                <FormItem>
                <FormLabel>Batch Number</FormLabel>
                <FormControl>
                    <Input placeholder="Enter batch number" {...field} />
                </FormControl>
                <FormMessage />
                </FormItem>
            )}
            />
            <FormField
            control={form.control}
            name="dateOfManufacture"
            render={({ field }) => (
                <FormItem>
                <FormLabel>Manufacture Date (Optional)</FormLabel>
                <FormControl>
                    <Input type="date" {...field} />
                </FormControl>
                <FormMessage />
                </FormItem>
            )}
            />
            <FormField
            control={form.control}
            name="dateOfExpiry"
            render={({ field }) => (
                <FormItem>
                <FormLabel>Expiry Date</FormLabel>
                <FormControl>
                    <Input type="date" {...field} />
                </FormControl>
                <FormMessage />
                </FormItem>
            )}
            />
            <FormField
            control={form.control}
            name="initialSource"
            render={({ field }) => (
                <FormItem>
                <FormLabel>Source (Optional)</FormLabel>
                <FormControl>
                    <Input placeholder="Enter source (e.g., supplier)" {...field} />
                </FormControl>
                <FormMessage />
                </FormItem>
            )}
            />
            <FormField
            control={form.control}
            name="purchasePricePerTablet"
            render={({ field }) => (
                <FormItem>
                <FormLabel>Purchase Price Per Tablet (INR)</FormLabel>
                <FormControl>
                    <Input type="number" placeholder="e.g., 2.50" {...field} min="0" step="0.01" />
                </FormControl>
                <FormMessage />
                </FormItem>
            )}
            />
            <FormField
            control={form.control}
            name="lowStockThreshold"
            render={({ field }) => (
                <FormItem className="md:col-span-2">
                <FormLabel>Low Stock Threshold (Tablets for this batch)</FormLabel>
                <FormControl>
                    <Input type="number" placeholder="Enter threshold" {...field} min="0" />
                </FormControl>
                <FormMessage />
                </FormItem>
            )}
            />
        </div>
        <div className="flex justify-end gap-2 pt-4">
          <Button type="button" variant="outline" onClick={onCancel}>
            Cancel
          </Button>
          <Button type="submit">Save Changes</Button>
        </div>
      </form>
    </Form>
  );
}
