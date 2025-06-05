"use client";

import type { Drug } from '@/types';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { AlertTriangle, Pill } from 'lucide-react';
import { cn } from '@/lib/utils';

interface DrugStockCardProps {
  drug: Drug;
  lowStockThreshold: number;
}

export default function DrugStockCard({ drug, lowStockThreshold }: DrugStockCardProps) {
  const isLowStock = drug.stock < lowStockThreshold;
  const stockPercentage = Math.min((drug.stock / (lowStockThreshold * 2)) * 100, 100); // Cap at 100 for visual, e.g. threshold is 10, max bar at 20.

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
          {isLowStock ? `Stock is low (Threshold: ${lowStockThreshold})` : `Threshold: ${lowStockThreshold} strips`}
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
