
"use client";

import type { ReactNode } from 'react';
import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import type { Drug, Transaction, TransactionDrugDetail, NewDrugDetails, EditDrugFormData, DrugRestockEntry } from '@/types';
import { INITIAL_DRUGS, DEFAULT_PURCHASE_PRICE, DEFAULT_DRUG_LOW_STOCK_THRESHOLD } from '@/types';

interface InventoryContextType {
  drugs: Drug[];
  transactions: Transaction[];
  dispenseDrugs: (patientDetails: { patientName: string; aadharLastFour: string; age: number; sex: 'Male' | 'Female' | 'Other' | ''; }, drugsToDispense: Array<{ drugId: string; stripsDispensed: number }>) => { success: boolean; message?: string; dispensedDrugs: Array<{ drugName: string; quantity: number}> };
  restockDrugs: (source: string, drugsToRestock: Array<DrugRestockEntry>) => { success: boolean; message?: string; restockedDrugs: Array<{ drugName: string; quantity: number}> };
  addNewDrug: (newDrugData: NewDrugDetails & { initialStock: number }, initialSource: string) => Drug;
  updateDrugDetails: (drugId: string, data: EditDrugFormData) => { success: boolean; message?: string; updatedDrug?: Drug };
  getDrugById: (drugId: string) => Drug | undefined;
  getDrugByName: (name: string) => Drug | undefined;
}

const InventoryContext = createContext<InventoryContextType | undefined>(undefined);

const LOCAL_STORAGE_DRUGS_KEY = 'rxinventory_drugs_v7'; // Incremented version due to structure change
const LOCAL_STORAGE_TRANSACTIONS_KEY = 'rxinventory_transactions_v6'; // Incremented version

export const InventoryProvider = ({ children }: { children: ReactNode }) => {
  const [drugs, setDrugs] = useState<Drug[]>(() => {
    if (typeof window !== 'undefined') {
      const savedDrugs = localStorage.getItem(LOCAL_STORAGE_DRUGS_KEY);
      try {
        const parsedDrugs = savedDrugs ? JSON.parse(savedDrugs) : INITIAL_DRUGS;
        return parsedDrugs.map((drug: Drug) => ({
          ...drug,
          lowStockThreshold: drug.lowStockThreshold ?? DEFAULT_DRUG_LOW_STOCK_THRESHOLD,
          initialSource: drug.initialSource 
        }));
      } catch (error) {
        console.error("Error parsing saved drugs from localStorage:", error);
        return INITIAL_DRUGS.map(drug => ({
            ...drug, 
            lowStockThreshold: drug.lowStockThreshold ?? DEFAULT_DRUG_LOW_STOCK_THRESHOLD,
            initialSource: drug.initialSource ?? "System Setup" 
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
    source: string, 
    drugsToRestock: Array<DrugRestockEntry>
  ): { success: boolean; message?: string; restockedDrugs: Array<{drugName: string; quantity: number}> } => {
    const transactionDrugDetails: TransactionDrugDetail[] = [];
    let tempDrugs = [...drugs]; 
    const successfullyRestockedForToast: Array<{drugName: string; quantity: number}> = [];

    for (const item of drugsToRestock) {
      let drugId = item.drugId;
      let drugName = '';
      let currentDrugIndex = -1;

      if (item.drugId === '--add-new--' && item.newDrugDetails) {
        const newDrug: Drug = {
          id: item.newDrugDetails.name.toLowerCase().replace(/\s+/g, '-') + '-' + Date.now(),
          name: item.newDrugDetails.name,
          purchasePricePerStrip: item.newDrugDetails.purchasePricePerStrip ?? DEFAULT_PURCHASE_PRICE,
          stock: 0, 
          lowStockThreshold: item.newDrugDetails.lowStockThreshold ?? DEFAULT_DRUG_LOW_STOCK_THRESHOLD,
          initialSource: source, 
        };
        tempDrugs.push(newDrug);
        drugId = newDrug.id;
        drugName = newDrug.name;
        currentDrugIndex = tempDrugs.length - 1;
      } else {
        currentDrugIndex = tempDrugs.findIndex(d => d.id === item.drugId);
        if (currentDrugIndex === -1) {
          console.error(`Restock failed: Drug with ID ${item.drugId} not found.`);
          continue; 
        }
        drugName = tempDrugs[currentDrugIndex].name;

        if (item.updatedPurchasePricePerStrip !== undefined && tempDrugs[currentDrugIndex].purchasePricePerStrip !== item.updatedPurchasePricePerStrip) {
          const oldPrice = tempDrugs[currentDrugIndex].purchasePricePerStrip;
          tempDrugs[currentDrugIndex].purchasePricePerStrip = item.updatedPurchasePricePerStrip;
          addTransaction({
            type: 'update',
            drugs: [], 
            notes: `Purchase price updated for ${drugName} during restock from ${source}.`,
            updateDetails: {
              drugId: drugId,
              drugName: drugName,
              previousPrice: oldPrice,
              newPrice: item.updatedPurchasePricePerStrip,
            }
          });
        }
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
      const existingDrugWithNewName = getDrugByName(data.name);
      if (existingDrugWithNewName && existingDrugWithNewName.id !== drugId) { 
        return { success: false, message: `A drug named "${data.name}" already exists.` };
      }
    }
    
    const oldDrug = drugs[drugIndex];
    const updatedDrugData: Drug = {
      ...oldDrug,
      name: data.name ?? oldDrug.name,
      purchasePricePerStrip: data.purchasePricePerStrip ?? oldDrug.purchasePricePerStrip,
      lowStockThreshold: data.lowStockThreshold ?? oldDrug.lowStockThreshold,
      initialSource: data.initialSource !== undefined ? data.initialSource : oldDrug.initialSource,
    };

    const updatedDrugsList = [...drugs];
    updatedDrugsList[drugIndex] = updatedDrugData;
    setDrugs(updatedDrugsList);

    const transactionUpdateDetails: Transaction['updateDetails'] = {
      drugId: updatedDrugData.id,
      drugName: updatedDrugData.name, 
    };
    let detailsChanged = false;

    if (data.name && data.name !== oldDrug.name) {
      transactionUpdateDetails.previousName = oldDrug.name;
      transactionUpdateDetails.newName = data.name;
      detailsChanged = true;
    }
    if (data.purchasePricePerStrip !== undefined && data.purchasePricePerStrip !== oldDrug.purchasePricePerStrip) {
      transactionUpdateDetails.previousPrice = oldDrug.purchasePricePerStrip;
      transactionUpdateDetails.newPrice = data.purchasePricePerStrip;
      detailsChanged = true;
    }
    if (data.lowStockThreshold !== undefined && data.lowStockThreshold !== oldDrug.lowStockThreshold) {
      transactionUpdateDetails.previousThreshold = oldDrug.lowStockThreshold;
      transactionUpdateDetails.newThreshold = data.lowStockThreshold;
      detailsChanged = true;
    }
    if (data.initialSource !== undefined && data.initialSource !== oldDrug.initialSource) {
      transactionUpdateDetails.previousSource = oldDrug.initialSource;
      transactionUpdateDetails.newSource = data.initialSource;
      detailsChanged = true;
    }

    if (detailsChanged) { 
        addTransaction({
            type: 'update',
            drugs: [], 
            notes: `Drug details updated for ${oldDrug.name}.`,
            updateDetails: transactionUpdateDetails
        });
    }

    return { success: true, updatedDrug: updatedDrugData };
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
