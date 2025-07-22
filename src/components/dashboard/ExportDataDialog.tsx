
"use client";

import React, { useState, useEffect } from 'react';
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
import { Input } from '@/components/ui/input';
import { Calendar } from '@/components/ui/calendar';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Calendar as CalendarIcon, Download, FileText } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Drug, Transaction, TransactionDrugDetail } from '@/types';
import { useToast } from '@/hooks/use-toast';
import { useInventory } from '@/contexts/InventoryContext';


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
  const [fileName, setFileName] = useState('');
  const { toast } = useToast();
  const { getDrugById } = useInventory();

  useEffect(() => {
    if (isOpen) {
        const defaultFileName = `FORRADS_MMU_Export_${format(new Date(), 'yyyyMMdd_HHmmss')}`;
        setFileName(defaultFileName);
    }
  }, [isOpen]);

  const handleExport = () => {
    if (!startDate || !endDate) {
      toast({
        variant: "destructive",
        title: "Date Range Required",
        description: "Please select both a start and end date for the data export.",
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
    
    if (!fileName.trim()) {
        toast({
            variant: "destructive",
            title: "Filename Required",
            description: "Please enter a name for the export file.",
        });
        return;
    }

    toast({
      title: "Exporting Data...",
      description: "Preparing your multi-sheet XLSX file.",
    });

    try {
      const sDate = startOfDay(startDate);
      const eDate = endOfDay(endDate);

      const filteredTransactions = allTransactions.filter(txn => {
        const txnDate = parseISO(txn.timestamp);
        return isValid(txnDate) && txnDate >= sDate && txnDate <= eDate;
      });

      // --- Data Preparation for each sheet ---

      // 1. Master Log
      const masterLogData = filteredTransactions.flatMap(txn => {
        if (txn.drugs.length === 0) {
            // For transactions like 'update' that might not have drugs array populated
            const drugDetails = txn.updateDetails ? getDrugById(txn.updateDetails.drugId) : null;
            return [{
                'Date': formatDateForExcel(txn.timestamp),
                'Type': txn.type,
                'Patient Name': txn.patientName || '',
                'Aadhar': txn.aadharLastFour || '',
                'Age/Sex': `${txn.age || ''} / ${txn.sex || ''}`,
                'Village': txn.villageName || '',
                'Drug Involved': drugDetails ? `${drugDetails.brandName || drugDetails.name}` : 'N/A',
                'Dosage': drugDetails?.dosage || 'N/A',
                'Batch Number': drugDetails?.batchNumber || 'N/A',
                'Mfg. Date': drugDetails ? formatDateOnlyForExcel(drugDetails.dateOfManufacture) : 'N/A',
                'Expiry Date': drugDetails ? formatDateOnlyForExcel(drugDetails.dateOfExpiry) : 'N/A',
                'Source': txn.source || (drugDetails?.initialSource || ''),
                'Notes': txn.notes || ''
            }];
        }
        return txn.drugs.map(drugDetail => {
            const drugBatch = getDrugById(drugDetail.drugId);
            return {
                'Date': formatDateForExcel(txn.timestamp),
                'Type': txn.type,
                'Patient Name': txn.patientName || '',
                'Aadhar': txn.aadharLastFour || '',
                'Age/Sex': `${txn.age || ''} / ${txn.sex || ''}`,
                'Village': txn.villageName || '',
                'Drug Involved': `${drugDetail.brandName || drugDetail.drugName}`,
                'Dosage': drugDetail.dosage || '',
                'Batch Number': drugDetail.batchNumber || '',
                'Mfg. Date': drugBatch ? formatDateOnlyForExcel(drugBatch.dateOfManufacture) : '',
                'Expiry Date': drugBatch ? formatDateOnlyForExcel(drugBatch.dateOfExpiry) : '',
                'Source': txn.source || (drugBatch?.initialSource || ''),
                'Notes': txn.notes || `Qty: ${drugDetail.quantity}, Stock: ${drugDetail.previousStock} -> ${drugDetail.newStock}`
            };
        });
      });

      // 2. Patient Dispensing
      const patientDispensingData = filteredTransactions
        .filter(txn => txn.type === 'dispense')
        .flatMap(txn => txn.drugs.map(drugDetail => {
            const drugBatch = getDrugById(drugDetail.drugId);
            return {
                'Date': formatDateForExcel(txn.timestamp),
                'Patient Name': txn.patientName || '',
                'Age/Sex': `${txn.age || ''} / ${txn.sex || ''}`,
                'Aadhar': txn.aadharLastFour || '',
                'Village': txn.villageName || '',
                'Drug Involved': `${drugDetail.brandName || drugDetail.drugName}`,
                'Dosage': drugDetail.dosage || '',
                'Batch and Expiry': `Batch: ${drugDetail.batchNumber || 'N/A'}, Exp: ${drugBatch ? formatDateOnlyForExcel(drugBatch.dateOfExpiry) : 'N/A'}`,
                'Quantity Dispensed': -drugDetail.quantity
            };
        }));
      
      // 3. Drug Inventory Log
      const drugInventoryLogData = filteredTransactions
        .filter(txn => ['restock', 'update', 'adjustment'].includes(txn.type))
        .flatMap(txn => {
            if (txn.drugs.length === 0 && txn.updateDetails) { // Handle pure updates
                const drugBatch = getDrugById(txn.updateDetails.drugId);
                return [{
                    'Date': formatDateForExcel(txn.timestamp),
                    'Source': txn.source || drugBatch?.initialSource || '',
                    'Type': txn.type,
                    'Drug': drugBatch ? `${drugBatch.brandName || drugBatch.name}` : (txn.updateDetails.drugName || ''),
                    'Dose': drugBatch?.dosage || '',
                    'Batch': drugBatch?.batchNumber || '',
                    'Mfg. Date': drugBatch ? formatDateOnlyForExcel(drugBatch.dateOfManufacture) : '',
                    'Exp. Date': drugBatch ? formatDateOnlyForExcel(drugBatch.dateOfExpiry) : '',
                    'Stock After Change': drugBatch?.stock ?? 'N/A',
                    'Notes': txn.notes
                }];
            }
            return txn.drugs.map(drugDetail => {
                const drugBatch = getDrugById(drugDetail.drugId);
                return {
                    'Date': formatDateForExcel(txn.timestamp),
                    'Source': txn.source || drugBatch?.initialSource || '',
                    'Type': txn.type,
                    'Drug': `${drugDetail.brandName || drugDetail.drugName}`,
                    'Dose': drugDetail.dosage || '',
                    'Batch': drugDetail.batchNumber || '',
                    'Mfg. Date': drugBatch ? formatDateOnlyForExcel(drugBatch.dateOfManufacture) : '',
                    'Exp. Date': drugBatch ? formatDateOnlyForExcel(drugBatch.dateOfExpiry) : '',
                    'Stock After Change': drugDetail.newStock,
                    'Notes': txn.notes || `Qty changed by ${drugDetail.quantity}`
                };
            });
      });

      // 4. Current Inventory
      const currentInventoryData = allDrugs.map(drug => ({
        'Generic Name': drug.name,
        'Brand Name': drug.brandName || '',
        'Dosage': drug.dosage || '',
        'Batch No.': drug.batchNumber || '',
        'Mfg. Date': formatDateOnlyForExcel(drug.dateOfManufacture),
        'Exp. Date': formatDateOnlyForExcel(drug.dateOfExpiry),
        'Current Stock (Tablets)': drug.stock,
        'Purchase Price/Tablet (INR)': drug.purchasePricePerTablet,
        'Low Stock Threshold': drug.lowStockThreshold,
        'Initial Source': drug.initialSource || '',
      }));


      // --- Create Workbook and Sheets ---
      const wb = XLSX.utils.book_new();
      const wsMaster = XLSX.utils.json_to_sheet(masterLogData);
      const wsDispensing = XLSX.utils.json_to_sheet(patientDispensingData);
      const wsInventoryLog = XLSX.utils.json_to_sheet(drugInventoryLogData);
      const wsCurrentInventory = XLSX.utils.json_to_sheet(currentInventoryData);
      
      XLSX.utils.book_append_sheet(wb, wsMaster, 'Master Log');
      XLSX.utils.book_append_sheet(wb, wsDispensing, 'Patient Dispensing');
      XLSX.utils.book_append_sheet(wb, wsInventoryLog, 'Drug Inventory Log');
      XLSX.utils.book_append_sheet(wb, wsCurrentInventory, 'Current Inventory');

      // --- Trigger Download ---
      const finalFileName = fileName.trim().toLowerCase().endsWith('.xlsx') 
        ? fileName.trim() 
        : `${fileName.trim()}.xlsx`;
        
      XLSX.writeFile(wb, finalFileName);

      toast({
        title: "Export Successful",
        description: `Data exported to ${finalFileName}`,
      });
      onClose();
      setStartDate(undefined);
      setEndDate(undefined);
      setFileName('');

    } catch (error) {
      console.error("Export failed:", error);
      toast({
        variant: "destructive",
        title: "Export Failed",
        description: "An error occurred while generating the XLSX file. Check console for details.",
      });
    }
  };

  const handleClose = () => {
    onClose();
    setStartDate(undefined);
    setEndDate(undefined);
    setFileName('');
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open) { handleClose(); } }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Export Data to XLSX</DialogTitle>
          <DialogDescription>
            Select a date range for the logs and provide a filename. The "Current Inventory" sheet is always the latest status.
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
           <div className="grid grid-cols-1 items-center gap-4">
            <Label htmlFor="fileName" className="text-left">
              File Name
            </Label>
             <div className="relative">
                <FileText className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                    id="fileName"
                    value={fileName}
                    onChange={(e) => setFileName(e.target.value)}
                    placeholder="Enter filename"
                    className="pl-9"
                />
             </div>
          </div>
        </div>
        <DialogFooter>
          <DialogClose asChild>
            <Button type="button" variant="outline">
              Cancel
            </Button>
          </DialogClose>
          <Button type="button" onClick={handleExport} disabled={!startDate || !endDate || !fileName.trim()}>
            <Download className="mr-2 h-4 w-4" />
            Export to XLSX
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
