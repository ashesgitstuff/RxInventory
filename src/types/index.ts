export interface Drug {
  id: string;
  name: string;
  purchasePricePerStrip: number; // For potential future use
  stock: number; // in strips
}

export const INITIAL_DRUGS: Drug[] = [
  { id: 'metformin', name: 'Metformin 500mg', purchasePricePerStrip: 5, stock: 50 },
  { id: 'amlong', name: 'Amlong 5mg', purchasePricePerStrip: 10, stock: 50 },
  { id: 'telma', name: 'Telma 40mg', purchasePricePerStrip: 15, stock: 50 },
];

export const DEFAULT_LOW_STOCK_THRESHOLD = 10;

export interface DispenseFormData {
  patientName: string;
  drugId: string;
  stripsDispensed: number;
}

export interface RestockFormData {
  drugId: string;
  stripsAdded: number;
}

export interface SettingsFormData {
  lowStockThreshold: number;
}
