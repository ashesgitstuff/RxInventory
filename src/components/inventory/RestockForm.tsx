
"use client";

import React, { useState } from 'react';
import { useForm, useFieldArray } from 'react-hook-form';
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
  FormDescription,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { useInventory } from '@/contexts/InventoryContext';
import type { RestockFormData, DrugRestockEntry, NewDrugDetails } from '@/types';
import { DEFAULT_PURCHASE_PRICE } from '@/types';
import { useToast } from '@/hooks/use-toast';
import { CheckCircle, PackagePlus, PlusCircle, Trash2 } from 'lucide-react';
import { Separator } from '@/components/ui/separator';

const newDrugDetailsSchema = z.object({
  name: z.string().min(2, { message: "New drug name must be at least 2 characters." }),
  purchasePricePerStrip: z.coerce.number().min(0, { message: "Price must be non-negative." }),
}).optional();

const drugRestockEntrySchema = z.object({
  drugId: z.string().min(1, { message: "Please select a drug or 'Add New'." }),
  newDrugDetails: newDrugDetailsSchema,
  stripsAdded: z.coerce.number().int().positive({ message: "Strips must be a positive number." }),
}).refine(data => {
    if (data.drugId === '--add-new--') {
        return !!data.newDrugDetails && data.newDrugDetails.name.length >=2 && data.newDrugDetails.purchasePricePerStrip >=0;
    }
    return true;
}, {
    message: "New drug details are required when 'Add New Drug' is selected.",
    path: ["newDrugDetails"], // Point error to the newDrugDetails field group
});


const restockFormSchema = z.object({
  source: z.string().min(2, { message: "Source must be at least 2 characters." }),
  drugsToRestock: z.array(drugRestockEntrySchema).min(1, { message: "At least one drug must be added to restock." }),
});

