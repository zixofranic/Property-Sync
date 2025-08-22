import { create } from 'zustand';

interface ParsedProperty {
  // Add these types when you provide them
  // Placeholder for now
  id: string;
  mlsUrl: string;
  // ... other fields
}

interface ImportResult {
  // Add these types when you provide them
  // Placeholder for now
  propertyId?: string;
  success: boolean;
  error?: string;
  // ... other fields
}

interface BatchPropertyState {
  // Input handling
  currentMlsUrl: string;
  isParsing: boolean;
  parseError: string | null;
  
  // Property queue
  propertyQueue: ParsedProperty[];
  
  // Import state
  isImporting: boolean;
  importResults: ImportResult[];
  
  // UI state
  selectedProperty: string | null;
  showImportSummary: boolean;
}

interface BatchPropertyActions {
  // Input actions
  setCurrentMlsUrl: (url: string) => void;
  clearParseError: () => void;
  
  // Parse actions
  parseMlsUrl: (url: string) => Promise<void>;
  
  // Queue management
  addToQueue: (property: ParsedProperty) => void;
  removeFromQueue: (propertyId: string) => void;
  clearQueue: () => void;
  updatePropertyInQueue: (propertyId: string, updates: Partial<ParsedProperty>) => void;
  
  // Import actions
  importProperties: () => Promise<void>;
  clearImportResults: () => void;
  
  // UI actions
  setSelectedProperty: (propertyId: string | null) => void;
  setShowImportSummary: (show: boolean) => void;
  
  // Reset actions
  reset: () => void;
}

type BatchPropertyStore = BatchPropertyState & BatchPropertyActions;

const initialState: BatchPropertyState = {
  currentMlsUrl: '',
  isParsing: false,
  parseError: null,
  propertyQueue: [],
  isImporting: false,
  importResults: [],
  selectedProperty: null,
  showImportSummary: false,
};

export const useBatchPropertyStore = create<BatchPropertyStore>((set, get) => ({
  ...initialState,
  
  // Input actions
  setCurrentMlsUrl: (url: string) => set({ currentMlsUrl: url }),
  clearParseError: () => set({ parseError: null }),
  
  // Parse actions
  parseMlsUrl: async (url: string) => {
    set({ isParsing: true, parseError: null });
    
    try {
      // TODO: Replace with actual API call to your MLS parser
      const response = await fetch('/api/v1/mls-parser/parse', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ mlsUrl: url }),
      });
      
      if (!response.ok) {
        throw new Error('Failed to parse MLS URL');
      }
      
      const parsedProperty: ParsedProperty = await response.json();
      
      // Add to queue
      get().addToQueue(parsedProperty);
      set({ currentMlsUrl: '', isParsing: false });
      
    } catch (error) {
      set({ 
        isParsing: false, 
        parseError: error instanceof Error ? error.message : 'Unknown error occurred' 
      });
    }
  },
  
  // Queue management
  addToQueue: (property: ParsedProperty) => set((state) => ({
    propertyQueue: [...state.propertyQueue, property]
  })),
  
  removeFromQueue: (propertyId: string) => set((state) => ({
    propertyQueue: state.propertyQueue.filter(p => p.id !== propertyId)
  })),
  
  clearQueue: () => set({ propertyQueue: [] }),
  
  updatePropertyInQueue: (propertyId: string, updates: Partial<ParsedProperty>) => 
    set((state) => ({
      propertyQueue: state.propertyQueue.map(p => 
        p.id === propertyId ? { ...p, ...updates } : p
      )
    })),
  
  // Import actions
  importProperties: async () => {
    const { propertyQueue } = get();
    set({ isImporting: true, importResults: [] });
    
    try {
      // TODO: Replace with actual API call to batch import
      const response = await fetch('/api/v1/timelines/batch-import', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ properties: propertyQueue }),
      });
      
      if (!response.ok) {
        throw new Error('Failed to import properties');
      }
      
      const results: ImportResult[] = await response.json();
      
      set({ 
        isImporting: false, 
        importResults: results,
        showImportSummary: true,
        propertyQueue: [] // Clear queue on successful import
      });
      
    } catch (error) {
      set({ 
        isImporting: false,
        importResults: [{
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error occurred'
        }]
      });
    }
  },
  
  clearImportResults: () => set({ importResults: [] }),
  
  // UI actions
  setSelectedProperty: (propertyId: string | null) => set({ selectedProperty: propertyId }),
  setShowImportSummary: (show: boolean) => set({ showImportSummary: show }),
  
  // Reset actions
  reset: () => set(initialState),
}));