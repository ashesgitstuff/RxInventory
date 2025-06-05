
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
  deleteDrugBatch: (drugId: string) => Promise<{ success: boolean; message?: string; deletedDrugName?: string }>;
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
    const successfullyDispensedForToast: Array<{ drugName: string; brandName?: string; dosage?: string; batchNumber?: string; quantity: number }> = [];
    const transactionDrugDetailsForLog: TransactionDrugDetail[] = [];
    
    // Create a deep copy of the current drugs state to work with
    const currentDrugsStateCopy = drugs.map(d => ({ ...d }));

    for (const request of drugsToDispenseRequest) {
      const [reqGenericName, reqBrandName, reqDosage] = request.selectedDrugGroupKey.split('-DELIMITER-');
      
      let stripsToDispense = request.stripsDispensed;
      if (stripsToDispense <= 0) {
          overallMessage += `Skipped ${reqGenericName || 'Unknown Drug'} ${reqBrandName || ''} ${reqDosage || ''} due to zero quantity. `;
          continue;
      }

      const matchingBatches = currentDrugsStateCopy.filter(d => 
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
        overallMessage += `No stock found for ${reqGenericName || 'Unknown Drug'} ${reqBrandName || ''} ${reqDosage || ''}. `;
        continue;
      }

      const totalStockForDrugType = matchingBatches.reduce((sum, batch) => sum + batch.stock, 0);
      if (totalStockForDrugType < stripsToDispense) {
        overallSuccess = false;
        overallMessage += `Not enough stock for ${reqGenericName || 'Unknown Drug'} ${reqBrandName || ''} ${reqDosage || ''}. Available: ${totalStockForDrugType}, Requested: ${stripsToDispense}. Dispensing available. `;
        stripsToDispense = totalStockForDrugType;
        if (stripsToDispense === 0) continue;
      }
      
      let dispensedThisItem = 0;
      for (const batch of matchingBatches) {
        if (stripsToDispense === 0) break;

        const batchInCopy = currentDrugsStateCopy.find(d => d.id === batch.id);
        if (!batchInCopy) {
             console.error("Critical error: Batch from filtered list not found in currentDrugsStateCopy.");
             overallSuccess = false;
             overallMessage += `Critical error processing ${reqGenericName}. `;
             continue;
        }

        const originalStock = batchInCopy.stock; 
        const dispensableFromThisBatch = Math.min(stripsToDispense, batchInCopy.stock);
        
        batchInCopy.stock -= dispensableFromThisBatch;
        stripsToDispense -= dispensableFromThisBatch;
        dispensedThisItem += dispensableFromThisBatch;

        transactionDrugDetailsForLog.push({
          drugId: batchInCopy.id,
          drugName: batchInCopy.name,
          brandName: batchInCopy.brandName,
          dosage: batchInCopy.dosage,
          batchNumber: batchInCopy.batchNumber,
          quantity: -dispensableFromThisBatch,
          previousStock: originalStock,
          newStock: batchInCopy.stock,
        });
        successfullyDispensedForToast.push({ 
           drugName: batchInCopy.name, 
           brandName: batchInCopy.brandName || undefined, 
           dosage: batchInCopy.dosage || undefined, 
           batchNumber: batchInCopy.batchNumber, 
           quantity: dispensableFromThisBatch 
        });
      }
      
      if (stripsToDispense > 0 && request.stripsDispensed > 0 && dispensedThisItem < request.stripsDispensed) {
          overallSuccess = false;
          if (!overallMessage.includes(`Partially dispensed for ${reqGenericName}`)) {
               overallMessage += `Partially dispensed for ${reqGenericName || 'Unknown Drug'} ${reqBrandName || ''} ${reqDosage || ''}. `;
          }
      }
    }

    // If any drugs were actually processed (stock changed), update the state and log transaction
    if (transactionDrugDetailsForLog.length > 0) {
        setDrugs(currentDrugsStateCopy); // Set the modified copy as the new state
        addTransaction({
            type: 'dispense',
            patientName: patientDetails.patientName,
            aadharLastFour: patientDetails.aadharLastFour,
            age: patientDetails.age,
            sex: patientDetails.sex,
            villageName: patientDetails.villageName,
            drugs: transactionDrugDetailsForLog,
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
    const newDrugsFromRestock: Drug[] = [];
    const updatedExistingDrugsMap = new Map<string, Drug>(); // To efficiently track updates

    const transactionDetailsForMainLog: TransactionDrugDetail[] = [];
    const restockedDrugsInfoForReturn: Array<{ drugName: string; brandName?: string; dosage?: string; batchNumber?: string; quantity: number }> = [];
    const priceUpdateTransactionsToLog: Array<Omit<Transaction, 'id' | 'timestamp'>> = [];

    // Create a base state from current drugs to apply modifications
    let nextDrugsState = drugs.map(d => ({...d}));

    drugsToRestockItems.forEach(item => {
      if (item.drugId === '--add-new--' && item.newDrugDetails) {
        const nd = item.newDrugDetails;
        const newDrugBatch: Drug = {
          id: generateId('drug'),
          name: nd.name, brandName: nd.brandName, dosage: nd.dosage, batchNumber: nd.batchNumber,
          dateOfManufacture: nd.dateOfManufacture, dateOfExpiry: nd.dateOfExpiry,
          purchasePricePerStrip: nd.purchasePricePerStrip ?? DEFAULT_PURCHASE_PRICE,
          stock: item.stripsAdded,
          lowStockThreshold: nd.lowStockThreshold ?? DEFAULT_DRUG_LOW_STOCK_THRESHOLD,
          initialSource: source,
        };
        newDrugsFromRestock.push(newDrugBatch); // Will be added to nextDrugsState later
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
        const drugIndex = nextDrugsState.findIndex(d => d.id === item.drugId);
        if (drugIndex !== -1) {
          const drugToUpdate = {...nextDrugsState[drugIndex]}; // Create a copy to modify
          const previousStock = drugToUpdate.stock;
          
          drugToUpdate.stock += item.stripsAdded;

          if (item.updatedPurchasePricePerStrip !== undefined && item.updatedPurchasePricePerStrip !== drugToUpdate.purchasePricePerStrip) {
            const oldPrice = drugToUpdate.purchasePricePerStrip;
            drugToUpdate.purchasePricePerStrip = item.updatedPurchasePricePerStrip;
            priceUpdateTransactionsToLog.push({
              type: 'update', drugs: [], 
              notes: `Purchase price updated for ${drugToUpdate.brandName || drugToUpdate.name} ${drugToUpdate.dosage || ''} (Batch: ${drugToUpdate.batchNumber}) to INR ${item.updatedPurchasePricePerStrip.toFixed(2)}.`,
              updateDetails: {
                drugId: drugToUpdate.id, drugName: drugToUpdate.name, previousPrice: oldPrice, newPrice: item.updatedPurchasePricePerStrip,
                newBrandName: drugToUpdate.brandName, newDosage: drugToUpdate.dosage, newBatchNumber: drugToUpdate.batchNumber,
              }
            });
          }
          nextDrugsState[drugIndex] = drugToUpdate; // Replace the old object with the updated one
          updatedExistingDrugsMap.set(drugToUpdate.id, drugToUpdate); // Track this update

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

    // Add all newly created drugs to the state
    if (newDrugsFromRestock.length > 0) {
      nextDrugsState = [...nextDrugsState, ...newDrugsFromRestock];
    }
    
    setDrugs(nextDrugsState);

    if (transactionDetailsForMainLog.length > 0) {
        addTransaction({
            type: 'restock', source: source, drugs: transactionDetailsForMainLog, 
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

  const deleteDrugBatch = async (drugId: string): Promise<{ success: boolean; message?: string; deletedDrugName?: string }> => {
    const drugToDelete = drugs.find(d => d.id === drugId);
    if (!drugToDelete) {
      return { success: false, message: "Drug batch not found." };
    }

    const deletedDrugName = `${drugToDelete.name} ${drugToDelete.brandName || ''} ${drugToDelete.dosage || ''} (Batch: ${drugToDelete.batchNumber || 'N/A'})`;
    
    setDrugs(prevDrugs => prevDrugs.filter(d => d.id !== drugId));

    let expiryDateFormatted = 'N/A';
    if (drugToDelete.dateOfExpiry) {
        try {
            expiryDateFormatted = format(parseISO(drugToDelete.dateOfExpiry), 'PP');
        } catch (e) {
            expiryDateFormatted = drugToDelete.dateOfExpiry; // fallback to raw string if parse fails
        }
    }

    addTransaction({
      type: 'update',
      drugs: [], 
      notes: `DELETED BATCH: ${deletedDrugName}. Stock at deletion: ${drugToDelete.stock}. Price/strip: INR ${drugToDelete.purchasePricePerStrip.toFixed(2)}. Exp: ${expiryDateFormatted}.`,
    });

    return { success: true, message: `Drug batch "${deletedDrugName}" deleted successfully.`, deletedDrugName };
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
        deleteDrugBatch,
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

