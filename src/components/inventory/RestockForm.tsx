
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
import { format, parseISO } from 'date-fns';

const newDrugDetailsSchema = z.object({
  name: z.string().min(2, { message: "Generic name must be at least 2 characters." }),
  brandName: z.string().optional(),
  dosage: z.string().optional(),
  batchNumber: z.string().optional(),
  dateOfManufacture: z.string().optional().refine(val => !val || !isNaN(Date.parse(val)), { message: "Invalid manufacture date" }),
  dateOfExpiry: z.string().optional().refine(val => !val || !isNaN(Date.parse(val)), { message: "Invalid expiry date" }),
  purchasePricePerStrip: z.coerce.number().min(0, { message: "Price must be non-negative." }),
  lowStockThreshold: z.coerce.number().int().min(0, { message: "Threshold must be zero or positive." }),
}).refine(data => {
    if (data.dateOfManufacture && data.dateOfExpiry) {
        return new Date(data.dateOfManufacture) < new Date(data.dateOfExpiry);
    }
    return true;
}, { message: "Expiry date must be after manufacture date.", path: ["dateOfExpiry"] });


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
    message: "New drug details (generic name, valid price, and valid threshold) are required when 'Add New Drug' is selected.",
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

const getDefaultNewDrugDetails = (): NewDrugDetails => ({
    name: '', 
    brandName: '',
    dosage: '',
    batchNumber: '',
    dateOfManufacture: '',
    dateOfExpiry: '',
    purchasePricePerStrip: DEFAULT_PURCHASE_PRICE, 
    lowStockThreshold: DEFAULT_DRUG_LOW_STOCK_THRESHOLD 
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
        newDrugDetails: getDefaultNewDrugDetails(),
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
        form.setValue(`drugsToRestock.${index}.newDrugDetails`, getDefaultNewDrugDetails());
        form.setValue(`drugsToRestock.${index}.updatedPurchasePricePerStrip`, undefined); 
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
                // A simple check for existing generic name. More complex logic might be needed
                // if brand/dosage makes it a "different" drug for inventory purposes.
                 form.setError(`drugsToRestock.${i}.newDrugDetails.name`, {
                    type: "manual",
                    message: `A drug with generic name "${item.newDrugDetails.name}" already exists. If this is a different brand or batch, consider adjusting details or using the existing entry and updating it via 'Manage Drugs'.`,
                });
                toast({
                    variant: "destructive",
                    title: "Validation Error",
                    description: `A drug with generic name "${item.newDrugDetails.name}" already exists.`,
                });
                return;
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
            newDrugDetails: getDefaultNewDrugDetails(),
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
  
  return (
    <Card className="w-full max-w-4xl mx-auto shadow-xl"> {/* Increased max-width */}
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
                            remove(index);
                            // Simplified state update for fieldStates, direct removal might be fine
                            // or requires more careful handling if indices are critical elsewhere
                            const newFieldStates = {...fieldStates};
                            delete newFieldStates[index];
                            // Re-index if necessary, though for this usage, it might not be
                            setFieldStates(newFieldStates);
                        }}
                    >
                        <Trash2 className="h-4 w-4" />
                        <span className="sr-only">Remove Drug</span>
                    </Button>
                )}
                {/* Row 1: Generic Name, Strips Added, Cost/Strip */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
                  <FormField
                    control={form.control}
                    name={`drugsToRestock.${index}.drugId`}
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Generic Name</FormLabel>
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
                                {drug.name} {drug.dosage ? `(${drug.dosage})` : ''} (Stock: {drug.stock})
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

                {/* Conditional section for new drug details */}
                {fieldStates[index]?.isNewDrug && form.getValues(`drugsToRestock.${index}.newDrugDetails`) && (
                  <div className="mt-4 p-3 border border-primary/50 rounded-md bg-primary/5 space-y-3">
                     <p className="text-sm text-primary font-medium">New Drug Details (Required for new entries):</p>
                    {/* Row 2 (New Drug): Generic Name (already handled by select), Brand Name, Dosage */}
                     <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <FormField
                        control={form.control}
                        name={`drugsToRestock.${index}.newDrugDetails.name`}
                        render={({ field }) => (
                            <FormItem>
                            <FormLabel>Generic Name</FormLabel>
                            <FormControl>
                                <Input placeholder="e.g., Paracetamol" {...field} />
                            </FormControl>
                            <FormMessage />
                            </FormItem>
                        )}
                        />
                        <FormField
                        control={form.control}
                        name={`drugsToRestock.${index}.newDrugDetails.brandName`}
                        render={({ field }) => (
                            <FormItem>
                            <FormLabel>Brand Name (Optional)</FormLabel>
                            <FormControl>
                                <Input placeholder="e.g., Calpol" {...field} />
                            </FormControl>
                            <FormMessage />
                            </FormItem>
                        )}
                        />
                        <FormField
                        control={form.control}
                        name={`drugsToRestock.${index}.newDrugDetails.dosage`}
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
                    </div>
                    {/* Row 3 (New Drug): Batch No, Mfg Date, Exp Date */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                         <FormField
                        control={form.control}
                        name={`drugsToRestock.${index}.newDrugDetails.batchNumber`}
                        render={({ field }) => (
                            <FormItem>
                            <FormLabel>Batch Number (Optional)</FormLabel>
                            <FormControl>
                                <Input placeholder="e.g., B12345" {...field} />
                            </FormControl>
                            <FormMessage />
                            </FormItem>
                        )}
                        />
                        <FormField
                        control={form.control}
                        name={`drugsToRestock.${index}.newDrugDetails.dateOfManufacture`}
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
                        name={`drugsToRestock.${index}.newDrugDetails.dateOfExpiry`}
                        render={({ field }) => (
                            <FormItem>
                            <FormLabel>Expiry Date (Optional)</FormLabel>
                            <FormControl>
                                <Input type="date" {...field} />
                            </FormControl>
                            <FormMessage />
                            </FormItem>
                        )}
                        />
                    </div>
                     {/* Row 4 (New Drug): Low Stock Threshold (Cost/Strip is above) */}
                     <FormField
                        control={form.control}
                        name={`drugsToRestock.${index}.newDrugDetails.lowStockThreshold`}
                        render={({ field }) => (
                            <FormItem className="md:col-span-1"> {/* Adjust span if needed */}
                            <FormLabel>Low Stock Threshold (Strips)</FormLabel>
                            <FormControl>
                                <Input type="number" placeholder="e.g., 10" {...field} min="0" />
                            </FormControl>
                            <FormMessage />
                            </FormItem>
                        )}
                        />
                    <FormDescription className="text-xs col-span-full">Ensure generic name, cost per strip, and threshold are filled for new drugs. Other fields are optional but recommended.</FormDescription>
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
                    newDrugDetails: getDefaultNewDrugDetails(),
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
