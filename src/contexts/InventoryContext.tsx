"use client";

import type { ReactNode } from 'react';
import React, { createContext, useContext, useState, useEffect } from 'react';
import type { Drug } from '@/types';
import { INITIAL_DRUGS, DEFAULT_LOW_STOCK_THRESHOLD } from '@/types';

interface InventoryContextType {
  drugs: Drug[];
  lowStockThreshold: number;
  dispenseDrug: (drugId: string, strips: number) => void;
  restockDrug: (drugId: string, strips: number) => void;
  updateLowStockThreshold: (newThreshold: number) => void;
  getDrugById: (drugId: string) => Drug | undefined;
}

const InventoryContext = createContext<InventoryContextType | undefined>(undefined);

const LOCAL_STORAGE_DRUGS_KEY = 'rxinventory_drugs';
const LOCAL_STORAGE_THRESHOLD_KEY = 'rxinventory_threshold';

export const InventoryProvider = ({ children }: { children: ReactNode }) => {
  const [drugs, setDrugs] = useState<Drug[]>(() => {
    if (typeof window !== 'undefined') {
      const savedDrugs = localStorage.getItem(LOCAL_STORAGE_DRUGS_KEY);
      return savedDrugs ? JSON.parse(savedDrugs) : INITIAL_DRUGS;
    }
    return INITIAL_DRUGS;
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
      localStorage.setItem(LOCAL_STORAGE_THRESHOLD_KEY, lowStockThreshold.toString());
    }
  }, [lowStockThreshold]);

  const dispenseDrug = (drugId: string, strips: number) => {
    setDrugs((prevDrugs) =>
      prevDrugs.map((drug) =>
        drug.id === drugId ? { ...drug, stock: Math.max(0, drug.stock - strips) } : drug
      )
    );
  };

  const restockDrug = (drugId: string, strips: number) => {
    setDrugs((prevDrugs) =>
      prevDrugs.map((drug) =>
        drug.id === drugId ? { ...drug, stock: drug.stock + strips } : drug
      )
    );
  };

  const updateLowStockThreshold = (newThreshold: number) => {
    setLowStockThreshold(newThreshold);
  };

  const getDrugById = (drugId: string) => {
    return drugs.find(drug => drug.id === drugId);
  };

  return (
    <InventoryContext.Provider
      value={{
        drugs,
        lowStockThreshold,
        dispenseDrug,
        restockDrug,
        updateLowStockThreshold,
        getDrugById,
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
