// apps/web/src/components/dashboard/modals/ClientsModal.tsx
'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  X, Users, UserPlus, Mail, Phone, Share2, 
  Trash2, Edit3, Target, Clock, TrendingUp, Heart 
} from 'lucide-react';
import { useMissionControlStore, Client } from '@/stores/missionControlStore';
import { AddClientModal } from './AddClientModal';

interface ClientsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function ClientsModal({ isOpen, onClose }: ClientsModalProps) {
  const { 
    clients, 
    selectedClient, 
    selectClient, 
    deleteClient, 
    shareTimeline,
    addNotification,
    clientsLoading
  } = useMissionControlStore();
  
  const [showAddClient, setShowAddClient] = useState(false);
  const [editingClient, setEditingClient] = useState<Client | null>(null);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'text-green-400 bg-green-400/20';
      case 'warm': return 'text-yellow-400 bg-yellow-400/20';
      case 'cold': return 'text-blue-400 bg-blue-400/20';
      default: return 'text-gray-400 bg-gray-400/20';
    }
  };

  const handleSelectClient = (client: Client) => {
    selectClient(client);
    addNotification({
      type: 'info',
      title: 'Client Selected',
      message: `Switched to ${client.name}'s timeline.`,
      read: false
    });
    onClose();
  };

  const handleEditClient = (client: Client) => {
    setEditingClient(client);
    setShowAddClient(true);
  };

  const handleShareTimeline = (client: Client) => {
    const shareToken = shareTimeline(client.id);
    const shareUrl = `${window.location.origin}/timeline/${shareToken}`;
    
    navigator.clipboard.writeText(shareUrl);
    
    addNotification({
      type: 'success',
      title: 'Share Link Copied',
      message: `Timeline link for ${client.name} copied to clipboard.`,
      read: false
    });
  };

  const handleDeleteClient = (client: Client) => {
    if (confirm(`Are you sure you want to delete ${client.name}? This will remove all their properties.`)) {
      deleteClient(client.id);
      
      addNotification({
        type: 'success',
        title: 'Client Deleted',
        message: `${client.name} has been removed from your client list.`,
        read: false
      });
    }
  };

  const handleCloseModal = () => {
    setShowAddClient(false);
    setEditingClient(null);
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
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-cyan-600 rounded-full flex items-center justify-center">
                  <Users className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-white">Client Management</h2>
                  <p className="text-sm text-slate-400">{clients.length} total clients</p>
                </div>
              </div>
              
              <div className="flex items-center space-x-3">
                <button
                  onClick={() => setShowAddClient(true)}
                  className="flex items-center space-x-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
                >
                  <UserPlus className="w-4 h-4" />
                  <span>Add Client</span>
                </button>
                
                <button
                  onClick={onClose}
                  className="p-2 hover:bg-slate-700 rounded-lg transition-colors"
                >
                  <X className="w-5 h-5 text-slate-400" />
                </button>
              </div>
            </div>

            {/* Clients List */}
            <div className="p-6 overflow-y-auto max-h-[calc(90vh-140px)]">
             {clientsLoading ? (
              /* Tailwind-only Skeleton Loader */
              <div className="space-y-4">
                {[1, 2, 3, 4].map((i) => (
                  <div key={i} className="p-6 border-b border-slate-700/50">
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        {/* Name skeleton */}
                        <div className="h-4 bg-gradient-to-r from-slate-600 via-slate-500 to-slate-600 rounded animate-pulse mb-2 w-3/4"></div>
            
                        {/* Email skeleton */}
                        <div className="h-3 bg-gradient-to-r from-slate-700 via-slate-600 to-slate-700 rounded animate-pulse w-1/2 mb-1"></div>
            
                        {/* Phone skeleton */}
                        <div className="h-2 bg-gradient-to-r from-slate-700 via-slate-600 to-slate-700 rounded animate-pulse w-1/3"></div>
                      </div>
                      <div className="text-right ml-4">
                        {/* Status badge skeleton */}
                        <div className="h-6 w-16 bg-gradient-to-r from-slate-600 via-slate-500 to-slate-600 rounded-full animate-pulse mb-1"></div>
                        {/* Engagement skeleton */}
                        <div className="h-2 w-12 bg-gradient-to-r from-slate-700 via-slate-600 to-slate-700 rounded animate-pulse"></div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : clients.filter(client => client && client.id).length > 0 ? (
                /* Actual Clients List */
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {clients.filter(client => client && client.id).map((client, index) => (
                    <motion.div
                      key={`client-${client.id}-${index}`}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.1 }}
                      className={`p-6 rounded-2xl border transition-all duration-300 hover:scale-[1.02] cursor-pointer ${
                        selectedClient?.id === client.id
                          ? 'bg-blue-500/10 border-blue-500/30'
                          : 'bg-slate-700/30 border-slate-600/50 hover:bg-slate-700/50'
                      }`}
                      onClick={() => handleSelectClient(client)}
                    >
                      {/* Client Header */}
                      <div className="flex items-start justify-between mb-4">
                        <div className="flex-1">
                          <h3 className="text-lg font-semibold text-white mb-1">
                            {client.name}
                          </h3>
                          <div className="space-y-1 text-sm text-slate-400">
                            <div className="flex items-center space-x-1">
                              <Mail className="w-3 h-3" />
                              <span>{client.email}</span>
                            </div>
                            {/* Spouse Email Display */}
                            {client.spouseEmail && (
                              <div className="flex items-center space-x-1">
                                <Heart className="w-3 h-3" />
                                <span className="text-pink-400">Spouse: {client.spouseEmail}</span>
                              </div>
                            )}
                            {client.phone && (
                              <div className="flex items-center space-x-1">
                                <Phone className="w-3 h-3" />
                                <span>{client.phone}</span>
                              </div>
                            )}
                          </div>
                        </div>
                        
                        <div className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(client.status)}`}>
                          {client.status}
                        </div>
                      </div>

                      {/* Client Stats */}
                      <div className="flex items-center space-x-6 mb-4 text-sm">
                        <div className="flex items-center space-x-2">
                          <TrendingUp className="w-4 h-4 text-green-400" />
                          <span className="text-slate-300">Properties:</span>
                          <span className="font-semibold text-green-400">{client.propertiesViewed}</span>
                        </div>
                        
                        <div className="flex items-center space-x-2">
                          <Target className="w-4 h-4 text-yellow-400" />
                          <span className="text-slate-300">Engagement:</span>
                          <span className="font-semibold text-yellow-400">{client.engagementScore}%</span>
                        </div>
                      </div>

                      <div className="flex items-center justify-between text-xs text-slate-400 mb-4">
                        <div className="flex items-center space-x-1">
                          <Clock className="w-3 h-3" />
                          <span>Last active: {client.lastActive}</span>
                        </div>
                        <span>Added {new Date(client.createdAt).toLocaleDateString()}</span>
                      </div>

                      {/* Action Buttons */}
                      <div className="flex items-center space-x-2">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleShareTimeline(client);
                          }}
                          className="flex-1 flex items-center justify-center space-x-2 px-3 py-2 bg-green-600/20 hover:bg-green-600/30 text-green-400 rounded-lg transition-colors"
                        >
                          <Share2 className="w-3 h-3" />
                          <span>Share Timeline</span>
                        </button>
                        
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleEditClient(client);
                          }}
                          className="px-3 py-2 bg-orange-600/20 hover:bg-orange-600/30 text-orange-400 rounded-lg transition-colors"
                        >
                          <Edit3 className="w-3 h-3" />
                        </button>
                        
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteClient(client);
                          }}
                          className="px-3 py-2 bg-red-600/20 hover:bg-red-600/30 text-red-400 rounded-lg transition-colors"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>

                      {/* Selected Indicator */}
                      {selectedClient?.id === client.id && (
                        <div className="mt-3 flex items-center justify-center space-x-2 text-blue-400 text-sm font-medium">
                          <Target className="w-4 h-4" />
                          <span>Currently Active</span>
                        </div>
                      )}
                    </motion.div>
                  ))}
                </div>
              ) : (
                /* Empty State */
                <div className="text-center py-20">
                  <Users className="w-16 h-16 text-slate-500 mx-auto mb-4" />
                  <h3 className="text-xl font-semibold text-white mb-2">No Clients Yet</h3>
                  <p className="text-slate-400 mb-6 max-w-md mx-auto">
                    Add your first client to start building property timelines and tracking engagement.
                  </p>
                  <button
                    onClick={() => setShowAddClient(true)}
                    className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors flex items-center space-x-2 mx-auto"
                  >
                    <UserPlus className="w-4 h-4" />
                    <span>Add Your First Client</span>
                  </button>
                </div>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
      
      {/* Add/Edit Client Modal */}
      <AddClientModal 
        isOpen={showAddClient} 
        onClose={handleCloseModal}
        editingClient={editingClient}
      />
    </AnimatePresence>
  );
}