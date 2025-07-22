
"use client";

import React, { useState } from 'react';
import { useInventory } from '@/contexts/InventoryContext';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
  TableCaption,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { format, parseISO } from 'date-fns';
import { ListChecks, ArrowDownCircle, ArrowUpCircle, Edit3, MapPin, Replace, Trash2, AlertTriangle, ArrowRight } from 'lucide-react';
import type { Transaction, TransactionDrugDetail, Drug } from '@/types';
import { Button } from '@/components/ui/button';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useToast } from '@/hooks/use-toast';


const formatDateSafe = (dateString?: string) => {
  if (!dateString) return 'N/A';
  try {
    return format(parseISO(dateString), 'PP'); 
  } catch (error) {
    return dateString; 
  }
};

interface CorrectedStockInfo {
  drugName: string;
  batchNumber?: string;
  currentStock: number;
  correctedStock: number;
}

export default function TransactionsPage() {
  const { transactions, deleteTransaction, getDrugById } = useInventory();
  const [transactionToDelete, setTransactionToDelete] = useState<Transaction | null>(null);
  const [correctedStockPreview, setCorrectedStockPreview] = useState<CorrectedStockInfo[]>([]);
  const { toast } = useToast();

  const sortedTransactions = React.useMemo(() => 
    [...transactions].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()),
    [transactions]
  );
  
  const handleOpenDeleteDialog = (transaction: Transaction) => {
    const stockPreview: CorrectedStockInfo[] = [];

    transaction.drugs.forEach(detail => {
      const currentBatch = getDrugById(detail.drugId);
      if (currentBatch) {
        // To reverse the transaction, we subtract the quantity.
        // Dispense is negative, so -- becomes +. Restock is positive, so - becomes -.
        const correctedStock = currentBatch.stock - detail.quantity;
        stockPreview.push({
          drugName: `${currentBatch.brandName || currentBatch.name} ${currentBatch.dosage || ''}`,
          batchNumber: currentBatch.batchNumber,
          currentStock: currentBatch.stock,
          correctedStock: correctedStock,
        });
      }
    });

    setCorrectedStockPreview(stockPreview);
    setTransactionToDelete(transaction);
  };

  const handleConfirmDelete = async () => {
    if (!transactionToDelete) return;

    const result = await deleteTransaction(transactionToDelete.id);

    if (result.success) {
      toast({
        title: "Transaction Deleted",
        description: `The transaction from ${format(parseISO(transactionToDelete.timestamp), 'PPpp')} has been deleted and inventory updated.`,
      });
    } else {
      toast({
        variant: "destructive",
        title: "Deletion Failed",
        description: result.message || "Could not delete the transaction.",
      });
    }

    setTransactionToDelete(null);
    setCorrectedStockPreview([]);
  };


  const renderDrugDetails = (drugDetails: TransactionDrugDetail[]) => {
    if (!drugDetails || drugDetails.length === 0) return <span className="text-muted-foreground">N/A</span>;
    return (
      <ul className="list-disc list-inside space-y-1 text-sm">
        {drugDetails.map((detail, index) => (
          <li key={`${detail.drugId}-${detail.batchNumber || 'nobatch'}-${index}`}> {/* Ensure unique key with index */}
            {detail.drugName} {detail.dosage ? `(${detail.dosage})` : ''} {detail.brandName ? `[${detail.brandName}]` : ''}
            {detail.batchNumber && ` (Batch: ${detail.batchNumber})`}: 
            <span className={detail.quantity > 0 ? "text-green-600 font-semibold" : "text-red-600 font-semibold"}>
              {detail.quantity > 0 ? ` +${detail.quantity}` : ` ${detail.quantity}`}
            </span> tablets (Prev: {detail.previousStock}, New: {detail.newStock})
          </li>
        ))}
      </ul>
    );
  };
  
  const renderAdjustmentDetails = (transaction: Transaction) => {
    if (transaction.type !== 'adjustment' || !transaction.drugs.length) return null;
    const detail = transaction.drugs[0];
    const change = detail.newStock - detail.previousStock;

    return (
      <div className="text-sm">
        <p>
            {detail.drugName} {detail.dosage ? `(${detail.dosage})` : ''} {detail.brandName ? `[${detail.brandName}]` : ''}
            {detail.batchNumber && ` (Batch: ${detail.batchNumber})`}
        </p>
        <p className="font-semibold">
          Stock changed from {detail.previousStock} to {detail.newStock} 
          <span className={change > 0 ? "text-green-600" : "text-red-600"}> ({change > 0 ? `+${change}`: change})</span>.
        </p>
        {transaction.notes && <p className="italic text-muted-foreground">Reason: {transaction.notes}</p>}
      </div>
    );
  }


  const renderUpdateDetails = (transaction: Transaction) => {
    if (transaction.type !== 'update' || !transaction.updateDetails) return null;
    const ud = transaction.updateDetails;
    const changes = [];

    // Primary identifiers for the updated batch
    let batchIdentifier = `${ud.drugName || 'Drug'}`;
    if (ud.newBrandName) batchIdentifier = `${ud.newBrandName} ${batchIdentifier}`;
    if (ud.newDosage) batchIdentifier += ` ${ud.newDosage}`;
    if (ud.newBatchNumber) batchIdentifier += ` (Batch: ${ud.newBatchNumber})`;
    else if (ud.previousBatchNumber) batchIdentifier += ` (Batch: ${ud.previousBatchNumber})`;


    if (ud.newName && ud.previousName !== undefined && ud.newName !== ud.previousName) changes.push(`Generic Name: "${ud.previousName}" -> "${ud.newName}"`);
    if (ud.newBrandName !== undefined && ud.newBrandName !== ud.previousBrandName) changes.push(`Brand Name: "${ud.previousBrandName || 'N/A'}" -> "${ud.newBrandName || 'N/A'}"`);
    if (ud.newDosage !== undefined && ud.newDosage !== ud.previousDosage) changes.push(`Dosage: "${ud.previousDosage || 'N/A'}" -> "${ud.newDosage || 'N/A'}"`);
    if (ud.newBatchNumber !== undefined && ud.newBatchNumber !== ud.previousBatchNumber) changes.push(`Batch No: "${ud.previousBatchNumber || 'N/A'}" -> "${ud.newBatchNumber || 'N/A'}"`);
    
    if (ud.newDateOfManufacture !== undefined && ud.newDateOfManufacture !== ud.previousDateOfManufacture) changes.push(`Mfg. Date: ${formatDateSafe(ud.previousDateOfManufacture)} -> ${formatDateSafe(ud.newDateOfManufacture)}`);
    if (ud.newDateOfExpiry !== undefined && ud.newDateOfExpiry !== ud.previousDateOfExpiry) changes.push(`Exp. Date: ${formatDateSafe(ud.previousDateOfExpiry)} -> ${formatDateSafe(ud.newDateOfExpiry)}`);
    
    if (ud.newPrice !== undefined && ud.previousPrice !== undefined && ud.newPrice !== ud.previousPrice) changes.push(`Price: INR ${ud.previousPrice.toFixed(2)} -> INR ${ud.newPrice.toFixed(2)}`);
    if (ud.newThreshold !== undefined && ud.previousThreshold !== undefined && ud.newThreshold !== ud.previousThreshold) changes.push(`Threshold: ${ud.previousThreshold} -> ${ud.newThreshold} tablets`);
    if (ud.newSource !== undefined && ud.newSource !== ud.previousSource) changes.push(`Source: "${ud.previousSource || 'N/A'}" -> "${ud.newSource || 'N/A'}"`);

    if (changes.length === 0 && !transaction.notes?.includes('details updated')) { 
        return transaction.notes ? <p className="text-sm">{transaction.notes}</p> : <p className="text-sm text-muted-foreground">No specific field changes recorded for {batchIdentifier}.</p>;
    }

    return (
      <div className="text-sm space-y-0.5">
        <p className="font-semibold">Updated: {batchIdentifier}</p>
        {changes.map((change, idx) => <p key={idx}><Edit3 className="inline h-3 w-3 mr-1 text-blue-500 shrink-0"/>{change}</p>)}
        {transaction.notes && !transaction.notes.startsWith('Details updated for batch:') && !transaction.notes.startsWith('Purchase price updated for') && <p className="mt-1 italic text-muted-foreground">{transaction.notes}</p>}
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8 space-y-8">
      <Card className="shadow-xl">
        <CardHeader>
          <CardTitle className="font-headline flex items-center gap-2 text-2xl">
            <ListChecks className="h-6 w-6 text-primary" />
            Transaction Log
          </CardTitle>
          <CardDescription>A record of all inventory movements, batch updates, and camp details.</CardDescription>
        </CardHeader>
        <CardContent>
          {sortedTransactions.length === 0 ? (
            <p className="text-center text-muted-foreground py-10">No transactions recorded yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableCaption>End of transaction log.</TableCaption>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[180px]">Timestamp</TableHead>
                    <TableHead className="w-[120px]">Type</TableHead>
                    <TableHead>Details / Patient & Camp Info</TableHead>
                    <TableHead>Drug Batches Involved / Changes</TableHead>
                    <TableHead className="text-center w-[100px]">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sortedTransactions.map((transaction: Transaction) => (
                    <TableRow key={transaction.id}>
                      <TableCell>{format(new Date(transaction.timestamp), "PPpp")}</TableCell>
                      <TableCell>
                        <Badge 
                           variant={transaction.type === 'dispense' ? 'destructive' : 
                           transaction.type === 'adjustment' ? 'secondary' : 
                           transaction.type === 'update' ? 'secondary' : 'default'}
                           className="capitalize flex items-center gap-1"
                        >
                          {transaction.type === 'dispense' && <ArrowDownCircle className="h-3 w-3" />}
                          {transaction.type === 'restock' && <ArrowUpCircle className="h-3 w-3" />}
                          {transaction.type === 'update' && <Edit3 className="h-3 w-3" />}
                          {transaction.type === 'adjustment' && <Replace className="h-3 w-3" />}
                          {transaction.type}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {transaction.type === 'dispense' && (
                          <div className="text-sm space-y-0.5">
                            {transaction.patientName && <p><strong>Patient:</strong> {transaction.patientName}</p>}
                            {transaction.aadharLastFour && <p><strong>Aadhar (Last 4):</strong> {transaction.aadharLastFour}</p>}
                            {transaction.age && <p><strong>Age:</strong> {transaction.age}</p>}
                            {transaction.sex && <p><strong>Sex:</strong> {transaction.sex}</p>}
                            {transaction.villageName && <p className="flex items-center"><MapPin className="inline h-3.5 w-3.5 mr-1 text-muted-foreground"/><strong>Village:</strong> {transaction.villageName}</p>}
                          </div>
                        )}
                        {transaction.type === 'restock' && transaction.source && (
                          <p><strong>Source:</strong> {transaction.source}</p>
                        )}
                         {transaction.type === 'update' && (
                            transaction.notes && !transaction.notes.startsWith('Details updated for batch:') && !transaction.notes.startsWith('Purchase price updated for') ? <p className="text-sm italic">{transaction.notes}</p> : <span className="text-sm text-muted-foreground">Batch details changed</span>
                        )}
                         {transaction.type === 'adjustment' && (
                            <p className="text-sm"><strong>By:</strong> {transaction.source || 'Admin'}</p>
                         )}
                      </TableCell>
                      <TableCell>
                        {transaction.type === 'update' ? renderUpdateDetails(transaction) :
                         transaction.type === 'adjustment' ? renderAdjustmentDetails(transaction) :
                         renderDrugDetails(transaction.drugs)}
                      </TableCell>
                      <TableCell className="text-center">
                        {['dispense', 'restock', 'adjustment'].includes(transaction.type) ? (
                            <Button variant="destructive" size="sm" onClick={() => handleOpenDeleteDialog(transaction)} className="h-8 px-2">
                                <Trash2 className="mr-1 h-4 w-4" /> Delete
                            </Button>
                        ) : (
                            <span className="text-xs text-muted-foreground">N/A</span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {transactionToDelete && (
        <AlertDialog open={!!transactionToDelete} onOpenChange={(isOpen) => !isOpen && setTransactionToDelete(null)}>
            <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertDialogTitle className="flex items-center gap-2">
                        <AlertTriangle className="h-5 w-5 text-destructive" />
                        Confirm Transaction Deletion
                    </AlertDialogTitle>
                    <AlertDialogDescription>
                        Are you sure you want to delete this transaction from <strong>{format(parseISO(transactionToDelete.timestamp), 'PPpp')}</strong>?
                        This action cannot be undone. It will reverse the stock changes and remove this entry from the log.
                    </AlertDialogDescription>
                </AlertDialogHeader>
                
                <div className="my-4 space-y-3 rounded-md border p-4">
                    <h4 className="font-semibold text-foreground">Stock Changes Preview:</h4>
                    {correctedStockPreview.length > 0 ? (
                        <ul className="space-y-2 text-sm">
                            {correctedStockPreview.map((item, index) => (
                                <li key={index} className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
                                    <div>
                                        <p className="font-medium">{item.drugName}</p>
                                        <p className="text-xs text-muted-foreground">Batch: {item.batchNumber || 'N/A'}</p>
                                    </div>
                                    <div className="flex items-center gap-2 font-mono mt-1 sm:mt-0">
                                        <span className="text-muted-foreground">{item.currentStock}</span>
                                        <ArrowRight className="h-4 w-4 text-primary" />
                                        <span className="font-bold text-lg text-primary">{item.correctedStock}</span>
                                    </div>
                                </li>
                            ))}
                        </ul>
                    ) : (
                        <p className="text-sm text-muted-foreground">Could not preview stock changes. The associated drug may no longer exist.</p>
                    )}
                </div>

                <AlertDialogFooter>
                    <AlertDialogCancel onClick={() => setTransactionToDelete(null)}>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={handleConfirmDelete} className="bg-destructive hover:bg-destructive/90 text-destructive-foreground">
                        Yes, Delete Transaction
                    </AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
      )}
    </div>
  );
}
