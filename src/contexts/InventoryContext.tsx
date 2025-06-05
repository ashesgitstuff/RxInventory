
"use client";

import type { ReactNode } from 'react';
import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import type { Drug, Transaction, TransactionDrugDetail, NewDrugDetails, EditDrugFormData } from '@/types';
import { INITIAL_DRUGS, DEFAULT_LOW_STOCK_THRESHOLD, DEFAULT_PURCHASE_PRICE } from '@/types';

interface InventoryContextType {
  drugs: Drug[];
  transactions: Transaction[];
  lowStockThreshold: number;
  dispenseDrugs: (patientDetails: { patientName: string; aadharLastFour: string; age: number; sex: 'Male' | 'Female' | 'Other' | ''; }, drugsToDispense: Array<{ drugId: string; stripsDispensed: number }>) => { success: boolean; message?: string; dispensedDrugs: Array<{ drugName: string; quantity: number}> };
  restockDrugs: (source: string, drugsToRestock: Array<{ drugId: string; newDrugDetails?: NewDrugDetails; stripsAdded: number }>) => { success: boolean; message?: string; restockedDrugs: Array<{ drugName: string; quantity: number}> };
  addNewDrug: (newDrugData: NewDrugDetails & { initialStock: number }) => Drug;
  updateDrugDetails: (drugId: string, data: EditDrugFormData) => { success: boolean; message?: string; updatedDrug?: Drug };
  updateLowStockThreshold: (newThreshold: number) => void;
  getDrugById: (drugId: string) => Drug | undefined;
  getDrugByName: (name: string) => Drug | undefined;
}

const InventoryContext = createContext<InventoryContextType | undefined>(undefined);

const LOCAL_STORAGE_DRUGS_KEY = 'rxinventory_drugs_v3'; // Incremented version due to structure change potential
const LOCAL_STORAGE_TRANSACTIONS_KEY = 'rxinventory_transactions_v3'; // Incremented version
const LOCAL_STORAGE_THRESHOLD_KEY = 'rxinventory_threshold_v3';

export const InventoryProvider = ({ children }: { children: ReactNode }) => {
  const [drugs, setDrugs] = useState<Drug[]>(() => {
    if (typeof window !== 'undefined') {
      const savedDrugs = localStorage.getItem(LOCAL_STORAGE_DRUGS_KEY);
      try {
        return savedDrugs ? JSON.parse(savedDrugs) : INITIAL_DRUGS;
      } catch (error) {
        console.error("Error parsing saved drugs from localStorage:", error);
        return INITIAL_DRUGS;
      }
    }
    return INITIAL_DRUGS;
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
    source: string,
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
      
      // Update purchase price if it's a new drug or if the restock form provides it for an existing (though current form doesn't do this for existing)
      if (newDrugCreated && item.newDrugDetails) {
        tempDrugs[currentDrugIndex].purchasePricePerStrip = item.newDrugDetails.purchasePricePerStrip ?? DEFAULT_PURCHASE_PRICE;
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

    // Check for name uniqueness if name is being changed
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
    };

    const updatedDrugs = [...drugs];
    updatedDrugs[drugIndex] = updatedDrug;
    setDrugs(updatedDrugs);

    // Log transaction for update
    const transactionUpdateDetails: Transaction['updateDetails'] = {
      drugId: updatedDrug.id,
      drugName: updatedDrug.name, // current name after update
    };
    if (data.name && data.name !== oldDrug.name) {
      transactionUpdateDetails.previousName = oldDrug.name;
      transactionUpdateDetails.newName = data.name;
    }
    if (data.purchasePricePerStrip !== undefined && data.purchasePricePerStrip !== oldDrug.purchasePricePerStrip) {
      transactionUpdateDetails.previousPrice = oldDrug.purchasePricePerStrip;
      transactionUpdateDetails.newPrice = data.purchasePricePerStrip;
    }

    addTransaction({
      type: 'update',
      drugs: [], // No stock change in this type of transaction for simplicity
      notes: `Drug details updated for ${oldDrug.name}.`,
      updateDetails: transactionUpdateDetails
    });

    return { success: true, updatedDrug };
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
        addNewDrug,
        updateDrugDetails,
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
