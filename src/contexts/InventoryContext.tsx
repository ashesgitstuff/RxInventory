
"use client";

import type { ReactNode } from 'react';
import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import type { Drug, Transaction, TransactionDrugDetail, NewDrugDetails, EditDrugFormData, DrugRestockEntry } from '@/types';
import { DEFAULT_PURCHASE_PRICE, DEFAULT_DRUG_LOW_STOCK_THRESHOLD } from '@/types'; // INITIAL_DRUGS is no longer used directly for initialization

import { db } from '@/lib/firebase';
import {
  collection,
  onSnapshot,
  addDoc,
  doc,
  updateDoc,
  writeBatch,
  query,
  orderBy,
  serverTimestamp,
  Timestamp,
  deleteDoc, 
  getDoc,
  getDocs,
  setDoc,
  FieldValue
} from 'firebase/firestore';

interface InventoryContextType {
  drugs: Drug[];
  transactions: Transaction[];
  loading: boolean; // To indicate when data is being fetched
  dispenseDrugs: (patientDetails: { patientName: string; aadharLastFour: string; age: number; sex: 'Male' | 'Female' | 'Other' | ''; }, drugsToDispense: Array<{ drugId: string; stripsDispensed: number }>) => Promise<{ success: boolean; message?: string; dispensedDrugs: Array<{ drugName: string; quantity: number}> }>;
  restockDrugs: (source: string, drugsToRestock: Array<DrugRestockEntry>) => Promise<{ success: boolean; message?: string; restockedDrugs: Array<{ drugName: string; quantity: number}> }>;
  addNewDrug: (newDrugData: NewDrugDetails & { initialStock: number }, initialSource: string) => Promise<Drug | null>;
  updateDrugDetails: (drugId: string, data: EditDrugFormData) => Promise<{ success: boolean; message?: string; updatedDrug?: Drug }>;
  getDrugById: (drugId: string) => Drug | undefined; // This will now operate on the local state synced from Firestore
  getDrugByName: (name: string) => Drug | undefined; // This will now operate on the local state synced from Firestore
}

const InventoryContext = createContext<InventoryContextType | undefined>(undefined);

