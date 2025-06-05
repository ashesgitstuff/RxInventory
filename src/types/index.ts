
export interface Drug {
  id: string;
  name: string;
  purchasePricePerStrip: number;
  stock: number; // in strips
}

export const INITIAL_DRUGS: Drug[] = [
  { id: 'metformin-500mg', name: 'Metformin 500mg', purchasePricePerStrip: 5, stock: 50 },
  { id: 'amlong-5mg', name: 'Amlong 5mg', purchasePricePerStrip: 10, stock: 50 },
  { id: 'telma-40mg', name: 'Telma 40mg', purchasePricePerStrip: 15, stock: 50 },
];

export const DEFAULT_LOW_STOCK_THRESHOLD = 10;
export const DEFAULT_PURCHASE_PRICE = 1; // Default purchase price for a new drug strip

export interface DrugDispenseEntry {
  drugId: string;
  stripsDispensed: number;
}

export interface DispenseFormData {
  patientName: string;
  aadharLastFour: string;
  age: number;
  sex: 'Male' | 'Female' | 'Other' | '';
  drugsToDispense: DrugDispenseEntry[];
}

export interface NewDrugDetails {
  name: string;
  purchasePricePerStrip: number;
}

export interface DrugRestockEntry {
  drugId: string; // Can be '--add-new--'
  newDrugDetails?: NewDrugDetails; // Only if drugId is '--add-new--'
  stripsAdded: number;
}

export interface RestockFormData {
  source: string;
  drugsToRestock: DrugRestockEntry[];
}

export interface SettingsFormData {
  lowStockThreshold: number;
}

export interface TransactionDrugDetail {
  drugId: string;
  drugName: string;
  quantity: number; // positive for restock, negative for dispense
  previousStock: number;
  newStock: number;
}

export interface Transaction {
  id: string;
  type: 'dispense' | 'restock';
  timestamp: string; // ISO string for date
  patientName?: string;
  aadharLastFour?: string;
  age?: number;
  sex?: 'Male' | 'Female' | 'Other';
  source?: string; // For restock
  drugs: TransactionDrugDetail[];
  notes?: string; // Optional field for any notes
}
