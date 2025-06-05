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
import type { DispenseFormData } from '@/types';
import { useToast } from '@/hooks/use-toast';
import { CheckCircle, MinusCircle } from 'lucide-react';

const dispenseFormSchema = z.object({
  patientName: z.string().min(2, { message: "Patient name must be at least 2 characters." }),
  drugId: z.string().min(1, { message: "Please select a drug." }),
  stripsDispensed: z.coerce.number().int().positive({ message: "Strips must be a positive number." }),
});

export default function DispenseForm() {
  const { drugs, dispenseDrug, getDrugById } = useInventory();
  const { toast } = useToast();

  const form = useForm<DispenseFormData>({
    resolver: zodResolver(dispenseFormSchema),
    defaultValues: {
      patientName: '',
      drugId: '',
      stripsDispensed: 1,
    },
  });

  function onSubmit(data: DispenseFormData) {
    const drug = getDrugById(data.drugId);
    if (!drug) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Selected drug not found.",
      });
      return;
    }
    if (drug.stock < data.stripsDispensed) {
       toast({
        variant: "destructive",
        title: "Insufficient Stock",
        description: `Not enough ${drug.name} in stock. Available: ${drug.stock} strips.`,
      });
      return;
    }

    dispenseDrug(data.drugId, data.stripsDispensed);
    toast({
      title: "Dispense Successful",
      description: `${data.stripsDispensed} strip(s) of ${drug.name} dispensed to ${data.patientName}.`,
      action: <CheckCircle className="text-green-500" />,
    });
    form.reset();
  }

  return (
    <Card className="w-full max-w-lg mx-auto shadow-xl">
      <CardHeader>
        <CardTitle className="font-headline flex items-center gap-2 text-2xl">
          <MinusCircle className="h-6 w-6 text-primary" />
          Dispense Drug
        </CardTitle>
        <CardDescription>Enter patient and drug details to dispense medication.</CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
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
              name="drugId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Drug</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select a drug to dispense" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
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
              name="stripsDispensed"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Number of Strips</FormLabel>
                  <FormControl>
                    <Input type="number" placeholder="Enter number of strips" {...field} min="1" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <Button type="submit" className="w-full text-lg py-6 shadow-md hover:shadow-lg transition-shadow">
              Dispense
            </Button>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
