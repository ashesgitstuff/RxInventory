
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
  FormDescription,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { useInventory } from '@/contexts/InventoryContext';
import type { DispenseFormData, DrugDispenseEntry } from '@/types';
import { useToast } from '@/hooks/use-toast';
import { CheckCircle, MinusCircle, PlusCircle, Trash2 } from 'lucide-react';
import { Separator } from '@/components/ui/separator';

const drugDispenseEntrySchema = z.object({
  drugId: z.string().min(1, { message: "Please select a drug." }),
  stripsDispensed: z.coerce.number().int().positive({ message: "Strips must be a positive number." }),
});

const dispenseFormSchema = z.object({
  patientName: z.string().min(2, { message: "Patient name must be at least 2 characters." }),
  aadharLastFour: z.string().length(4, {message: "Aadhar must be 4 digits."}).regex(/^\d{4}$/, "Must be 4 digits."),
  age: z.coerce.number().int().positive({ message: "Age must be a positive number." }),
  sex: z.enum(['Male', 'Female', 'Other', ''], { errorMap: () => ({ message: "Please select a valid sex."}) }).refine(val => val !== '', { message: "Please select a sex."}),
  drugsToDispense: z.array(drugDispenseEntrySchema).min(1, { message: "At least one drug must be added to dispense." }),
});

export default function DispenseForm() {
  const { drugs, dispenseDrugs, getDrugById } = useInventory();
  const { toast } = useToast();

  const form = useForm<DispenseFormData>({
    resolver: zodResolver(dispenseFormSchema),
    defaultValues: {
      patientName: '',
      aadharLastFour: '',
      age: '' as unknown as number,
      sex: '',
      drugsToDispense: [{ drugId: '', stripsDispensed: 1 }],
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
    };
    const result = await dispenseDrugs(patientDetails, data.drugsToDispense);

    if (result.success) {
      const drugSummary = result.dispensedDrugs.map(d => `${d.quantity}x ${d.drugName}`).join(', ');
      toast({
        title: "Dispense Successful",
        description: `${drugSummary} dispensed to ${data.patientName}. Inventory updated locally. ${result.message || ''}`,
        action: <CheckCircle className="text-green-500" />,
      });
      form.reset({
        patientName: '',
        aadharLastFour: '',
        age: '' as unknown as number,
        sex: '',
        drugsToDispense: [{ drugId: '', stripsDispensed: 1 }],
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
        <CardDescription>Enter patient and drug details to dispense medication.</CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="patientName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Patient Name</FormLabel>
                    <FormControl>
                      <Input placeholder="Enter patient's full name" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="aadharLastFour"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Aadhar (Last 4 Digits)</FormLabel>
                    <FormControl>
                      <Input type="text" placeholder="1234" {...field} maxLength={4} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="age"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Age</FormLabel>
                    <FormControl>
                      <Input type="number" placeholder="Enter age" {...field} min="0" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="sex"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Sex</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select sex" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="Male">Male</SelectItem>
                        <SelectItem value="Female">Female</SelectItem>
                        <SelectItem value="Other">Other</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            
            <Separator />
            <h3 className="text-lg font-medium text-foreground">Drugs to Dispense</h3>
            {fields.map((item, index) => (
              <div key={item.id} className="space-y-4 p-4 border rounded-md shadow-sm relative">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name={`drugsToDispense.${index}.drugId`}
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Drug</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select a drug" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {drugs.map((drug) => (
                              <SelectItem key={drug.id} value={drug.id} disabled={drug.stock === 0}>
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
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="absolute top-2 right-2 text-destructive hover:bg-destructive/10"
                    onClick={() => remove(index)}
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
              onClick={() => append({ drugId: '', stripsDispensed: 1 })}
              className="w-full flex items-center gap-2"
            >
              <PlusCircle className="h-4 w-4" /> Add Another Drug
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
