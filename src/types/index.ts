
export interface Drug {
  id: string;
  name: string;
  purchasePricePerStrip: number;
  stock: number; // in strips
  lowStockThreshold: number; // Individual threshold for this drug
  initialSource?: string; // Source from where the drug was first added
}

export const INITIAL_DRUGS: Drug[] = [
  { id: 'metformin-500mg', name: 'Metformin 500mg', purchasePricePerStrip: 5, stock: 50, lowStockThreshold: 10, initialSource: 'System Setup' },
  { id: 'amlong-5mg', name: 'Amlong 5mg', purchasePricePerStrip: 10, stock: 50, lowStockThreshold: 10, initialSource: 'System Setup' },
  { id: 'telma-40mg', name: 'Telma 40mg', purchasePricePerStrip: 15, stock: 50, lowStockThreshold: 15, initialSource: 'System Setup' },
];

export const DEFAULT_PURCHASE_PRICE = 1; // Default purchase price for a new drug strip
export const DEFAULT_DRUG_LOW_STOCK_THRESHOLD = 5; // Default low stock threshold for a new drug

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
  lowStockThreshold: number;
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

// SettingsFormData is no longer needed as threshold is per-drug
// export interface SettingsFormData {
//   lowStockThreshold: number;
// }

export interface TransactionDrugDetail {
  drugId: string;
  drugName: string;
  quantity: number; // positive for restock, negative for dispense
  previousStock: number;
  newStock: number;
}

export interface Transaction {
  id: string;
  type: 'dispense' | 'restock' | 'update';
  timestamp: string; // ISO string for date
  patientName?: string;
  aadharLastFour?: string;
  age?: number;
  sex?: 'Male' | 'Female' | 'Other';
  source?: string; // For restock
  drugs: TransactionDrugDetail[];
  notes?: string; // Optional field for any notes
  updateDetails?: { // For 'update' type transactions
    drugId: string;
    drugName: string; // Current name after update
    previousName?: string;
    newName?: string;
    previousPrice?: number;
    newPrice?: number;
    previousThreshold?: number;
    newThreshold?: number;
  };
}

export interface EditDrugFormData {
  name: string;
  purchasePricePerStrip: number;
  lowStockThreshold: number;
}

