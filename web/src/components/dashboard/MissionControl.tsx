// apps/web/src/components/dashboard/MissionControl.tsx - COMPLETE WITH NULL SAFETY FIXES
'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Users, 
  Plus, 
  Settings, 
  BarChart3, 
  CreditCard,
  Search,
  Bell,
  ChevronDown,
  Zap,
  Target,
  Clock,
  TrendingUp,
  Send,
  Calendar
} from 'lucide-react';
import { useMissionControlStore, Property } from '@/stores/missionControlStore';
import { SimplifiedAddPropertyModal } from './modals/SimplifiedAddPropertyModal';
import { MLSViewModal } from '../modals/MLSViewModal';
import { PropertyCard } from '../timeline/PropertyCard';
import { Notifications } from '../ui/Notifications';
import { ClientsModal } from './modals/ClientsModal';

export function MissionControl() {
  const { 
    selectedClient, 
    clients, 
    selectClient, 
    getClientTimeline,
    activeModal,
    setActiveModal,
    updatePropertyFeedback,
    setEditingProperty,
    addNotification,
    deleteProperty,
    getPropertyById,
    bulkMode,
    sendBulkProperties,
  } = useMissionControlStore();
  
  const [isClientDropdownOpen, setIsClientDropdownOpen] = useState(false);
  const [mlsModal, setMlsModal] = useState<{ isOpen: boolean; url: string; address: string }>({
    isOpen: false,
    url: '',
    address: ''
  });

  // Get current timeline and properties
  const currentTimeline = selectedClient ? getClientTimeline(selectedClient.id) : null;
  const properties = currentTimeline?.properties || [];

  // Check if there are properties queued for bulk sending
  const bulkQueueCount = properties.filter(p => !p.clientFeedback).length;

  // ✅ FIXED: Date grouping function with null safety
  const groupPropertiesByDate = (properties: Property[]) => {
    const groups: { [key: string]: Property[] } = {};
    
    properties.forEach(property => {
      if (!property.addedAt) return; // Skip properties without dates
      
      try {
        const date = new Date(property.addedAt).toDateString();
        if (!groups[date]) {
          groups[date] = [];
        }
        groups[date].push(property);
      } catch (error) {
        console.warn('Invalid date for property:', property.id, property.addedAt);
      }
    });
    
    return groups;
  };

  // ✅ FIXED: Format relative time with null safety
  const getRelativeTime = (dateString: string | undefined) => {
    if (!dateString) return 'Unknown';
    
    try {
      const now = new Date();
      const date = new Date(dateString);
      
      // Check for invalid date
      if (isNaN(date.getTime())) return 'Unknown';
      
      const diffInHours = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60));
      
      if (diffInHours < 1) return 'Just now';
      if (diffInHours < 24) return `${diffInHours}h ago`;
      if (diffInHours < 48) return 'Yesterday';
      return date.toLocaleDateString();
    } catch (error) {
      return 'Unknown';
    }
  };

  const getStatusColor = (status: string | undefined) => {
    switch (status) {
      case 'active': return 'text-green-400 bg-green-400/20';
      case 'warm': return 'text-yellow-400 bg-yellow-400/20';
      case 'cold': return 'text-blue-400 bg-blue-400/20';
      default: return 'text-gray-400 bg-gray-400/20';
    }
  };

  const handleDeleteProperty = (propertyId: string) => {
    const property = getPropertyById(propertyId);
    if (property && confirm(`Delete "${property.address || 'this property'}"?\n\nThis action cannot be undone.`)) {
      deleteProperty(propertyId);
    }
  };

  const handleViewMLS = (mlsLink: string, address: string) => {
    if (!mlsLink) {
      addNotification({
        type: 'warning',
        title: 'No MLS Link',
        message: 'This property does not have an MLS link configured.'
      });
      return;
    }

    setMlsModal({
      isOpen: true,
      url: mlsLink,
      address: address || 'Property Details'
    });
  };

  const handlePropertyFeedback = (propertyId: string, feedback: 'love' | 'like' | 'dislike', notes?: string) => {
    updatePropertyFeedback(propertyId, feedback, notes);
    
    addNotification({
      type: 'info',
      title: 'Feedback Received',
      message: `Client feedback: ${feedback.charAt(0).toUpperCase() + feedback.slice(1)}`
    });
  };

  const handleEditProperty = (propertyId: string) => {
    const property = getPropertyById(propertyId);
    
    if (property) {
      setEditingProperty(property);
      setActiveModal('add-property');
      
      addNotification({
        type: 'info',
        title: 'Edit Mode',
        message: `Editing ${property.address || 'property'}`
      });
    }
  };

  const handleSendBulkProperties = () => {
    if (selectedClient && bulkQueueCount > 0) {
      sendBulkProperties(selectedClient.id);
    }
  };

  // ✅ FIXED: Enhanced client selector with search - NULL SAFETY APPLIED
  const [clientSearch, setClientSearch] = useState('');
  const filteredClients = clients.filter(client => {
    if (!client) return false; // Skip null/undefined clients
    
    const searchTerm = clientSearch.toLowerCase();
    const name = client.name?.toLowerCase() || '';
    const email = client.email?.toLowerCase() || '';
    
    return name.includes(searchTerm) || email.includes(searchTerm);
  });

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      {/* Mission Control HUD */}
      <div className="fixed top-0 left-0 right-0 z-50 bg-slate-900/90 backdrop-blur-md border-b border-slate-700/50">
        <div className="flex items-center justify-between p-4">
          {/* Enhanced Client Selector */}
          <div className="relative">
            <motion.button
              onClick={() => setIsClientDropdownOpen(!isClientDropdownOpen)}
              className="flex items-center space-x-3 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white px-6 py-3 rounded-xl shadow-lg transition-all duration-200"
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              <Target className="w-5 h-5" />
              <div className="text-left">
                <div className="font-semibold text-sm">
                  {selectedClient?.name || 'Select Client'}
                </div>
                <div className="text-xs opacity-75">
                  {selectedClient ? `${properties.length} properties` : 'Active Mission'}
                </div>
              </div>
              <ChevronDown className={`w-4 h-4 transition-transform ${isClientDropdownOpen ? 'rotate-180' : ''}`} />
            </motion.button>

            <AnimatePresence>
              {isClientDropdownOpen && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="absolute top-full left-0 mt-2 w-96 bg-slate-800 border border-slate-700 rounded-xl shadow-2xl overflow-hidden"
                >
                  {/* Search Bar */}
                  <div className="p-4 border-b border-slate-700">
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-400" />
                      <input
                        type="text"
                        placeholder="Search clients..."
                        value={clientSearch}
                        onChange={(e) => setClientSearch(e.target.value)}
                        className="w-full pl-10 pr-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                      />
                    </div>
                  </div>

                  {/* Client List */}
                  <div className="max-h-80 overflow-y-auto">
                    {filteredClients.length > 0 ? (
                      filteredClients.map((client) => (
                        <motion.button
                          key={client.id}
                          onClick={() => {
                            selectClient(client);
                            setIsClientDropdownOpen(false);
                            setClientSearch('');
                          }}
                          className="w-full p-4 text-left hover:bg-slate-700/50 transition-colors border-b border-slate-700/50 last:border-b-0"
                          whileHover={{ x: 4 }}
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex-1">
                              <div className="font-medium text-white">{client.name || 'Unnamed Client'}</div>
                              <div className="text-sm text-slate-400 truncate">{client.email || 'No email'}</div>
                              <div className="text-xs text-slate-500 mt-1">
                                {client.propertiesViewed || 0} properties • Last active {getRelativeTime(client.lastActive)}
                              </div>
                            </div>
                            <div className="text-right ml-4">
                              <div className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(client.status)}`}>
                                {client.status || 'active'}
                              </div>
                              <div className="text-xs text-slate-400 mt-1">
                                {client.engagementScore || 0}% engagement
                              </div>
                            </div>
                          </div>
                        </motion.button>
                      ))
                    ) : (
                      <div className="p-8 text-center text-slate-400">
                        <Users className="w-8 h-8 mx-auto mb-2 opacity-50" />
                        <p>No clients found</p>
                      </div>
                    )}
                  </div>

                  {/* Add Client Button */}
                  <div className="p-4 border-t border-slate-700">
                    <button
                      onClick={() => {
                        setActiveModal('clients');
                        setIsClientDropdownOpen(false);
                        setClientSearch('');
                      }}
                      className="w-full flex items-center justify-center space-x-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors"
                    >
                      <Plus className="w-4 h-4" />
                      <span>Add New Client</span>
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Enhanced Client Stats HUD */}
          <div className="flex items-center space-x-6">
            {selectedClient && (
              <motion.div
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                className="flex items-center space-x-4 bg-slate-800/50 backdrop-blur-sm px-4 py-2 rounded-lg border border-slate-700/50"
              >
                <div className="flex items-center space-x-2">
                  <Zap className="w-4 h-4 text-yellow-400" />
                  <span className="text-sm text-slate-300">Engagement</span>
                  <span className="font-bold text-yellow-400">{selectedClient.engagementScore || 0}%</span>
                </div>
                <div className="w-px h-4 bg-slate-600" />
                <div className="flex items-center space-x-2">
                  <TrendingUp className="w-4 h-4 text-green-400" />
                  <span className="text-sm text-slate-300">Properties</span>
                  <span className="font-bold text-green-400">{properties.length}</span>
                </div>
                <div className="w-px h-4 bg-slate-600" />
                <div className="flex items-center space-x-2">
                  <Clock className="w-4 h-4 text-blue-400" />
                  <span className="text-sm text-slate-300">Last Active</span>
                  <span className="font-bold text-blue-400">{getRelativeTime(selectedClient.lastActive)}</span>
                </div>
              </motion.div>
            )}

            <div className="flex items-center space-x-2">
              <Bell className="w-5 h-5 text-slate-400 hover:text-white cursor-pointer transition-colors" />
              <Search className="w-5 h-5 text-slate-400 hover:text-white cursor-pointer transition-colors" />
            </div>
          </div>
        </div>
      </div>

      {/* Enhanced Bulk Send Notification Bar */}
      {selectedClient && bulkMode && bulkQueueCount > 0 && (
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="fixed top-24 right-6 z-40 bg-gradient-to-r from-purple-600 to-purple-700 text-white px-6 py-3 rounded-xl shadow-lg border border-purple-500/30"
        >
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-2">
              <Send className="w-4 h-4" />
              <span className="font-medium">{bulkQueueCount} properties ready to send</span>
            </div>
            <button
              onClick={handleSendBulkProperties}
              className="px-4 py-1 bg-white/20 hover:bg-white/30 rounded-md text-sm transition-colors font-medium"
            >
              Send Bulk Email
            </button>
          </div>
        </motion.div>
      )}

      {/* Main Timeline Canvas */}
      <div className="pt-28 px-6 pb-24">
        <div className="max-w-6xl mx-auto">
          {selectedClient ? (
            <>
              {/* Enhanced Timeline Header */}
              <div className="mb-12">
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="text-center"
                >
                  <h1 className="text-4xl font-bold text-white mb-4">
                    {selectedClient.name || 'Client'}'s Property Journey
                  </h1>
                </motion.div>
              </div>

              {properties.length > 0 ? (
                /* ✅ ENHANCED: Timeline with Date Grouping */
                <div className="relative">
                  {/* Center Timeline Line for Large Screens */}
                  <div className="hidden lg:block absolute left-1/2 top-0 bottom-0 w-0.5 bg-gradient-to-b from-blue-500 via-purple-500 to-pink-500 transform -translate-x-1/2" />
                  
                  {/* Left Timeline Line for Mobile */}
                  <div className="lg:hidden absolute left-8 top-0 bottom-0 w-0.5 bg-gradient-to-b from-blue-500 via-purple-500 to-pink-500" />

                  {/* ✅ FIXED: Timeline Items - GROUPED BY DATE with null safety */}
                  <div className="space-y-12 lg:space-y-16">
                    {(() => {
                      const sortedProperties = properties
                        .filter(p => p && p.addedAt) // Filter out invalid properties
                        .sort((a, b) => new Date(b.addedAt).getTime() - new Date(a.addedAt).getTime());
                      const groupedProperties = groupPropertiesByDate(sortedProperties);
                      let globalIndex = 0;

                      return Object.entries(groupedProperties).map(([dateString, dayProperties]) => (
                        <div key={dateString} className="space-y-12 lg:space-y-16">
                          {/* ✅ FIXED: Modern Date Header with error handling */}
                          <motion.div
                            initial={{ opacity: 0, scale: 0.9 }}
                            animate={{ opacity: 1, scale: 1 }}
                            transition={{ delay: globalIndex * 0.1 }}
                            className="flex items-center justify-center mb-8"
                          >
                            <div className="relative">
                              <div className="bg-gradient-to-r from-blue-500 via-purple-600 to-indigo-600 text-white px-8 py-4 rounded-2xl font-bold text-xl shadow-2xl border border-white/20 backdrop-blur-sm">
                                {(() => {
                                  try {
                                    return new Date(dateString).toLocaleDateString('en-US', { 
                                      weekday: 'long', 
                                      year: 'numeric', 
                                      month: 'long', 
                                      day: 'numeric' 
                                    });
                                  } catch (error) {
                                    return dateString;
                                  }
                                })()}
                              </div>
                              <div className="absolute -inset-1 bg-gradient-to-r from-blue-500 via-purple-600 to-indigo-600 rounded-2xl blur opacity-30" />
                            </div>
                          </motion.div>
                          
                          {/* Properties for this date */}
                          {dayProperties.map((property) => {
                            if (!property || !property.id) return null; // Skip invalid properties
                            
                            const currentIndex = globalIndex++;
                            return (
                              <PropertyCard
                                key={property.id}
                                property={property}
                                onFeedback={handlePropertyFeedback}
                                onViewMLS={(mlsLink) => handleViewMLS(mlsLink, property.address)}
                                onEdit={handleEditProperty}
                                onDelete={handleDeleteProperty}
                                isClientView={false}
                                index={currentIndex}
                                isAlternating={true}
                              />
                            );
                          })}
                        </div>
                      ));
                    })()}
                  </div>
                </div>
              ) : (
                /* Enhanced Empty State */
                <div className="text-center py-20">
                  <motion.div
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="max-w-lg mx-auto"
                  >
                    <div className="relative mb-8">
                      <div className="w-32 h-32 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center mx-auto">
                        <Plus className="w-16 h-16 text-white" />
                      </div>
                      <div className="absolute -inset-4 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full blur opacity-20" />
                    </div>
                    <h3 className="text-2xl font-bold text-white mb-4">Start Building the Timeline</h3>
                    <p className="text-slate-400 mb-8 text-lg leading-relaxed">
                      Add the first property to {selectedClient.name || 'this client'}'s journey and watch their engagement grow. 
                      Create a personalized experience that converts browsers into buyers.
                    </p>
                    <motion.button
                      onClick={() => setActiveModal('add-property')}
                      className="px-10 py-4 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white rounded-xl font-semibold text-lg transition-all duration-200 shadow-lg"
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                    >
                      Add First Property
                    </motion.button>
                  </motion.div>
                </div>
              )}
            </>
          ) : (
            /* Enhanced No Client Selected */
            <div className="text-center py-20">
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                className="max-w-lg mx-auto"
              >
                <div className="relative mb-8">
                  <div className="w-32 h-32 bg-gradient-to-br from-slate-600 to-slate-700 rounded-full flex items-center justify-center mx-auto">
                    <Target className="w-16 h-16 text-slate-400" />
                  </div>
                  <div className="absolute -inset-4 bg-gradient-to-br from-slate-600 to-slate-700 rounded-full blur opacity-20" />
                </div>
                <h3 className="text-2xl font-bold text-white mb-4">Select Your Client</h3>
                <p className="text-slate-400 mb-8 text-lg leading-relaxed">
                  Choose a client from the dropdown above to view their property timeline and start building their personalized journey.
                </p>
                <motion.button
                  onClick={() => setActiveModal('clients')}
                  className="px-10 py-4 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-500 hover:to-emerald-500 text-white rounded-xl font-semibold text-lg transition-all duration-200 shadow-lg"
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                >
                  Manage Clients
                </motion.button>
              </motion.div>
            </div>
          )}
        </div>
      </div>

      {/* Prominent Add Property Button */}
      <div className="fixed bottom-32 right-20">
        <motion.button
          onClick={() => !selectedClient ? null : setActiveModal('add-property')}
          disabled={!selectedClient}
          className={`w-16 h-16 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center shadow-2xl transition-all duration-200 ${
            selectedClient 
              ? 'hover:scale-110 cursor-pointer' 
              : 'opacity-50 cursor-not-allowed'
          }`}
          whileHover={{ scale: selectedClient ? 1.1 : 1 }}
          whileTap={{ scale: selectedClient ? 0.95 : 1 }}
          initial={{ opacity: 0, y: 50 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <Plus className="w-8 h-8 text-white" />
        </motion.button>
      </div>

      {/* Enhanced Floating Action Bar */}
      <div className="fixed bottom-6 right-6">
        <motion.div
          initial={{ opacity: 0, y: 50 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center space-x-3 bg-slate-800/90 backdrop-blur-sm border border-slate-700/50 rounded-2xl p-3 shadow-2xl"
        >
          {[
            { 
              icon: Users, 
              label: 'Clients', 
              action: 'clients', 
              color: 'from-blue-500 to-cyan-600',
              disabled: false 
            },
            { 
              icon: BarChart3, 
              label: 'Analytics', 
              action: 'analytics', 
              color: 'from-purple-500 to-violet-600',
              disabled: false 
            },
            { 
              icon: Settings, 
              label: 'Settings', 
              action: 'settings', 
              color: 'from-gray-500 to-slate-600',
              disabled: false 
            },
            { 
              icon: CreditCard, 
              label: 'Billing', 
              action: 'billing', 
              color: 'from-yellow-500 to-orange-600',
              disabled: false 
            }
          ].map(({ icon: Icon, label, action, color, disabled }) => (
            <motion.button
              key={action}
              onClick={() => !disabled && setActiveModal(action)}
              disabled={disabled}
              className={`p-3 bg-gradient-to-br ${color} hover:scale-110 transition-all duration-200 rounded-xl shadow-lg group relative ${
                disabled ? 'opacity-50 cursor-not-allowed' : ''
              }`}
              whileHover={{ scale: disabled ? 1 : 1.1 }}
              whileTap={{ scale: disabled ? 1 : 0.95 }}
            >
              <Icon className="w-5 h-5 text-white" />
              <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-3 py-1 bg-slate-900 text-white text-xs rounded-lg opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
                {label}
              </div>
            </motion.button>
          ))}
        </motion.div>
      </div>

      {/* Modals */}
      <SimplifiedAddPropertyModal 
        isOpen={activeModal === 'add-property'} 
        onClose={() => {
          setActiveModal(null);
          setEditingProperty(null);
        }} 
      />

      <ClientsModal 
        isOpen={activeModal === 'clients'} 
        onClose={() => setActiveModal(null)} 
      />

      <MLSViewModal
        isOpen={mlsModal.isOpen}
        mlsUrl={mlsModal.url}
        propertyAddress={mlsModal.address}
        onClose={() => setMlsModal({ isOpen: false, url: '', address: '' })}
      />

      {/* Notifications */}
      <Notifications />

      {/* Click outside to close dropdown */}
      {isClientDropdownOpen && (
        <div 
          className="fixed inset-0 z-40" 
          onClick={() => {
            setIsClientDropdownOpen(false);
            setClientSearch('');
          }}
        />
      )}
    </div>
  );
}