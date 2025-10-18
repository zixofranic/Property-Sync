'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X, Search, MapPin, DollarSign, Bed, Bath, Square,
  Home, CheckCircle, Loader2, AlertTriangle
} from 'lucide-react';
import { useMissionControlStore } from '@/stores/missionControlStore';
import { apiClient } from '@/lib/api-client';

interface RapidAPIAddPropertyModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface PropertySearchResult {
  property_id: string;
  address: string;
  city: string;
  state: string;
  zipCode: string;
  price: number;
  beds: number;
  baths: number;
  sqft: number;
  photo: string;
  status: string;
}

export function RapidAPIAddPropertyModal({ isOpen, onClose }: RapidAPIAddPropertyModalProps) {
  const {
    selectedClient,
    addNotification,
    loadTimeline
  } = useMissionControlStore();

  // State
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<PropertySearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [selectedPropertyId, setSelectedPropertyId] = useState<string | null>(null);
  const [hasSearched, setHasSearched] = useState(false);

  // Reset state when modal opens/closes
  useEffect(() => {
    if (!isOpen) {
      setSearchQuery('');
      setSearchResults([]);
      setSelectedPropertyId(null);
      setHasSearched(false);
    }
  }, [isOpen]);

  // Handle address search
  const handleSearch = async () => {
    if (!searchQuery.trim()) {
      addNotification({
        type: 'warning',
        title: 'No Address Entered',
        message: 'Please enter an address to search',
        read: false
      });
      return;
    }

    setIsSearching(true);
    setHasSearched(true);
    setSelectedPropertyId(null);

    try {
      console.log('🔍 RapidAPIModal: Searching for:', searchQuery);
      const response = await apiClient.searchPropertiesByAddress(searchQuery);
      console.log('🔍 RapidAPIModal: Raw response:', response);
      console.log('🔍 RapidAPIModal: response.data:', response.data);
      console.log('🔍 RapidAPIModal: response.data.results:', response.data?.results);

      if (response.error) {
        console.log('❌ RapidAPIModal: Error:', response.error);
        throw new Error(response.error);
      }

      if (response.data) {
        console.log('✅ RapidAPIModal: response.data type:', typeof response.data);
        console.log('✅ RapidAPIModal: response.data keys:', Object.keys(response.data));
        console.log('✅ RapidAPIModal: response.data.results:', response.data.results);
        console.log('✅ RapidAPIModal: response.data.results type:', typeof response.data.results);
        console.log('✅ RapidAPIModal: response.data.results is array:', Array.isArray(response.data.results));

        const results = response.data.results || [];
        const count = Array.isArray(results) ? results.length : 0;

        console.log('✅ RapidAPIModal: Setting results, count:', count);
        console.log('✅ RapidAPIModal: Results array:', results);

        setSearchResults(results);

        if (count === 0) {
          addNotification({
            type: 'info',
            title: 'No Properties Found',
            message: `No properties found for "${searchQuery}". Try a different address or city.`,
            read: false
          });
        } else {
          addNotification({
            type: 'success',
            title: 'Properties Found',
            message: `Found ${count} properties matching your search`,
            read: false
          });
        }
      } else {
        console.log('❌ RapidAPIModal: No response.data');
        setSearchResults([]);
      }
    } catch (error) {
      console.log('❌ RapidAPIModal: Exception:', error);

      console.error('Property search failed:', error);
      addNotification({
        type: 'error',
        title: 'Search Failed',
        message: error.message || 'Failed to search properties',
        read: false
      });
      setSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  };

  // Handle property import
  const handleImportProperty = async (propertyId: string) => {
    if (!selectedClient) {
      addNotification({
        type: 'error',
        title: 'No Client Selected',
        message: 'Please select a client first',
        read: false
      });
      return;
    }

    setIsImporting(true);
    setSelectedPropertyId(propertyId);

    try {
      const response = await apiClient.importPropertyFromRapidAPI(propertyId, selectedClient.id);

      if (response.error || !response.data?.success) {
        if (response.data?.isDuplicate) {
          addNotification({
            type: 'warning',
            title: 'Duplicate Property',
            message: response.error || 'This property has already been added to this client\'s timeline',
            read: false
          });
        } else {
          throw new Error(response.error || 'Import failed');
        }
        return;
      }

      // Success!
      addNotification({
        type: 'success',
        title: 'Property Imported!',
        message: response.data.message || 'Property added to timeline successfully',
        read: false
      });

      // Refresh timeline
      await loadTimeline(selectedClient.id);

      // Close modal after successful import
      setTimeout(() => {
        onClose();
      }, 1500);

    } catch (error) {
      console.error('Property import failed:', error);
      addNotification({
        type: 'error',
        title: 'Import Failed',
        message: error.message || 'Failed to import property',
        read: false
      });
    } finally {
      setIsImporting(false);
      setSelectedPropertyId(null);
    }
  };

  // Format price
  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
    }).format(price);
  };

  // Format number with commas
  const formatNumber = (num: number) => {
    return new Intl.NumberFormat('en-US').format(num);
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          onClick={onClose}
        >
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            className="bg-slate-800 border border-slate-700 rounded-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden"
            onClick={e => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b border-slate-700">
              <div>
                <h2 className="text-2xl font-bold text-white flex items-center">
                  <Search className="w-6 h-6 mr-3 text-blue-400" />
                  Search & Import Properties
                </h2>
                {selectedClient && (
                  <p className="text-slate-400 mt-1">for {selectedClient.name}</p>
                )}
              </div>

              <button
                onClick={onClose}
                className="p-2 hover:bg-slate-700 rounded-lg transition-colors"
              >
                <X className="w-5 h-5 text-slate-400" />
              </button>
            </div>

            {/* Search Bar */}
            <div className="p-6 border-b border-slate-700 bg-slate-700/30">
              <label className="block text-sm font-medium text-slate-300 mb-3">
                <MapPin className="w-4 h-4 inline mr-2" />
                Enter Address, City, or Property ID
              </label>

              <div className="flex space-x-3">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
                  className="flex-1 px-4 py-3 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                  placeholder="e.g., 1700441 or Louisville, KY or 3617 Nellie Bly Dr, Louisville, KY"
                  disabled={isSearching}
                />
                <motion.button
                  type="button"
                  onClick={handleSearch}
                  disabled={isSearching || !selectedClient}
                  className="px-6 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-600 disabled:cursor-not-allowed text-white rounded-lg font-medium transition-colors flex items-center space-x-2"
                  whileHover={{ scale: isSearching ? 1 : 1.02 }}
                  whileTap={{ scale: isSearching ? 1 : 0.98 }}
                >
                  {isSearching ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      <span>Searching...</span>
                    </>
                  ) : (
                    <>
                      <Search className="w-5 h-5" />
                      <span>Search</span>
                    </>
                  )}
                </motion.button>
              </div>

              <p className="text-xs text-slate-400 mt-2">
                💡 Tip: Enter a <strong>Property ID</strong> (e.g., 1700441) for direct lookup, a <strong>full address</strong> for specific properties, or just a <strong>city and state</strong> to browse listings
              </p>
            </div>

            {/* Search Results */}
            <div className="p-6 overflow-y-auto max-h-[calc(90vh-300px)]">
              {isSearching ? (
                <div className="flex flex-col items-center justify-center py-12">
                  <Loader2 className="w-12 h-12 text-blue-400 animate-spin mb-4" />
                  <p className="text-slate-300">Searching for properties...</p>
                </div>
              ) : searchResults.length === 0 && hasSearched ? (
                <div className="flex flex-col items-center justify-center py-12">
                  <Home className="w-16 h-16 text-slate-600 mb-4" />
                  <p className="text-slate-300 text-lg font-medium">No properties found</p>
                  <p className="text-slate-500 text-sm mt-2">Try searching with a different address or city</p>
                </div>
              ) : searchResults.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12">
                  <Search className="w-16 h-16 text-slate-600 mb-4" />
                  <p className="text-slate-300 text-lg font-medium">Ready to search</p>
                  <p className="text-slate-500 text-sm mt-2">Enter an address above to find properties</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {searchResults.map((property) => (
                    <PropertyCard
                      key={property.property_id}
                      property={property}
                      isImporting={isImporting && selectedPropertyId === property.property_id}
                      onImport={() => handleImportProperty(property.property_id)}
                      formatPrice={formatPrice}
                      formatNumber={formatNumber}
                    />
                  ))}
                </div>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// Property Card Component
function PropertyCard({
  property,
  isImporting,
  onImport,
  formatPrice,
  formatNumber
}: {
  property: PropertySearchResult;
  isImporting: boolean;
  onImport: () => void;
  formatPrice: (price: number) => string;
  formatNumber: (num: number) => string;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-slate-700/30 border border-slate-600 rounded-lg overflow-hidden hover:border-blue-500/50 transition-all group"
    >
      {/* Property Image */}
      <div className="relative h-48 bg-slate-700">
        {property.photo ? (
          <img
            src={property.photo}
            alt={property.address}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <Home className="w-16 h-16 text-slate-600" />
          </div>
        )}

        {/* Status Badge */}
        {property.status && (
          <div className="absolute top-3 right-3 px-3 py-1 bg-blue-600 text-white text-xs font-medium rounded-full">
            {property.status.replace('_', ' ')}
          </div>
        )}
      </div>

      {/* Property Details */}
      <div className="p-4">
        <div className="mb-3">
          <div className="flex items-start justify-between mb-2">
            <h3 className="text-white font-semibold text-lg flex-1">
              {property.address}
            </h3>
          </div>
          <p className="text-slate-400 text-sm">
            {property.city}, {property.state} {property.zipCode}
          </p>
        </div>

        {/* Price */}
        <div className="flex items-center space-x-2 mb-3">
          <DollarSign className="w-5 h-5 text-green-400" />
          <span className="text-2xl font-bold text-green-400">
            {formatPrice(property.price)}
          </span>
        </div>

        {/* Property Stats */}
        <div className="flex items-center space-x-4 text-sm text-slate-300 mb-4">
          {property.beds > 0 && (
            <div className="flex items-center space-x-1">
              <Bed className="w-4 h-4" />
              <span>{property.beds} bd</span>
            </div>
          )}
          {property.baths > 0 && (
            <div className="flex items-center space-x-1">
              <Bath className="w-4 h-4" />
              <span>{property.baths} ba</span>
            </div>
          )}
          {property.sqft > 0 && (
            <div className="flex items-center space-x-1">
              <Square className="w-4 h-4" />
              <span>{formatNumber(property.sqft)} sqft</span>
            </div>
          )}
        </div>

        {/* Import Button */}
        <motion.button
          onClick={onImport}
          disabled={isImporting}
          className="w-full px-4 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-600 disabled:cursor-not-allowed text-white rounded-lg font-medium transition-colors flex items-center justify-center space-x-2"
          whileHover={{ scale: isImporting ? 1 : 1.02 }}
          whileTap={{ scale: isImporting ? 1 : 0.98 }}
        >
          {isImporting ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>Importing...</span>
            </>
          ) : (
            <>
              <CheckCircle className="w-4 h-4" />
              <span>Import Property</span>
            </>
          )}
        </motion.button>
      </div>
    </motion.div>
  );
}
