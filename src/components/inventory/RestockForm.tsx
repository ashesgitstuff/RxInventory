
"use client";

import React, { useState, useEffect } from 'react';
import { useForm, useFieldArray, useWatch } from 'react-hook-form';
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
import type { RestockFormData, DrugRestockEntry, NewDrugDetails, Drug } from '@/types';
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
        return !!data.newDrugDetails && data.newDrugDetails.name.length >=2 && (data.newDrugDetails.purchasePricePerStrip !== undefined && data.newDrugDetails.purchasePricePerStrip >=0);
    }
    return true;
}, {
    message: "New drug details (name and valid price) are required when 'Add New Drug' is selected.",
    path: ["newDrugDetails"], 
});


const restockFormSchema = z.object({
  source: z.string().min(2, { message: "Source must be at least 2 characters." }),
  drugsToRestock: z.array(drugRestockEntrySchema).min(1, { message: "At least one drug must be added to restock." }),
});

export default function RestockForm() {
  const { drugs, restockDrugs, getDrugByName, getDrugById } = useInventory();
  const { toast } = useToast();
  const [fieldStates, setFieldStates] = useState<Record<number, { isNewDrug: boolean }>>({});
  const [grandTotal, setGrandTotal] = useState(0);

  const form = useForm<RestockFormData>({
    resolver: zodResolver(restockFormSchema),
    defaultValues: {
      source: '',
      drugsToRestock: [{ drugId: '', stripsAdded: 10, newDrugDetails: { name: '', purchasePricePerStrip: DEFAULT_PURCHASE_PRICE } }],
    },
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "drugsToRestock",
  });

  const watchedDrugsToRestock = useWatch({
    control: form.control,
    name: "drugsToRestock",
  });

  useEffect(() => {
    let currentGrandTotal = 0;
    watchedDrugsToRestock.forEach((item, index) => {
      const strips = Number(item.stripsAdded) || 0;
      let pricePerStrip = 0;
      if (item.drugId === '--add-new--') {
        pricePerStrip = Number(item.newDrugDetails?.purchasePricePerStrip) || 0;
      } else {
        const selectedDrug = getDrugById(item.drugId);
        pricePerStrip = selectedDrug?.purchasePricePerStrip || 0;
      }
      currentGrandTotal += strips * pricePerStrip;
    });
    setGrandTotal(currentGrandTotal);
  }, [watchedDrugsToRestock, getDrugById]);


  const handleDrugIdChange = (index: number, value: string) => {
    const isNew = value === '--add-new--';
    setFieldStates(prev => ({ ...prev, [index]: { isNewDrug: isNew } }));
    form.setValue(`drugsToRestock.${index}.newDrugDetails`, 
        isNew ? { name: '', purchasePricePerStrip: DEFAULT_PURCHASE_PRICE } : undefined
    );
    form.setValue(`drugsToRestock.${index}.drugId`, value);
    form.trigger(`drugsToRestock.${index}.newDrugDetails`); // Trigger validation for conditional fields
  };


  function onSubmit(data: RestockFormData) {
    for (const item of data.drugsToRestock) {
        if (item.drugId === '--add-new--' && item.newDrugDetails) {
            if (getDrugByName(item.newDrugDetails.name)) {
                toast({
                    variant: "destructive",
                    title: "Validation Error",
                    description: `A drug named "${item.newDrugDetails.name}" already exists. Please use the existing drug or choose a different name.`,
                });
                return; 
            }
        }
    }

    const result = restockDrugs(data.source, data.drugsToRestock);

    if (result.success) {
      const drugSummary = result.restockedDrugs.map(d => `${d.quantity}x ${d.drugName}`).join(', ');
      toast({
        title: "Restock Successful",
        description: `${drugSummary} added from ${data.source}. Total cost: ₹${grandTotal.toFixed(2)}`,
        action: <CheckCircle className="text-green-500" />,
      });
      form.reset({
        source: '',
        drugsToRestock: [{ drugId: '', stripsAdded: 10, newDrugDetails: { name: '', purchasePricePerStrip: DEFAULT_PURCHASE_PRICE } }],
      });
      setFieldStates({}); 
      setGrandTotal(0);
    } else {
      toast({
        variant: "destructive",
        title: "Restock Failed",
        description: result.message || "An unexpected error occurred.",
      });
    }
  }
  
  const getLineItemTotal = (index: number): number => {
    const item = form.getValues(`drugsToRestock.${index}`);
    if (!item) return 0;

    const strips = Number(item.stripsAdded) || 0;
    let pricePerStrip = 0;

    if (item.drugId === '--add-new--' && item.newDrugDetails) {
      pricePerStrip = Number(item.newDrugDetails.purchasePricePerStrip) || 0;
    } else if (item.drugId) {
      const selectedDrug = getDrugById(item.drugId);
      pricePerStrip = selectedDrug?.purchasePricePerStrip || 0;
    }
    return strips * pricePerStrip;
  };
  
  const getPurchasePricePerStripForDisplay = (drugEntry: DrugRestockEntry): number | string => {
    if (drugEntry.drugId === '--add-new--') {
      return drugEntry.newDrugDetails?.purchasePricePerStrip ?? DEFAULT_PURCHASE_PRICE;
    }
    const drug = getDrugById(drugEntry.drugId);
    return drug ? drug.purchasePricePerStrip : 'N/A';
  };


  return (
    <Card className="w-full max-w-3xl mx-auto shadow-xl">
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
                 {fields.length > 1 && (
                    <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="absolute top-2 right-2 text-destructive hover:bg-destructive/10 z-10"
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
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 items-end">
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
                                {drug.name} (Stock: {drug.stock})
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
                        <FormLabel>Strips Added</FormLabel>
                        <FormControl>
                          <Input type="number" placeholder="Quantity" {...field} min="1" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormItem>
                    <FormLabel>Cost/Strip (₹)</FormLabel>
                    {fieldStates[index]?.isNewDrug ? (
                       <FormField
                            control={form.control}
                            name={`drugsToRestock.${index}.newDrugDetails.purchasePricePerStrip`}
                            render={({ field }) => (
                                <FormControl>
                                <Input type="number" placeholder="Price" {...field} min="0" step="0.01" />
                                </FormControl>
                            )}
                        />
                    ) : (
                        <Input 
                            type="text" 
                            value={typeof getPurchasePricePerStripForDisplay(watchedDrugsToRestock[index]) === 'number' 
                                ? (getPurchasePricePerStripForDisplay(watchedDrugsToRestock[index]) as number).toFixed(2) 
                                : getPurchasePricePerStripForDisplay(watchedDrugsToRestock[index])} 
                            readOnly 
                            className="bg-muted"
                        />
                    )}
                     <FormMessage>{form.formState.errors.drugsToRestock?.[index]?.newDrugDetails?.purchasePricePerStrip?.message}</FormMessage>
                  </FormItem>
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
                    {/* Purchase price for new drug is now in the main grid, this is a bit redundant but harmless */}
                     <FormDescription className="text-xs">Ensure name and cost per strip (above) are filled for new drugs.</FormDescription>
                  </div>
                )}
                 <div className="text-right font-semibold mt-2">
                    Line Total: ₹{getLineItemTotal(index).toFixed(2)}
                </div>
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
            <div className="text-right text-xl font-bold text-foreground">
                Grand Total: ₹{grandTotal.toFixed(2)}
            </div>
            <Button type="submit" className="w-full text-lg py-6 shadow-md hover:shadow-lg transition-shadow">
              Add All to Stock
            </Button>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
