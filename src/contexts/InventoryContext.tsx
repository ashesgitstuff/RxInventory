
"use client";

import type { ReactNode } from 'react';
import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import type { Drug, Transaction, TransactionDrugDetail, NewDrugDetails, EditDrugFormData } from '@/types';
import { INITIAL_DRUGS, DEFAULT_PURCHASE_PRICE, DEFAULT_DRUG_LOW_STOCK_THRESHOLD } from '@/types';

interface InventoryContextType {
  drugs: Drug[];
  transactions: Transaction[];
  dispenseDrugs: (patientDetails: { patientName: string; aadharLastFour: string; age: number; sex: 'Male' | 'Female' | 'Other' | ''; }, drugsToDispense: Array<{ drugId: string; stripsDispensed: number }>) => { success: boolean; message?: string; dispensedDrugs: Array<{ drugName: string; quantity: number}> };
  restockDrugs: (source: string, drugsToRestock: Array<{ drugId: string; newDrugDetails?: NewDrugDetails; stripsAdded: number }>) => { success: boolean; message?: string; restockedDrugs: Array<{ drugName: string; quantity: number}> };
  addNewDrug: (newDrugData: NewDrugDetails & { initialStock: number }, initialSource: string) => Drug;
  updateDrugDetails: (drugId: string, data: EditDrugFormData) => { success: boolean; message?: string; updatedDrug?: Drug };
  getDrugById: (drugId: string) => Drug | undefined;
  getDrugByName: (name: string) => Drug | undefined;
}

const InventoryContext = createContext<InventoryContextType | undefined>(undefined);

const LOCAL_STORAGE_DRUGS_KEY = 'rxinventory_drugs_v5'; // Incremented version due to structure change (initialSource)
const LOCAL_STORAGE_TRANSACTIONS_KEY = 'rxinventory_transactions_v4';

