
"use client";

import type { ReactNode } from 'react';
import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import type { Drug, Transaction, TransactionDrugDetail, NewDrugDetails, EditDrugFormData, DrugRestockEntry, Village, DispenseFormData } from '@/types';
import { DEFAULT_PURCHASE_PRICE, DEFAULT_DRUG_LOW_STOCK_THRESHOLD } from '@/types';

const DRUGS_STORAGE_KEY = 'chotusdrugbus_drugs_v2'; // Incremented version due to data structure change
const TRANSACTIONS_STORAGE_KEY = 'chotusdrugbus_transactions_v2'; // Incremented version
const VILLAGES_STORAGE_KEY = 'chotusdrugbus_villages';

const generateId = (prefix: string) => `${prefix}-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;

interface InventoryContextType {
  drugs: Drug[];
  transactions: Transaction[];
  villages: Village[]; 
  loading: boolean;
  addVillage: (name: string) => Promise<{ success: boolean; message?: string; village?: Village }>; 
  dispenseDrugs: (patientDetails: Omit<DispenseFormData, 'drugsToDispense'>, drugsToDispense: Array<{ drugId: string; stripsDispensed: number }>) => Promise<{ success: boolean; message?: string; dispensedDrugs: Array<{ drugName: string; quantity: number}> }>;
  restockDrugs: (source: string, drugsToRestock: Array<DrugRestockEntry>) => Promise<{ success: boolean; message?: string; restockedDrugs: Array<{ drugName: string; quantity: number}> }>;
  addNewDrug: (newDrugData: NewDrugDetails & { initialStock: number }, initialSource: string) => Promise<Drug | null>; // Kept for potential direct use, though restock handles new drugs
  updateDrugDetails: (drugId: string, data: EditDrugFormData) => Promise<{ success: boolean; message?: string; updatedDrug?: Drug }>;
  getDrugById: (drugId: string) => Drug | undefined;
  getDrugByName: (name: string) => Drug | undefined; // Searches by generic name
  getVillages: () => Village[];
}

const InventoryContext = createContext<InventoryContextType | undefined>(undefined);

export const InventoryProvider = ({ children }: { children: ReactNode }) => {
  const [drugs, setDrugs] = useState<Drug[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [villages, setVillages] = useState<Village[]>([]); 
  const [loading, setLoading] = useState(true);

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
      const storedVillages = localStorage.getItem(VILLAGES_STORAGE_KEY); 
      if (storedVillages) {
        setVillages(JSON.parse(storedVillages));
      }
    } catch (error) {
      console.error("Error loading data from localStorage:", error);
      // Potentially add logic here to clear corrupted keys or offer a reset
      localStorage.removeItem(DRUGS_STORAGE_KEY); // Clear potentially corrupt data
      localStorage.removeItem(TRANSACTIONS_STORAGE_KEY);
      setDrugs([]);
      setTransactions([]);
      setVillages([]); 
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    if (!loading) {
      localStorage.setItem(DRUGS_STORAGE_KEY, JSON.stringify(drugs));
    }
  }, [drugs, loading]);

  useEffect(() => {
    if (!loading) {
      localStorage.setItem(TRANSACTIONS_STORAGE_KEY, JSON.stringify(transactions));
    }
  }, [transactions, loading]);

  useEffect(() => {
    if (!loading) {
      localStorage.setItem(VILLAGES_STORAGE_KEY, JSON.stringify(villages));
    }
  }, [villages, loading]);

  const addTransaction = useCallback((transactionData: Omit<Transaction, 'id'>) => {
    const newTransaction: Transaction = {
      ...transactionData,
      id: generateId('txn'),
      timestamp: transactionData.timestamp || new Date().toISOString(), // Ensure timestamp exists
    };
    setTransactions(prevTxns => [newTransaction, ...prevTxns]);
  }, []);
  
  const getDrugById = useCallback((drugId: string) => {
    return drugs.find(drug => drug.id === drugId);
  }, [drugs]);
  
  const getDrugByName = useCallback((name: string) => { // Generic name search
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

  // This function can still be used for adding drugs programmatically if needed,
  // but the primary way to add new drugs is now via the RestockForm.
  const addNewDrug = async (newDrugData: NewDrugDetails & { initialStock: number }, initialSource: string): Promise<Drug | null> => {
    const existingDrug = getDrugByName(newDrugData.name); // Check by generic name
    if (existingDrug) {
      // More nuanced check could be needed if brand/dosage makes it unique
      console.error("Drug with this generic name already exists. Consider uniqueness by brand/dosage.");
      // return null; // For now, allow if other fields are different, ID will make it unique.
    }
    const newDrug: Drug = {
      id: generateId('drug'),
      name: newDrugData.name,
      brandName: newDrugData.brandName,
      dosage: newDrugData.dosage,
      batchNumber: newDrugData.batchNumber,
      dateOfManufacture: newDrugData.dateOfManufacture,
      dateOfExpiry: newDrugData.dateOfExpiry,
      purchasePricePerStrip: newDrugData.purchasePricePerStrip ?? DEFAULT_PURCHASE_PRICE,
      stock: newDrugData.initialStock,
      lowStockThreshold: newDrugData.lowStockThreshold ?? DEFAULT_DRUG_LOW_STOCK_THRESHOLD,
      initialSource: initialSource,
    };
    setDrugs(prevDrugs => [...prevDrugs, newDrug]);
    if (newDrugData.initialStock > 0) {
      addTransaction({
        type: 'restock',
        source: initialSource,
        drugs: [{
          drugId: newDrug.id,
          drugName: newDrug.name, // Generic name
          brandName: newDrug.brandName,
          dosage: newDrug.dosage,
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
          errorMessage += `Not enough ${drug.name} (Brand: ${drug.brandName || 'N/A'}) in stock. Available: ${drug.stock}, Requested: ${item.stripsDispensed}. `;
          continue; 
        }

        const previousStock = drug.stock;
        const newStock = drug.stock - item.stripsDispensed;
        
        updatedDrugs[drugIndex] = { ...drug, stock: newStock };
        successfullyDispensedForToast.push({drugName: `${drug.name} ${drug.dosage || ''} (${drug.brandName || 'Generic'})`, quantity: item.stripsDispensed});

        transactionDrugDetails.push({
          drugId: drug.id,
          drugName: drug.name,
          brandName: drug.brandName,
          dosage: drug.dosage,
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
        villageName: patientDetails.villageName, 
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
        let drugName = ''; // Generic Name
        let brandName = '';
        let dosage = '';
        let existingDrugIndex = -1;
        let previousStock = 0;
        let oldPrice: number | undefined = undefined;
        let drugForTxnLog: Drug | undefined = undefined;


        if (item.drugId === '--add-new--' && item.newDrugDetails) {
          drugId = generateId('drug');
          const nd = item.newDrugDetails;
          drugName = nd.name;
          brandName = nd.brandName || '';
          dosage = nd.dosage || '';

          const newDrug: Drug = {
            id: drugId,
            name: nd.name,
            brandName: nd.brandName,
            dosage: nd.dosage,
            batchNumber: nd.batchNumber,
            dateOfManufacture: nd.dateOfManufacture,
            dateOfExpiry: nd.dateOfExpiry,
            purchasePricePerStrip: nd.purchasePricePerStrip ?? DEFAULT_PURCHASE_PRICE,
            stock: 0, 
            lowStockThreshold: nd.lowStockThreshold ?? DEFAULT_DRUG_LOW_STOCK_THRESHOLD,
            initialSource: source,
          };
          updatedDrugs.push(newDrug);
          existingDrugIndex = updatedDrugs.length - 1;
          drugForTxnLog = newDrug;
        } else {
          existingDrugIndex = updatedDrugs.findIndex(d => d.id === item.drugId);
          if (existingDrugIndex === -1) {
            console.error(`Restock failed: Drug with ID ${item.drugId} not found.`);
            continue; 
          }
          const currentDrug = updatedDrugs[existingDrugIndex];
          drugName = currentDrug.name;
          brandName = currentDrug.brandName || '';
          dosage = currentDrug.dosage || '';
          previousStock = currentDrug.stock;
          oldPrice = currentDrug.purchasePricePerStrip;
          drugForTxnLog = currentDrug;

          if (item.updatedPurchasePricePerStrip !== undefined && currentDrug.purchasePricePerStrip !== item.updatedPurchasePricePerStrip) {
            updatedDrugs[existingDrugIndex] = { ...currentDrug, purchasePricePerStrip: item.updatedPurchasePricePerStrip };
             priceUpdateTransactions.push({
                type: 'update',
                drugs: [],
                notes: `Purchase price updated for ${drugName} (${brandName}) during restock from ${source}.`,
                updateDetails: {
                  drugId: drugId,
                  drugName: drugName, // generic name
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
        
        successfullyRestockedForToast.push({drugName: `${drugName} ${dosage} (${brandName || 'Generic'})`, quantity: item.stripsAdded});
        
        transactionDrugDetails.push({
          drugId: drugId,
          drugName: drugName,
          brandName: drugForTxnLog?.brandName,
          dosage: drugForTxnLog?.dosage,
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


    if (transactionDrugDetails.length === 0 && priceUpdateTransactions.length === 0) { // also check price updates
        return { success: false, message: "No drugs were restocked or updated.", restockedDrugs: [] };
    }
    return { success: true, restockedDrugs: successfullyRestockedForToast };
  };

  const updateDrugDetails = async (drugId: string, data: EditDrugFormData): Promise<{ success: boolean; message?: string; updatedDrug?: Drug }> => {
    let updatedDrugObj: Drug | undefined = undefined; // Renamed to avoid conflict with state
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
            console.error(`A drug with generic name "${data.name}" already exists.`);
            // This check might need to be more nuanced if brand/dosage also contribute to uniqueness
            // For now, we prevent duplicate generic names if they are different entries.
            return currentDrugs; 
          }
          updates.name = data.name;
          transactionUpdateDetails.previousName = oldDrug.name;
          transactionUpdateDetails.newName = data.name;
          detailsChanged = true;
        }

        // Helper for comparing optional string fields
        const diffOptional = (oldVal?: string, newVal?: string) => (newVal !== undefined && newVal !== oldVal);

        if (diffOptional(oldDrug.brandName, data.brandName)) {
            updates.brandName = data.brandName;
            transactionUpdateDetails.previousBrandName = oldDrug.brandName;
            transactionUpdateDetails.newBrandName = data.brandName;
            detailsChanged = true;
        }
        if (diffOptional(oldDrug.dosage, data.dosage)) {
            updates.dosage = data.dosage;
            transactionUpdateDetails.previousDosage = oldDrug.dosage;
            transactionUpdateDetails.newDosage = data.dosage;
            detailsChanged = true;
        }
        if (diffOptional(oldDrug.batchNumber, data.batchNumber)) {
            updates.batchNumber = data.batchNumber;
            transactionUpdateDetails.previousBatchNumber = oldDrug.batchNumber;
            transactionUpdateDetails.newBatchNumber = data.batchNumber;
            detailsChanged = true;
        }
        if (diffOptional(oldDrug.dateOfManufacture, data.dateOfManufacture)) {
            updates.dateOfManufacture = data.dateOfManufacture;
            transactionUpdateDetails.previousDateOfManufacture = oldDrug.dateOfManufacture;
            transactionUpdateDetails.newDateOfManufacture = data.dateOfManufacture;
            detailsChanged = true;
        }
        if (diffOptional(oldDrug.dateOfExpiry, data.dateOfExpiry)) {
            updates.dateOfExpiry = data.dateOfExpiry;
            transactionUpdateDetails.previousDateOfExpiry = oldDrug.dateOfExpiry;
            transactionUpdateDetails.newDateOfExpiry = data.dateOfExpiry;
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
        if (diffOptional(oldDrug.initialSource, data.initialSource)) {
          updates.initialSource = data.initialSource;
          transactionUpdateDetails.previousSource = oldDrug.initialSource;
          transactionUpdateDetails.newSource = data.initialSource;
          detailsChanged = true;
        }

        if (Object.keys(updates).length > 0) {
            const newDrugsArray = [...currentDrugs];
            updatedDrugObj = { ...oldDrug, ...updates };
            newDrugsArray[drugIndex] = updatedDrugObj;
            return newDrugsArray;
        }
        updatedDrugObj = oldDrug; 
        return currentDrugs;
    });
    
    if (!updatedDrugObj && !detailsChanged) { 
      const oldDrug = getDrugById(drugId);
      if (!oldDrug) return { success: false, message: "Drug not found." };
      
      if (data.name && data.name.toLowerCase() !== oldDrug.name.toLowerCase()) {
        // Check for duplicate generic name if name is being changed
        const existingDrugWithNewName = getDrugByName(data.name);
        if (existingDrugWithNewName && existingDrugWithNewName.id !== drugId) {
          return { success: false, message: `A drug with generic name "${data.name}" already exists.` };
        }
      }
       return { success: false, message: "No valid changes applied or drug not found." };
    }

    if (detailsChanged && updatedDrugObj) { 
        addTransaction({
            type: 'update',
            drugs: [], 
            notes: `Drug details updated for ${transactionUpdateDetails.previousName || updatedDrugObj.name}.`,
            updateDetails: transactionUpdateDetails,
            timestamp: new Date().toISOString(),
        });
        return { success: true, updatedDrug: updatedDrugObj };
    } else if (updatedDrugObj) { 
        return { success: true, updatedDrug: updatedDrugObj }; 
    }
    return { success: false, message: "Failed to apply updates." };
  };

  return (
    <InventoryContext.Provider
      value={{
        drugs,
        transactions,
        villages, 
        loading,
        addVillage, 
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