export const InventoryProvider = ({ children }: { children: ReactNode }) => {
  const [drugs, setDrugs] = useState<Drug[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);

  // Fetch drugs from Firestore
  useEffect(() => {
    setLoading(true);
    const q = query(collection(db, 'drugs'), orderBy('name'));
    const unsubscribe = onSnapshot(q, (querySnapshot) => {
      const drugsData: Drug[] = [];
      querySnapshot.forEach((doc) => {
        drugsData.push({ id: doc.id, ...doc.data() } as Drug);
      });
      setDrugs(drugsData);
      setLoading(false);
    }, (error) => {
      console.error("Error fetching drugs from Firestore:", error);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  // Fetch transactions from Firestore
  useEffect(() => {
    setLoading(true);
    const q = query(collection(db, 'transactions'), orderBy('timestamp', 'desc'));
    const unsubscribe = onSnapshot(q, (querySnapshot) => {
      const transactionsData: Transaction[] = [];
      querySnapshot.forEach((docSnapshot) => {
        const data = docSnapshot.data();
        // Convert Firestore Timestamp to ISO string
        const timestamp = data.timestamp instanceof Timestamp ? data.timestamp.toDate().toISOString() : new Date().toISOString();
        transactionsData.push({ 
          id: docSnapshot.id, 
          ...data,
          timestamp,
         } as Transaction);
      });
      setTransactions(transactionsData);
      setLoading(false);
    }, (error) => {
      console.error("Error fetching transactions from Firestore:", error);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);


  const addTransactionToFirestore = useCallback(async (transactionData: Omit<Transaction, 'id' | 'timestamp' > & { timestamp: FieldValue }) => {
    try {
      await addDoc(collection(db, 'transactions'), transactionData);
    } catch (error) {
      console.error("Error adding transaction to Firestore:", error);
    }
  }, []);
  
  const getDrugById = useCallback((drugId: string) => {
    return drugs.find(drug => drug.id === drugId);
  }, [drugs]);
  
  const getDrugByName = useCallback((name: string) => {
    return drugs.find(drug => drug.name.toLowerCase() === name.toLowerCase());
  }, [drugs]);

  const addNewDrug = async (newDrugData: NewDrugDetails & { initialStock: number }, initialSource: string): Promise<Drug | null> => {
    try {
      const newDrugRef = doc(collection(db, 'drugs'));
      const newDrug: Drug = {
        id: newDrugRef.id, // Use Firestore generated ID
        name: newDrugData.name,
        purchasePricePerStrip: newDrugData.purchasePricePerStrip || DEFAULT_PURCHASE_PRICE,
        stock: newDrugData.initialStock,
        lowStockThreshold: newDrugData.lowStockThreshold || DEFAULT_DRUG_LOW_STOCK_THRESHOLD,
        initialSource: initialSource,
      };
      await setDoc(newDrugRef, newDrug);
      // No need to call addTransaction here for drug creation itself, only for stock changes.
      return newDrug;
    } catch (error) {
      console.error("Error adding new drug to Firestore:", error);
      return null;
    }
  };

  const dispenseDrugs = async (
    patientDetails: { patientName: string; aadharLastFour: string; age: number; sex: 'Male' | 'Female' | 'Other' | ''; },
    drugsToDispense: Array<{ drugId: string; stripsDispensed: number }>
  ): Promise<{ success: boolean; message?: string; dispensedDrugs: Array<{drugName: string; quantity: number}> }> => {
    const batch = writeBatch(db);
    let allSuccessful = true;
    let errorMessage = '';
    const transactionDrugDetails: TransactionDrugDetail[] = [];
    const successfullyDispensedForToast: Array<{drugName: string; quantity: number}> = [];

    // Create a mutable copy of current drugs state for local checks
    const currentDrugsState = [...drugs];

    for (const item of drugsToDispense) {
      const drugIndex = currentDrugsState.findIndex(d => d.id === item.drugId);
      if (drugIndex === -1) {
        allSuccessful = false;
        errorMessage += `Drug with ID ${item.drugId} not found in local cache. `;
        continue;
      }
      
      const drug = currentDrugsState[drugIndex];
      if (drug.stock < item.stripsDispensed) {
        allSuccessful = false;
        errorMessage += `Not enough ${drug.name} in stock. Available: ${drug.stock}, Requested: ${item.stripsDispensed}. `;
        continue; 
      }

      const previousStock = drug.stock;
      const newStock = drug.stock - item.stripsDispensed;
      
      const drugRef = doc(db, 'drugs', drug.id);
      batch.update(drugRef, { stock: newStock });
      
      // Optimistically update local cache for subsequent checks in the same batch
      currentDrugsState[drugIndex] = { ...drug, stock: newStock };
      successfullyDispensedForToast.push({drugName: drug.name, quantity: item.stripsDispensed});

      transactionDrugDetails.push({
        drugId: drug.id,
        drugName: drug.name,
        quantity: -item.stripsDispensed,
        previousStock: previousStock,
        newStock: newStock,
      });
    }

    if (transactionDrugDetails.length > 0) { 
      try {
        await batch.commit();
        await addTransactionToFirestore({
          type: 'dispense',
          patientName: patientDetails.patientName,
          aadharLastFour: patientDetails.aadharLastFour,
          age: patientDetails.age,
          sex: patientDetails.sex,
          drugs: transactionDrugDetails,
          timestamp: serverTimestamp(),
        });
      } catch (error) {
        console.error("Error committing dispense batch to Firestore:", error);
        // Potentially revert optimistic updates or re-fetch if critical
        return { success: false, message: "Failed to save dispense to database. " + (error as Error).message, dispensedDrugs: [] };
      }
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
    const batch = writeBatch(db);
    const transactionDrugDetails: TransactionDrugDetail[] = [];
    const successfullyRestockedForToast: Array<{drugName: string; quantity: number}> = [];
    let requiresNewTransactionForPriceUpdate = false;
    const priceUpdateTransactionDetails: TransactionDrugDetail[] = []; // Not used for quantity, but for notes
    let priceUpdateNotes = "";

    for (const item of drugsToRestock) {
      let drugId = item.drugId;
      let drugName = '';
      let currentDrugRef;
      let existingDrugData: Drug | undefined;

      if (item.drugId === '--add-new--' && item.newDrugDetails) {
        currentDrugRef = doc(collection(db, 'drugs'));
        drugId = currentDrugRef.id;
        drugName = item.newDrugDetails.name;
        const newDrugForFirestore: Omit<Drug, 'id'> = {
          name: item.newDrugDetails.name,
          purchasePricePerStrip: item.newDrugDetails.purchasePricePerStrip ?? DEFAULT_PURCHASE_PRICE,
          stock: 0, // Will be updated by the restock quantity
          lowStockThreshold: item.newDrugDetails.lowStockThreshold ?? DEFAULT_DRUG_LOW_STOCK_THRESHOLD,
          initialSource: source, 
        };
        batch.set(currentDrugRef, newDrugForFirestore); // Set new drug data
        existingDrugData = { ...newDrugForFirestore, id: drugId, stock: 0 }; // for stock calculation
      } else {
        currentDrugRef = doc(db, 'drugs', item.drugId);
        // For existing drugs, we need to fetch them to get current stock and price
        const drugDoc = await getDoc(currentDrugRef);
        if (!drugDoc.exists()) {
          console.error(`Restock failed: Drug with ID ${item.drugId} not found.`);
          continue; 
        }
        existingDrugData = { id: drugDoc.id, ...drugDoc.data() } as Drug;
        drugName = existingDrugData.name;

        if (item.updatedPurchasePricePerStrip !== undefined && existingDrugData.purchasePricePerStrip !== item.updatedPurchasePricePerStrip) {
          const oldPrice = existingDrugData.purchasePricePerStrip;
          batch.update(currentDrugRef, { purchasePricePerStrip: item.updatedPurchasePricePerStrip });
          requiresNewTransactionForPriceUpdate = true;
          priceUpdateNotes += `Price for ${drugName} updated from INR ${oldPrice.toFixed(2)} to INR ${item.updatedPurchasePricePerStrip.toFixed(2)}. `;
          // Update local for transaction log
          existingDrugData.purchasePricePerStrip = item.updatedPurchasePricePerStrip; 
           await addTransactionToFirestore({ // Log price update separately
            type: 'update',
            drugs: [], 
            notes: `Purchase price updated for ${drugName} during restock from ${source}.`,
            updateDetails: {
              drugId: drugId,
              drugName: drugName,
              previousPrice: oldPrice,
              newPrice: item.updatedPurchasePricePerStrip,
            },
            timestamp: serverTimestamp()
          });
        }
      }
      
      if (!existingDrugData) continue; // Should not happen if logic is correct

      const previousStock = existingDrugData.stock;
      const newStock = previousStock + item.stripsAdded;
      batch.update(currentDrugRef, { stock: newStock });
      
      successfullyRestockedForToast.push({drugName: drugName, quantity: item.stripsAdded});
      
      transactionDrugDetails.push({
        drugId: drugId,
        drugName: drugName,
        quantity: item.stripsAdded,
        previousStock: previousStock,
        newStock: newStock,
      });
    }

    if (transactionDrugDetails.length > 0) {
      try {
        await batch.commit();
        await addTransactionToFirestore({
          type: 'restock',
          source: source,
          drugs: transactionDrugDetails,
          timestamp: serverTimestamp(),
        });
        return { success: true, restockedDrugs: successfullyRestockedForToast };
      } catch (error) {
         console.error("Error committing restock batch to Firestore:", error);
         return { success: false, message: "Failed to save restock to database. " + (error as Error).message, restockedDrugs: [] };
      }
    }
    return { success: false, message: "No drugs were restocked.", restockedDrugs: [] };
  };

  const updateDrugDetails = async (drugId: string, data: EditDrugFormData): Promise<{ success: boolean; message?: string; updatedDrug?: Drug }> => {
    const drugRef = doc(db, 'drugs', drugId);
    try {
      const drugSnap = await getDoc(drugRef);
      if (!drugSnap.exists()) {
        return { success: false, message: "Drug not found." };
      }
      const oldDrug = {id: drugSnap.id, ...drugSnap.data()} as Drug;

      if (data.name && data.name.toLowerCase() !== oldDrug.name.toLowerCase()) {
        // Check if new name conflicts with another existing drug
        const q = query(collection(db, 'drugs'));
        const querySnapshot = await getDocs(q);
        const existingDrugWithNewName = querySnapshot.docs
          .map(d => ({ id: d.id, ...d.data() } as Drug))
          .find(d => d.name.toLowerCase() === data.name!.toLowerCase() && d.id !== drugId);
        
        if (existingDrugWithNewName) { 
          return { success: false, message: `A drug named "${data.name}" already exists.` };
        }
      }
      
      const updates: Partial<Drug> = {};
      let detailsChanged = false;
      const transactionUpdateDetails: Transaction['updateDetails'] = {
        drugId: drugId,
        drugName: data.name ?? oldDrug.name,
      };

      if (data.name && data.name !== oldDrug.name) {
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
        await updateDoc(drugRef, updates);
      }
      
      const updatedDrugData = { ...oldDrug, ...updates };

      if (detailsChanged) { 
          await addTransactionToFirestore({
              type: 'update',
              drugs: [], 
              notes: `Drug details updated for ${oldDrug.name}.`,
              updateDetails: transactionUpdateDetails,
              timestamp: serverTimestamp(),
          });
      }

      return { success: true, updatedDrug: updatedDrugData };
    } catch (error) {
      console.error("Error updating drug details in Firestore:", error);
      return { success: false, message: "Failed to update drug details. " + (error as Error).message };
    }
  };

  return (
    <InventoryContext.Provider
      value={{
        drugs,
        transactions,
        loading,
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

