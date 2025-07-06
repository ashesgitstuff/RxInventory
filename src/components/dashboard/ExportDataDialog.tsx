
"use client";

import React, { useState } from 'react';
import * as XLSX from 'xlsx';
import { format, parseISO, isValid, startOfDay, endOfDay } from 'date-fns';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Calendar } from '@/components/ui/calendar';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Calendar as CalendarIcon, Download } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Drug, Transaction, TransactionDrugDetail } from '@/types';
import { useToast } from '@/hooks/use-toast';

interface ExportDataDialogProps {
  isOpen: boolean;
  onClose: () => void;
  allDrugs: Drug[];
  allTransactions: Transaction[];
}

const formatDateForDisplay = (date?: Date) => {
  return date ? format(date, 'PPP') : 'Pick a date';
};

const formatDateForExcel = (dateString?: string) => {
  if (!dateString) return '';
  try {
    const parsedDate = parseISO(dateString);
    return isValid(parsedDate) ? format(parsedDate, 'yyyy-MM-dd HH:mm:ss') : dateString;
  } catch (error) {
    return dateString;
  }
};

const formatDateOnlyForExcel = (dateString?: string) => {
    if (!dateString) return '';
    try {
      const parsedDate = parseISO(dateString);
      return isValid(parsedDate) ? format(parsedDate, 'yyyy-MM-dd') : dateString;
    } catch (error) {
      return dateString;
    }
  };


