
"use client";

import React from 'react';
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
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { useInventory } from '@/contexts/InventoryContext';
import type { DispenseFormData, DrugDispenseEntry, GroupedDrugDisplay } from '@/types';
import { useToast } from '@/hooks/use-toast';
import { CheckCircle, MinusCircle, PlusCircle, Trash2 } from 'lucide-react';
import { Separator } from '@/components/ui/separator';
import { format, parseISO } from 'date-fns';

const drugDispenseEntrySchema = z.object({
  selectedDrugGroupKey: z.string().min(1, { message: "Please select a drug type." }),
  stripsDispensed: z.coerce.number().int().positive({ message: "Strips must be a positive number." }),
});

const dispenseFormSchema = z.object({
  patientName: z.string().min(2, { message: "Patient name must be at least 2 characters." }),
  aadharLastFour: z.string().length(4, {message: "Aadhar must be 4 digits."}).regex(/^\d{4}$/, "Must be 4 digits."),
  age: z.coerce.number().int().positive({ message: "Age must be a positive number." }),
  sex: z.enum(['Male', 'Female', 'Other', ''], { errorMap: () => ({ message: "Please select a valid sex."}) }).refine(val => val !== '', { message: "Please select a sex."}),
  villageName: z.string().optional(),
  drugsToDispense: z.array(drugDispenseEntrySchema).min(1, { message: "At least one drug type must be added to dispense." }),
});

const formatDateSafeShort = (dateString?: string) => {
  if (!dateString) return 'N/A';
  try {
    return format(parseISO(dateString), 'MM/yy');
  } catch (error) {
    return dateString;
  }
};

export default function DispenseForm() {
  const { getDrugGroupsForDisplay, dispenseDrugs, villages: villageList } = useInventory();
  const { toast } = useToast();

  const availableDrugGroups = React.useMemo(() => {
    return getDrugGroupsForDisplay().filter(group => group.totalStock > 0);
  }, [getDrugGroupsForDisplay]);

  const form = useForm<DispenseFormData>({
    resolver: zodResolver(dispenseFormSchema),
    defaultValues: {
      patientName: '',
      aadharLastFour: '',
      age: '' as unknown as number, // Keep this for resolver compatibility
      sex: '', // Default to empty, placeholder will show
      villageName: '', // Default to empty, placeholder will show
      drugsToDispense: [{ selectedDrugGroupKey: '', stripsDispensed: 1 }],
    },
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "drugsToDispense",
  });

  async function onSubmit(data: DispenseFormData) {
    const patientDetails = {
        patientName: data.patientName,
        aadharLastFour: data.aadharLastFour,
        age: data.age,
        sex: data.sex,
        villageName: data.villageName,
    };
    // The drugsToDispense from data already contains selectedDrugGroupKey and stripsDispensed
    const result = await dispenseDrugs(patientDetails, data.drugsToDispense);

    if (result.success) {
      const drugSummary = result.dispensedDrugsInfo.map(d => `${d.quantity}x ${d.brandName || d.drugName} ${d.dosage || ''} (from batch: ${d.batchNumber})`).join(', ');
      toast({
        title: "Dispense Successful",
        description: `${drugSummary} dispensed to ${data.patientName}${data.villageName ? ` in ${data.villageName}` : ''}. ${result.message || ''}`,
        action: <CheckCircle className="text-green-500" />,
      });
      form.reset({
        patientName: '',
        aadharLastFour: '',
        age: '' as unknown as number,
        sex: '',
        villageName: '',
        drugsToDispense: [{ selectedDrugGroupKey: '', stripsDispensed: 1 }],
      });
    } else {
      toast({
        variant: "destructive",
        title: "Dispense Failed",
        description: result.message || "An unexpected error occurred.",
      });
    }
  }

  return (
    <Card className="w-full max-w-2xl mx-auto shadow-xl">
      <CardHeader>
        <CardTitle className="font-headline flex items-center gap-2 text-2xl">
          <MinusCircle className="h-6 w-6 text-primary" />
          Dispense Drugs
        </CardTitle>
        <CardDescription>Enter patient and drug details to dispense medication. Drugs will be dispensed from the batch with the closest expiry date automatically.</CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField control={form.control} name="patientName" render={({ field }) => (<FormItem><FormLabel>Patient Name</FormLabel><FormControl><Input placeholder="Enter patient's full name" {...field} /></FormControl><FormMessage /></FormItem>)} />
              <FormField control={form.control} name="aadharLastFour" render={({ field }) => (<FormItem><FormLabel>Aadhar (Last 4 Digits)</FormLabel><FormControl><Input type="text" placeholder="1234" {...field} maxLength={4} /></FormControl><FormMessage /></FormItem>)} />
              <FormField control={form.control} name="age" render={({ field }) => (<FormItem><FormLabel>Age</FormLabel><FormControl><Input type="number" placeholder="Enter age" {...field} min="0" /></FormControl><FormMessage /></FormItem>)} />
              <FormField control={form.control} name="sex" render={({ field }) => (<FormItem><FormLabel>Sex</FormLabel><Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger><SelectValue placeholder="Select sex" /></SelectTrigger></FormControl><SelectContent><SelectItem value="Male">Male</SelectItem><SelectItem value="Female">Female</SelectItem><SelectItem value="Other">Other</SelectItem></SelectContent></Select><FormMessage /></FormItem>)} />
              <FormField
                control={form.control}
                name="villageName"
                render={({ field }) => (
                  <FormItem className="md:col-span-2">
                    <FormLabel>Village / Camp Name (Optional)</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}> {/* Use value for controlled component */}
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select village if applicable" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {villageList.length === 0 ? (
                           <div className="p-2 text-center text-sm text-muted-foreground">
                             No villages added. Add on Camps page.
                           </div>
                        ) : (
                          villageList.map((village) => (
                            <SelectItem key={village.id} value={village.name}>
                              {village.name}
                            </SelectItem>
                          ))
                        )}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            
            <Separator />
            <h3 className="text-lg font-medium text-foreground">Drug Types to Dispense</h3>
            {fields.map((item, index) => (
              <div key={item.id} className="space-y-4 p-4 border rounded-md shadow-sm relative">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name={`drugsToDispense.${index}.selectedDrugGroupKey`}
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Drug Type</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select a drug type" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent className="max-h-72">
                            {availableDrugGroups.length === 0 && 
                              <div className="p-2 text-center text-sm text-muted-foreground">No drugs in stock</div>
                            }
                            {availableDrugGroups.map((group) => (
                              <SelectItem key={group.groupKey} value={group.groupKey}>
                                {group.displayName} (Stock: {group.totalStock})
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
                    name={`drugsToDispense.${index}.stripsDispensed`}
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Number of Strips</FormLabel>
                        <FormControl>
                          <Input type="number" placeholder="Strips" {...field} min="1" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                {fields.length > 1 && (
                  <Button type="button" variant="ghost" size="icon" className="absolute top-2 right-2 text-destructive hover:bg-destructive/10" onClick={() => remove(index)}>
                    <Trash2 className="h-4 w-4" /><span className="sr-only">Remove Drug Batch</span>
                  </Button>
                )}
              </div>
            ))}
            <Button type="button" variant="outline" onClick={() => append({ selectedDrugGroupKey: '', stripsDispensed: 1 })} className="w-full flex items-center gap-2">
              <PlusCircle className="h-4 w-4" /> Add Another Drug Type
            </Button>

            <Separator />
            <Button type="submit" className="w-full text-lg py-6 shadow-md hover:shadow-lg transition-shadow">
              Dispense All Drugs
            </Button>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
    