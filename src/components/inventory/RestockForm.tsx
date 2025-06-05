"use client";

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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { useInventory } from '@/contexts/InventoryContext';
import type { RestockFormData } from '@/types';
import { useToast } from '@/hooks/use-toast';
import { CheckCircle, PackagePlus } from 'lucide-react';

const restockFormSchema = z.object({
  drugId: z.string().min(1, { message: "Please select a drug." }),
  stripsAdded: z.coerce.number().int().positive({ message: "Strips must be a positive number." }),
});

export default function RestockForm() {
  const { drugs, restockDrug, getDrugById } = useInventory();
  const { toast } = useToast();

  const form = useForm<RestockFormData>({
    resolver: zodResolver(restockFormSchema),
    defaultValues: {
      drugId: '',
      stripsAdded: 10, // Default to a common restock quantity
    },
  });

  function onSubmit(data: RestockFormData) {
    const drug = getDrugById(data.drugId);
    if (!drug) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Selected drug not found.",
      });
      return;
    }
    restockDrug(data.drugId, data.stripsAdded);
    toast({
      title: "Restock Successful",
      description: `${data.stripsAdded} strip(s) of ${drug.name} added to inventory.`,
      action: <CheckCircle className="text-green-500" />,
    });
    form.reset();
  }

  return (
    <Card className="w-full max-w-lg mx-auto shadow-xl">
      <CardHeader>
        <CardTitle className="font-headline flex items-center gap-2 text-2xl">
          <PackagePlus className="h-6 w-6 text-primary" />
          Restock Inventory
        </CardTitle>
        <CardDescription>Log new stock received for each drug.</CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <FormField
              control={form.control}
              name="drugId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Drug</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select a drug to restock" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {drugs.map((drug) => (
                        <SelectItem key={drug.id} value={drug.id}>
                          {drug.name} (Current Stock: {drug.stock})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="stripsAdded"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Number of Strips Added</FormLabel>
                  <FormControl>
                    <Input type="number" placeholder="Enter number of strips" {...field} min="1" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <Button type="submit" className="w-full text-lg py-6 shadow-md hover:shadow-lg transition-shadow">
              Add to Stock
            </Button>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
