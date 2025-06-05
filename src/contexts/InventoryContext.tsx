
"use client";

import type { ReactNode } from 'react';
import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import type { Drug, Transaction, TransactionDrugDetail, NewDrugDetails } from '@/types';
import { INITIAL_DRUGS, DEFAULT_LOW_STOCK_THRESHOLD, DEFAULT_PURCHASE_PRICE } from '@/types';

interface InventoryContextType {
  drugs: Drug[];
  transactions: Transaction[];
  lowStockThreshold: number;
  dispenseDrugs: (patientDetails: { patientName: string; aadharLastFour: string; age: number; sex: 'Male' | 'Female' | 'Other' | ''; }, drugsToDispense: Array<{ drugId: string; stripsDispensed: number }>) => { success: boolean; message?: string; dispensedDrugs: Array<{ drugName: string; quantity: number}> };
  restockDrugs: (source: string, drugsToRestock: Array<{ drugId: string; newDrugDetails?: NewDrugDetails; stripsAdded: number }>) => { success: boolean; message?: string; restockedDrugs: Array<{ drugName: string; quantity: number}> };
  addNewDrug: (newDrugData: NewDrugDetails & { initialStock: number }) => Drug;
  updateLowStockThreshold: (newThreshold: number) => void;
  getDrugById: (drugId: string) => Drug | undefined;
  getDrugByName: (name: string) => Drug | undefined;
}

const InventoryContext = createContext<InventoryContextType | undefined>(undefined);

const LOCAL_STORAGE_DRUGS_KEY = 'rxinventory_drugs_v2';
const LOCAL_STORAGE_TRANSACTIONS_KEY = 'rxinventory_transactions_v2';
const LOCAL_STORAGE_THRESHOLD_KEY = 'rxinventory_threshold_v2';

