
export interface Drug {
  id: string; // Unique ID for THIS SPECIFIC BATCH/STOCK ITEM
  name: string; // Generic Name
  brandName?: string;
  dosage?: string; // e.g., "500mg", "10ml"
  batchNumber?: string;
  dateOfManufacture?: string; // ISO string
  dateOfExpiry?: string; // ISO string
  purchasePricePerStrip: number;
  stock: number; // in strips for THIS SPECIFIC BATCH
  lowStockThreshold: number; // Individual threshold for THIS SPECIFIC BATCH
  initialSource?: string; // Source from where the drug batch was first added
}

export const INITIAL_DRUGS: Drug[] = [
  // Each object is a distinct batch
  {
    id: 'metformin-500mg-glycomet-batch1',
    name: 'Metformin',
    dosage: '500mg',
    brandName: 'Glycomet',
    batchNumber: 'M001',
    dateOfManufacture: '2023-01-01',
    dateOfExpiry: '2025-01-01',
    purchasePricePerStrip: 5,
    stock: 30,
    lowStockThreshold: 10,
    initialSource: 'System Setup'
  },
  {
    id: 'metformin-500mg-glycomet-batch2',
    name: 'Metformin',
    dosage: '500mg',
    brandName: 'Glycomet',
    batchNumber: 'M002',
    dateOfManufacture: '2023-06-01',
    dateOfExpiry: '2025-06-01',
    purchasePricePerStrip: 5.5,
    stock: 20,
    lowStockThreshold: 10,
    initialSource: 'System Setup'
  },
   {
    id: 'metformin-500mg-generic-batch3',
    name: 'Metformin',
    dosage: '500mg',
    brandName: '', // Or some indicator for generic
    batchNumber: 'MG003',
    dateOfManufacture: '2023-07-01',
    dateOfExpiry: '2024-07-01', // Earlier expiry for testing
    purchasePricePerStrip: 4.5,
    stock: 15,
    lowStockThreshold: 5,
    initialSource: 'System Setup'
  },
  {
    id: 'amlong-5mg-batch1',
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
];

export const DEFAULT_PURCHASE_PRICE = 1;
export const DEFAULT_DRUG_LOW_STOCK_THRESHOLD = 5;

export interface DrugDispenseEntry {
  selectedBatchId: string; // ID of the specific batch to dispense from
  stripsDispensed: number;
}

export interface DispenseFormData {
  patientName: string;
  aadharLastFour: string;
  age: number;
  sex?: 'Male' | 'Female' | 'Other';
  villageName?: string;
  drugsToDispense: DrugDispenseEntry[];
}

// For "Add New Drug" in RestockForm - represents a new batch
export interface NewDrugDetails {
  name: string; // Generic Name
  brandName?: string;
  dosage?: string;
  batchNumber: string; // Batch number is mandatory for a new batch
  dateOfManufacture?: string;
  dateOfExpiry: string; // Expiry date is mandatory for a new batch
  purchasePricePerStrip: number;
  lowStockThreshold: number;
}

export interface DrugRestockEntry {
  drugId: string; // ID of existing batch to restock, or '--add-new--'
  stripsAdded: number;
  newDrugDetails?: NewDrugDetails; // Only if drugId is '--add-new--'
  updatedPurchasePricePerStrip?: number; // For existing batch
}

export interface RestockFormData {
  source: string;
  drugsToRestock: DrugRestockEntry[];
}

export interface TransactionDrugDetail {
  drugId: string; // ID of the specific batch involved
  drugName: string; // Generic Name (snapshot)
  brandName?: string; // (snapshot)
  dosage?: string; // (snapshot)
  batchNumber?: string; // (snapshot)
  quantity: number;
  previousStock: number; // Stock of this batch before transaction
  newStock: number; // Stock of this batch after transaction
}

export interface Transaction {
  id: string;
  type: 'dispense' | 'restock' | 'update' | 'adjustment';
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
    drugId: string; // ID of the specific batch updated
    drugName: string; // Generic name (snapshot, usually the new one)
    previousName?: string;
    newName?: string;
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

// For editing a specific batch
export interface EditDrugFormData {
  name: string; // Generic Name
  brandName?: string;
  dosage?: string;
  batchNumber: string;
  dateOfManufacture?: string;
  dateOfExpiry: string;
  purchasePricePerStrip: number;
  lowStockThreshold: number;
  initialSource?: string;
}

export interface Village {
  id: string;
  name: string;
}

// For dashboard display and dispense form selection
export interface GroupedDrugDisplay {
  groupKey: string; // e.g., "metformin-glycomet-500mg" or "metformin--500mg"
  displayName: string; // For UI display, e.g., "Metformin Glycomet 500mg"
  genericName: string;
  brandName?: string;
  dosage?: string;
  totalStock: number;
  // Use the threshold of the first batch in the group for the aggregate warning
  lowStockThreshold: number;
  // Batches belonging to this group, sorted by expiry
  batches: Drug[];
}
