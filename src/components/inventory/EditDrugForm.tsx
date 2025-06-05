
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
  purchasePricePerStrip: z.coerce.number().min(0, { message: "Price must be non-negative." }),
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
      purchasePricePerStrip: drug.purchasePricePerStrip,
    },
  });

  function onSubmit(data: EditDrugFormData) {
    // Check for name uniqueness if name has changed
    if (data.name.toLowerCase() !== drug.name.toLowerCase()) {
      const existingDrugWithNewName = getDrugByName(data.name);
      if (existingDrugWithNewName && existingDrugWithNewName.id !== drug.id) {
        form.setError("name", {
          type: "manual",
          message: `A drug named "${data.name}" already exists. Please choose a different name.`,
        });
        return;
      }
    }

    const result = updateDrugDetails(drug.id, data);

    if (result.success) {
      toast({
        title: "Drug Updated",
        description: `Details for ${result.updatedDrug?.name || data.name} have been saved.`,
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
          name="purchasePricePerStrip"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Purchase Price Per Strip (₹)</FormLabel>
              <FormControl>
                <Input type="number" placeholder="e.g., 2.50" {...field} min="0" step="0.01" />
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
