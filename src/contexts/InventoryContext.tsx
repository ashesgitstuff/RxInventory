
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
      // Grouping primarily by Generic Name and Dosage for the dashboard cards
      const groupKey = `${drug.name.toLowerCase()}-${(drug.dosage || '').toLowerCase()}`;
      
      let displayName = `${drug.name}`;
      if (drug.dosage) displayName += ` ${drug.dosage}`;

      if (!groups[groupKey]) {
        groups[groupKey] = {
          groupKey,
          displayName, // Simplified display name for the card title
          genericName: drug.name,
          brandName: drug.brandName, // Will show in popover if brands differ
          dosage: drug.dosage,
          totalStock: 0,
          // Use the threshold of the first batch encountered for this Generic Name/Dosage group.
          // This is an approximation for a "combined threshold".
          lowStockThreshold: drug.lowStockThreshold, 
          batches: [],
        };
      }
      groups[groupKey].totalStock += drug.stock;
      groups[groupKey].batches.push(drug);
      // Sort batches by expiry date (oldest first) for popover display
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
        // selectedDrugGroupKey is now "genericName-brandName-dosage" or "genericName--dosage"
        const [reqGenericName, reqBrandName, reqDosage] = request.selectedDrugGroupKey.split('-DELIMITER-');
        
        let stripsToDispense = request.stripsDispensed;
        if (stripsToDispense <= 0) {
            overallMessage += `Skipped ${reqGenericName} ${reqBrandName || ''} ${reqDosage || ''} due to zero quantity. `;
            continue;
        }

        // Find all batches matching the drug type (generic, brand, dosage)
        const matchingBatches = updatedDrugsState.filter(d =>
          d.name.toLowerCase() === reqGenericName.toLowerCase() &&
          (d.brandName || '').toLowerCase() === (reqBrandName || '').toLowerCase() && // Match brand exactly or if it's empty/null
          (d.dosage || '').toLowerCase() === (reqDosage || '').toLowerCase() && // Match dosage exactly or if it's empty/null
          d.stock > 0
        ).sort((a, b) => { // Sort by expiry date, oldest first
          const dateA = a.dateOfExpiry ? parseISO(a.dateOfExpiry) : new Date(8640000000000000); // Far future for undefined dates
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
          overallMessage += `Not enough stock for ${reqGenericName} ${reqBrandName || ''} ${reqDosage || ''}. Available: ${totalStockForDrugType}, Requested: ${stripsToDispense}. `;
          // Dispense what's available if desired, or fail the item. Current logic: fails item.
          stripsToDispense = totalStockForDrugType; // Or skip this item by 'continue;'
          if (stripsToDispense === 0) continue;
        }
        
        let dispensedThisItem = 0;
        for (const batch of matchingBatches) {
          if (stripsToDispense === 0) break;

          const batchIndexInUpdatedState = updatedDrugsState.findIndex(d => d.id === batch.id);
          // This check might be redundant if updatedDrugsState is correctly managed, but safe.
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
            quantity: -dispensableFromThisBatch, // Negative as it's outgoing
            previousStock: originalStock,
            newStock: currentBatchInState.stock,
          });
        }
        
        if (dispensedThisItem > 0) {
           successfullyDispensedForToast.push({ 
             drugName: reqGenericName, 
             brandName: reqBrandName || undefined, 
             dosage: reqDosage || undefined, 
             batchNumber: 'Multiple/Auto', // Since specific batch isn't user-selected
             quantity: dispensedThisItem 
           });
        } else if (stripsToDispense > 0 && request.stripsDispensed > 0) { // If still couldn't dispense anything for this item
            overallSuccess = false; // Ensure overallSuccess reflects this if it wasn't already false
            if (!overallMessage.includes(`Failed to dispense requested quantity for ${reqGenericName}`)) {
                 overallMessage += `Failed to dispense full quantity for ${reqGenericName} ${reqBrandName || ''} ${reqDosage || ''}. `;
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
        // If loop completed but no drugs were actually processed for dispense, and success is false.
        overallMessage = "No drugs were dispensed. Check stock or request details."
    }


    return { 
        success: overallSuccess, 
        message: overallMessage.trim() || (overallSuccess ? "Dispense successful." : "Dispense failed or partially completed."),
        dispensedDrugsInfo: successfullyDispensedForToast 
    };
  };


  const restockDrugs = async (source: string, drugsToRestock: Array<DrugRestockEntry>): Promise<{ success: boolean; message?: string; restockedDrugs: Array<{ drugName: string; brandName?: string; dosage?: string; batchNumber?: string; quantity: number }> }> => {
    const transactionDrugDetails: TransactionDrugDetail[] = [];
    const restockedDrugsInfo: Array<{ drugName: string; brandName?: string; dosage?: string; batchNumber?: string; quantity: number }> = [];

    setDrugs(prevDrugs => {
      const updatedDrugs = [...prevDrugs];
      drugsToRestock.forEach(item => {
        if (item.drugId === '--add-new--' && item.newDrugDetails) {
          const nd = item.newDrugDetails;
          // Check for existing batch with same identifiers (generic, brand, dosage, batch no.)
          const existingBatch = updatedDrugs.find(d =>
            d.name.toLowerCase() === nd.name.toLowerCase() &&
            (d.brandName || '').toLowerCase() === (nd.brandName || '').toLowerCase() &&
            (d.dosage || '').toLowerCase() === (nd.dosage || '').toLowerCase() &&
            (d.batchNumber || '').toLowerCase() === (nd.batchNumber || '').toLowerCase()
          );

          if (existingBatch) {
            // This case should ideally be caught by form validation, but double-check here.
            // Skip or update existing? For now, we assume form validation prevents this.
            // If it can happen, decide: add to existing, or error out.
            // For now, let's assume unique new batches are being added.
            console.warn(`Attempted to add a new batch that already exists: ${nd.name} ${nd.batchNumber}`);
            return; // Or throw error / return specific failure message
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
          updatedDrugs.push(newDrugBatch);
          transactionDrugDetails.push({
            drugId: newDrugBatch.id,
            drugName: newDrugBatch.name,
            brandName: newDrugBatch.brandName,
            dosage: newDrugBatch.dosage,
            batchNumber: newDrugBatch.batchNumber,
            quantity: item.stripsAdded,
            previousStock: 0,
            newStock: item.stripsAdded,
          });
          restockedDrugsInfo.push({ drugName: newDrugBatch.name, brandName: newDrugBatch.brandName, dosage: newDrugBatch.dosage, batchNumber: newDrugBatch.batchNumber, quantity: item.stripsAdded });
        } else {
          const drugIndex = updatedDrugs.findIndex(d => d.id === item.drugId);
          if (drugIndex !== -1) {
            const drugToUpdate = updatedDrugs[drugIndex];
            const previousStock = drugToUpdate.stock;
            drugToUpdate.stock += item.stripsAdded;
            
            let priceUpdateNote = '';
            if (item.updatedPurchasePricePerStrip !== undefined && item.updatedPurchasePricePerStrip !== drugToUpdate.purchasePricePerStrip) {
                const oldPrice = drugToUpdate.purchasePricePerStrip;
                drugToUpdate.purchasePricePerStrip = item.updatedPurchasePricePerStrip;
                priceUpdateNote = ` Price updated: INR ${oldPrice.toFixed(2)} -> INR ${item.updatedPurchasePricePerStrip.toFixed(2)}.`;

                // Log a separate 'update' transaction for price change for clarity if desired
                 addTransaction({
                    type: 'update',
                    drugs: [], // Not strictly needed for this specific update log, or could be minimal
                    notes: `Purchase price updated for ${drugToUpdate.brandName || drugToUpdate.name} ${drugToUpdate.dosage || ''} (Batch: ${drugToUpdate.batchNumber}) to INR ${item.updatedPurchasePricePerStrip.toFixed(2)}.`,
                    updateDetails: {
                        drugId: drugToUpdate.id,
                        drugName: drugToUpdate.name,
                        previousPrice: oldPrice,
                        newPrice: item.updatedPurchasePricePerStrip,
                        // Include other identifiers if they are helpful
                        newBrandName: drugToUpdate.brandName,
                        newDosage: drugToUpdate.dosage,
                        newBatchNumber: drugToUpdate.batchNumber
                    }
                });
            }

            transactionDrugDetails.push({
              drugId: drugToUpdate.id,
              drugName: drugToUpdate.name,
              brandName: drugToUpdate.brandName,
              dosage: drugToUpdate.dosage,
              batchNumber: drugToUpdate.batchNumber,
              quantity: item.stripsAdded,
              previousStock: previousStock,
              newStock: drugToUpdate.stock,
            });
            restockedDrugsInfo.push({ drugName: drugToUpdate.name, brandName: drugToUpdate.brandName, dosage: drugToUpdate.dosage, batchNumber: drugToUpdate.batchNumber, quantity: item.stripsAdded });
          }
        }
      });
      return updatedDrugs;
    });

    if (transactionDrugDetails.length > 0) {
        addTransaction({
            type: 'restock',
            source: source,
            drugs: transactionDrugDetails,
            notes: `Restocked from ${source}.`
        });
    }
    return { success: true, message: "Stock updated successfully.", restockedDrugs: restockedDrugsInfo };
  };


  const updateDrugDetails = async (drugId: string, data: EditDrugFormData): Promise<{ success: boolean; message?: string; updatedDrug?: Drug }> => {
    let updatedDrugInstance: Drug | undefined = undefined;
    let previousDetails: Partial<Drug> = {};

    setDrugs(prevDrugs => {
      const updatedDrugs = prevDrugs.map(drug => {
        if (drug.id === drugId) {
          previousDetails = { ...drug }; // Capture previous state for logging

          updatedDrugInstance = {
            ...drug, // Keep existing stock, initialSource (unless source becomes editable)
            name: data.name,
            brandName: data.brandName,
            dosage: data.dosage,
            batchNumber: data.batchNumber,
            dateOfManufacture: data.dateOfManufacture,
            dateOfExpiry: data.dateOfExpiry,
            purchasePricePerStrip: data.purchasePricePerStrip,
            lowStockThreshold: data.lowStockThreshold,
            // If initialSource is editable, add: initialSource: data.initialSource,
          };
          return updatedDrugInstance;
        }
        return drug;
      });
      return updatedDrugs;
    });

    if (updatedDrugInstance && previousDetails.id) { // Ensure previousDetails were captured
        const ud = updatedDrugInstance;
        const pd = previousDetails;
        addTransaction({
            type: 'update',
            drugs: [], // No stock change in this type of transaction, so empty or minimal drug list.
            notes: `Details updated for batch: ${ud.brandName || ud.name} ${ud.dosage || ''} (Batch: ${ud.batchNumber}).`,
            updateDetails: {
                drugId: ud.id,
                drugName: ud.name, // Current generic name
                previousName: pd.name !== ud.name ? pd.name : undefined,
                newName: pd.name !== ud.name ? ud.name : undefined,
                previousBrandName: pd.brandName !== ud.brandName ? pd.brandName : undefined,
                newBrandName: pd.brandName !== ud.brandName ? ud.brandName : undefined,
                previousDosage: pd.dosage !== ud.dosage ? pd.dosage : undefined,
                newDosage: pd.dosage !== ud.dosage ? ud.dosage : undefined,
                previousBatchNumber: pd.batchNumber !== ud.batchNumber ? pd.batchNumber : undefined,
                newBatchNumber: pd.batchNumber !== ud.batchNumber ? ud.batchNumber : undefined,
                previousDateOfManufacture: pd.dateOfManufacture !== ud.dateOfManufacture ? pd.dateOfManufacture : undefined,
                newDateOfManufacture: pd.dateOfManufacture !== ud.dateOfManufacture ? pd.dateOfManufacture : undefined,
                previousDateOfExpiry: pd.dateOfExpiry !== ud.dateOfExpiry ? pd.dateOfExpiry : undefined,
                newDateOfExpiry: pd.dateOfExpiry !== ud.dateOfExpiry ? pd.dateOfExpiry : undefined,
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

    