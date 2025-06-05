
"use client";

import React from 'react';
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
import { ListChecks, ArrowDownCircle, ArrowUpCircle, Edit3, MapPin } from 'lucide-react';
import type { Transaction, TransactionDrugDetail } from '@/types';

const formatDateSafe = (dateString?: string) => {
  if (!dateString) return 'N/A';
  try {
    return format(parseISO(dateString), 'PP'); 
  } catch (error) {
    return dateString; 
  }
};

export default function TransactionsPage() {
  const { transactions } = useInventory();

  const sortedTransactions = React.useMemo(() => 
    [...transactions].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()),
    [transactions]
  );

  const renderDrugDetails = (drugDetails: TransactionDrugDetail[]) => {
    if (!drugDetails || drugDetails.length === 0) return <span className="text-muted-foreground">N/A</span>;
    return (
      <ul className="list-disc list-inside space-y-1 text-sm">
        {drugDetails.map(detail => (
          <li key={`${detail.drugId}-${detail.batchNumber || 'nobatch'}`}> {/* Ensure unique key with batch */}
            {detail.drugName} {detail.dosage ? `(${detail.dosage})` : ''} {detail.brandName ? `[${detail.brandName}]` : ''}
            {detail.batchNumber && ` (Batch: ${detail.batchNumber})`}: 
            <span className={detail.quantity > 0 ? "text-green-600 font-semibold" : "text-red-600 font-semibold"}>
              {detail.quantity > 0 ? ` +${detail.quantity}` : ` ${detail.quantity}`}
            </span> strips (Prev: {detail.previousStock}, New: {detail.newStock})
          </li>
        ))}
      </ul>
    );
  };

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
    if (ud.newThreshold !== undefined && ud.previousThreshold !== undefined && ud.newThreshold !== ud.previousThreshold) changes.push(`Threshold: ${ud.previousThreshold} -> ${ud.newThreshold} strips`);
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
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sortedTransactions.map((transaction: Transaction) => (
                    <TableRow key={transaction.id}>
                      <TableCell>{format(new Date(transaction.timestamp), "PPpp")}</TableCell>
                      <TableCell>
                        <Badge 
                          variant={transaction.type === 'dispense' ? 'destructive' : transaction.type === 'update' ? 'secondary' : 'default'} 
                          className="capitalize flex items-center gap-1"
                        >
                          {transaction.type === 'dispense' && <ArrowDownCircle className="h-3 w-3" />}
                          {transaction.type === 'restock' && <ArrowUpCircle className="h-3 w-3" />}
                          {transaction.type === 'update' && <Edit3 className="h-3 w-3" />}
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
                      </TableCell>
                      <TableCell>
                        {transaction.type === 'update' ? renderUpdateDetails(transaction) : renderDrugDetails(transaction.drugs)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
