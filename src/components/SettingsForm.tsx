
"use client";

// This file is no longer needed and can be deleted.
// The global low stock threshold functionality has been moved to a per-drug basis.
// All logic related to managing a global threshold has been removed or refactored.

// Keeping the file with this comment to ensure the build system recognizes the deletion.
// If this file were completely removed, the agent might not register its deletion properly.

// import React from 'react'; 
// import { useForm } from 'react-hook-form';
// import { zodResolver } from '@hookform/resolvers/zod';
// import * as z from 'zod';
// import { Button } from '@/components/ui/button';
// import {
//   Form,
//   FormControl,
//   FormField,
//   FormItem,
//   FormLabel,
//   FormMessage,
// } from '@/components/ui/form';
// import { Input } from '@/components/ui/input';
// import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
// import { useInventory } from '@/contexts/InventoryContext';
// // import type { SettingsFormData } from '@/types'; // SettingsFormData is removed
// import { useToast } from '@/hooks/use-toast';
// import { CheckCircle, Settings as SettingsIcon } from 'lucide-react';

// const settingsFormSchema = z.object({
//   lowStockThreshold: z.coerce.number().int().min(0, { message: "Threshold must be zero or a positive number." }),
// });

// // Define SettingsFormData locally if types file is already updated
// interface SettingsFormData {
//    lowStockThreshold: number;
// }


// export default function SettingsForm() {
//   // const { lowStockThreshold, updateLowStockThreshold } = useInventory(); // This context logic is removed
//   const { toast } = useToast();
//   const lowStockThreshold = 10; // Placeholder, as this component is deprecated
//   const updateLowStockThreshold = (value: number) => {
//     console.log("Global threshold update (deprecated):", value);
//   };


//   const form = useForm<SettingsFormData>({
//     resolver: zodResolver(settingsFormSchema),
//     defaultValues: {
//       lowStockThreshold: lowStockThreshold,
//     },
//   });
  
//   React.useEffect(() => {
//     form.reset({ lowStockThreshold });
//   }, [lowStockThreshold, form]);


//   function onSubmit(data: SettingsFormData) {
//     updateLowStockThreshold(data.lowStockThreshold);
//     toast({
//       title: "Settings Updated (Deprecated)",
//       description: `Global low stock threshold was set to ${data.lowStockThreshold} strips. This feature is now per-drug.`,
//       action: <CheckCircle className="text-green-500" />,
//     });
//   }

//   return (
//     <Card className="w-full max-w-lg mx-auto shadow-xl opacity-50 cursor-not-allowed" title="This settings form is deprecated. Thresholds are now managed per drug.">
//       <CardHeader>
//         <CardTitle className="font-headline flex items-center gap-2 text-2xl">
//           <SettingsIcon className="h-6 w-6 text-primary" />
//           Application Settings (Deprecated)
//         </CardTitle>
//         <CardDescription>Global settings are no longer configured here. Low stock thresholds are managed individually for each drug.</CardDescription>
//       </CardHeader>
//       <CardContent>
//         <Form {...form}>
//           <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
//             <FormField
//               control={form.control}
//               name="lowStockThreshold"
//               render={({ field }) => (
//                 <FormItem>
//                   <FormLabel>Global Low Stock Threshold (Strips) - Deprecated</FormLabel>
//                   <FormControl>
//                     <Input type="number" placeholder="Enter threshold value" {...field} min="0" disabled />
//                   </FormControl>
//                   <FormMessage />
//                 </FormItem>
//               )}
//             />
//             <Button type="submit" className="w-full text-lg py-6 shadow-md hover:shadow-lg transition-shadow" disabled>
//               Save Settings (Disabled)
//             </Button>
//           </form>
//         </Form>
//       </CardContent>
//     </Card>
//   );
// }
// Content indicating deprecation
"// This component is deprecated and will be removed. Low stock thresholds are now managed per drug."
export default function SettingsForm() { return null; }
