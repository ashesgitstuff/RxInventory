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
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { useInventory } from '@/contexts/InventoryContext';
import type { SettingsFormData } from '@/types';
import { useToast } from '@/hooks/use-toast';
import { CheckCircle, Settings as SettingsIcon } from 'lucide-react';

const settingsFormSchema = z.object({
  lowStockThreshold: z.coerce.number().int().min(0, { message: "Threshold must be zero or a positive number." }),
});

export default function SettingsForm() {
  const { lowStockThreshold, updateLowStockThreshold } = useInventory();
  const { toast } = useToast();

  const form = useForm<SettingsFormData>({
    resolver: zodResolver(settingsFormSchema),
    defaultValues: {
      lowStockThreshold: lowStockThreshold,
    },
  });
  
  // Sync form default value if context value changes after mount
  React.useEffect(() => {
    form.reset({ lowStockThreshold });
  }, [lowStockThreshold, form]);


  function onSubmit(data: SettingsFormData) {
    updateLowStockThreshold(data.lowStockThreshold);
    toast({
      title: "Settings Updated",
      description: `Low stock threshold set to ${data.lowStockThreshold} strips.`,
      action: <CheckCircle className="text-green-500" />,
    });
  }

  return (
    <Card className="w-full max-w-lg mx-auto shadow-xl">
      <CardHeader>
        <CardTitle className="font-headline flex items-center gap-2 text-2xl">
          <SettingsIcon className="h-6 w-6 text-primary" />
          Application Settings
        </CardTitle>
        <CardDescription>Configure global settings for the inventory system.</CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <FormField
              control={form.control}
              name="lowStockThreshold"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Low Stock Threshold (Strips)</FormLabel>
                  <FormControl>
                    <Input type="number" placeholder="Enter threshold value" {...field} min="0" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <Button type="submit" className="w-full text-lg py-6 shadow-md hover:shadow-lg transition-shadow">
              Save Settings
            </Button>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
