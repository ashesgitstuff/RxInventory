
"use client";

import type { Drug } from '@/types';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { AlertTriangle, Pill, CalendarClock, Info } from 'lucide-react';
import { cn } from '@/lib/utils';
import { format, parseISO, differenceInDays } from 'date-fns';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Button } from '@/components/ui/button'; // Added this import
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';

interface GroupedDrugForCard {
  groupKey: string;
  displayName: string; 
  genericName: string;
  brandName?: string;
  dosage?: string;
  totalStock: number;
  lowStockThreshold: number; 
  batches: Drug[];
}

interface DrugStockCardProps {
  drugGroup: GroupedDrugForCard;
}

const formatDateSafe = (dateString?: string, dateFormat: string = 'MMM yyyy') => {
  if (!dateString) return 'N/A';
  try {
    return format(parseISO(dateString), dateFormat);
  } catch (error) {
    return dateString; 
  }
};

export default function DrugStockCard({ drugGroup }: DrugStockCardProps) {
  const { displayName, totalStock, lowStockThreshold, batches } = drugGroup;
  const isLowStock = totalStock < lowStockThreshold;
  
  const progressBarMax = lowStockThreshold > 0 ? lowStockThreshold * 2 : Math.max(20, totalStock); 
  const stockPercentage = progressBarMax > 0 ? Math.min((totalStock / progressBarMax) * 100, 100) : (totalStock > 0 ? 100 : 0);

  let earliestExpiryWarning: string | null = null;
  let overallExpiryStatus: 'ok' | 'soon' | 'expired' = 'ok';
  let earliestBatch: Drug | null = null; 

  if (batches.length > 0) {
    const sortedBatchesByExpiry = [...batches].sort((a, b) => {
      const dateA = a.dateOfExpiry ? new Date(a.dateOfExpiry).getTime() : Infinity;
      const dateB = b.dateOfExpiry ? new Date(b.dateOfExpiry).getTime() : Infinity;
      return dateA - dateB;
    });
    
    earliestBatch = sortedBatchesByExpiry[0];
    if (earliestBatch && earliestBatch.dateOfExpiry) {
      try {
        const expiryDate = parseISO(earliestBatch.dateOfExpiry);
        const today = new Date();
        const daysToExpiry = differenceInDays(expiryDate, today);

        if (daysToExpiry < 0) {
          earliestExpiryWarning = "Expired";
          overallExpiryStatus = 'expired';
        } else if (daysToExpiry <= 30) {
          earliestExpiryWarning = `Expires in ${daysToExpiry}d`;
          overallExpiryStatus = 'soon';
        } else if (daysToExpiry <= 90) {
          earliestExpiryWarning = `Expires soon`;
          overallExpiryStatus = 'soon';
        }
      } catch (e) { /* Do nothing */ }
    }
  }

  const earliestExpiryDisplayDate = earliestBatch?.dateOfExpiry;

  return (
    <Card className={cn(
        "transition-all duration-300 shadow-lg hover:shadow-xl relative", 
        isLowStock ? 'border-destructive bg-destructive/10' : 'border-border',
        overallExpiryStatus === 'expired' ? 'border-red-700 bg-red-700/10' : 
        overallExpiryStatus === 'soon' ? 'border-orange-500 bg-orange-500/10' : ''
      )}>
      <CardHeader className="pb-2 pr-10"> 
        <div className="flex items-start justify-between">
            <CardTitle className="text-lg font-medium font-headline flex items-center gap-2">
            <Pill className={cn("h-5 w-5 shrink-0", isLowStock ? "text-destructive" : "text-primary")} />
            <div>
                <div>{displayName}</div>
            </div>
            </CardTitle>
            {isLowStock && <AlertTriangle className="h-5 w-5 text-destructive shrink-0" />}
        </div>
        <CardDescription className="text-xs pt-1">
          {batches.length} batch(es) available.
          {batches.length > 0 && earliestBatch && earliestBatch.batchNumber && ` Earliest Batch: ${earliestBatch.batchNumber}`}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="text-3xl font-bold text-foreground">{totalStock} tablets</div>
        <p className="text-xs text-muted-foreground">
          {isLowStock ? `Stock is low (Threshold: ${lowStockThreshold})` : `Threshold: ${lowStockThreshold} tablets`}
        </p>
        <Progress 
          value={stockPercentage} 
          className="mt-4 h-2" 
          indicatorClassName={cn(
            isLowStock ? 'bg-destructive' : 
            overallExpiryStatus === 'expired' ? 'bg-red-700' : 
            overallExpiryStatus === 'soon' ? 'bg-orange-500' : 
            'bg-primary'
          )}
        />
        {earliestExpiryWarning && (
          <div className={cn(
            "mt-2 text-xs flex items-center gap-1",
            overallExpiryStatus === "expired" ? "text-red-700 font-semibold" : 
            overallExpiryStatus === "soon" ? "text-orange-600 font-semibold" : 
            "text-muted-foreground"
          )}>
            <CalendarClock className="h-3.5 w-3.5 shrink-0" />
            Earliest Expiry: {formatDateSafe(earliestBatch?.dateOfExpiry)} {earliestExpiryWarning && earliestExpiryWarning !== "Expires soon" && `(${earliestExpiryWarning})`}
          </div>
        )}
      </CardContent>

      <Popover>
        <PopoverTrigger asChild>
          <Button variant="ghost" size="icon" className="absolute top-2 right-2 h-7 w-7 text-muted-foreground hover:text-primary">
            <Info className="h-4 w-4" />
            <span className="sr-only">View Batch Details</span>
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-80 max-h-96" side="left" align="end">
          <ScrollArea className="max-h-80">
            <div className="grid gap-4 p-1">
              <div className="space-y-2">
                <h4 className="font-medium leading-none">{displayName} - Batch Details</h4>
                <p className="text-sm text-muted-foreground">
                  Total stock: {totalStock} tablets across {batches.length} batch(es).
                </p>
              </div>
              {batches.length > 0 ? (
                <ul className="space-y-3">
                  {batches.map(batch => {
                    let batchExpiryStatus: 'ok' | 'soon' | 'expired' = 'ok';
                    let batchDaysToExpiryText = '';
                    if (batch.dateOfExpiry) {
                        try {
                            const expiry = parseISO(batch.dateOfExpiry);
                            const days = differenceInDays(expiry, new Date());
                            if (days < 0) { batchExpiryStatus = 'expired'; batchDaysToExpiryText = '(Expired)'; }
                            else if (days <= 30) { batchExpiryStatus = 'soon'; batchDaysToExpiryText = `(${days}d left)`; }
                            else if (days <= 90) { batchExpiryStatus = 'soon'; batchDaysToExpiryText = '(Expires soon)';}
                        } catch(e) { /* ignore parse error for this display */ }
                    }
                    return (
                      <li key={batch.id} className="text-sm border-b pb-2 last:border-b-0 last:pb-0">
                        <div className="font-semibold">Batch: {batch.batchNumber || 'N/A'}</div>
                        {batch.brandName && <div>Brand: {batch.brandName}</div>}
                        <div>Stock: <Badge variant={batch.stock < batch.lowStockThreshold ? "destructive" : "secondary"}>{batch.stock}</Badge> tablets</div>
                        <div className={cn(
                            batchExpiryStatus === 'expired' ? 'text-red-600' : batchExpiryStatus === 'soon' ? 'text-orange-600' : ''
                        )}>
                            Exp: {formatDateSafe(batch.dateOfExpiry, 'PP')} {batchDaysToExpiryText}
                        </div>
                        <div>Mfg: {formatDateSafe(batch.dateOfManufacture, 'PP')}</div>
                        <div>Price/Tablet: INR {batch.purchasePricePerTablet.toFixed(2)}</div>
                      </li>
                    );
                  })}
                </ul>
              ) : (
                <p className="text-sm text-muted-foreground">No specific batch information available.</p>
              )}
            </div>
          </ScrollArea>
        </PopoverContent>
      </Popover>
    </Card>
  );
}