export default function ExportDataDialog({
  isOpen,
  onClose,
  allDrugs,
  allTransactions,
}: ExportDataDialogProps) {
  const [startDate, setStartDate] = useState<Date | undefined>();
  const [endDate, setEndDate] = useState<Date | undefined>();
  const { toast } = useToast();

  const handleExport = () => {
    if (!startDate || !endDate) {
      toast({
        variant: "destructive",
        title: "Date Range Required",
        description: "Please select both a start and end date for the transaction log.",
      });
      return;
    }

    if (endDate < startDate) {
        toast({
            variant: "destructive",
            title: "Invalid Date Range",
            description: "End date cannot be before start date.",
          });
          return;
    }

    toast({
      title: "Exporting Data...",
      description: "Preparing your XLSX file.",
    });

    try {
      // 1. Filter Transactions
      const sDate = startOfDay(startDate);
      const eDate = endOfDay(endDate);

      const filteredTransactions = allTransactions.filter(txn => {
        const txnDate = parseISO(txn.timestamp);
        return isValid(txnDate) && txnDate >= sDate && txnDate <= eDate;
      });

      // 2. Prepare Transaction Data for Sheet
      const transactionSheetData = filteredTransactions.map(txn => {
        let drugsInvolved = txn.drugs.map(d => 
          `${d.drugName}${d.brandName ? ` [${d.brandName}]` : ''}${d.dosage ? ` (${d.dosage})` : ''}${d.batchNumber ? ` (Batch: ${d.batchNumber})` : ''}: ${d.quantity > 0 ? '+' : ''}${d.quantity} strips (Prev: ${d.previousStock}, New: ${d.newStock})`
        ).join('; ');

        let updateDetailsSummary = '';
        if (txn.type === 'update' && txn.updateDetails) {
            const ud = txn.updateDetails;
            const changes = [];
            if (ud.newName && ud.previousName !== undefined) changes.push(`Generic Name: "${ud.previousName}" -> "${ud.newName}"`);
            if (ud.newBrandName !== undefined && ud.previousBrandName !== undefined) changes.push(`Brand Name: "${ud.previousBrandName || 'N/A'}" -> "${ud.newBrandName || 'N/A'}"`);
            if (ud.newDosage !== undefined && ud.previousDosage !== undefined) changes.push(`Dosage: "${ud.previousDosage || 'N/A'}" -> "${ud.newDosage || 'N/A'}"`);
            if (ud.newBatchNumber !== undefined && ud.previousBatchNumber !== undefined) changes.push(`Batch No: "${ud.previousBatchNumber || 'N/A'}" -> "${ud.newBatchNumber || 'N/A'}"`);
            if (ud.newDateOfManufacture !== undefined && ud.previousDateOfManufacture !== undefined) changes.push(`Mfg. Date: ${formatDateOnlyForExcel(ud.previousDateOfManufacture)} -> ${formatDateOnlyForExcel(ud.newDateOfManufacture)}`);
            if (ud.newDateOfExpiry !== undefined && ud.previousDateOfExpiry !== undefined) changes.push(`Exp. Date: ${formatDateOnlyForExcel(ud.previousDateOfExpiry)} -> ${formatDateOnlyForExcel(ud.newDateOfExpiry)}`);
            if (ud.newPrice !== undefined && ud.previousPrice !== undefined) changes.push(`Price: ${ud.previousPrice.toFixed(2)} -> ${ud.newPrice.toFixed(2)}`);
            if (ud.newThreshold !== undefined && ud.previousThreshold !== undefined) changes.push(`Threshold: ${ud.previousThreshold} -> ${ud.newThreshold}`);
            if (ud.newSource !== undefined && ud.previousSource !== undefined) changes.push(`Source: "${ud.previousSource || 'N/A'}" -> "${ud.newSource || 'N/A'}"`);
            updateDetailsSummary = changes.join('; ');
            if (txn.notes && !txn.notes.startsWith('Details updated for batch:') && !txn.notes.startsWith('Purchase price updated for')) {
                 updateDetailsSummary = updateDetailsSummary ? `${updateDetailsSummary}; Notes: ${txn.notes}` : `Notes: ${txn.notes}`;
            } else if (txn.notes) {
                updateDetailsSummary = txn.notes; // if specific note is about update itself
            }
        } else if (txn.notes) {
            updateDetailsSummary = txn.notes;
        }


        return {
          'Timestamp': formatDateForExcel(txn.timestamp),
          'Type': txn.type,
          'Patient Name': txn.patientName || '',
          'Aadhar (Last 4)': txn.aadharLastFour || '',
          'Age': txn.age || '',
          'Sex': txn.sex || '',
          'Village': txn.villageName || '',
          'Drugs Involved/Stock Change': drugsInvolved,
          'Source (for Restock)': txn.source || '',
          'Notes/Update Details': updateDetailsSummary,
        };
      });

      // 3. Prepare Inventory Data for Sheet
      const inventorySheetData = allDrugs.map(drug => ({
        'Generic Name': drug.name,
        'Brand Name': drug.brandName || '',
        'Dosage': drug.dosage || '',
        'Batch No.': drug.batchNumber || '',
        'Mfg. Date': formatDateOnlyForExcel(drug.dateOfManufacture),
        'Exp. Date': formatDateOnlyForExcel(drug.dateOfExpiry),
        'Current Stock (Strips)': drug.stock,
        'Purchase Price/Strip (INR)': drug.purchasePricePerStrip,
        'Low Stock Threshold': drug.lowStockThreshold,
        'Initial Source': drug.initialSource || '',
      }));

      // 4. Create Workbook and Sheets
      const wb = XLSX.utils.book_new();
      const wsTransactions = XLSX.utils.json_to_sheet(transactionSheetData);
      const wsInventory = XLSX.utils.json_to_sheet(inventorySheetData);

      XLSX.utils.book_append_sheet(wb, wsTransactions, 'Transaction Log');
      XLSX.utils.book_append_sheet(wb, wsInventory, 'Current Inventory');

      // 5. Trigger Download
      const exportFileName = `FORRADS_MMU_Export_${format(new Date(), 'yyyyMMdd_HHmmss')}.xlsx`;
      XLSX.writeFile(wb, exportFileName);

      toast({
        title: "Export Successful",
        description: `Data exported to ${exportFileName}`,
      });
      onClose();
      setStartDate(undefined);
      setEndDate(undefined);

    } catch (error) {
      console.error("Export failed:", error);
      toast({
        variant: "destructive",
        title: "Export Failed",
        description: "An error occurred while generating the XLSX file. Check console for details.",
      });
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open) { onClose(); setStartDate(undefined); setEndDate(undefined); } }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Export Data to XLSX</DialogTitle>
          <DialogDescription>
            Select a date range for the transaction log. The current inventory will also be exported.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid grid-cols-1 items-center gap-4">
            <Label htmlFor="startDate" className="text-left">
              Start Date
            </Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  id="startDate"
                  variant="outline"
                  className={cn(
                    'w-full justify-start text-left font-normal',
                    !startDate && 'text-muted-foreground'
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {formatDateForDisplay(startDate)}
                </Button>
              </PopoverTrigger>
              <PopoverContent 
                className="w-auto p-0" 
                align="start"
              >
                <Calendar
                  mode="single"
                  selected={startDate}
                  onSelect={setStartDate}
                />
              </PopoverContent>
            </Popover>
          </div>
          <div className="grid grid-cols-1 items-center gap-4">
            <Label htmlFor="endDate" className="text-left">
              End Date
            </Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  id="endDate"
                  variant="outline"
                  className={cn(
                    'w-full justify-start text-left font-normal',
                    !endDate && 'text-muted-foreground'
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {formatDateForDisplay(endDate)}
                </Button>
              </PopoverTrigger>
              <PopoverContent 
                className="w-auto p-0" 
                align="start"
              >
                <Calendar
                  mode="single"
                  selected={endDate}
                  onSelect={setEndDate}
                  disabled={(date) => !!(startDate && date < startOfDay(startDate))}
                />
              </PopoverContent>
            </Popover>
          </div>
        </div>
        <DialogFooter>
          <DialogClose asChild>
            <Button type="button" variant="outline">
              Cancel
            </Button>
          </DialogClose>
          <Button type="button" onClick={handleExport} disabled={!startDate || !endDate}>
            <Download className="mr-2 h-4 w-4" />
            Export to XLSX
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
