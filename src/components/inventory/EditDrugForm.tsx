
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
import type { Drug, EditDrugFormData } from '@/types';
import { useToast } from '@/hooks/use-toast';
import { CheckCircle } from 'lucide-react';

const editDrugFormSchema = z.object({
  name: z.string().min(2, { message: "Drug name must be at least 2 characters." }),
  initialSource: z.string().optional(),
  purchasePricePerStrip: z.coerce.number().min(0, { message: "Price must be non-negative." }),
  lowStockThreshold: z.coerce.number().int().min(0, { message: "Threshold must be zero or a positive number." }),
});

interface EditDrugFormProps {
  drug: Drug;
  onSaveSuccess: () => void;
  onCancel: () => void;
}

export default function EditDrugForm({ drug, onSaveSuccess, onCancel }: EditDrugFormProps) {
  const { updateDrugDetails, getDrugByName } = useInventory();
  const { toast } = useToast();

  const form = useForm<EditDrugFormData>({
    resolver: zodResolver(editDrugFormSchema),
    defaultValues: {
      name: drug.name,
      initialSource: drug.initialSource || '',
      purchasePricePerStrip: drug.purchasePricePerStrip,
      lowStockThreshold: drug.lowStockThreshold,
    },
  });

  async function onSubmit(data: EditDrugFormData) {
    if (data.name && data.name.toLowerCase() !== drug.name.toLowerCase()) {
      const existingDrugWithNewName = getDrugByName(data.name);
      if (existingDrugWithNewName && existingDrugWithNewName.id !== drug.id) {
        form.setError("name", {
          type: "manual",
          message: `A drug named "${data.name}" already exists. Please choose a different name.`,
        });
        return;
      }
    }

    const result = await updateDrugDetails(drug.id, data);

    if (result.success) {
      toast({
        title: "Drug Updated",
        description: `Details for ${result.updatedDrug?.name || data.name || drug.name} have been saved locally.`,
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
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6 py-4">
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Drug Name</FormLabel>
              <FormControl>
                <Input placeholder="Enter drug name" {...field} />
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
              <FormLabel>Initial Source</FormLabel>
              <FormControl>
                <Input placeholder="Enter initial source (e.g., supplier)" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="purchasePricePerStrip"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Purchase Price Per Strip (INR)</FormLabel>
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
            <FormItem>
              <FormLabel>Low Stock Threshold (Strips)</FormLabel>
              <FormControl>
                <Input type="number" placeholder="Enter threshold" {...field} min="0" />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
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
