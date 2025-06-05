
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
import { DEFAULT_PURCHASE_PRICE, DEFAULT_DRUG_LOW_STOCK_THRESHOLD } from '@/types';
import { useToast } from '@/hooks/use-toast';
import { CheckCircle, PackagePlus, PlusCircle, Trash2 } from 'lucide-react';
import { Separator } from '@/components/ui/separator';
import { format, parseISO } from 'date-fns';

// Schema for adding a new batch/drug
const newDrugDetailsSchema = z.object({
  name: z.string().min(2, { message: "Generic name must be at least 2 characters." }),
  brandName: z.string().optional(),
  dosage: z.string().optional(),
  batchNumber: z.string().min(1, { message: "Batch number is required." }),
  dateOfManufacture: z.string().optional().refine(val => !val || !isNaN(Date.parse(val)), { message: "Invalid manufacture date" }),
  dateOfExpiry: z.string().min(1, {message: "Expiry date is required."}).refine(val => !val || !isNaN(Date.parse(val)), { message: "Invalid expiry date" }),
  purchasePricePerStrip: z.coerce.number().min(0, { message: "Price must be non-negative." }),
  lowStockThreshold: z.coerce.number().int().min(0, { message: "Threshold must be zero or positive." }),
}).refine(data => {
    if (data.dateOfManufacture && data.dateOfExpiry) {
        try {
            const mfg = parseISO(data.dateOfManufacture);
            const exp = parseISO(data.dateOfExpiry);
            return mfg < exp;
        } catch (e) { return true; } 
    }
    return true;
}, { message: "Expiry date must be after manufacture date.", path: ["dateOfExpiry"] });


const drugRestockEntrySchema = z.object({
  drugId: z.string().min(1, { message: "Please select an existing batch or 'Add New Batch'." }), 
  stripsAdded: z.coerce.number().int().positive({ message: "Strips must be a positive number." }),
  newDrugDetails: newDrugDetailsSchema.optional(), 
  updatedPurchasePricePerStrip: z.coerce.number().min(0, { message: "Price must be non-negative." }).optional(), 
}).refine(data => { 
    if (data.drugId === '--add-new--') {
        return !!data.newDrugDetails &&
               data.newDrugDetails.name.length >=2 &&
               !!data.newDrugDetails.batchNumber &&
               !!data.newDrugDetails.dateOfExpiry &&
               (data.newDrugDetails.purchasePricePerStrip !== undefined && data.newDrugDetails.purchasePricePerStrip >=0) &&
               (data.newDrugDetails.lowStockThreshold !== undefined && data.newDrugDetails.lowStockThreshold >=0);
    }
    return true;
}, {
    message: "New batch details (generic name, batch no., expiry date, valid price, and valid threshold) are required.",
    path: ["newDrugDetails"],
});


