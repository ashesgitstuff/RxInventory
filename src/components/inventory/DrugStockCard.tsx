
"use client";

import type { Drug } from '@/types';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { AlertTriangle, Pill } from 'lucide-react';
import { cn } from '@/lib/utils';

interface DrugStockCardProps {
  drug: Drug;
  // lowStockThreshold prop is removed as it's now part of the drug object
}

export default function DrugStockCard({ drug }: DrugStockCardProps) {
  const isLowStock = drug.stock < drug.lowStockThreshold;
  // Cap at 100 for visual, e.g. threshold is 10, max bar at 20 (or twice the threshold).
  // If threshold is 0, use stock directly up to a reasonable max like 50 for progress bar visualization.
  const progressBarMax = drug.lowStockThreshold > 0 ? drug.lowStockThreshold * 2 : Math.max(20, drug.stock); // Avoid division by zero
  const stockPercentage = progressBarMax > 0 ? Math.min((drug.stock / progressBarMax) * 100, 100) : (drug.stock > 0 ? 100 : 0) ;


  return (
    <Card className={cn("transition-all duration-300 shadow-lg hover:shadow-xl", isLowStock ? 'border-destructive bg-destructive/10' : 'border-border')}>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-lg font-medium font-headline flex items-center gap-2">
          <Pill className={cn("h-5 w-5", isLowStock ? "text-destructive" : "text-primary")} />
          {drug.name}
        </CardTitle>
        {isLowStock && <AlertTriangle className="h-5 w-5 text-destructive" />}
      </CardHeader>
      <CardContent>
        <div className="text-3xl font-bold text-foreground">{drug.stock} strips</div>
        <p className="text-xs text-muted-foreground">
          {isLowStock ? `Stock is low (Threshold: ${drug.lowStockThreshold})` : `Threshold: ${drug.lowStockThreshold} strips`}
        </p>
        <Progress 
          value={stockPercentage} 
          className="mt-4 h-2" 
          indicatorClassName={cn(isLowStock ? 'bg-destructive' : 'bg-primary')}
        />
      </CardContent>
    </Card>
  );
}
