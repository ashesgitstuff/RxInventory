
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
import type { RestockFormData, DrugRestockEntry, NewDrugDetails } from '@/types';
import { DEFAULT_PURCHASE_PRICE, DEFAULT_DRUG_LOW_STOCK_THRESHOLD } from '@/types';
import { useToast } from '@/hooks/use-toast';
import { CheckCircle, PackagePlus, PlusCircle, Trash2 } from 'lucide-react';
import { Separator } from '@/components/ui/separator';

const newDrugDetailsSchema = z.object({
  name: z.string().min(2, { message: "New drug name must be at least 2 characters." }),
  purchasePricePerStrip: z.coerce.number().min(0, { message: "Price must be non-negative." }),
  lowStockThreshold: z.coerce.number().int().min(0, { message: "Threshold must be zero or positive." }),
});

const drugRestockEntrySchema = z.object({
  drugId: z.string().min(1, { message: "Please select a drug or 'Add New'." }),
  stripsAdded: z.coerce.number().int().positive({ message: "Strips must be a positive number." }),
  newDrugDetails: newDrugDetailsSchema.optional(),
  updatedPurchasePricePerStrip: z.coerce.number().min(0, { message: "Price must be non-negative." }).optional(),
}).refine(data => {
    if (data.drugId === '--add-new--') {
        return !!data.newDrugDetails && 
               data.newDrugDetails.name.length >=2 && 
               (data.newDrugDetails.purchasePricePerStrip !== undefined && data.newDrugDetails.purchasePricePerStrip >=0) &&
               (data.newDrugDetails.lowStockThreshold !== undefined && data.newDrugDetails.lowStockThreshold >=0);
    }
    return true;
}, {
    message: "New drug details (name, valid price, and valid threshold) are required when 'Add New Drug' is selected.",
    path: ["newDrugDetails"], 
}).refine(data => {
    if (data.drugId === '--add-new--' && data.updatedPurchasePricePerStrip !== undefined) {
        return false; 
    }
    if (data.drugId !== '--add-new--' && data.newDrugDetails) {
        return false; 
    }
    return true;
}, {
    message: "Invalid combination of new drug details and price update fields. New drugs use 'New Drug Details', existing drugs can use 'Updated Purchase Price'."
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
      drugsToRestock: [{ 
        drugId: '', 
        stripsAdded: 10, 
        newDrugDetails: { 
          name: '', 
          purchasePricePerStrip: DEFAULT_PURCHASE_PRICE, 
          lowStockThreshold: DEFAULT_DRUG_LOW_STOCK_THRESHOLD 
        },
        updatedPurchasePricePerStrip: DEFAULT_PURCHASE_PRICE 
      }],
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
      if (item.drugId === '--add-new--' && item.newDrugDetails) {
        pricePerStrip = Number(item.newDrugDetails.purchasePricePerStrip) || 0;
      } else if (item.drugId !== '--add-new--' && item.drugId !== '') { 
        const drug = getDrugById(item.drugId);
        pricePerStrip = item.updatedPurchasePricePerStrip !== undefined 
                        ? Number(item.updatedPurchasePricePerStrip) 
                        : (drug?.purchasePricePerStrip || 0);
      }
      currentGrandTotal += strips * pricePerStrip;
    });
    setGrandTotal(currentGrandTotal);
  }, [watchedDrugsToRestock, getDrugById]);


  const handleDrugIdChange = (index: number, value: string) => {
    const isNew = value === '--add-new--';
    setFieldStates(prev => ({ ...prev, [index]: { isNewDrug: isNew } }));
    form.setValue(`drugsToRestock.${index}.drugId`, value);

    if (isNew) {
        form.setValue(`drugsToRestock.${index}.newDrugDetails`, { 
            name: '', 
            purchasePricePerStrip: DEFAULT_PURCHASE_PRICE, 
            lowStockThreshold: DEFAULT_DRUG_LOW_STOCK_THRESHOLD 
        });
        form.setValue(`drugsToRestock.${index}.updatedPurchasePricePerStrip`, undefined); // Ensure this is undefined for new drugs
    } else {
        form.setValue(`drugsToRestock.${index}.newDrugDetails`, undefined);
        const selectedDrug = getDrugById(value);
        form.setValue(`drugsToRestock.${index}.updatedPurchasePricePerStrip`, selectedDrug?.purchasePricePerStrip ?? DEFAULT_PURCHASE_PRICE);
    }
    form.trigger(`drugsToRestock.${index}.newDrugDetails`);
    form.trigger(`drugsToRestock.${index}.updatedPurchasePricePerStrip`);
  };


  async function onSubmit(data: RestockFormData) {
    
    for (let i = 0; i < data.drugsToRestock.length; i++) {
        const item = data.drugsToRestock[i];
        if (item.drugId === '--add-new--' && item.newDrugDetails) {
            const existingDrugWithSameName = getDrugByName(item.newDrugDetails.name);
            if (existingDrugWithSameName) {
                // Simplified check: if a drug with the same name exists, it's a conflict for new entries.
                // The more complex source/price check might be too nuanced for fully offline localStorage.
                if (existingDrugWithSameName.initialSource === data.source &&
                    existingDrugWithSameName.purchasePricePerStrip !== item.newDrugDetails.purchasePricePerStrip) {
                    form.setError(`drugsToRestock.${i}.newDrugDetails.name`, {
                        type: "manual",
                        message: `A drug named '${item.newDrugDetails.name}' from source '${data.source}' already exists with a different price (INR ${existingDrugWithSameName.purchasePricePerStrip.toFixed(2)}). Please use a different name, or update the existing drug's price via 'Manage Drugs'.`,
                    });
                    toast({
                        variant: "destructive",
                        title: "Validation Error",
                        description: `Drug '${item.newDrugDetails.name}' from source '${data.source}' conflicts with an existing entry due to different pricing. Please adjust.`,
                    });
                    return; 
                } else if (existingDrugWithSameName.initialSource !== data.source || existingDrugWithSameName.purchasePricePerStrip === item.newDrugDetails.purchasePricePerStrip) {
                     form.setError(`drugsToRestock.${i}.newDrugDetails.name`, {
                        type: "manual",
                        message: `A drug named "${item.newDrugDetails.name}" already exists. Please use the existing drug or choose a different name.`,
                    });
                    toast({
                        variant: "destructive",
                        title: "Validation Error",
                        description: `A drug named "${item.newDrugDetails.name}" already exists. Please use the existing drug or choose a different name.`,
                    });
                    return;
                }
            }
        }
    }

    const result = await restockDrugs(data.source, data.drugsToRestock);

    if (result.success) {
      const drugSummary = result.restockedDrugs.map(d => `${d.quantity}x ${d.drugName}`).join(', ');
      toast({
        title: "Drugs Added to Stock",
        description: `${drugSummary} successfully added from ${data.source}. Inventory updated locally. Total cost: INR ${grandTotal.toFixed(2)}.`,
        action: <CheckCircle className="text-green-500" />,
      });
      form.reset({
        source: '',
        drugsToRestock: [{ 
            drugId: '', 
            stripsAdded: 10, 
            newDrugDetails: { 
                name: '', 
                purchasePricePerStrip: DEFAULT_PURCHASE_PRICE, 
                lowStockThreshold: DEFAULT_DRUG_LOW_STOCK_THRESHOLD 
            },
            updatedPurchasePricePerStrip: DEFAULT_PURCHASE_PRICE
        }],
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
    } else if (item.drugId && item.drugId !== '--add-new--') {
      const drug = getDrugById(item.drugId);
      pricePerStrip = item.updatedPurchasePricePerStrip !== undefined 
                      ? Number(item.updatedPurchasePricePerStrip)
                      : (drug?.purchasePricePerStrip || 0);
    }
    return strips * pricePerStrip;
  };
  
  const getPurchasePricePerStripForDisplay = (index: number): string => {
    const item = watchedDrugsToRestock[index];
    if (!item) return 'N/A';
    
    let price: number | undefined;

    if (item.drugId === '--add-new--' && item.newDrugDetails) {
        price = item.newDrugDetails.purchasePricePerStrip;
    } else if (item.drugId !== '--add-new--' && item.drugId !== '') {
        price = item.updatedPurchasePricePerStrip; 
    }
    
    return price !== undefined ? `INR ${Number(price).toFixed(2)}` : 'N/A';
};


  return (
    <Card className="w-full max-w-3xl mx-auto shadow-xl">
      <CardHeader>
        <CardTitle className="font-headline flex items-center gap-2 text-2xl">
          <PackagePlus className="h-6 w-6 text-primary" />
          Restock Inventory
        </CardTitle>
        <CardDescription>Log new stock received. You can add new drugs or update prices for existing ones during restock.</CardDescription>
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
            {fields.map((fieldItem, index) => (
              <div key={fieldItem.id} className="space-y-4 p-4 border rounded-md shadow-sm relative">
                 {fields.length > 1 && (
                    <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="absolute top-2 right-2 text-destructive hover:bg-destructive/10 z-10"
                        onClick={() => {
                            const currentFields = form.getValues("drugsToRestock");
                            remove(index);
                            const newFieldStates: Record<number, { isNewDrug: boolean }> = {};
                            let newIdx = 0;
                            for (let i = 0; i < currentFields.length; i++) {
                                if (i !== index) {
                                    if (fieldStates[i]) {
                                        newFieldStates[newIdx] = fieldStates[i];
                                    }
                                    newIdx++;
                                }
                            }
                            setFieldStates(newFieldStates);
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
                    <FormLabel>Cost/Strip (INR)</FormLabel>
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
                        <FormField
                            control={form.control}
                            name={`drugsToRestock.${index}.updatedPurchasePricePerStrip`}
                            render={({ field }) => (
                                <FormControl>
                                    <Input 
                                      type="number" 
                                      placeholder="Price" 
                                      {...field} 
                                      min="0" 
                                      step="0.01" 
                                      value={field.value === undefined ? '' : field.value}
                                      onChange={e => field.onChange(e.target.value === '' ? undefined : parseFloat(e.target.value))}
                                    />
                                </FormControl>
                            )}
                        />
                    )}
                     <FormMessage>
                        {form.formState.errors.drugsToRestock?.[index]?.newDrugDetails?.purchasePricePerStrip?.message ||
                         form.formState.errors.drugsToRestock?.[index]?.updatedPurchasePricePerStrip?.message}
                    </FormMessage>
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
                     <FormField
                        control={form.control}
                        name={`drugsToRestock.${index}.newDrugDetails.lowStockThreshold`}
                        render={({ field }) => (
                            <FormItem>
                            <FormLabel>Low Stock Threshold (Strips)</FormLabel>
                            <FormControl>
                                <Input type="number" placeholder="e.g., 5" {...field} min="0" />
                            </FormControl>
                            <FormMessage />
                            </FormItem>
                        )}
                        />
                    <FormDescription className="text-xs">Ensure name, cost per strip (above), and threshold are filled for new drugs.</FormDescription>
                  </div>
                )}
                 <div className="text-right font-semibold mt-2">
                    Line Total: INR {getLineItemTotal(index).toFixed(2)}
                </div>
              </div>
            ))}
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                const newIndex = fields.length; 
                append({ 
                    drugId: '', 
                    stripsAdded: 10, 
                    newDrugDetails: { 
                        name: '', 
                        purchasePricePerStrip: DEFAULT_PURCHASE_PRICE, 
                        lowStockThreshold: DEFAULT_DRUG_LOW_STOCK_THRESHOLD 
                      },
                    updatedPurchasePricePerStrip: DEFAULT_PURCHASE_PRICE 
                  });
                  setFieldStates(prev => ({...prev, [newIndex]: {isNewDrug: false}}));
                }}
              className="w-full flex items-center gap-2"
            >
              <PlusCircle className="h-4 w-4" /> Add Another Drug Item
            </Button>

            <Separator />
            <div className="text-right text-xl font-bold text-foreground">
                Grand Total: INR {grandTotal.toFixed(2)}
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
