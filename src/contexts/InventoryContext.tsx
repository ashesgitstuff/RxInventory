
"use client";

import type { ReactNode } from 'react';
import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import type { Drug, Transaction, TransactionDrugDetail, NewDrugDetails, EditDrugFormData, DrugRestockEntry, Village, DispenseFormData } from '@/types';
import { DEFAULT_PURCHASE_PRICE, DEFAULT_DRUG_LOW_STOCK_THRESHOLD } from '@/types';

const DRUGS_STORAGE_KEY = 'chotusdrugbus_drugs';
const TRANSACTIONS_STORAGE_KEY = 'chotusdrugbus_transactions';
const VILLAGES_STORAGE_KEY = 'chotusdrugbus_villages'; // New storage key for villages

// Helper to generate unique IDs
const generateId = (prefix: string) => `${prefix}-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;

interface InventoryContextType {
  drugs: Drug[];
  transactions: Transaction[];
  villages: Village[]; // Added villages state
  loading: boolean;
  addVillage: (name: string) => Promise<{ success: boolean; message?: string; village?: Village }>; // Added function to add village
  dispenseDrugs: (patientDetails: Omit<DispenseFormData, 'drugsToDispense'>, drugsToDispense: Array<{ drugId: string; stripsDispensed: number }>) => Promise<{ success: boolean; message?: string; dispensedDrugs: Array<{ drugName: string; quantity: number}> }>;
  restockDrugs: (source: string, drugsToRestock: Array<DrugRestockEntry>) => Promise<{ success: boolean; message?: string; restockedDrugs: Array<{ drugName: string; quantity: number}> }>;
  addNewDrug: (newDrugData: NewDrugDetails & { initialStock: number }, initialSource: string) => Promise<Drug | null>;
  updateDrugDetails: (drugId: string, data: EditDrugFormData) => Promise<{ success: boolean; message?: string; updatedDrug?: Drug }>;
  getDrugById: (drugId: string) => Drug | undefined;
  getDrugByName: (name: string) => Drug | undefined;
  getVillages: () => Village[];
}

const InventoryContext = createContext<InventoryContextType | undefined>(undefined);

export const InventoryProvider = ({ children }: { children: ReactNode }) => {
  const [drugs, setDrugs] = useState<Drug[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [villages, setVillages] = useState<Village[]>([]); // Initialize villages state
  const [loading, setLoading] = useState(true);

  // Load data from localStorage on initial mount
  useEffect(() => {
    try {
      const storedDrugs = localStorage.getItem(DRUGS_STORAGE_KEY);
      if (storedDrugs) {
        setDrugs(JSON.parse(storedDrugs));
      }
      const storedTransactions = localStorage.getItem(TRANSACTIONS_STORAGE_KEY);
      if (storedTransactions) {
        setTransactions(JSON.parse(storedTransactions));
      }
      const storedVillages = localStorage.getItem(VILLAGES_STORAGE_KEY); // Load villages
      if (storedVillages) {
        setVillages(JSON.parse(storedVillages));
      }
    } catch (error) {
      console.error("Error loading data from localStorage:", error);
      setDrugs([]);
      setTransactions([]);
      setVillages([]); // Set villages to empty array on error
    }
    setLoading(false);
  }, []);

  // Persist drugs to localStorage
  useEffect(() => {
    if (!loading) {
      localStorage.setItem(DRUGS_STORAGE_KEY, JSON.stringify(drugs));
    }
  }, [drugs, loading]);

  // Persist transactions to localStorage
  useEffect(() => {
    if (!loading) {
      localStorage.setItem(TRANSACTIONS_STORAGE_KEY, JSON.stringify(transactions));
    }
  }, [transactions, loading]);

  // Persist villages to localStorage
  useEffect(() => {
    if (!loading) {
      localStorage.setItem(VILLAGES_STORAGE_KEY, JSON.stringify(villages));
    }
  }, [villages, loading]);

  const addTransaction = useCallback((transactionData: Omit<Transaction, 'id'>) => {
    const newTransaction: Transaction = {
      ...transactionData,
      id: generateId('txn'),
      timestamp: new Date().toISOString(),
    };
    setTransactions(prevTxns => [newTransaction, ...prevTxns]);
  }, []);
  
  const getDrugById = useCallback((drugId: string) => {
    return drugs.find(drug => drug.id === drugId);
  }, [drugs]);
  
  const getDrugByName = useCallback((name: string) => {
    return drugs.find(drug => drug.name.toLowerCase() === name.toLowerCase());
  }, [drugs]);

  const getVillages = useCallback(() => {
    return villages;
  }, [villages]);

  const addVillage = async (name: string): Promise<{ success: boolean; message?: string; village?: Village }> => {
    if (!name.trim()) {
        return { success: false, message: 'Village name cannot be empty.' };
    }
    const existingVillage = villages.find(v => v.name.toLowerCase() === name.trim().toLowerCase());
    if (existingVillage) {
      return { success: false, message: `Village "${name.trim()}" already exists.` };
    }
    const newVillage: Village = {
      id: generateId('village'),
      name: name.trim(),
    };
    setVillages(prevVillages => [...prevVillages, newVillage].sort((a,b) => a.name.localeCompare(b.name)));
    return { success: true, village: newVillage, message: `Village "${newVillage.name}" added.` };
  };

  const addNewDrug = async (newDrugData: NewDrugDetails & { initialStock: number }, initialSource: string): Promise<Drug | null> => {
    const existingDrug = getDrugByName(newDrugData.name);
    if (existingDrug) {
      console.error("Drug with this name already exists.");
      return null;
    }
    const newDrug: Drug = {
      id: generateId('drug'),
      name: newDrugData.name,
      purchasePricePerStrip: newDrugData.purchasePricePerStrip || DEFAULT_PURCHASE_PRICE,
      stock: newDrugData.initialStock,
      lowStockThreshold: newDrugData.lowStockThreshold || DEFAULT_DRUG_LOW_STOCK_THRESHOLD,
      initialSource: initialSource,
    };
    setDrugs(prevDrugs => [...prevDrugs, newDrug]);
    if (newDrugData.initialStock > 0) {
      addTransaction({
        type: 'restock',
        source: initialSource,
        drugs: [{
          drugId: newDrug.id,
          drugName: newDrug.name,
          quantity: newDrug.initialStock,
          previousStock: 0,
          newStock: newDrug.stock,
        }],
        notes: 'Initial stock for new drug.',
        timestamp: new Date().toISOString() 
      });
    }
    return newDrug;
  };

  const dispenseDrugs = async (
    patientDetails: Omit<DispenseFormData, 'drugsToDispense'>,
    drugsToDispense: Array<{ drugId: string; stripsDispensed: number }>
  ): Promise<{ success: boolean; message?: string; dispensedDrugs: Array<{drugName: string; quantity: number}> }> => {
    let allSuccessful = true;
    let errorMessage = '';
    const transactionDrugDetails: TransactionDrugDetail[] = [];
    const successfullyDispensedForToast: Array<{drugName: string; quantity: number}> = [];
    
    setDrugs(currentDrugs => {
      const updatedDrugs = [...currentDrugs]; 

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
        const newStock = drug.stock - item.stripsDispensed;
        
        updatedDrugs[drugIndex] = { ...drug, stock: newStock };
        successfullyDispensedForToast.push({drugName: drug.name, quantity: item.stripsDispensed});

        transactionDrugDetails.push({
          drugId: drug.id,
          drugName: drug.name,
          quantity: -item.stripsDispensed,
          previousStock: previousStock,
          newStock: newStock,
        });
      }
      return updatedDrugs; 
    });

    if (transactionDrugDetails.length > 0) {
      addTransaction({
        type: 'dispense',
        patientName: patientDetails.patientName,
        aadharLastFour: patientDetails.aadharLastFour,
        age: patientDetails.age,
        sex: patientDetails.sex,
        villageName: patientDetails.villageName, // Log village name
        drugs: transactionDrugDetails,
        timestamp: new Date().toISOString()
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

  const restockDrugs = async (
    source: string, 
    drugsToRestock: Array<DrugRestockEntry>
  ): Promise<{ success: boolean; message?: string; restockedDrugs: Array<{drugName: string; quantity: number}> }> => {
    const transactionDrugDetails: TransactionDrugDetail[] = [];
    const successfullyRestockedForToast: Array<{drugName: string; quantity: number}> = [];
    const priceUpdateTransactions: Omit<Transaction, 'id' | 'timestamp'>[] = [];

    setDrugs(currentDrugs => {
      let updatedDrugs = [...currentDrugs];

      for (const item of drugsToRestock) {
        let drugId = item.drugId;
        let drugName = '';
        let existingDrugIndex = -1;
        let previousStock = 0;
        let oldPrice: number | undefined = undefined;

        if (item.drugId === '--add-new--' && item.newDrugDetails) {
          drugId = generateId('drug');
          drugName = item.newDrugDetails.name;
          const newDrug: Drug = {
            id: drugId,
            name: item.newDrugDetails.name,
            purchasePricePerStrip: item.newDrugDetails.purchasePricePerStrip ?? DEFAULT_PURCHASE_PRICE,
            stock: 0, 
            lowStockThreshold: item.newDrugDetails.lowStockThreshold ?? DEFAULT_DRUG_LOW_STOCK_THRESHOLD,
            initialSource: source,
          };
          updatedDrugs.push(newDrug);
          existingDrugIndex = updatedDrugs.length - 1;
        } else {
          existingDrugIndex = updatedDrugs.findIndex(d => d.id === item.drugId);
          if (existingDrugIndex === -1) {
            console.error(`Restock failed: Drug with ID ${item.drugId} not found.`);
            continue; 
          }
          const currentDrug = updatedDrugs[existingDrugIndex];
          drugName = currentDrug.name;
          previousStock = currentDrug.stock;
          oldPrice = currentDrug.purchasePricePerStrip;

          if (item.updatedPurchasePricePerStrip !== undefined && currentDrug.purchasePricePerStrip !== item.updatedPurchasePricePerStrip) {
            updatedDrugs[existingDrugIndex] = { ...currentDrug, purchasePricePerStrip: item.updatedPurchasePricePerStrip };
             priceUpdateTransactions.push({
                type: 'update',
                drugs: [],
                notes: `Purchase price updated for ${drugName} during restock from ${source}.`,
                updateDetails: {
                  drugId: drugId,
                  drugName: drugName,
                  previousPrice: oldPrice,
                  newPrice: item.updatedPurchasePricePerStrip,
                },
                timestamp: new Date().toISOString() 
             });
          }
        }
        
        const drugForStockUpdate = updatedDrugs[existingDrugIndex];
        if (!drugForStockUpdate) continue;

        previousStock = drugForStockUpdate.stock; 
        const newStock = drugForStockUpdate.stock + item.stripsAdded;
        updatedDrugs[existingDrugIndex] = { ...drugForStockUpdate, stock: newStock };
        
        successfullyRestockedForToast.push({drugName: drugName, quantity: item.stripsAdded});
        
        transactionDrugDetails.push({
          drugId: drugId,
          drugName: drugName,
          quantity: item.stripsAdded,
          previousStock: previousStock,
          newStock: newStock,
        });
      }
      return updatedDrugs;
    });

    if (transactionDrugDetails.length > 0) {
      addTransaction({
        type: 'restock',
        source: source,
        drugs: transactionDrugDetails,
        timestamp: new Date().toISOString(),
      });
    }
    priceUpdateTransactions.forEach(tx => addTransaction(tx));


    if (transactionDrugDetails.length === 0) {
        return { success: false, message: "No drugs were restocked.", restockedDrugs: [] };
    }
    return { success: true, restockedDrugs: successfullyRestockedForToast };
  };

  const updateDrugDetails = async (drugId: string, data: EditDrugFormData): Promise<{ success: boolean; message?: string; updatedDrug?: Drug }> => {
    let updatedDrug: Drug | undefined = undefined;
    let detailsChanged = false;
    let transactionUpdateDetails: Transaction['updateDetails'] = { drugId: '', drugName: '' }; 

    setDrugs(currentDrugs => {
        const drugIndex = currentDrugs.findIndex(d => d.id === drugId);
        if (drugIndex === -1) {
            return currentDrugs; 
        }
        const oldDrug = currentDrugs[drugIndex];
        transactionUpdateDetails.drugId = drugId;
        transactionUpdateDetails.drugName = data.name ?? oldDrug.name;


        const updates: Partial<Drug> = {};
        if (data.name && data.name.toLowerCase() !== oldDrug.name.toLowerCase()) {
          const existingDrugWithNewName = currentDrugs.find(d => d.name.toLowerCase() === data.name!.toLowerCase() && d.id !== drugId);
          if (existingDrugWithNewName) {
            console.error(`A drug named "${data.name}" already exists.`);
            return currentDrugs; 
          }
          updates.name = data.name;
          transactionUpdateDetails.previousName = oldDrug.name;
          transactionUpdateDetails.newName = data.name;
          detailsChanged = true;
        }
        if (data.purchasePricePerStrip !== undefined && data.purchasePricePerStrip !== oldDrug.purchasePricePerStrip) {
          updates.purchasePricePerStrip = data.purchasePricePerStrip;
          transactionUpdateDetails.previousPrice = oldDrug.purchasePricePerStrip;
          transactionUpdateDetails.newPrice = data.purchasePricePerStrip;
          detailsChanged = true;
        }
        if (data.lowStockThreshold !== undefined && data.lowStockThreshold !== oldDrug.lowStockThreshold) {
          updates.lowStockThreshold = data.lowStockThreshold;
          transactionUpdateDetails.previousThreshold = oldDrug.lowStockThreshold;
          transactionUpdateDetails.newThreshold = data.lowStockThreshold;
          detailsChanged = true;
        }
        if (data.initialSource !== undefined && data.initialSource !== oldDrug.initialSource) {
          updates.initialSource = data.initialSource;
          transactionUpdateDetails.previousSource = oldDrug.initialSource;
          transactionUpdateDetails.newSource = data.initialSource;
          detailsChanged = true;
        }

        if (Object.keys(updates).length > 0) {
            const newDrugsArray = [...currentDrugs];
            updatedDrug = { ...oldDrug, ...updates };
            newDrugsArray[drugIndex] = updatedDrug;
            return newDrugsArray;
        }
        updatedDrug = oldDrug; 
        return currentDrugs;
    });
    
    if (!updatedDrug && !detailsChanged) { 
      const oldDrug = getDrugById(drugId);
      if (!oldDrug) return { success: false, message: "Drug not found." };
      
      if (data.name && data.name.toLowerCase() !== oldDrug.name.toLowerCase()) {
        const existingDrugWithNewName = getDrugByName(data.name);
        if (existingDrugWithNewName && existingDrugWithNewName.id !== drugId) {
          return { success: false, message: `A drug named "${data.name}" already exists.` };
        }
      }
       return { success: false, message: "No valid changes applied or drug not found." };
    }

    if (detailsChanged && updatedDrug) { 
        addTransaction({
            type: 'update',
            drugs: [], 
            notes: `Drug details updated for ${transactionUpdateDetails.previousName || updatedDrug.name}.`,
            updateDetails: transactionUpdateDetails,
            timestamp: new Date().toISOString(),
        });
        return { success: true, updatedDrug };
    } else if (updatedDrug) { 
        return { success: true, updatedDrug }; 
    }
    return { success: false, message: "Failed to apply updates." };
  };

  return (
    <InventoryContext.Provider
      value={{
        drugs,
        transactions,
        villages, // Expose villages
        loading,
        addVillage, // Expose addVillage
        dispenseDrugs,
        restockDrugs,
        addNewDrug,
        updateDrugDetails,
        getDrugById,
        getDrugByName,
        getVillages,
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
