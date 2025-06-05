
"use client";

import type { ReactNode } from 'react';
import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import type { Drug, Transaction, TransactionDrugDetail, EditDrugFormData, DrugRestockEntry, Village, DispenseFormData, DrugDispenseEntry, GroupedDrugDisplay, NewDrugDetails } from '@/types';
import { INITIAL_DRUGS, DEFAULT_PURCHASE_PRICE, DEFAULT_DRUG_LOW_STOCK_THRESHOLD } from '@/types'; // Import INITIAL_DRUGS
import { parseISO, compareAsc, format } from 'date-fns';

const DRUGS_STORAGE_KEY = 'chotusdrugbus_drugs_v3';
const TRANSACTIONS_STORAGE_KEY = 'chotusdrugbus_transactions_v3';
const VILLAGES_STORAGE_KEY = 'chotusdrugbus_villages';

const generateId = (prefix: string) => `${prefix}-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;

interface InventoryContextType {
  drugs: Drug[];
  transactions: Transaction[];
  villages: Village[];
  loading: boolean;
  addVillage: (name: string) => Promise<{ success: boolean; message?: string; village?: Village }>;
  dispenseDrugs: (patientDetails: Omit<DispenseFormData, 'drugsToDispense'>, drugsToDispense: Array<DrugDispenseEntry>) => Promise<{ success: boolean; message?: string; dispensedDrugsInfo: Array<{ drugName: string; brandName?: string; dosage?: string; batchNumber?: string; quantity: number }> }>;
  restockDrugs: (source: string, drugsToRestock: Array<DrugRestockEntry>) => Promise<{ success: boolean; message?: string; restockedDrugs: Array<{ drugName: string; brandName?: string; dosage?: string; batchNumber?: string; quantity: number }> }>;
  updateDrugDetails: (drugId: string, data: EditDrugFormData) => Promise<{ success: boolean; message?: string; updatedDrug?: Drug }>;
  getDrugById: (drugId: string) => Drug | undefined;
  getDrugGroupsForDisplay: () => GroupedDrugDisplay[];
  getVillages: () => Village[];
  resetInventoryData: () => void;
}

const InventoryContext = createContext<InventoryContextType | undefined>(undefined);

export const InventoryProvider = ({ children }: { children: ReactNode }) => {
  const [drugs, setDrugs] = useState<Drug[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [villages, setVillages] = useState<Village[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    try {
      const storedDrugs = localStorage.getItem(DRUGS_STORAGE_KEY);
      if (storedDrugs) {
        setDrugs(JSON.parse(storedDrugs));
      } else {
        setDrugs(INITIAL_DRUGS);
      }
      const storedTransactions = localStorage.getItem(TRANSACTIONS_STORAGE_KEY);
      if (storedTransactions) {
        setTransactions(JSON.parse(storedTransactions));
      } else {
        setTransactions([]);
      }
      const storedVillages = localStorage.getItem(VILLAGES_STORAGE_KEY);
      if (storedVillages) {
        setVillages(JSON.parse(storedVillages));
      } else {
        setVillages([]);
      }
    } catch (error) {
      console.error("Error loading data from localStorage:", error);
      localStorage.removeItem(DRUGS_STORAGE_KEY);
      localStorage.removeItem(TRANSACTIONS_STORAGE_KEY);
      localStorage.removeItem(VILLAGES_STORAGE_KEY);
      setDrugs(INITIAL_DRUGS);
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

  const addTransaction = useCallback((transactionData: Omit<Transaction, 'id' | 'timestamp'> & { timestamp?: string }) => {
    const newTransaction: Transaction = {
      ...transactionData,
      id: generateId('txn'),
      timestamp: transactionData.timestamp || new Date().toISOString(),
    };
    setTransactions(prevTxns => [newTransaction, ...prevTxns]);
  }, []);

  const getDrugById = useCallback((drugId: string) => {
    return drugs.find(drug => drug.id === drugId);
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
    setVillages(prevVillages => [...prevVillages, newVillage].sort((a, b) => a.name.localeCompare(b.name)));
    return { success: true, village: newVillage, message: `Village "${newVillage.name}" added.` };
  };

  const getDrugGroupsForDisplay = useCallback((): GroupedDrugDisplay[] => {
    const groups: Record<string, GroupedDrugDisplay> = {};
    drugs.forEach(drug => {
      const groupKey = `${drug.name.toLowerCase()}-DELIMITER-${(drug.brandName || '').toLowerCase()}-DELIMITER-${(drug.dosage || '').toLowerCase()}`;
      
      let displayNameSegments: string[] = [];
      if (drug.brandName) {
        displayNameSegments.push(drug.brandName);
      }
      displayNameSegments.push(drug.name); 
      if (drug.dosage) {
        displayNameSegments.push(drug.dosage);
      }
      const displayName = displayNameSegments.join(' ');

      if (!groups[groupKey]) {
        groups[groupKey] = {
          groupKey,
          displayName,
          genericName: drug.name,
          brandName: drug.brandName,
          dosage: drug.dosage,
          totalStock: 0,
          lowStockThreshold: drug.lowStockThreshold, 
          batches: [],
        };
      }
      groups[groupKey].totalStock += drug.stock;
      groups[groupKey].batches.push(drug);
      groups[groupKey].batches.sort((a, b) => {
        const dateA = a.dateOfExpiry ? parseISO(a.dateOfExpiry).getTime() : Infinity;
        const dateB = b.dateOfExpiry ? parseISO(b.dateOfExpiry).getTime() : Infinity;
        return dateA - dateB; 
      });
    });
    return Object.values(groups).sort((a,b) => a.displayName.localeCompare(b.displayName));
  }, [drugs]);


const dispenseDrugs = async (
    patientDetails: Omit<DispenseFormData, 'drugsToDispense'>,
    drugsToDispenseRequest: Array<DrugDispenseEntry>
  ): Promise<{ success: boolean; message?: string; dispensedDrugsInfo: Array<{ drugName: string; brandName?: string; dosage?: string; batchNumber?: string; quantity: number }> }> => {
    
    let overallSuccess = true;
    let overallMessage = '';
    
    const newTransactionDrugDetails: TransactionDrugDetail[] = [];
    const newSuccessfullyDispensedForToast: Array<{ drugName: string; brandName?: string; dosage?: string; batchNumber?: string; quantity: number }> = [];
    
    // Create a new array based on the current drugs state by deep copying objects
    const nextDrugsState = drugs.map(d => ({ ...d })); 

    for (const request of drugsToDispenseRequest) {
      const [reqGenericName, reqBrandName, reqDosage] = request.selectedDrugGroupKey.split('-DELIMITER-');
      
      let stripsToDispense = request.stripsDispensed;
      if (stripsToDispense <= 0) {
          overallMessage += `Skipped ${reqGenericName || 'Unknown Drug'} ${reqBrandName || ''} ${reqDosage || ''} due to zero quantity. `;
          continue;
      }

      // Filter from the 'nextDrugsState' copy
      const matchingBatches = nextDrugsState.filter(d => 
        d.name.toLowerCase() === reqGenericName.toLowerCase() &&
        (d.brandName || '').toLowerCase() === (reqBrandName || '').toLowerCase() && 
        (d.dosage || '').toLowerCase() === (reqDosage || '').toLowerCase() && 
        d.stock > 0
      ).sort((a, b) => { // Sort by expiry date, earliest first
        const dateA = a.dateOfExpiry ? parseISO(a.dateOfExpiry) : new Date(8640000000000000); 
        const dateB = b.dateOfExpiry ? parseISO(b.dateOfExpiry) : new Date(8640000000000000);
        return compareAsc(dateA, dateB);
      });

      if (matchingBatches.length === 0) {
        overallSuccess = false;
        overallMessage += `No stock found for ${reqGenericName || 'Unknown Drug'} ${reqBrandName || ''} ${reqDosage || ''}. `;
        continue;
      }

      const totalStockForDrugType = matchingBatches.reduce((sum, batch) => sum + batch.stock, 0);
      if (totalStockForDrugType < stripsToDispense) {
        overallSuccess = false;
        overallMessage += `Not enough stock for ${reqGenericName || 'Unknown Drug'} ${reqBrandName || ''} ${reqDosage || ''}. Available: ${totalStockForDrugType}, Requested: ${stripsToDispense}. Dispensing available. `;
        stripsToDispense = totalStockForDrugType; // Adjust to dispense only what's available
        if (stripsToDispense === 0) continue; // Nothing to dispense if adjusted to zero
      }
      
      let dispensedThisItem = 0;
      for (const batch of matchingBatches) { // Iterate over filtered batches from `nextDrugsState`
        if (stripsToDispense === 0) break; // All requested strips for this item have been dispensed

        // Find the batch in `nextDrugsState` by its ID to modify it
        const batchToUpdate = nextDrugsState.find(d => d.id === batch.id);
        // This check is crucial: we are modifying the `nextDrugsState` array elements directly
        if (!batchToUpdate) {
             console.error("Critical error: Batch from filtered list not found in nextDrugsState. This should not happen.");
             overallSuccess = false;
             overallMessage += `Critical error processing ${reqGenericName}. `;
             continue; // Skip this batch if something went terribly wrong
        }

        const originalStock = batchToUpdate.stock; 
        const dispensableFromThisBatch = Math.min(stripsToDispense, batchToUpdate.stock);
        
        batchToUpdate.stock -= dispensableFromThisBatch; // Modify the element in `nextDrugsState`
        stripsToDispense -= dispensableFromThisBatch;
        dispensedThisItem += dispensableFromThisBatch;

        newTransactionDrugDetails.push({
          drugId: batchToUpdate.id,
          drugName: batchToUpdate.name,
          brandName: batchToUpdate.brandName,
          dosage: batchToUpdate.dosage,
          batchNumber: batchToUpdate.batchNumber,
          quantity: -dispensableFromThisBatch, // Negative for dispense
          previousStock: originalStock,
          newStock: batchToUpdate.stock,
        });
        newSuccessfullyDispensedForToast.push({ 
           drugName: batchToUpdate.name, 
           brandName: batchToUpdate.brandName || undefined, 
           dosage: batchToUpdate.dosage || undefined, 
           batchNumber: batchToUpdate.batchNumber, 
           quantity: dispensableFromThisBatch 
        });
      }
      
      if (stripsToDispense > 0 && request.stripsDispensed > 0 && dispensedThisItem < request.stripsDispensed) { // If some strips couldn't be dispensed for this item
          overallSuccess = false; // Mark overall success as false due to partial dispense
          // Add a specific message for this item if not already present
          if (!overallMessage.includes(`Partially dispensed for ${reqGenericName}`)) {
               overallMessage += `Partially dispensed for ${reqGenericName || 'Unknown Drug'} ${reqBrandName || ''} ${reqDosage || ''}. `;
          }
      }
    }

    // After the loop, `nextDrugsState` contains the modified drug list
    setDrugs(nextDrugsState);

    if (newTransactionDrugDetails.length > 0) {
      addTransaction({
        type: 'dispense',
        patientName: patientDetails.patientName,
        aadharLastFour: patientDetails.aadharLastFour,
        age: patientDetails.age,
        sex: patientDetails.sex,
        villageName: patientDetails.villageName,
        drugs: newTransactionDrugDetails, // Use the locally built array
        notes: overallMessage || 'Dispense operation completed.',
      });
    } else if (!overallSuccess && overallMessage.length === 0) {
        // This case might happen if all requested items had zero quantity or no stock at all
        overallMessage = "No drugs were dispensed. Check stock or request details."
    }

    return { 
        success: overallSuccess, 
        message: overallMessage.trim() || (overallSuccess ? "Dispense successful." : "Dispense failed or partially completed."),
        dispensedDrugsInfo: newSuccessfullyDispensedForToast // Use the locally built array
    };
  };

  const restockDrugs = async (
    source: string,
    drugsToRestockItems: Array<DrugRestockEntry>
  ): Promise<{
    success: boolean;
    message?: string;
    restockedDrugs: Array<{ drugName: string; brandName?: string; dosage?: string; batchNumber?: string; quantity: number }>;
  }> => {
    const newDrugsFromRestock: Drug[] = [];
    const updatedExistingDrugs: Drug[] = [];
    const transactionDetailsForMainLog: TransactionDrugDetail[] = [];
    const restockedDrugsInfoForReturn: Array<{ drugName: string; brandName?: string; dosage?: string; batchNumber?: string; quantity: number }> = [];
    const priceUpdateTransactionsToLog: Array<Omit<Transaction, 'id' | 'timestamp'>> = [];

    const currentDrugsCopy = drugs.map(d => ({...d})); // Create a mutable copy

    drugsToRestockItems.forEach(item => {
      if (item.drugId === '--add-new--' && item.newDrugDetails) {
        const nd = item.newDrugDetails;
        const newDrugBatch: Drug = {
          id: generateId('drug'),
          name: nd.name,
          brandName: nd.brandName,
          dosage: nd.dosage,
          batchNumber: nd.batchNumber,
          dateOfManufacture: nd.dateOfManufacture,
          dateOfExpiry: nd.dateOfExpiry,
          purchasePricePerStrip: nd.purchasePricePerStrip ?? DEFAULT_PURCHASE_PRICE,
          stock: item.stripsAdded,
          lowStockThreshold: nd.lowStockThreshold ?? DEFAULT_DRUG_LOW_STOCK_THRESHOLD,
          initialSource: source,
        };
        newDrugsFromRestock.push(newDrugBatch);
        transactionDetailsForMainLog.push({
          drugId: newDrugBatch.id, drugName: newDrugBatch.name, brandName: newDrugBatch.brandName,
          dosage: newDrugBatch.dosage, batchNumber: newDrugBatch.batchNumber, quantity: item.stripsAdded,
          previousStock: 0, newStock: item.stripsAdded,
        });
        restockedDrugsInfoForReturn.push({ 
          drugName: newDrugBatch.name, brandName: newDrugBatch.brandName, dosage: newDrugBatch.dosage, 
          batchNumber: newDrugBatch.batchNumber, quantity: item.stripsAdded 
        });
      } else {
        const drugIndexInCopy = currentDrugsCopy.findIndex(d => d.id === item.drugId);
        if (drugIndexInCopy !== -1) {
          const drugToUpdate = currentDrugsCopy[drugIndexInCopy]; // This is a reference to an object in currentDrugsCopy
          const previousStock = drugToUpdate.stock;
          
          drugToUpdate.stock += item.stripsAdded;

          if (item.updatedPurchasePricePerStrip !== undefined && item.updatedPurchasePricePerStrip !== drugToUpdate.purchasePricePerStrip) {
            const oldPrice = drugToUpdate.purchasePricePerStrip;
            drugToUpdate.purchasePricePerStrip = item.updatedPurchasePricePerStrip;
            priceUpdateTransactionsToLog.push({
              type: 'update',
              drugs: [], 
              notes: `Purchase price updated for ${drugToUpdate.brandName || drugToUpdate.name} ${drugToUpdate.dosage || ''} (Batch: ${drugToUpdate.batchNumber}) to INR ${item.updatedPurchasePricePerStrip.toFixed(2)}.`,
              updateDetails: {
                drugId: drugToUpdate.id, drugName: drugToUpdate.name, previousPrice: oldPrice, newPrice: item.updatedPurchasePricePerStrip,
                newBrandName: drugToUpdate.brandName, newDosage: drugToUpdate.dosage, newBatchNumber: drugToUpdate.batchNumber,
              }
            });
          }
          updatedExistingDrugs.push(drugToUpdate); // Collect the updated drug
          transactionDetailsForMainLog.push({
            drugId: drugToUpdate.id, drugName: drugToUpdate.name, brandName: drugToUpdate.brandName,
            dosage: drugToUpdate.dosage, batchNumber: drugToUpdate.batchNumber, quantity: item.stripsAdded,
            previousStock: previousStock, newStock: drugToUpdate.stock,
          });
          restockedDrugsInfoForReturn.push({ 
            drugName: drugToUpdate.name, brandName: drugToUpdate.brandName, dosage: drugToUpdate.dosage, 
            batchNumber: drugToUpdate.batchNumber, quantity: item.stripsAdded 
          });
        }
      }
    });

    // Combine the untouched drugs from currentDrugsCopy with new and updated ones
    const nextDrugsState = currentDrugsCopy.map(drug => {
      const updatedVersion = updatedExistingDrugs.find(ud => ud.id === drug.id);
      return updatedVersion || drug; // Use updated version if exists, else original from copy
    }).concat(newDrugsFromRestock); // Add newly created drugs

    setDrugs(nextDrugsState);

    if (transactionDetailsForMainLog.length > 0) {
        addTransaction({
            type: 'restock',
            source: source,
            drugs: transactionDetailsForMainLog, 
            notes: `Restocked from ${source}.`
        });
    }
    priceUpdateTransactionsToLog.forEach(tx => addTransaction(tx));

    return { success: true, message: "Stock updated successfully.", restockedDrugs: restockedDrugsInfoForReturn };
  };


  const updateDrugDetails = async (drugId: string, data: EditDrugFormData): Promise<{ success: boolean; message?: string; updatedDrug?: Drug }> => {
    let updatedDrugInstance: Drug | undefined = undefined;
    let previousDetails: Partial<Drug> = {};

    setDrugs(prevDrugs => {
      const updatedDrugs = prevDrugs.map(drug => {
        if (drug.id === drugId) {
          previousDetails = { ...drug }; 

          updatedDrugInstance = {
            ...drug, 
            name: data.name,
            brandName: data.brandName,
            dosage: data.dosage,
            batchNumber: data.batchNumber,
            dateOfManufacture: data.dateOfManufacture,
            dateOfExpiry: data.dateOfExpiry,
            purchasePricePerStrip: data.purchasePricePerStrip,
            lowStockThreshold: data.lowStockThreshold,
            initialSource: data.initialSource || drug.initialSource,
          };
          return updatedDrugInstance;
        }
        return drug;
      });
      return updatedDrugs;
    });

    if (updatedDrugInstance && previousDetails.id) { 
        const ud = updatedDrugInstance;
        const pd = previousDetails;
        addTransaction({
            type: 'update',
            drugs: [], 
            notes: `Details updated for batch: ${ud.brandName || ud.name} ${ud.dosage || ''} (Batch: ${ud.batchNumber}).`,
            updateDetails: {
                drugId: ud.id,
                drugName: ud.name, 
                previousName: pd.name !== ud.name ? pd.name : undefined,
                newName: pd.name !== ud.name ? ud.name : undefined,
                previousBrandName: pd.brandName !== ud.brandName ? pd.brandName : undefined,
                newBrandName: pd.brandName !== ud.brandName ? ud.brandName : undefined,
                previousDosage: pd.dosage !== ud.dosage ? pd.dosage : undefined,
                newDosage: pd.dosage !== ud.dosage ? ud.dosage : undefined,
                previousBatchNumber: pd.batchNumber !== ud.batchNumber ? pd.batchNumber : undefined,
                newBatchNumber: pd.batchNumber !== ud.batchNumber ? ud.batchNumber : undefined,
                previousDateOfManufacture: pd.dateOfManufacture !== ud.dateOfManufacture ? pd.dateOfManufacture : undefined,
                newDateOfManufacture: pd.dateOfManufacture !== ud.dateOfManufacture ? ud.dateOfManufacture : undefined,
                previousDateOfExpiry: pd.dateOfExpiry !== ud.dateOfExpiry ? pd.dateOfExpiry : undefined,
                newDateOfExpiry: pd.dateOfExpiry !== ud.dateOfExpiry ? ud.dateOfExpiry : undefined,
                previousPrice: pd.purchasePricePerStrip !== ud.purchasePricePerStrip ? pd.purchasePricePerStrip : undefined,
                newPrice: pd.purchasePricePerStrip !== ud.purchasePricePerStrip ? ud.purchasePricePerStrip : undefined,
                previousThreshold: pd.lowStockThreshold !== ud.lowStockThreshold ? pd.lowStockThreshold : undefined,
                newThreshold: pd.lowStockThreshold !== ud.lowStockThreshold ? ud.lowStockThreshold : undefined,
                previousSource: pd.initialSource !== ud.initialSource ? pd.initialSource : undefined,
                newSource: pd.initialSource !== ud.initialSource ? ud.initialSource : undefined,
            }
        });
      return { success: true, message: 'Drug details updated successfully.', updatedDrug: updatedDrugInstance };
    }
    return { success: false, message: 'Failed to find drug to update.' };
  };

  const resetInventoryData = useCallback(() => {
    setLoading(true);
    localStorage.removeItem(DRUGS_STORAGE_KEY);
    localStorage.removeItem(TRANSACTIONS_STORAGE_KEY);
    localStorage.removeItem(VILLAGES_STORAGE_KEY);
    
    setDrugs(INITIAL_DRUGS);
    setTransactions([]);
    setVillages([]);
    setLoading(false); 
    console.log("Inventory data has been reset to initial defaults.");
  }, [setDrugs, setTransactions, setVillages, setLoading]);


  return (
    <InventoryContext.Provider value={{ 
        drugs, 
        transactions, 
        villages, 
        loading, 
        addVillage, 
        dispenseDrugs, 
        restockDrugs, 
        updateDrugDetails, 
        getDrugById,
        getDrugGroupsForDisplay,
        getVillages,
        resetInventoryData
    }}>
      {children}
    </InventoryContext.Provider>
  );
};

export const useInventory = () => {
  const context = useContext(InventoryContext);
  if (context === undefined) {
    throw new Error('useInventory must be used within an InventoryProvider');
  }
  return context;
};

