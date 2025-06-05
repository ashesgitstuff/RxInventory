
"use client";

import type { ReactNode } from 'react';
import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import type { Drug, Transaction, TransactionDrugDetail, EditDrugFormData, DrugRestockEntry, Village, DispenseFormData, DrugDispenseEntry, GroupedDrugDisplay, NewDrugDetails } from '@/types';
import { DEFAULT_PURCHASE_PRICE, DEFAULT_DRUG_LOW_STOCK_THRESHOLD } from '@/types';
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
      localStorage.removeItem(DRUGS_STORAGE_KEY);
      localStorage.removeItem(TRANSACTIONS_STORAGE_KEY);
      localStorage.removeItem(VILLAGES_STORAGE_KEY);
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
    const transactionDrugDetailsAccumulator: TransactionDrugDetail[] = [];
    const successfullyDispensedForToast: Array<{ drugName: string; brandName?: string; dosage?: string; batchNumber?: string; quantity: number }> = [];

    setDrugs(currentDrugs => {
      const updatedDrugsState = [...currentDrugs]; 

      for (const request of drugsToDispenseRequest) {
        const [reqGenericName, reqBrandName, reqDosage] = request.selectedDrugGroupKey.split('-DELIMITER-');
        
        let stripsToDispense = request.stripsDispensed;
        if (stripsToDispense <= 0) {
            overallMessage += `Skipped ${reqGenericName} ${reqBrandName || ''} ${reqDosage || ''} due to zero quantity. `;
            continue;
        }

        const matchingBatches = updatedDrugsState.filter(d =>
          d.name.toLowerCase() === reqGenericName.toLowerCase() &&
          (d.brandName || '').toLowerCase() === (reqBrandName || '').toLowerCase() && 
          (d.dosage || '').toLowerCase() === (reqDosage || '').toLowerCase() && 
          d.stock > 0
        ).sort((a, b) => { 
          const dateA = a.dateOfExpiry ? parseISO(a.dateOfExpiry) : new Date(8640000000000000); 
          const dateB = b.dateOfExpiry ? parseISO(b.dateOfExpiry) : new Date(8640000000000000);
          return compareAsc(dateA, dateB);
        });

        if (matchingBatches.length === 0) {
          overallSuccess = false;
          overallMessage += `No stock found for ${reqGenericName} ${reqBrandName || ''} ${reqDosage || ''}. `;
          continue;
        }

        const totalStockForDrugType = matchingBatches.reduce((sum, batch) => sum + batch.stock, 0);
        if (totalStockForDrugType < stripsToDispense) {
          overallSuccess = false;
          overallMessage += `Not enough stock for ${reqGenericName} ${reqBrandName || ''} ${reqDosage || ''}. Available: ${totalStockForDrugType}, Requested: ${stripsToDispense}. Dispensing available. `;
          stripsToDispense = totalStockForDrugType; 
          if (stripsToDispense === 0) continue;
        }
        
        let dispensedThisItem = 0;
        for (const batch of matchingBatches) {
          if (stripsToDispense === 0) break;

          const batchIndexInUpdatedState = updatedDrugsState.findIndex(d => d.id === batch.id);
          if (batchIndexInUpdatedState === -1) continue; 

          const currentBatchInState = updatedDrugsState[batchIndexInUpdatedState];
          const originalStock = currentBatchInState.stock;

          const dispensableFromThisBatch = Math.min(stripsToDispense, currentBatchInState.stock);
          
          currentBatchInState.stock -= dispensableFromThisBatch;
          stripsToDispense -= dispensableFromThisBatch;
          dispensedThisItem += dispensableFromThisBatch;

          transactionDrugDetailsAccumulator.push({
            drugId: currentBatchInState.id,
            drugName: currentBatchInState.name,
            brandName: currentBatchInState.brandName,
            dosage: currentBatchInState.dosage,
            batchNumber: currentBatchInState.batchNumber,
            quantity: -dispensableFromThisBatch, 
            previousStock: originalStock,
            newStock: currentBatchInState.stock,
          });
           successfullyDispensedForToast.push({ 
             drugName: currentBatchInState.name, 
             brandName: currentBatchInState.brandName || undefined, 
             dosage: currentBatchInState.dosage || undefined, 
             batchNumber: currentBatchInState.batchNumber, 
             quantity: dispensableFromThisBatch 
           });
        }
        
        if (stripsToDispense > 0 && request.stripsDispensed > 0 && dispensedThisItem < request.stripsDispensed) { 
            overallSuccess = false; 
            if (!overallMessage.includes(`Partially dispensed for ${reqGenericName}`)) {
                 overallMessage += `Partially dispensed for ${reqGenericName} ${reqBrandName || ''} ${reqDosage || ''}. `;
            }
        }
      }
      return updatedDrugsState; 
    });

    if (transactionDrugDetailsAccumulator.length > 0) {
      addTransaction({
        type: 'dispense',
        patientName: patientDetails.patientName,
        aadharLastFour: patientDetails.aadharLastFour,
        age: patientDetails.age,
        sex: patientDetails.sex,
        villageName: patientDetails.villageName,
        drugs: transactionDrugDetailsAccumulator,
        notes: overallMessage || 'Dispense operation completed.',
      });
    } else if (!overallSuccess && overallMessage.length === 0) {
        overallMessage = "No drugs were dispensed. Check stock or request details."
    }

    return { 
        success: overallSuccess, 
        message: overallMessage.trim() || (overallSuccess ? "Dispense successful." : "Dispense failed or partially completed."),
        dispensedDrugsInfo: successfullyDispensedForToast 
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
    const newDrugsStateAfterProcessing: Drug[] = [...drugs]; // Start with a copy of the current state
    const transactionDetailsForLog: TransactionDrugDetail[] = [];
    const restockedDrugsInfoForReturn: Array<{ drugName: string; brandName?: string; dosage?: string; batchNumber?: string; quantity: number }> = [];
    const priceUpdateTransactionsToLog: Array<Omit<Transaction, 'id' | 'timestamp'>> = [];

    drugsToRestockItems.forEach(item => {
      if (item.drugId === '--add-new--' && item.newDrugDetails) {
        const nd = item.newDrugDetails;
        // Basic check, form should also validate this
        const existingBatchCheck = newDrugsStateAfterProcessing.find(d =>
            d.name.toLowerCase() === nd.name.toLowerCase() &&
            (d.brandName || '').toLowerCase() === (nd.brandName || '').toLowerCase() &&
            (d.dosage || '').toLowerCase() === (nd.dosage || '').toLowerCase() &&
            (d.batchNumber || '').toLowerCase() === (nd.batchNumber || '').toLowerCase()
        );
        if (existingBatchCheck) {
          console.warn(`Attempted to add a new batch that already exists: ${nd.name} ${nd.batchNumber} during processing.`);
          // Optionally, you could add to overallMessage if this function returned one, or throw
          return; // Skip this item if it's a duplicate new batch based on current processing
        }

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
        newDrugsStateAfterProcessing.push(newDrugBatch);
        
        transactionDetailsForLog.push({
          drugId: newDrugBatch.id, drugName: newDrugBatch.name, brandName: newDrugBatch.brandName,
          dosage: newDrugBatch.dosage, batchNumber: newDrugBatch.batchNumber, quantity: item.stripsAdded,
          previousStock: 0, newStock: item.stripsAdded,
        });
        restockedDrugsInfoForReturn.push({ 
          drugName: newDrugBatch.name, brandName: newDrugBatch.brandName, dosage: newDrugBatch.dosage, 
          batchNumber: newDrugBatch.batchNumber, quantity: item.stripsAdded 
        });

      } else { // Existing batch
        const drugIndex = newDrugsStateAfterProcessing.findIndex(d => d.id === item.drugId);
        if (drugIndex !== -1) {
          const drugBeforeUpdate = newDrugsStateAfterProcessing[drugIndex];
          const previousStock = drugBeforeUpdate.stock;
          
          // Create a new object for the updated batch to ensure React detects the change
          const updatedBatchData: Drug = {
            ...drugBeforeUpdate,
            stock: drugBeforeUpdate.stock + item.stripsAdded,
          };

          if (item.updatedPurchasePricePerStrip !== undefined && item.updatedPurchasePricePerStrip !== updatedBatchData.purchasePricePerStrip) {
            const oldPrice = updatedBatchData.purchasePricePerStrip;
            updatedBatchData.purchasePricePerStrip = item.updatedPurchasePricePerStrip;
            priceUpdateTransactionsToLog.push({
              type: 'update',
              drugs: [], 
              notes: `Purchase price updated for ${updatedBatchData.brandName || updatedBatchData.name} ${updatedBatchData.dosage || ''} (Batch: ${updatedBatchData.batchNumber}) to INR ${item.updatedPurchasePricePerStrip.toFixed(2)}.`,
              updateDetails: {
                drugId: updatedBatchData.id,
                drugName: updatedBatchData.name,
                previousPrice: oldPrice,
                newPrice: item.updatedPurchasePricePerStrip,
                newBrandName: updatedBatchData.brandName,
                newDosage: updatedBatchData.dosage,
                newBatchNumber: updatedBatchData.batchNumber,
              }
            });
          }
          
          newDrugsStateAfterProcessing[drugIndex] = updatedBatchData; // Replace with the new object

          transactionDetailsForLog.push({
            drugId: updatedBatchData.id, drugName: updatedBatchData.name, brandName: updatedBatchData.brandName,
            dosage: updatedBatchData.dosage, batchNumber: updatedBatchData.batchNumber, quantity: item.stripsAdded,
            previousStock: previousStock, newStock: updatedBatchData.stock,
          });
          restockedDrugsInfoForReturn.push({ 
            drugName: updatedBatchData.name, brandName: updatedBatchData.brandName, dosage: updatedBatchData.dosage, 
            batchNumber: updatedBatchData.batchNumber, quantity: item.stripsAdded 
          });
        }
      }
    });

    // Commit the final processed state
    setDrugs(newDrugsStateAfterProcessing);

    // Log the main restock transaction
    if (transactionDetailsForLog.length > 0) {
        addTransaction({
            type: 'restock',
            source: source,
            drugs: transactionDetailsForLog, // Use the locally built details
            notes: `Restocked from ${source}.`
        });
    }
    // Log any price update transactions
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
        getVillages
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
