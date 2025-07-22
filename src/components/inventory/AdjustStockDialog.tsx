
"use client";

import React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from '@/components/ui/dialog';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useInventory } from '@/contexts/InventoryContext';
import { useToast } from '@/hooks/use-toast';
import type { Drug } from '@/types';
import { CheckCircle, AlertTriangle } from 'lucide-react';

const adjustStockFormSchema = z.object({
  newStock: z.coerce.number().int().min(0, { message: "Stock must be a non-negative number." }),
  reason: z.string().min(5, { message: "Reason must be at least 5 characters long." }).max(200),
});

type AdjustStockFormData = z.infer<typeof adjustStockFormSchema>;

interface AdjustStockDialogProps {
  drug: Drug;
  isOpen: boolean;
  onClose: () => void;
  onSaveSuccess: () => void;
}

export default function AdjustStockDialog({ drug, isOpen, onClose, onSaveSuccess }: AdjustStockDialogProps) {
  const { adjustDrugStock } = useInventory();
  const { toast } = useToast();

  const form = useForm<AdjustStockFormData>({
    resolver: zodResolver(adjustStockFormSchema),
    defaultValues: {
      newStock: drug.stock,
      reason: '',
    },
  });

  async function onSubmit(data: AdjustStockFormData) {
    const result = await adjustDrugStock(drug.id, data.newStock, data.reason);
    if (result.success) {
      toast({
        title: "Stock Adjusted",
        description: result.message,
        action: <CheckCircle className="text-green-500" />,
      });
      onSaveSuccess();
    } else {
      toast({
        variant: "destructive",
        title: "Adjustment Failed",
        description: result.message || "Could not adjust stock.",
      });
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Adjust Stock: {drug.brandName || drug.name} ({drug.dosage})</DialogTitle>
          <DialogDescription>
            Batch: {drug.batchNumber || 'N/A'}. Current Stock: {drug.stock}.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="newStock"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>New Stock Quantity (in Tablets)</FormLabel>
                  <FormControl>
                    <Input type="number" placeholder="Enter new stock count" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="reason"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Reason for Adjustment</FormLabel>
                  <FormControl>
                    <Textarea placeholder="e.g., Recount correction, Damaged stock" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="mt-2 p-3 bg-yellow-100 dark:bg-yellow-900/30 border border-yellow-300 dark:border-yellow-700 rounded-md text-xs text-yellow-800 dark:text-yellow-300 flex items-start gap-2">
              <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
              <span>This action is for correcting inventory counts and will be recorded. For adding new stock from a supplier, use the 'Restock' page.</span>
            </div>
            <DialogFooter className="pt-4">
              <DialogClose asChild>
                <Button type="button" variant="outline" onClick={onClose}>
                  Cancel
                </Button>
              </DialogClose>
              <Button type="submit">Save Adjustment</Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
