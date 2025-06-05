
"use client";

import type { Drug } from '@/types';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { AlertTriangle, Pill, CalendarClock } from 'lucide-react'; // Added CalendarClock
import { cn } from '@/lib/utils';
import { format, parseISO, differenceInDays } from 'date-fns';

interface DrugStockCardProps {
  drug: Drug;
}

// Helper to format date strings for display, e.g., Aug 2023
const formatExpirySafe = (dateString?: string) => {
  if (!dateString) return null;
  try {
    return format(parseISO(dateString), 'MMM yyyy');
  } catch (error) {
    return dateString; // Return original if parsing fails
  }
};

export default function DrugStockCard({ drug }: DrugStockCardProps) {
  const isLowStock = drug.stock < drug.lowStockThreshold;
  const progressBarMax = drug.lowStockThreshold > 0 ? drug.lowStockThreshold * 2 : Math.max(20, drug.stock); 
  const stockPercentage = progressBarMax > 0 ? Math.min((drug.stock / progressBarMax) * 100, 100) : (drug.stock > 0 ? 100 : 0) ;

  const formattedExpiry = formatExpirySafe(drug.dateOfExpiry);
  let expiryWarning: string | null = null;
  if (drug.dateOfExpiry) {
    try {
      const expiryDate = parseISO(drug.dateOfExpiry);
      const today = new Date();
      const daysToExpiry = differenceInDays(expiryDate, today);

      if (daysToExpiry < 0) {
        expiryWarning = "Expired";
      } else if (daysToExpiry <= 30) {
        expiryWarning = `Expires in ${daysToExpiry}d`;
      } else if (daysToExpiry <= 90) {
        expiryWarning = `Expires soon`;
      }
    } catch (e) { /* Do nothing if date is invalid */ }
  }


  return (
    <Card className={cn(
        "transition-all duration-300 shadow-lg hover:shadow-xl", 
        isLowStock ? 'border-destructive bg-destructive/10' : 'border-border',
        expiryWarning === "Expired" ? 'border-red-700 bg-red-700/10' : 
        expiryWarning && expiryWarning.includes('Expires in') ? 'border-orange-500 bg-orange-500/10' : ''
      )}>
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between">
            <CardTitle className="text-lg font-medium font-headline flex items-center gap-2">
            <Pill className={cn("h-5 w-5 shrink-0", isLowStock ? "text-destructive" : "text-primary")} />
            <div>
                <div>{drug.name} {drug.dosage ? `(${drug.dosage})` : ''}</div>
                {drug.brandName && <div className="text-xs text-muted-foreground font-normal">{drug.brandName}</div>}
            </div>
            </CardTitle>
            {isLowStock && <AlertTriangle className="h-5 w-5 text-destructive shrink-0" />}
        </div>
        {drug.batchNumber && <CardDescription className="text-xs pt-1">Batch: {drug.batchNumber}</CardDescription>}
      </CardHeader>
      <CardContent>
        <div className="text-3xl font-bold text-foreground">{drug.stock} strips</div>
        <p className="text-xs text-muted-foreground">
          {isLowStock ? `Stock is low (Threshold: ${drug.lowStockThreshold})` : `Threshold: ${drug.lowStockThreshold} strips`}
        </p>
        <Progress 
          value={stockPercentage} 
          className="mt-4 h-2" 
          indicatorClassName={cn(
            isLowStock ? 'bg-destructive' : 
            expiryWarning === "Expired" ? 'bg-red-700' : 
            expiryWarning && expiryWarning.includes('Expires in') ? 'bg-orange-500' : 
            'bg-primary'
          )}
        />
        {formattedExpiry && (
          <div className={cn(
            "mt-2 text-xs flex items-center gap-1",
            expiryWarning === "Expired" ? "text-red-700 font-semibold" : 
            expiryWarning && expiryWarning.includes('Expires in') ? "text-orange-600 font-semibold" : 
            "text-muted-foreground"
          )}>
            <CalendarClock className="h-3.5 w-3.5 shrink-0" />
            Exp: {formattedExpiry} {expiryWarning && expiryWarning !== "Expires soon" && `(${expiryWarning})`}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
