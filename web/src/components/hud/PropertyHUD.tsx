'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  X, Plus, Download, Trash2, 
  ShoppingBasket, Minimize2, Maximize2, User
} from 'lucide-react';
import { useMissionControlStore } from '@/stores/missionControlStore';
import { apiClient } from '@/lib/api-client';

interface CollectedURL {
  id: string;
  url: string;
  title?: string;
  addedAt: Date;
}

interface PropertyHUDProps {
  isVisible: boolean;
  onClose: () => void;
}

export function PropertyHUD({ isVisible, onClose }: PropertyHUDProps) {
  console.log('🛒 PropertyHUD render:', { isVisible });
  const { 
    clients, 
    selectedClient, 
    selectClient, 
    getClientTimeline, 
    addNotification,
    loadTimeline 
  } = useMissionControlStore();
  const [isMinimized, setIsMinimized] = useState(false);
  const [collectedURLs, setCollectedURLs] = useState<CollectedURL[]>([]);
  const [currentURL, setCurrentURL] = useState('');
  const [isImporting, setIsImporting] = useState(false);

  // Load/save URLs to localStorage
  useEffect(() => {
    if (isVisible) {
      const stored = localStorage.getItem('property-hud-urls');
      if (stored) {
        try {
          const parsed = JSON.parse(stored).map((item: any) => ({
            ...item,
            addedAt: new Date(item.addedAt)
          }));
          setCollectedURLs(parsed);
        } catch (error) {
          console.warn('Failed to load HUD URLs:', error);
        }
      }
    }
  }, [isVisible]);

  useEffect(() => {
    if (collectedURLs.length > 0) {
      localStorage.setItem('property-hud-urls', JSON.stringify(collectedURLs));
    }
  }, [collectedURLs]);

  // Listen for storage changes from other tabs
  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'property-hud-urls' && e.newValue) {
        try {
          const parsed = JSON.parse(e.newValue).map((item: any) => ({
            ...item,
            addedAt: new Date(item.addedAt)
          }));
          setCollectedURLs(parsed);
          console.log('Cross-tab sync: Updated basket URLs from storage event', parsed.length);
        } catch (error) {
          console.warn('Cross-tab sync: Failed to parse basket URLs', error);
        }
      } else if (e.key === 'property-hud-urls' && e.newValue === null) {
        // URLs were cleared in another tab
        setCollectedURLs([]);
        console.log('Cross-tab sync: Basket cleared from other tab');
      }
    };

    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);

  const addURL = () => {
    if (!currentURL.trim()) return;
    
    const newURL: CollectedURL = {
      id: Date.now().toString(),
      url: currentURL.trim(),
      title: new URL(currentURL.trim()).hostname,
      addedAt: new Date()
    };

    setCollectedURLs(prev => [newURL, ...prev]);
    setCurrentURL('');
  };

  const removeURL = (id: string) => {
    setCollectedURLs(prev => prev.filter(url => url.id !== id));
  };

  const clearAll = () => {
    setCollectedURLs([]);
    localStorage.removeItem('property-hud-urls');
  };

  const handleImport = async () => {
    if (!selectedClient || collectedURLs.length === 0) {
      addNotification({
        type: 'error',
        title: 'Import Error',
        message: selectedClient ? 'No URLs to import' : 'Please select a client first',
        read: false
      });
      return;
    }

    setIsImporting(true);
    
    try {
      const urls = collectedURLs.map(item => item.url);
      const currentTimeline = getClientTimeline(selectedClient.id);
      
      const response = await apiClient.createAndParseBatch(
        selectedClient.id,
        currentTimeline?.id || '',
        urls
      );

      if (response.error) {
        throw new Error(response.error);
      }

      if (response.data) {
        addNotification({
          type: 'success',
          title: 'Properties Queued!',
          message: `Started parsing ${urls.length} properties for ${selectedClient.name}. Check Mission Control for progress.`,
          read: false
        });

        // Refresh timeline data
        await loadTimeline(selectedClient.id);
        
        clearAll();
        onClose(); // Close HUD after successful import
      }
      
    } catch (error) {
      addNotification({
        type: 'error',
        title: 'Import Failed',
        message: error instanceof Error ? error.message : 'Failed to import properties. Please try again.',
        read: false
      });
      console.error('Import failed:', error);
    } finally {
      setIsImporting(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      addURL();
    }
  };

  if (!isVisible) return null;

  if (isMinimized) {
    return (
      <motion.div
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        className="fixed bottom-4 right-4 z-50"
      >
        <button
          onClick={() => setIsMinimized(false)}
          className="bg-blue-600 hover:bg-blue-700 text-white rounded-full p-4 shadow-lg transition-colors relative"
          title="PropertySync HUD"
        >
          <ShoppingBasket className="w-6 h-6" />
          {collectedURLs.length > 0 && (
            <div className="absolute -top-2 -right-2 bg-red-500 text-white text-xs rounded-full w-6 h-6 flex items-center justify-center font-bold">
              {collectedURLs.length}
            </div>
          )}
        </button>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ x: 400, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      exit={{ x: 400, opacity: 0 }}
      className="fixed top-4 right-4 w-96 bg-slate-900/95 backdrop-blur-sm border border-slate-700 rounded-xl shadow-2xl z-50 max-h-[80vh] flex flex-col"
    >
      {/* Header */}
      <div className="p-4 border-b border-slate-700 flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <ShoppingBasket className="w-5 h-5 text-blue-400" />
          <h3 className="font-semibold text-white">Property Collector</h3>
          <div className="bg-blue-600 text-white text-xs px-2 py-1 rounded-full">
            {collectedURLs.length}
          </div>
        </div>
        
        <div className="flex items-center space-x-2">
          <button
            onClick={() => setIsMinimized(true)}
            className="p-1 hover:bg-slate-700 rounded transition-colors text-slate-400 hover:text-white"
            title="Minimize"
          >
            <Minimize2 className="w-4 h-4" />
          </button>
          <button
            onClick={onClose}
            className="p-1 hover:bg-slate-700 rounded transition-colors text-slate-400 hover:text-white"
            title="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Client Selection */}
      <div className="p-4 border-b border-slate-700">
        <label className="block text-sm text-slate-400 mb-2 flex items-center space-x-2">
          <User className="w-4 h-4" />
          <span>Import for client:</span>
        </label>
        <select 
          value={selectedClient?.id || ''}
          onChange={(e) => {
            const client = clients.find(c => c.id === e.target.value);
            selectClient(client || null);
          }}
          className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm"
        >
          <option value="">Select client...</option>
          {clients.map(client => (
            <option key={client.id} value={client.id}>
              {client.name}
            </option>
          ))}
        </select>
      </div>

      {/* URL Input */}
      <div className="p-4 border-b border-slate-700">
        <div className="flex space-x-2">
          <input
            type="url"
            value={currentURL}
            onChange={(e) => setCurrentURL(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="Paste property URL here..."
            className="flex-1 bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-white placeholder-slate-400 text-sm"
          />
          <button
            onClick={addURL}
            disabled={!currentURL.trim()}
            className="bg-blue-600 hover:bg-blue-700 disabled:bg-slate-600 text-white p-2 rounded-lg transition-colors"
          >
            <Plus className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* URL List */}
      <div className="flex-1 overflow-y-auto p-4 space-y-2 min-h-0">
        {collectedURLs.length === 0 ? (
          <div className="text-center py-8 text-slate-400">
            <ShoppingBasket className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p className="text-sm">No URLs collected yet</p>
            <p className="text-xs mt-1">Paste URLs above to get started</p>
          </div>
        ) : (
          collectedURLs.map((item) => (
            <motion.div
              key={item.id}
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-slate-800 border border-slate-600 rounded-lg p-3 group"
            >
              <div className="flex items-start justify-between">
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-blue-400 font-medium truncate">
                    {item.title}
                  </p>
                  <p className="text-xs text-slate-500 mt-1 truncate">
                    {item.url}
                  </p>
                  <p className="text-xs text-slate-500 mt-1">
                    {item.addedAt.toLocaleTimeString()}
                  </p>
                </div>
                
                <button
                  onClick={() => removeURL(item.id)}
                  className="opacity-0 group-hover:opacity-100 p-1 hover:bg-red-600 rounded transition-all text-red-400 hover:text-white ml-2"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              </div>
            </motion.div>
          ))
        )}
      </div>

      {/* Footer Actions */}
      <div className="p-4 border-t border-slate-700 flex items-center justify-between">
        <button
          onClick={clearAll}
          disabled={collectedURLs.length === 0}
          className="text-xs text-slate-400 hover:text-red-400 transition-colors disabled:opacity-50"
        >
          Clear All
        </button>
        
        <button
          onClick={handleImport}
          disabled={!selectedClient || collectedURLs.length === 0 || isImporting}
          className="bg-green-600 hover:bg-green-700 disabled:bg-slate-600 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center space-x-2"
        >
          <Download className="w-4 h-4" />
          <span>
            {isImporting ? 'Importing...' : `Import ${collectedURLs.length} URLs`}
          </span>
        </button>
      </div>
    </motion.div>
  );
}