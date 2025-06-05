
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
import { format } from 'date-fns';
import { ListChecks, ArrowDownCircle, ArrowUpCircle, Edit3 } from 'lucide-react';
import type { Transaction, TransactionDrugDetail } from '@/types';

export default function TransactionsPage() {
  const { transactions } = useInventory();

  const sortedTransactions = React.useMemo(() => 
    [...transactions].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()),
    [transactions]
  );

  const renderDrugDetails = (drugDetails: TransactionDrugDetail[]) => {
    if (!drugDetails || drugDetails.length === 0) return <span className="text-muted-foreground">N/A</span>;
    return (
      <ul className="list-disc list-inside space-y-1">
        {drugDetails.map(detail => (
          <li key={detail.drugId}>
            {detail.drugName}: <span className={detail.quantity > 0 ? "text-green-600 font-semibold" : "text-red-600 font-semibold"}>{detail.quantity > 0 ? `+${detail.quantity}` : detail.quantity}</span> strips (Prev: {detail.previousStock}, New: {detail.newStock})
          </li>
        ))}
      </ul>
    );
  };

  const renderUpdateDetails = (transaction: Transaction) => {
    if (transaction.type !== 'update' || !transaction.updateDetails) return null;
    const { drugName, previousName, newName, previousPrice, newPrice } = transaction.updateDetails;
    const changes = [];
    if (newName && previousName) changes.push(`Name: "${previousName}" -> "${newName}"`);
    else if (newName) changes.push(`Name set to: "${newName}"`);
    
    if (newPrice !== undefined && previousPrice !== undefined) changes.push(`Price: ₹${previousPrice.toFixed(2)} -> ₹${newPrice.toFixed(2)}`);
    else if (newPrice !== undefined) changes.push(`Price set to: ₹${newPrice.toFixed(2)}`);

    return (
      <div className="text-sm">
        <p><strong>Drug:</strong> {drugName}</p>
        {changes.map((change, idx) => <p key={idx}>{change}</p>)}
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
          <CardDescription>A record of all inventory movements and updates.</CardDescription>
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
                    <TableHead>Details</TableHead>
                    <TableHead>Drugs Involved / Changes</TableHead>
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
                        {transaction.type === 'dispense' && transaction.patientName && (
                          <div className="text-sm">
                            <p><strong>Patient:</strong> {transaction.patientName}</p>
                            {transaction.aadharLastFour && <p><strong>Aadhar (Last 4):</strong> {transaction.aadharLastFour}</p>}
                            {transaction.age && <p><strong>Age:</strong> {transaction.age}</p>}
                            {transaction.sex && <p><strong>Sex:</strong> {transaction.sex}</p>}
                          </div>
                        )}
                        {transaction.type === 'restock' && transaction.source && (
                          <p><strong>Source:</strong> {transaction.source}</p>
                        )}
                        {transaction.type === 'update' && transaction.notes && (
                            <p className="text-sm">{transaction.notes}</p>
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