const restockFormSchema = z.object({
  source: z.string().min(2, { message: "Source must be at least 2 characters." }),
  drugsToRestock: z.array(drugRestockEntrySchema).min(1, { message: "At least one drug item must be added to restock." }),
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

const formatDateForInput = (dateString?: string) => {
  if (!dateString) return '';
  try {
    return format(parseISO(dateString), 'yyyy-MM-dd');
  } catch (error) {
    return '';
  }
};

export default function RestockForm() {
  const { drugs, restockDrugs, getDrugById } = useInventory();
  const { toast } = useToast();
  const [fieldStates, setFieldStates] = useState<Record<number, { isNewBatch: boolean }>>({});
  const [grandTotal, setGrandTotal] = useState(0);

  const form = useForm<RestockFormData>({
    resolver: zodResolver(restockFormSchema),
    defaultValues: {
      source: '',
      drugsToRestock: [{
        drugId: '',
        stripsAdded: 10,
        newDrugDetails: getDefaultNewDrugDetails(),
        updatedPurchasePricePerStrip: undefined
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
    watchedDrugsToRestock.forEach((item) => {
      const strips = Number(item.stripsAdded) || 0;
      let pricePerStrip = 0;
      if (item.drugId === '--add-new--' && item.newDrugDetails) {
        pricePerStrip = Number(item.newDrugDetails.purchasePricePerStrip) || 0;
      } else if (item.drugId !== '--add-new--' && item.drugId !== '') {
        const drugBatch = getDrugById(item.drugId);
        pricePerStrip = item.updatedPurchasePricePerStrip !== undefined
                        ? Number(item.updatedPurchasePricePerStrip)
                        : (drugBatch?.purchasePricePerStrip || 0);
      }
      currentGrandTotal += strips * pricePerStrip;
    });
    setGrandTotal(currentGrandTotal);
  }, [watchedDrugsToRestock, getDrugById]);


  const handleDrugIdChange = (index: number, value: string) => {
    const isNew = value === '--add-new--';
    setFieldStates(prev => ({ ...prev, [index]: { isNewBatch: isNew } }));
    form.setValue(`drugsToRestock.${index}.drugId`, value);

    if (isNew) {
        form.setValue(`drugsToRestock.${index}.newDrugDetails`, getDefaultNewDrugDetails());
        form.setValue(`drugsToRestock.${index}.updatedPurchasePricePerStrip`, undefined);
    } else {
        form.setValue(`drugsToRestock.${index}.newDrugDetails`, undefined);
        const selectedDrugBatch = getDrugById(value);
        form.setValue(`drugsToRestock.${index}.updatedPurchasePricePerStrip`, selectedDrugBatch?.purchasePricePerStrip ?? DEFAULT_PURCHASE_PRICE);
    }
    form.trigger(`drugsToRestock.${index}.newDrugDetails`);
    form.trigger(`drugsToRestock.${index}.updatedPurchasePricePerStrip`);
  };

  const handleGenericNameBlur = (index: number, typedGenericName: string) => {
    if (typedGenericName && fieldStates[index]?.isNewBatch) {
      const matchedDrug = drugs.find(d => d.name.toLowerCase() === typedGenericName.toLowerCase());
      if (matchedDrug) {
        form.setValue(`drugsToRestock.${index}.newDrugDetails.brandName`, matchedDrug.brandName || '');
        form.setValue(`drugsToRestock.${index}.newDrugDetails.dosage`, matchedDrug.dosage || '');
      }
    }
  };


  async function onSubmit(data: RestockFormData) {
    for (let i = 0; i < data.drugsToRestock.length; i++) {
        const item = data.drugsToRestock[i];
        if (item.drugId === '--add-new--' && item.newDrugDetails) {
            const nd = item.newDrugDetails;
            const existingSameBatch = drugs.find(d =>
                d.name.toLowerCase() === nd.name.toLowerCase() &&
                (d.brandName || '').toLowerCase() === (nd.brandName || '').toLowerCase() &&
                (d.dosage || '').toLowerCase() === (nd.dosage || '').toLowerCase() &&
                (d.batchNumber || '').toLowerCase() === (nd.batchNumber || '').toLowerCase()
            );
            if (existingSameBatch) {
                 form.setError(`drugsToRestock.${i}.newDrugDetails.batchNumber`, {
                    type: "manual",
                    message: `This exact batch (Generic, Brand, Dosage, Batch No.) already exists. Please add stock to the existing entry or use a different batch number.`,
                });
                toast({
                    variant: "destructive",
                    title: "Validation Error",
                    description: `Batch for "${nd.name} - ${nd.batchNumber}" already exists.`,
                });
                return;
            }
        }
    }

    const result = await restockDrugs(data.source, data.drugsToRestock);

    if (result.success) {
      const drugSummary = result.restockedDrugs.map(d => `${d.quantity}x ${d.brandName || d.drugName} ${d.dosage || ''} (Batch: ${d.batchNumber})`).join(', ');
      toast({
        title: "Batches Added to Stock",
        description: `${drugSummary} successfully added from ${data.source}. Total cost: INR ${grandTotal.toFixed(2)}.`,
        action: <CheckCircle className="text-green-500" />,
      });
      form.reset({
        source: '',
        drugsToRestock: [{
            drugId: '',
            stripsAdded: 10,
            newDrugDetails: getDefaultNewDrugDetails(),
            updatedPurchasePricePerStrip: undefined
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
      const drugBatch = getDrugById(item.drugId);
      pricePerStrip = item.updatedPurchasePricePerStrip !== undefined
                      ? Number(item.updatedPurchasePricePerStrip)
                      : (drugBatch?.purchasePricePerStrip || 0);
    }
    return strips * pricePerStrip;
  };

  return (
    <Card className="w-full max-w-4xl mx-auto shadow-xl">
      <CardHeader>
        <CardTitle className="font-headline flex items-center gap-2 text-2xl">
          <PackagePlus className="h-6 w-6 text-primary" />
          Restock Inventory
        </CardTitle>
        <CardDescription>Log new stock received. Add to existing batches, add new batches for known drugs, or add entirely new drugs.</CardDescription>
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
            <h3 className="text-lg font-medium text-foreground">Drug Batches to Restock</h3>
            {fields.map((fieldItem, index) => (
              <div key={fieldItem.id} className="space-y-4 p-4 border rounded-md shadow-sm relative">
                 {fields.length > 1 && (
                    <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="absolute top-2 right-2 text-destructive hover:bg-destructive/10 z-10"
                        onClick={() => remove(index)}
                    >
                        <Trash2 className="h-4 w-4" />
                        <span className="sr-only">Remove Drug Batch</span>
                    </Button>
                )}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
                  <FormField
                    control={form.control}
                    name={`drugsToRestock.${index}.drugId`}
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Select Existing Batch / Add New</FormLabel>
                        <Select
                            onValueChange={(value) => {
                                field.onChange(value);
                                handleDrugIdChange(index, value);
                            }}
                            value={field.value} 
                        >
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select batch or add new" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent className="max-h-72">
                            <SelectItem value="--add-new--">
                              <span className="flex items-center"><PlusCircle className="mr-2 h-4 w-4 text-green-500" /> Add New Batch...</span>
                            </SelectItem>
                            {drugs.map((batch) => (
                              <SelectItem key={batch.id} value={batch.id}>
                                {batch.brandName || batch.name} {batch.dosage} (Batch: {batch.batchNumber}) Exp: {formatDateForInput(batch.dateOfExpiry)} (Stock: {batch.stock})
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
                        <FormLabel>Strips Added / Initial Stock</FormLabel>
                        <FormControl>
                          <Input type="number" placeholder="Quantity" {...field} min="1" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormItem>
                    <FormLabel>Cost/Strip (INR)</FormLabel>
                    {fieldStates[index]?.isNewBatch ? (
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

                {fieldStates[index]?.isNewBatch && form.getValues(`drugsToRestock.${index}.newDrugDetails`) && (
                  <div className="mt-4 p-3 border border-primary/50 rounded-md bg-primary/5 space-y-3">
                     <p className="text-sm text-primary font-medium">New Batch Details:</p>
                     <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <FormField control={form.control} name={`drugsToRestock.${index}.newDrugDetails.name`}
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel>Generic Name</FormLabel>
                                <FormControl>
                                    <Input
                                        placeholder="e.g., Paracetamol"
                                        {...field}
                                        value={field.value ?? ''}
                                        onBlur={(e) => {
                                            field.onBlur(e); 
                                            handleGenericNameBlur(index, e.target.value);
                                        }}
                                    />
                                </FormControl>
                                <FormMessage />
                            </FormItem>
                        )} />
                        <FormField control={form.control} name={`drugsToRestock.${index}.newDrugDetails.brandName`}
                        render={({ field }) => (<FormItem><FormLabel>Brand Name (Optional)</FormLabel><FormControl><Input placeholder="e.g., Calpol" {...field} value={field.value ?? ''} /></FormControl><FormMessage /></FormItem>)} />
                        <FormField control={form.control} name={`drugsToRestock.${index}.newDrugDetails.dosage`}
                        render={({ field }) => (<FormItem><FormLabel>Dosage (e.g., 500mg)</FormLabel><FormControl><Input placeholder="e.g., 500mg, 10ml" {...field} value={field.value ?? ''} /></FormControl><FormMessage /></FormItem>)} />
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                         <FormField control={form.control} name={`drugsToRestock.${index}.newDrugDetails.batchNumber`}
                        render={({ field }) => (<FormItem><FormLabel>Batch Number</FormLabel><FormControl><Input placeholder="e.g., B12345" {...field} value={field.value ?? ''} /></FormControl><FormMessage /></FormItem>)} />
                        <FormField control={form.control} name={`drugsToRestock.${index}.newDrugDetails.dateOfManufacture`}
                        render={({ field }) => (<FormItem><FormLabel>Manufacture Date (Optional)</FormLabel><FormControl><Input type="date" {...field} value={field.value ?? ''} /></FormControl><FormMessage /></FormItem>)} />
                        <FormField control={form.control} name={`drugsToRestock.${index}.newDrugDetails.dateOfExpiry`}
                        render={({ field }) => (<FormItem><FormLabel>Expiry Date</FormLabel><FormControl><Input type="date" {...field} value={field.value ?? ''} /></FormControl><FormMessage /></FormItem>)} />
                    </div>
                     <FormField control={form.control} name={`drugsToRestock.${index}.newDrugDetails.lowStockThreshold`}
                        render={({ field }) => (<FormItem className="md:col-span-1"><FormLabel>Low Stock Threshold (Strips)</FormLabel><FormControl><Input type="number" placeholder="e.g., 10" {...field} min="0" /></FormControl><FormMessage /></FormItem>)} />
                    <FormDescription className="text-xs col-span-full">For new batches, ensure Generic Name, Batch No., Expiry, Cost, Threshold, and Strips Added are filled. Brand & Dosage will pre-fill if Generic Name exists.</FormDescription>
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
                append({
                    drugId: '',
                    stripsAdded: 10,
                    newDrugDetails: getDefaultNewDrugDetails(),
                    updatedPurchasePricePerStrip: undefined
                  });
                }}
              className="w-full flex items-center gap-2"
            >
              <PlusCircle className="h-4 w-4" /> Add Another Item
            </Button>

            <Separator />
            <div className="text-right text-xl font-bold text-foreground">
                Grand Total: INR {grandTotal.toFixed(2)}
            </div>
            <Button type="submit" className="w-full text-lg py-6 shadow-md hover:shadow-lg transition-shadow">
              Add All Batches to Stock
            </Button>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
