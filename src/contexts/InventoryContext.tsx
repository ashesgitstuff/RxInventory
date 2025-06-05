
"use client";

import type { ReactNode } from 'react';
import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import type { Drug, Transaction, TransactionDrugDetail, NewDrugDetails, EditDrugFormData, DrugRestockEntry, Village, DispenseFormData } from '@/types';
import { DEFAULT_PURCHASE_PRICE, DEFAULT_DRUG_LOW_STOCK_THRESHOLD } from '@/types';

const DRUGS_STORAGE_KEY = 'chotusdrugbus_drugs_v3'; // Incremented version for batch tracking
const TRANSACTIONS_STORAGE_KEY = 'chotusdrugbus_transactions_v3'; // Incremented
const VILLAGES_STORAGE_KEY = 'chotusdrugbus_villages';

const generateId = (prefix: string) => `${prefix}-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;

interface InventoryContextType {
  drugs: Drug[];
  transactions: Transaction[];
  villages: Village[]; 
  loading: boolean;
  addVillage: (name: string) => Promise<{ success: boolean; message?: string; village?: Village }>; 
  dispenseDrugs: (patientDetails: Omit<DispenseFormData, 'drugsToDispense'>, drugsToDispense: Array<{ drugId: string; stripsDispensed: number }>) => Promise<{ success: boolean; message?: string; dispensedDrugs: Array<{ drugName: string; brandName?: string; dosage?: string; batchNumber?:string; quantity: number}> }>;
  restockDrugs: (source: string, drugsToRestock: Array<DrugRestockEntry>) => Promise<{ success: boolean; message?: string; restockedDrugs: Array<{ drugName: string; brandName?: string; dosage?: string; batchNumber?: string; quantity: number}> }>;
  updateDrugDetails: (drugId: string, data: EditDrugFormData) => Promise<{ success: boolean; message?: string; updatedDrug?: Drug }>;
  getDrugById: (drugId: string) => Drug | undefined;
  // getDrugByName is less relevant now, as we deal with batches. UI will filter/group.
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
    setVillages(prevVillages => [...prevVillages, newVillage].sort((a,b) => a.name.localeCompare(b.name)));
    return { success: true, village: newVillage, message: `Village "${newVillage.name}" added.` };
  };

  const dispenseDrugs = async (
    patientDetails: Omit<DispenseFormData, 'drugsToDispense'>,
    drugsToDispense: Array<{ drugId: string; stripsDispensed: number }>
  ): Promise<{ success: boolean; message?: string; dispensedDrugs: Array<{drugName: string; brandName?: string; dosage?: string; batchNumber?:string; quantity: number}> }> => {
    let allSuccessful = true;
    let errorMessage = '';
    const transactionDrugDetails: TransactionDrugDetail[] = [];
    const successfullyDispensedForToast: Array<{drugName: string; brandName?: string; dosage?: string; batchNumber?:string; quantity: number}> = [];
    
    setDrugs(currentDrugs => {
      const updatedDrugs = [...currentDrugs]; 

      for (const item of drugsToDispense) {
        const drugIndex = updatedDrugs.findIndex(d => d.id === item.drugId); // drugId is for a specific batch
        if (drugIndex === -1) {
          allSuccessful = false;
          errorMessage += `Drug batch with ID ${item.drugId} not found. `;
          continue;
        }
        
        const drugBatch = updatedDrugs[drugIndex];
        if (drugBatch.stock < item.stripsDispensed) {
          allSuccessful = false;
          errorMessage += `Not enough ${drugBatch.name} (${drugBatch.brandName || 'N/A'}) Batch: ${drugBatch.batchNumber} in stock. Available: ${drugBatch.stock}, Requested: ${item.stripsDispensed}. `;
          continue; 
        }

        const previousStock = drugBatch.stock;
        const newStock = drugBatch.stock - item.stripsDispensed;
        
        updatedDrugs[drugIndex] = { ...drugBatch, stock: newStock };
        successfullyDispensedForToast.push({
            drugName: drugBatch.name, 
            brandName: drugBatch.brandName, 
            dosage: drugBatch.dosage,
            batchNumber: drugBatch.batchNumber,
            quantity: item.stripsDispensed
        });

        transactionDrugDetails.push({
          drugId: drugBatch.id,
          drugName: drugBatch.name,
          brandName: drugBatch.brandName,
          dosage: drugBatch.dosage,
          batchNumber: drugBatch.batchNumber,
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
  ): Promise<{ success: boolean; message?: string; restockedDrugs: Array<{ drugName: string; brandName?: string; dosage?: string; batchNumber?: string; quantity: number}> }> => {
    const transactionDrugDetails: TransactionDrugDetail[] = [];
    const successfullyRestockedForToast: Array<{drugName: string; brandName?: string; dosage?: string; batchNumber?: string; quantity: number}> = [];
    const priceUpdateTransactions: Omit<Transaction, 'id' | 'timestamp'>[] = [];

    setDrugs(currentDrugs => {
      let updatedDrugs = [...currentDrugs];

      for (const item of drugsToRestock) {
        if (item.drugId === '--add-new--' && item.newDrugDetails) {
          // Adding a new batch/drug
          const nd = item.newDrugDetails;
          const newBatchId = generateId('drug');

          // Check if a batch with the exact same generic name, brand, dosage, AND batch number already exists
          const existingExactBatch = updatedDrugs.find(d => 
            d.name.toLowerCase() === nd.name.toLowerCase() &&
            (d.brandName || '').toLowerCase() === (nd.brandName || '').toLowerCase() &&
            (d.dosage || '').toLowerCase() === (nd.dosage || '').toLowerCase() &&
            (d.batchNumber || '').toLowerCase() === (nd.batchNumber || '').toLowerCase()
          );

          if (existingExactBatch) {
            // Instead of error, add to existing batch stock and log appropriately
            const batchIndex = updatedDrugs.findIndex(d => d.id === existingExactBatch.id);
            const currentBatch = updatedDrugs[batchIndex];
            const previousStock = currentBatch.stock;
            currentBatch.stock += item.stripsAdded;
            // Optionally update price if different
            if (nd.purchasePricePerStrip !== currentBatch.purchasePricePerStrip) {
                // Log price update separately or as part of restock note
                currentBatch.purchasePricePerStrip = nd.purchasePricePerStrip;
            }
            updatedDrugs[batchIndex] = currentBatch;

            successfullyRestockedForToast.push({
                drugName: currentBatch.name, 
                brandName: currentBatch.brandName, 
                dosage: currentBatch.dosage,
                batchNumber: currentBatch.batchNumber,
                quantity: item.stripsAdded
            });
            transactionDrugDetails.push({
                drugId: currentBatch.id,
                drugName: currentBatch.name,
                brandName: currentBatch.brandName,
                dosage: currentBatch.dosage,
                batchNumber: currentBatch.batchNumber,
                quantity: item.stripsAdded,
                previousStock: previousStock,
                newStock: currentBatch.stock,
            });
            continue; // Skip creating a new batch entry
          }

          const newDrugBatch: Drug = {
            id: newBatchId,
            name: nd.name,
            brandName: nd.brandName,
            dosage: nd.dosage,
            batchNumber: nd.batchNumber,
            dateOfManufacture: nd.dateOfManufacture,
            dateOfExpiry: nd.dateOfExpiry,
            purchasePricePerStrip: nd.purchasePricePerStrip,
            stock: item.stripsAdded, // Initial stock for this new batch
            lowStockThreshold: nd.lowStockThreshold,
            initialSource: source,
          };
          updatedDrugs.push(newDrugBatch);
          
          successfullyRestockedForToast.push({
            drugName: newDrugBatch.name, 
            brandName: newDrugBatch.brandName, 
            dosage: newDrugBatch.dosage,
            batchNumber: newDrugBatch.batchNumber,
            quantity: item.stripsAdded
          });
          transactionDrugDetails.push({
            drugId: newDrugBatch.id,
            drugName: newDrugBatch.name,
            brandName: newDrugBatch.brandName,
            dosage: newDrugBatch.dosage,
            batchNumber: newDrugBatch.batchNumber,
            quantity: item.stripsAdded,
            previousStock: 0, // New batch starts with 0 previous stock
            newStock: newDrugBatch.stock,
          });

        } else {
          // Adding stock to an existing batch
          const existingBatchIndex = updatedDrugs.findIndex(d => d.id === item.drugId);
          if (existingBatchIndex === -1) {
            console.error(`Restock failed: Drug batch with ID ${item.drugId} not found.`);
            continue; 
          }
          const currentBatch = updatedDrugs[existingBatchIndex];
          const previousStock = currentBatch.stock;
          const oldPrice = currentBatch.purchasePricePerStrip;

          currentBatch.stock += item.stripsAdded;
          if (item.updatedPurchasePricePerStrip !== undefined && currentBatch.purchasePricePerStrip !== item.updatedPurchasePricePerStrip) {
            currentBatch.purchasePricePerStrip = item.updatedPurchasePricePerStrip;
             priceUpdateTransactions.push({
                type: 'update',
                drugs: [], // No direct drug quantity change, it's a detail update
                notes: `Purchase price updated for ${currentBatch.name} (Brand: ${currentBatch.brandName}, Batch: ${currentBatch.batchNumber}) during restock from ${source}.`,
                updateDetails: {
                  drugId: currentBatch.id,
                  drugName: currentBatch.name,
                  previousPrice: oldPrice,
                  newPrice: item.updatedPurchasePricePerStrip,
                },
                timestamp: new Date().toISOString() 
             });
          }
          updatedDrugs[existingBatchIndex] = currentBatch;

          successfullyRestockedForToast.push({
            drugName: currentBatch.name, 
            brandName: currentBatch.brandName, 
            dosage: currentBatch.dosage,
            batchNumber: currentBatch.batchNumber,
            quantity: item.stripsAdded
          });
          transactionDrugDetails.push({
            drugId: currentBatch.id,
            drugName: currentBatch.name,
            brandName: currentBatch.brandName,
            dosage: currentBatch.dosage,
            batchNumber: currentBatch.batchNumber,
            quantity: item.stripsAdded,
            previousStock: previousStock,
            newStock: currentBatch.stock,
          });
        }
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

    if (transactionDrugDetails.length === 0 && priceUpdateTransactions.length === 0) {
        return { success: false, message: "No drugs were restocked or updated.", restockedDrugs: [] };
    }
    return { success: true, restockedDrugs: successfullyRestockedForToast };
  };

  const updateDrugDetails = async (drugId: string, data: EditDrugFormData): Promise<{ success: boolean; message?: string; updatedDrug?: Drug }> => {
    let updatedDrugObj: Drug | undefined = undefined;
    let detailsChanged = false;
    let transactionUpdateDetails: Transaction['updateDetails'] = { drugId: drugId, drugName: data.name }; 

    setDrugs(currentDrugs => {
        const drugIndex = currentDrugs.findIndex(d => d.id === drugId);
        if (drugIndex === -1) {
            return currentDrugs; 
        }
        const oldDrugBatch = currentDrugs[drugIndex];
        
        // Check for duplicate: generic name + brand name + dosage + batch number MUST be unique
        if (data.name.toLowerCase() !== oldDrugBatch.name.toLowerCase() ||
            (data.brandName || '').toLowerCase() !== (oldDrugBatch.brandName || '').toLowerCase() ||
            (data.dosage || '').toLowerCase() !== (oldDrugBatch.dosage || '').toLowerCase() ||
            (data.batchNumber || '').toLowerCase() !== (oldDrugBatch.batchNumber || '').toLowerCase() ) {
            
            const conflictingBatch = currentDrugs.find(d => 
                d.id !== drugId &&
                d.name.toLowerCase() === data.name.toLowerCase() &&
                (d.brandName || '').toLowerCase() === (data.brandName || '').toLowerCase() &&
                (d.dosage || '').toLowerCase() === (data.dosage || '').toLowerCase() &&
                (d.batchNumber || '').toLowerCase() === (data.batchNumber || '').toLowerCase()
            );
            if (conflictingBatch) {
                console.error("A drug batch with the same generic name, brand name, dosage, and batch number already exists.");
                // This state will be temporary as the promise will reject or message will be shown by toast
                return currentDrugs; 
            }
        }


        const updates: Partial<Drug> = {};
        if (data.name !== oldDrugBatch.name) {
            updates.name = data.name; transactionUpdateDetails.previousName = oldDrugBatch.name; transactionUpdateDetails.newName = data.name; detailsChanged = true;
        }
        if (data.brandName !== oldDrugBatch.brandName) {
            updates.brandName = data.brandName; transactionUpdateDetails.previousBrandName = oldDrugBatch.brandName; transactionUpdateDetails.newBrandName = data.brandName; detailsChanged = true;
        }
        if (data.dosage !== oldDrugBatch.dosage) {
            updates.dosage = data.dosage; transactionUpdateDetails.previousDosage = oldDrugBatch.dosage; transactionUpdateDetails.newDosage = data.dosage; detailsChanged = true;
        }
        if (data.batchNumber !== oldDrugBatch.batchNumber) {
            updates.batchNumber = data.batchNumber; transactionUpdateDetails.previousBatchNumber = oldDrugBatch.batchNumber; transactionUpdateDetails.newBatchNumber = data.batchNumber; detailsChanged = true;
        }
        if (data.dateOfManufacture !== oldDrugBatch.dateOfManufacture) {
            updates.dateOfManufacture = data.dateOfManufacture; transactionUpdateDetails.previousDateOfManufacture = oldDrugBatch.dateOfManufacture; transactionUpdateDetails.newDateOfManufacture = data.dateOfManufacture; detailsChanged = true;
        }
        if (data.dateOfExpiry !== oldDrugBatch.dateOfExpiry) {
            updates.dateOfExpiry = data.dateOfExpiry; transactionUpdateDetails.previousDateOfExpiry = oldDrugBatch.dateOfExpiry; transactionUpdateDetails.newDateOfExpiry = data.dateOfExpiry; detailsChanged = true;
        }
        if (data.purchasePricePerStrip !== oldDrugBatch.purchasePricePerStrip) {
            updates.purchasePricePerStrip = data.purchasePricePerStrip; transactionUpdateDetails.previousPrice = oldDrugBatch.purchasePricePerStrip; transactionUpdateDetails.newPrice = data.purchasePricePerStrip; detailsChanged = true;
        }
        if (data.lowStockThreshold !== oldDrugBatch.lowStockThreshold) {
            updates.lowStockThreshold = data.lowStockThreshold; transactionUpdateDetails.previousThreshold = oldDrugBatch.lowStockThreshold; transactionUpdateDetails.newThreshold = data.lowStockThreshold; detailsChanged = true;
        }
        if (data.initialSource !== oldDrugBatch.initialSource) {
            updates.initialSource = data.initialSource; transactionUpdateDetails.previousSource = oldDrugBatch.initialSource; transactionUpdateDetails.newSource = data.initialSource; detailsChanged = true;
        }
        
        transactionUpdateDetails.drugName = updates.name || oldDrugBatch.name; // ensure drugName in TX is current

        if (Object.keys(updates).length > 0) {
            detailsChanged = true;
            const newDrugsArray = [...currentDrugs];
            updatedDrugObj = { ...oldDrugBatch, ...updates };
            newDrugsArray[drugIndex] = updatedDrugObj;
            return newDrugsArray;
        }
        updatedDrugObj = oldDrugBatch; 
        return currentDrugs;
    });
    
    // Re-check for conflict after attempting update, in case setDrugs didn't bail early
    const finalDrugsState = drugs; // get current state after potential update
     const conflictingBatchAfterUpdate = finalDrugsState.find(d => 
        d.id !== drugId &&
        d.name.toLowerCase() === data.name.toLowerCase() &&
        (d.brandName || '').toLowerCase() === (data.brandName || '').toLowerCase() &&
        (d.dosage || '').toLowerCase() === (data.dosage || '').toLowerCase() &&
        (d.batchNumber || '').toLowerCase() === (data.batchNumber || '').toLowerCase()
    );

    if (conflictingBatchAfterUpdate && detailsChanged) { // only if an actual change caused the conflict
         // Revert the change if a conflict is now detected (this is tricky with async state)
         // For now, we'll rely on the toast message and the user to correct.
         // A better solution would be a synchronous validation before setDrugs.
        return { success: false, message: "Update failed: A drug batch with the same identifying details (generic name, brand, dosage, batch no.) already exists." };
    }


    if (detailsChanged && updatedDrugObj) { 
        addTransaction({
            type: 'update',
            drugs: [], 
            notes: `Details updated for batch: ${oldDrugBatch.name} (Batch: ${oldDrugBatch.batchNumber}) -> ${updatedDrugObj.name} (Batch: ${updatedDrugObj.batchNumber}).`,
            updateDetails: transactionUpdateDetails,
            timestamp: new Date().toISOString(),
        });
        return { success: true, updatedDrug: updatedDrugObj };
    } else if (updatedDrugObj && !detailsChanged) { 
        return { success: true, updatedDrug: updatedDrugObj, message: "No changes detected." }; 
    }
    return { success: false, message: "Failed to apply updates or drug not found." };
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
        updateDrugDetails,
        getDrugById,
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
