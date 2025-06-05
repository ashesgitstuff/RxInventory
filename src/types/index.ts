
export interface Drug {
  id: string;
  name: string; // This will now be treated as Generic Name
  brandName?: string;
  dosage?: string; // e.g., "500mg", "10ml"
  batchNumber?: string;
  dateOfManufacture?: string; // ISO string
  dateOfExpiry?: string; // ISO string
  purchasePricePerStrip: number;
  stock: number; // in strips
  lowStockThreshold: number; // Individual threshold for this drug
  initialSource?: string; // Source from where the drug was first added
}

export const INITIAL_DRUGS: Drug[] = [
  // This list is now primarily for reference or if you want to implement a "reset to defaults"
  // It's no longer used for initial data population if localStorage has data.
  { 
    id: 'metformin-500mg', 
    name: 'Metformin', 
    dosage: '500mg',
    brandName: 'Glycomet',
    batchNumber: 'M001',
    dateOfManufacture: '2023-01-01',
    dateOfExpiry: '2025-01-01',
    purchasePricePerStrip: 5, 
    stock: 50, 
    lowStockThreshold: 10, 
    initialSource: 'System Setup' 
  },
  { 
    id: 'amlong-5mg', 
    name: 'Amlodipine', 
    dosage: '5mg',
    brandName: 'Amlong',
    batchNumber: 'A002',
    dateOfManufacture: '2023-03-01',
    dateOfExpiry: '2025-03-01',
    purchasePricePerStrip: 10, 
    stock: 50, 
    lowStockThreshold: 10, 
    initialSource: 'System Setup' 
  },
  { 
    id: 'telma-40mg', 
    name: 'Telmisartan', 
    dosage: '40mg',
    brandName: 'Telma',
    batchNumber: 'T003',
    dateOfManufacture: '2023-06-01',
    dateOfExpiry: '2025-06-01',
    purchasePricePerStrip: 15, 
    stock: 50, 
    lowStockThreshold: 15, 
    initialSource: 'System Setup' 
  },
];

export const DEFAULT_PURCHASE_PRICE = 1; 
export const DEFAULT_DRUG_LOW_STOCK_THRESHOLD = 5;

export interface DrugDispenseEntry {
  drugId: string;
  stripsDispensed: number;
}

export interface DispenseFormData {
  patientName: string;
  aadharLastFour: string;
  age: number;
  sex: 'Male' | 'Female' | 'Other' | '';
  villageName?: string; 
  drugsToDispense: DrugDispenseEntry[];
}

export interface NewDrugDetails {
  name: string; // Generic Name
  brandName?: string;
  dosage?: string;
  batchNumber?: string;
  dateOfManufacture?: string;
  dateOfExpiry?: string;
  purchasePricePerStrip: number;
  lowStockThreshold: number;
}

export interface DrugRestockEntry {
  drugId: string; 
  stripsAdded: number;
  newDrugDetails?: NewDrugDetails; 
  updatedPurchasePricePerStrip?: number;
}

export interface RestockFormData {
  source: string;
  drugsToRestock: DrugRestockEntry[];
}

export interface TransactionDrugDetail {
  drugId: string;
  drugName: string; // Generic Name
  brandName?: string; // Snapshot at time of transaction for context
  dosage?: string; // Snapshot
  quantity: number; 
  previousStock: number;
  newStock: number;
}

export interface Transaction {
  id: string;
  type: 'dispense' | 'restock' | 'update';
  timestamp: string; 
  patientName?: string;
  aadharLastFour?: string;
  age?: number;
  sex?: 'Male' | 'Female' | 'Other';
  villageName?: string; 
  source?: string; 
  drugs: TransactionDrugDetail[]; 
  notes?: string; 
  updateDetails?: { 
    drugId: string;
    drugName: string; 
    previousName?: string; // Generic Name
    newName?: string; // Generic Name
    previousBrandName?: string;
    newBrandName?: string;
    previousDosage?: string;
    newDosage?: string;
    previousBatchNumber?: string;
    newBatchNumber?: string;
    previousDateOfManufacture?: string;
    newDateOfManufacture?: string;
    previousDateOfExpiry?: string;
    newDateOfExpiry?: string;
    previousPrice?: number;
    newPrice?: number;
    previousThreshold?: number;
    newThreshold?: number;
    previousSource?: string;
    newSource?: string;
  };
}

export interface EditDrugFormData {
  name?: string; // Generic Name
  brandName?: string;
  dosage?: string;
  batchNumber?: string;
  dateOfManufacture?: string;
  dateOfExpiry?: string;
  purchasePricePerStrip?: number;
  lowStockThreshold?: number;
  initialSource?: string;
}

export interface Village {
  id: string;
  name: string;
}