export default function RestockForm() {
  const { drugs, restockDrugs, getDrugByName } = useInventory();
  const { toast } = useToast();
  // Used to trigger re-render for conditional new drug fields
  const [fieldStates, setFieldStates] = useState<Record<number, { isNewDrug: boolean }>>({});


  const form = useForm<RestockFormData>({
    resolver: zodResolver(restockFormSchema),
    defaultValues: {
      source: '',
      drugsToRestock: [{ drugId: '', stripsAdded: 10, newDrugDetails: { name: '', purchasePricePerStrip: DEFAULT_PURCHASE_PRICE } }],
    },
  });

  const { fields, append, remove, update } = useFieldArray({
    control: form.control,
    name: "drugsToRestock",
  });

  const handleDrugIdChange = (index: number, value: string) => {
    const isNew = value === '--add-new--';
    setFieldStates(prev => ({ ...prev, [index]: { isNewDrug: isNew } }));
    // Reset newDrugDetails if not adding new, or prefill if switching to new
    const currentField = form.getValues(`drugsToRestock.${index}`);
    form.setValue(`drugsToRestock.${index}.newDrugDetails`, 
        isNew ? { name: '', purchasePricePerStrip: DEFAULT_PURCHASE_PRICE } : undefined
    );
    form.setValue(`drugsToRestock.${index}.drugId`, value); // ensure drugId is set
  };


  function onSubmit(data: RestockFormData) {
    // Validate new drug names for uniqueness before submitting
    for (const item of data.drugsToRestock) {
        if (item.drugId === '--add-new--' && item.newDrugDetails) {
            if (getDrugByName(item.newDrugDetails.name)) {
                toast({
                    variant: "destructive",
                    title: "Validation Error",
                    description: `A drug named "${item.newDrugDetails.name}" already exists. Please use the existing drug or choose a different name.`,
                });
                return; // Stop submission
            }
        }
    }

    const result = restockDrugs(data.source, data.drugsToRestock);

    if (result.success) {
      const drugSummary = result.restockedDrugs.map(d => `${d.quantity}x ${d.drugName}`).join(', ');
      toast({
        title: "Restock Successful",
        description: `${drugSummary} added from ${data.source}.`,
        action: <CheckCircle className="text-green-500" />,
      });
      form.reset({
        source: '',
        drugsToRestock: [{ drugId: '', stripsAdded: 10, newDrugDetails: { name: '', purchasePricePerStrip: DEFAULT_PURCHASE_PRICE } }],
      });
      setFieldStates({}); // Reset field states
    } else {
      toast({
        variant: "destructive",
        title: "Restock Failed",
        description: result.message || "An unexpected error occurred.",
      });
    }
  }

  return (
    <Card className="w-full max-w-2xl mx-auto shadow-xl">
      <CardHeader>
        <CardTitle className="font-headline flex items-center gap-2 text-2xl">
          <PackagePlus className="h-6 w-6 text-primary" />
          Restock Inventory
        </CardTitle>
        <CardDescription>Log new stock received. You can add new drugs if they are not in the list.</CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <FormField
              control={form.control}
              name="source"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Source of Drugs</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g., Supplier Name, Donation Program" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <Separator />
            <h3 className="text-lg font-medium text-foreground">Drugs to Restock</h3>
            {fields.map((item, index) => (
              <div key={item.id} className="space-y-4 p-4 border rounded-md shadow-sm relative">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name={`drugsToRestock.${index}.drugId`}
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Drug</FormLabel>
                        <Select 
                            onValueChange={(value) => {
                                field.onChange(value);
                                handleDrugIdChange(index, value);
                            }} 
                            defaultValue={field.value}
                        >
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select a drug or add new" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="--add-new--">
                              <span className="flex items-center"><PlusCircle className="mr-2 h-4 w-4 text-green-500" /> Add New Drug...</span>
                            </SelectItem>
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
                    name={`drugsToRestock.${index}.stripsAdded`}
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Number of Strips Added</FormLabel>
                        <FormControl>
                          <Input type="number" placeholder="Strips to add" {...field} min="1" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                {fieldStates[index]?.isNewDrug && (
                  <div className="mt-4 p-3 border border-primary/50 rounded-md bg-primary/5 space-y-3">
                     <p className="text-sm text-primary font-medium">New Drug Details:</p>
                    <FormField
                      control={form.control}
                      name={`drugsToRestock.${index}.newDrugDetails.name`}
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>New Drug Name</FormLabel>
                          <FormControl>
                            <Input placeholder="e.g., Paracetamol 500mg" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name={`drugsToRestock.${index}.newDrugDetails.purchasePricePerStrip`}
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Purchase Price Per Strip (Optional)</FormLabel>
                          <FormControl>
                            <Input type="number" placeholder="e.g., 2.50" {...field} min="0" step="0.01" />
                          </FormControl>
                           <FormDescription>Default is {DEFAULT_PURCHASE_PRICE} if left blank.</FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                )}
                {fields.length > 1 && (
                    <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="absolute top-2 right-2 text-destructive hover:bg-destructive/10"
                        onClick={() => {
                            remove(index);
                            setFieldStates(prev => {
                                const newState = {...prev};
                                delete newState[index];
                                return newState;
                            });
                        }}
                    >
                        <Trash2 className="h-4 w-4" />
                        <span className="sr-only">Remove Drug</span>
                    </Button>
                )}
              </div>
            ))}
            <Button
              type="button"
              variant="outline"
              onClick={() => append({ drugId: '', stripsAdded: 10, newDrugDetails: { name: '', purchasePricePerStrip: DEFAULT_PURCHASE_PRICE } })}
              className="w-full flex items-center gap-2"
            >
              <PlusCircle className="h-4 w-4" /> Add Another Drug Item
            </Button>

            <Separator />
            <Button type="submit" className="w-full text-lg py-6 shadow-md hover:shadow-lg transition-shadow">
              Add All to Stock
            </Button>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
