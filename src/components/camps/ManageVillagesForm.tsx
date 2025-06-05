
"use client";

import React, { useState } from 'react';
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
import { useToast } from '@/hooks/use-toast';
import { CheckCircle, PlusCircle, Tent, List } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';

const addVillageFormSchema = z.object({
  villageName: z.string().min(2, { message: "Village name must be at least 2 characters." }).max(100, { message: "Village name cannot exceed 100 characters."}),
});

type AddVillageFormData = z.infer<typeof addVillageFormSchema>;

export default function ManageVillagesForm() {
  const { villages, addVillage } = useInventory();
  const { toast } = useToast();

  const form = useForm<AddVillageFormData>({
    resolver: zodResolver(addVillageFormSchema),
    defaultValues: {
      villageName: '',
    },
  });

  async function onSubmit(data: AddVillageFormData) {
    const result = await addVillage(data.villageName);
    if (result.success) {
      toast({
        title: "Village Added",
        description: result.message,
        action: <CheckCircle className="text-green-500" />,
      });
      form.reset();
    } else {
      toast({
        variant: "destructive",
        title: "Failed to Add Village",
        description: result.message,
      });
    }
  }

  return (
    <div className="space-y-8">
      <Card className="w-full max-w-lg mx-auto shadow-xl">
        <CardHeader>
          <CardTitle className="font-headline flex items-center gap-2 text-2xl">
            <Tent className="h-6 w-6 text-primary" />
            Manage Camp Villages
          </CardTitle>
          <CardDescription>Add new village names that you will be visiting for camps.</CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <FormField
                control={form.control}
                name="villageName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>New Village Name</FormLabel>
                    <div className="flex gap-2">
                      <FormControl>
                        <Input placeholder="Enter village name" {...field} />
                      </FormControl>
                      <Button type="submit" className="shrink-0">
                        <PlusCircle className="mr-2 h-4 w-4" /> Add
                      </Button>
                    </div>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </form>
          </Form>
        </CardContent>
      </Card>

      <Card className="w-full max-w-lg mx-auto shadow-xl">
        <CardHeader>
          <CardTitle className="font-headline flex items-center gap-2 text-xl">
             <List className="h-5 w-5 text-primary" />
            Current Village List
          </CardTitle>
          <CardDescription>Villages available for selection during dispensing.</CardDescription>
        </CardHeader>
        <CardContent>
          {villages.length === 0 ? (
            <p className="text-center text-muted-foreground py-6">No villages added yet.</p>
          ) : (
            <ScrollArea className="h-60 w-full rounded-md border p-4">
              <ul className="space-y-2">
                {villages.map((village) => (
                  <li key={village.id} className="text-sm p-2 bg-muted/50 rounded-md">
                    {village.name}
                  </li>
                ))}
              </ul>
            </ScrollArea>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