export const InventoryProvider = ({ children }: { children: ReactNode }) => {
  const [drugs, setDrugs] = useState<Drug[]>(() => {
    if (typeof window !== 'undefined') {
      const savedDrugs = localStorage.getItem(LOCAL_STORAGE_DRUGS_KEY);
      return savedDrugs ? JSON.parse(savedDrugs) : INITIAL_DRUGS;
    }
    return INITIAL_DRUGS;
  });

  const [transactions, setTransactions] = useState<Transaction[]>(() => {
    if (typeof window !== 'undefined') {
      const savedTransactions = localStorage.getItem(LOCAL_STORAGE_TRANSACTIONS_KEY);
      return savedTransactions ? JSON.parse(savedTransactions) : [];
    }
    return [];
  });

  const [lowStockThreshold, setLowStockThreshold] = useState<number>(() => {
    if (typeof window !== 'undefined') {
      const savedThreshold = localStorage.getItem(LOCAL_STORAGE_THRESHOLD_KEY);
      return savedThreshold ? parseInt(savedThreshold, 10) : DEFAULT_LOW_STOCK_THRESHOLD;
    }
    return DEFAULT_LOW_STOCK_THRESHOLD;
  });

  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem(LOCAL_STORAGE_DRUGS_KEY, JSON.stringify(drugs));
    }
  }, [drugs]);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem(LOCAL_STORAGE_TRANSACTIONS_KEY, JSON.stringify(transactions));
    }
  }, [transactions]);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem(LOCAL_STORAGE_THRESHOLD_KEY, lowStockThreshold.toString());
    }
  }, [lowStockThreshold]);

  const addTransaction = useCallback((transaction: Omit<Transaction, 'id' | 'timestamp'>) => {
    setTransactions((prevTransactions) => [
      { ...transaction, id: crypto.randomUUID(), timestamp: new Date().toISOString() },
      ...prevTransactions,
    ]);
  }, []);
  
  const getDrugById = useCallback((drugId: string) => {
    return drugs.find(drug => drug.id === drugId);
  }, [drugs]);
  
  const getDrugByName = useCallback((name: string) => {
    return drugs.find(drug => drug.name.toLowerCase() === name.toLowerCase());
  }, [drugs]);

  const addNewDrug = useCallback((newDrugData: NewDrugDetails & { initialStock: number }): Drug => {
    const newDrug: Drug = {
      id: newDrugData.name.toLowerCase().replace(/\s+/g, '-') + '-' + Date.now(),
      name: newDrugData.name,
      purchasePricePerStrip: newDrugData.purchasePricePerStrip || DEFAULT_PURCHASE_PRICE,
      stock: newDrugData.initialStock,
    };
    setDrugs((prevDrugs) => [...prevDrugs, newDrug]);
    return newDrug;
  }, []);

  const dispenseDrugs = (
    patientDetails: { patientName: string; aadharLastFour: string; age: number; sex: 'Male' | 'Female' | 'Other' | ''; },
    drugsToDispense: Array<{ drugId: string; stripsDispensed: number }>
  ): { success: boolean; message?: string; dispensedDrugs: Array<{drugName: string; quantity: number}> } => {
    let allSuccessful = true;
    let errorMessage = '';
    const transactionDrugDetails: TransactionDrugDetail[] = [];
    const updatedDrugs = [...drugs]; // Create a mutable copy
    const successfullyDispensedForToast: Array<{drugName: string; quantity: number}> = [];

    for (const item of drugsToDispense) {
      const drugIndex = updatedDrugs.findIndex(d => d.id === item.drugId);
      if (drugIndex === -1) {
        allSuccessful = false;
        errorMessage += `Drug with ID ${item.drugId} not found. `;
        continue;
      }
      
      const drug = updatedDrugs[drugIndex];
      if (drug.stock < item.stripsDispensed) {
        allSuccessful = false;
        errorMessage += `Not enough ${drug.name} in stock. Available: ${drug.stock}, Requested: ${item.stripsDispensed}. `;
        continue; // Skip this drug, but try others
      }

      const previousStock = drug.stock;
      updatedDrugs[drugIndex] = { ...drug, stock: drug.stock - item.stripsDispensed };
      successfullyDispensedForToast.push({drugName: drug.name, quantity: item.stripsDispensed});

      transactionDrugDetails.push({
        drugId: drug.id,
        drugName: drug.name,
        quantity: -item.stripsDispensed,
        previousStock: previousStock,
        newStock: updatedDrugs[drugIndex].stock,
      });
    }

    if (transactionDrugDetails.length > 0) { // Only update state and add transaction if at least one drug was successfully processed
      setDrugs(updatedDrugs);
      addTransaction({
        type: 'dispense',
        patientName: patientDetails.patientName,
        aadharLastFour: patientDetails.aadharLastFour,
        age: patientDetails.age,
        sex: patientDetails.sex,
        drugs: transactionDrugDetails,
      });
    }
    
    if (!allSuccessful && transactionDrugDetails.length === 0) { // No drugs were dispensed at all
        return { success: false, message: errorMessage.trim() || "Dispense operation failed for all drugs.", dispensedDrugs: [] };
    }
    
    if (!allSuccessful && transactionDrugDetails.length > 0) { // Some drugs dispensed, some failed
        return { success: true, message: `Partial dispense. Issues: ${errorMessage.trim()}`, dispensedDrugs: successfullyDispensedForToast };
    }

    return { success: true, dispensedDrugs: successfullyDispensedForToast };
  };


  const restockDrugs = (
    source: string,
    drugsToRestock: Array<{ drugId: string; newDrugDetails?: NewDrugDetails; stripsAdded: number }>
  ): { success: boolean; message?: string; restockedDrugs: Array<{drugName: string; quantity: number}> } => {
    const transactionDrugDetails: TransactionDrugDetail[] = [];
    let tempDrugs = [...drugs]; // Operate on a temporary copy for this operation
    const successfullyRestockedForToast: Array<{drugName: string; quantity: number}> = [];

    for (const item of drugsToRestock) {
      let drugId = item.drugId;
      let drugName = '';
      let currentDrugIndex = -1;

      if (item.drugId === '--add-new--' && item.newDrugDetails) {
        const existing = getDrugByName(item.newDrugDetails.name);
        if (existing) {
            // If drug name already exists, restock that instead of creating new
            drugId = existing.id;
            drugName = existing.name;
            currentDrugIndex = tempDrugs.findIndex(d => d.id === drugId);
        } else {
            const newDrug = {
              id: item.newDrugDetails.name.toLowerCase().replace(/\s+/g, '-') + '-' + Date.now(),
              name: item.newDrugDetails.name,
              purchasePricePerStrip: item.newDrugDetails.purchasePricePerStrip || DEFAULT_PURCHASE_PRICE,
              stock: 0, // Will be updated below
            };
            tempDrugs.push(newDrug);
            drugId = newDrug.id;
            drugName = newDrug.name;
            currentDrugIndex = tempDrugs.length - 1;
        }

      } else {
        currentDrugIndex = tempDrugs.findIndex(d => d.id === item.drugId);
        if (currentDrugIndex === -1) {
          // This case should ideally not happen if UI is correct
          console.error(`Restock failed: Drug with ID ${item.drugId} not found.`);
          continue; 
        }
        drugName = tempDrugs[currentDrugIndex].name;
      }
      
      const previousStock = tempDrugs[currentDrugIndex].stock;
      tempDrugs[currentDrugIndex] = { ...tempDrugs[currentDrugIndex], stock: previousStock + item.stripsAdded };
      successfullyRestockedForToast.push({drugName: drugName, quantity: item.stripsAdded});
      
      transactionDrugDetails.push({
        drugId: drugId,
        drugName: drugName,
        quantity: item.stripsAdded,
        previousStock: previousStock,
        newStock: tempDrugs[currentDrugIndex].stock,
      });
    }

    if (transactionDrugDetails.length > 0) {
      setDrugs(tempDrugs); // Commit changes to actual state
      addTransaction({
        type: 'restock',
        source: source,
        drugs: transactionDrugDetails,
      });
      return { success: true, restockedDrugs: successfullyRestockedForToast };
    }
    return { success: false, message: "No drugs were restocked.", restockedDrugs: [] };
  };


  const updateLowStockThreshold = (newThreshold: number) => {
    setLowStockThreshold(newThreshold);
  };

  return (
    <InventoryContext.Provider
      value={{
        drugs,
        transactions,
        lowStockThreshold,
        dispenseDrugs,
        restockDrugs,
        addNewDrug, // Kept for potential direct use, though restock handles it
        updateLowStockThreshold,
        getDrugById,
        getDrugByName,
      }}
    >
      {children}
    </InventoryContext.Provider>
  );
};

export const useInventory = (): InventoryContextType => {
  const context = useContext(InventoryContext);
  if (context === undefined) {
    throw new Error('useInventory must be used within an InventoryProvider');
  }
  return context;
};