export const InventoryProvider = ({ children }: { children: ReactNode }) => {
  const [drugs, setDrugs] = useState<Drug[]>(() => {
    if (typeof window !== 'undefined') {
      const savedDrugs = localStorage.getItem(LOCAL_STORAGE_DRUGS_KEY);
      try {
        const parsedDrugs = savedDrugs ? JSON.parse(savedDrugs) : INITIAL_DRUGS;
        return parsedDrugs.map((drug: Drug) => ({
          ...drug,
          lowStockThreshold: drug.lowStockThreshold ?? DEFAULT_DRUG_LOW_STOCK_THRESHOLD,
          initialSource: drug.initialSource // Will be undefined if not present, handled at display
        }));
      } catch (error) {
        console.error("Error parsing saved drugs from localStorage:", error);
        return INITIAL_DRUGS.map(drug => ({
            ...drug, 
            lowStockThreshold: drug.lowStockThreshold ?? DEFAULT_DRUG_LOW_STOCK_THRESHOLD,
            initialSource: drug.initialSource ?? "System Setup" // Ensure initial drugs have a source
        }));
      }
    }
    return INITIAL_DRUGS.map(drug => ({
        ...drug, 
        lowStockThreshold: drug.lowStockThreshold ?? DEFAULT_DRUG_LOW_STOCK_THRESHOLD,
        initialSource: drug.initialSource ?? "System Setup"
    }));
  });

  const [transactions, setTransactions] = useState<Transaction[]>(() => {
    if (typeof window !== 'undefined') {
      const savedTransactions = localStorage.getItem(LOCAL_STORAGE_TRANSACTIONS_KEY);
       try {
        return savedTransactions ? JSON.parse(savedTransactions) : [];
      } catch (error) {
        console.error("Error parsing saved transactions from localStorage:", error);
        return [];
      }
    }
    return [];
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

  const addTransaction = useCallback((transactionData: Omit<Transaction, 'id' | 'timestamp'>) => {
    setTransactions((prevTransactions) => [
      { ...transactionData, id: crypto.randomUUID(), timestamp: new Date().toISOString() },
      ...prevTransactions,
    ]);
  }, []);
  
  const getDrugById = useCallback((drugId: string) => {
    return drugs.find(drug => drug.id === drugId);
  }, [drugs]);
  
  const getDrugByName = useCallback((name: string) => {
    return drugs.find(drug => drug.name.toLowerCase() === name.toLowerCase());
  }, [drugs]);

  const addNewDrug = useCallback((newDrugData: NewDrugDetails & { initialStock: number }, initialSource: string): Drug => {
    const newDrug: Drug = {
      id: newDrugData.name.toLowerCase().replace(/\s+/g, '-') + '-' + Date.now(),
      name: newDrugData.name,
      purchasePricePerStrip: newDrugData.purchasePricePerStrip || DEFAULT_PURCHASE_PRICE,
      stock: newDrugData.initialStock,
      lowStockThreshold: newDrugData.lowStockThreshold || DEFAULT_DRUG_LOW_STOCK_THRESHOLD,
      initialSource: initialSource,
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
    const updatedDrugs = [...drugs]; 
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
        continue; 
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

    if (transactionDrugDetails.length > 0) { 
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
    
    if (!allSuccessful && transactionDrugDetails.length === 0) { 
        return { success: false, message: errorMessage.trim() || "Dispense operation failed for all drugs.", dispensedDrugs: [] };
    }
    
    if (!allSuccessful && transactionDrugDetails.length > 0) { 
        return { success: true, message: `Partial dispense. Issues: ${errorMessage.trim()}`, dispensedDrugs: successfullyDispensedForToast };
    }

    return { success: true, dispensedDrugs: successfullyDispensedForToast };
  };


  const restockDrugs = (
    source: string, // This is the source for the overall transaction
    drugsToRestock: Array<{ drugId: string; newDrugDetails?: NewDrugDetails; stripsAdded: number }>
  ): { success: boolean; message?: string; restockedDrugs: Array<{drugName: string; quantity: number}> } => {
    const transactionDrugDetails: TransactionDrugDetail[] = [];
    let tempDrugs = [...drugs]; 
    const successfullyRestockedForToast: Array<{drugName: string; quantity: number}> = [];

    for (const item of drugsToRestock) {
      let drugId = item.drugId;
      let drugName = '';
      let currentDrugIndex = -1;
      let newDrugCreated = false;

      if (item.drugId === '--add-new--' && item.newDrugDetails) {
        const existing = getDrugByName(item.newDrugDetails.name);
        if (existing) {
            drugId = existing.id;
            drugName = existing.name;
            currentDrugIndex = tempDrugs.findIndex(d => d.id === drugId);
        } else {
            const newDrug: Drug = {
              id: item.newDrugDetails.name.toLowerCase().replace(/\s+/g, '-') + '-' + Date.now(),
              name: item.newDrugDetails.name,
              purchasePricePerStrip: item.newDrugDetails.purchasePricePerStrip ?? DEFAULT_PURCHASE_PRICE,
              stock: 0, // Will be updated below
              lowStockThreshold: item.newDrugDetails.lowStockThreshold ?? DEFAULT_DRUG_LOW_STOCK_THRESHOLD,
              initialSource: source, // Use the transaction source as the initial source for the new drug
            };
            tempDrugs.push(newDrug);
            drugId = newDrug.id;
            drugName = newDrug.name;
            currentDrugIndex = tempDrugs.length - 1;
            newDrugCreated = true;
        }

      } else {
        currentDrugIndex = tempDrugs.findIndex(d => d.id === item.drugId);
        if (currentDrugIndex === -1) {
          console.error(`Restock failed: Drug with ID ${item.drugId} not found.`);
          continue; 
        }
        drugName = tempDrugs[currentDrugIndex].name;
      }
      
      const previousStock = tempDrugs[currentDrugIndex].stock;
      tempDrugs[currentDrugIndex] = { ...tempDrugs[currentDrugIndex], stock: previousStock + item.stripsAdded };
      
      if (newDrugCreated && item.newDrugDetails) {
        // These are already set during newDrug object creation above
        // tempDrugs[currentDrugIndex].purchasePricePerStrip = item.newDrugDetails.purchasePricePerStrip ?? DEFAULT_PURCHASE_PRICE;
        // tempDrugs[currentDrugIndex].lowStockThreshold = item.newDrugDetails.lowStockThreshold ?? DEFAULT_DRUG_LOW_STOCK_THRESHOLD;
      }


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
      setDrugs(tempDrugs); 
      addTransaction({
        type: 'restock',
        source: source,
        drugs: transactionDrugDetails,
      });
      return { success: true, restockedDrugs: successfullyRestockedForToast };
    }
    return { success: false, message: "No drugs were restocked.", restockedDrugs: [] };
  };

  const updateDrugDetails = (drugId: string, data: EditDrugFormData): { success: boolean; message?: string; updatedDrug?: Drug } => {
    const drugIndex = drugs.findIndex(d => d.id === drugId);
    if (drugIndex === -1) {
      return { success: false, message: "Drug not found." };
    }

    if (data.name && data.name.toLowerCase() !== drugs[drugIndex].name.toLowerCase()) {
      if (getDrugByName(data.name)) {
        return { success: false, message: `A drug named "${data.name}" already exists.` };
      }
    }
    
    const oldDrug = drugs[drugIndex];
    const updatedDrug = {
      ...oldDrug,
      name: data.name ?? oldDrug.name,
      purchasePricePerStrip: data.purchasePricePerStrip ?? oldDrug.purchasePricePerStrip,
      lowStockThreshold: data.lowStockThreshold ?? oldDrug.lowStockThreshold,
      // initialSource is not editable via this form, it's set at creation
    };

    const updatedDrugs = [...drugs];
    updatedDrugs[drugIndex] = updatedDrug;
    setDrugs(updatedDrugs);

    const transactionUpdateDetails: Transaction['updateDetails'] = {
      drugId: updatedDrug.id,
      drugName: updatedDrug.name,
    };
    if (data.name && data.name !== oldDrug.name) {
      transactionUpdateDetails.previousName = oldDrug.name;
      transactionUpdateDetails.newName = data.name;
    }
    if (data.purchasePricePerStrip !== undefined && data.purchasePricePerStrip !== oldDrug.purchasePricePerStrip) {
      transactionUpdateDetails.previousPrice = oldDrug.purchasePricePerStrip;
      transactionUpdateDetails.newPrice = data.purchasePricePerStrip;
    }
    if (data.lowStockThreshold !== undefined && data.lowStockThreshold !== oldDrug.lowStockThreshold) {
      transactionUpdateDetails.previousThreshold = oldDrug.lowStockThreshold;
      transactionUpdateDetails.newThreshold = data.lowStockThreshold;
    }

    if (Object.keys(transactionUpdateDetails).length > 2) { 
        addTransaction({
            type: 'update',
            drugs: [], 
            notes: `Drug details updated for ${oldDrug.name}.`,
            updateDetails: transactionUpdateDetails
        });
    }

    return { success: true, updatedDrug };
  };

  return (
    <InventoryContext.Provider
      value={{
        drugs,
        transactions,
        dispenseDrugs,
        restockDrugs,
        addNewDrug,
        updateDrugDetails,
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

