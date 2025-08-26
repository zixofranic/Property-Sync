'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  X, BarChart3, Users, Eye, Heart, TrendingUp, Calendar,
  Download, RefreshCw, Activity, Clock, Mail
} from 'lucide-react';
import { apiClient } from '@/lib/api-client';
import { useMissionControlStore } from '@/stores/missionControlStore';

interface AnalyticsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface AnalyticsDashboard {
  totalClients: number;
  totalProperties: number;
  totalViews: number;
  recentActivity: number;
  feedbackStats: {
    love: number;
    like: number;
    dislike: number;
  };
  activeTimelines: number;
}

interface ClientActivity {
  id: string;
  eventType: string;
  propertyId?: string;
  timestamp: string;
  clientName: string;
  metadata?: any;
}

interface ClientAnalytics {
  averageResponseTime: number;
  responseRate: number;
  emailOpenRate: number;
  engagementScore: number;
  preferredTimes: Array<{
    time: string;
    count: number;
    percentage: number;
  }>;
}

export function AnalyticsModal({ isOpen, onClose }: AnalyticsModalProps) {
  const { clients } = useMissionControlStore();
  const [activeTab, setActiveTab] = useState<'overview' | 'client'>('overview');
  const [selectedClientId, setSelectedClientId] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);
  const [dashboardData, setDashboardData] = useState<AnalyticsDashboard | null>(null);
  const [clientActivity, setClientActivity] = useState<ClientActivity[]>([]);
  const [clientAnalytics, setClientAnalytics] = useState<ClientAnalytics | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  // Load dashboard data on mount
  useEffect(() => {
    if (isOpen && activeTab === 'overview') {
      loadDashboardData();
    }
  }, [isOpen, activeTab]);

  // Load client analytics when client is selected
  useEffect(() => {
    if (activeTab === 'client' && selectedClientId) {
      loadClientAnalytics(selectedClientId);
    }
  }, [activeTab, selectedClientId]);

  const loadDashboardData = async () => {
    setIsLoading(true);
    try {
      const response = await apiClient.getDashboardAnalytics();
      if (response.data) {
        setDashboardData(response.data);
      }
    } catch (error) {
      console.error('Failed to load dashboard analytics:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const loadClientAnalytics = async (clientId: string) => {
    setIsLoading(true);
    try {
      // Load client activity data
      const activityResponse = await apiClient.request(`/api/v1/analytics/client/${clientId}/activity?limit=100`);
      if (activityResponse.data) {
        setClientActivity(activityResponse.data);
        
        // Process the activity data to calculate useful analytics
        const analytics = processClientActivityData(activityResponse.data);
        setClientAnalytics(analytics);
      }
    } catch (error) {
      console.error('Failed to load client analytics:', error);
      setClientActivity([]);
      setClientAnalytics(null);
    } finally {
      setIsLoading(false);
    }
  };

  // Process raw activity data into useful analytics
  const processClientActivityData = (activities: ClientActivity[]): ClientAnalytics => {
    if (activities.length === 0) {
      return {
        averageResponseTime: 0,
        responseRate: 0,
        emailOpenRate: 0,
        engagementScore: 0,
        preferredTimes: []
      };
    }

    // Calculate average response time (hours from view to feedback)
    const views = activities.filter(a => a.eventType === 'property_view');
    const feedbacks = activities.filter(a => a.eventType === 'feedback_submit');
    
    let averageResponseTime = 0;
    if (views.length > 0 && feedbacks.length > 0) {
      const responseTimes = feedbacks.map(feedback => {
        const relatedView = views.find(v => v.propertyId === feedback.propertyId);
        if (!relatedView) return null;
        return (new Date(feedback.timestamp).getTime() - new Date(relatedView.timestamp).getTime()) / (1000 * 60 * 60);
      }).filter(time => time !== null);

      if (responseTimes.length > 0) {
        averageResponseTime = Math.round(responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length * 10) / 10;
      }
    }

    // Calculate response rate (views that get feedback)
    const responseRate = views.length > 0 ? Math.round((feedbacks.length / views.length) * 100) : 0;

    // Calculate email open rate
    const emailEvents = activities.filter(a => a.eventType === 'email_open');
    const totalEmailsSent = activities.filter(a => a.eventType.includes('email')).length;
    const emailOpenRate = totalEmailsSent > 0 ? Math.round((emailEvents.length / totalEmailsSent) * 100) : 0;

    // Calculate engagement score (weighted activity score)
    const weights = { timeline_view: 1, property_view: 2, feedback_submit: 5, email_open: 1 };
    const score = activities.reduce((total, activity) => {
      return total + (weights[activity.eventType as keyof typeof weights] || 1);
    }, 0);
    const engagementScore = Math.min(100, Math.round((score / activities.length) * 10));

    // Analyze preferred times (Morning, Afternoon, Evening)
    const timeSlots = activities.reduce((acc, activity) => {
      const hour = new Date(activity.timestamp).getHours();
      const timeSlot = hour < 12 ? 'Morning' : hour < 18 ? 'Afternoon' : 'Evening';
      acc[timeSlot] = (acc[timeSlot] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const preferredTimes = Object.entries(timeSlots)
      .sort(([,a], [,b]) => b - a)
      .map(([time, count]) => ({
        time,
        count,
        percentage: Math.round((count / activities.length) * 100)
      }));

    return {
      averageResponseTime,
      responseRate,
      emailOpenRate,
      engagementScore,
      preferredTimes
    };
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    if (activeTab === 'overview') {
      await loadDashboardData();
    } else if (selectedClientId) {
      await loadClientAnalytics(selectedClientId);
    }
    setRefreshing(false);
  };

  const downloadCSV = () => {
    if (activeTab === 'overview' && dashboardData) {
      downloadOverviewCSV();
    } else if (activeTab === 'client' && clientAnalytics) {
      downloadClientAnalyticsCSV();
    }
  };

  const downloadOverviewCSV = () => {
    if (!dashboardData) return;

    const csvData = [
      ['Metric', 'Value'],
      ['Total Clients', dashboardData.totalClients],
      ['Total Properties', dashboardData.totalProperties],
      ['Total Views', dashboardData.totalViews],
      ['Recent Activity (24h)', dashboardData.recentActivity],
      ['Active Timelines', dashboardData.activeTimelines],
      ['Love Feedback', dashboardData.feedbackStats.love],
      ['Like Feedback', dashboardData.feedbackStats.like],
      ['Dislike Feedback', dashboardData.feedbackStats.dislike],
      ['Generated', new Date().toISOString()],
    ];

    const csv = csvData.map(row => row.join(',')).join('\n');
    downloadFile(csv, `agent-analytics-${new Date().toISOString().split('T')[0]}.csv`);
  };

  const downloadClientAnalyticsCSV = () => {
    const selectedClient = clients.find(c => c.id === selectedClientId);
    const clientName = selectedClient?.name || 'Unknown';

    if (!clientAnalytics) return;

    const csvData = [
      ['Metric', 'Value'],
      ['Client Name', clientName],
      ['Average Response Time (hours)', clientAnalytics.averageResponseTime],
      ['Response Rate (%)', clientAnalytics.responseRate],
      ['Email Open Rate (%)', clientAnalytics.emailOpenRate],
      ['Engagement Score', clientAnalytics.engagementScore],
      ['Generated', new Date().toISOString()],
    ];

    const csv = csvData.map(row => row.join(',')).join('\n');
    downloadFile(csv, `client-analytics-${clientName.replace(/\s+/g, '-')}-${new Date().toISOString().split('T')[0]}.csv`);
  };

  const downloadFile = (content: string, filename: string) => {
    const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', filename);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const formatEventType = (eventType: string) => {
    switch (eventType) {
      case 'timeline_view':
        return 'Viewed Timeline';
      case 'property_view':
        return 'Viewed Property';
      case 'feedback_submit':
        return 'Submitted Feedback';
      case 'email_open':
        return 'Opened Email';
      default:
        return eventType.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
    }
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
            className="bg-slate-800 border border-slate-700 rounded-2xl w-full max-w-5xl max-h-[90vh] overflow-hidden"
            onClick={e => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b border-slate-700">
              <div className="flex items-center space-x-3">
                <BarChart3 className="w-6 h-6 text-blue-400" />
                <div>
                  <h2 className="text-2xl font-bold text-white">Agent Analytics</h2>
                  <p className="text-slate-400 text-sm">Essential metrics for real estate agents</p>
                </div>
              </div>
              
              <div className="flex items-center space-x-2">
                <button
                  onClick={handleRefresh}
                  disabled={refreshing}
                  className="p-2 hover:bg-slate-700 rounded-lg transition-colors disabled:opacity-50"
                >
                  <RefreshCw className={`w-5 h-5 text-slate-400 ${refreshing ? 'animate-spin' : ''}`} />
                </button>
                <button
                  onClick={downloadCSV}
                  className="flex items-center space-x-2 px-3 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors"
                >
                  <Download className="w-4 h-4" />
                  <span>CSV</span>
                </button>
                <button
                  onClick={onClose}
                  className="p-2 hover:bg-slate-700 rounded-lg transition-colors"
                >
                  <X className="w-5 h-5 text-slate-400" />
                </button>
              </div>
            </div>

            {/* Tabs */}
            <div className="border-b border-slate-700">
              <div className="px-6">
                <div className="flex space-x-1">
                  <button
                    onClick={() => setActiveTab('overview')}
                    className={`px-4 py-3 text-sm font-medium transition-colors relative ${
                      activeTab === 'overview'
                        ? 'text-blue-400'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    Overview
                    {activeTab === 'overview' && (
                      <motion.div
                        layoutId="activeTab"
                        className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-400"
                      />
                    )}
                  </button>
                  <button
                    onClick={() => setActiveTab('client')}
                    className={`px-4 py-3 text-sm font-medium transition-colors relative ${
                      activeTab === 'client'
                        ? 'text-blue-400'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    Client Insights
                    {activeTab === 'client' && (
                      <motion.div
                        layoutId="activeTab"
                        className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-400"
                      />
                    )}
                  </button>
                </div>
              </div>
            </div>

            {/* Content */}
            <div className="p-6 overflow-y-auto max-h-[calc(90vh-180px)]">
              {/* Overview Tab */}
              {activeTab === 'overview' && (
                <div className="space-y-6">
                  {isLoading ? (
                    <div className="flex items-center justify-center py-12">
                      <RefreshCw className="w-8 h-8 text-blue-400 animate-spin" />
                    </div>
                  ) : dashboardData ? (
                    <>
                      {/* Stats Grid */}
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                        <div className="bg-slate-700/30 rounded-lg p-4">
                          <div className="flex items-center space-x-3">
                            <Users className="w-8 h-8 text-blue-400" />
                            <div>
                              <p className="text-slate-400 text-sm">Total Clients</p>
                              <p className="text-2xl font-bold text-white">{dashboardData.totalClients}</p>
                            </div>
                          </div>
                        </div>
                        
                        <div className="bg-slate-700/30 rounded-lg p-4">
                          <div className="flex items-center space-x-3">
                            <BarChart3 className="w-8 h-8 text-green-400" />
                            <div>
                              <p className="text-slate-400 text-sm">Total Properties</p>
                              <p className="text-2xl font-bold text-white">{dashboardData.totalProperties}</p>
                            </div>
                          </div>
                        </div>
                        
                        <div className="bg-slate-700/30 rounded-lg p-4">
                          <div className="flex items-center space-x-3">
                            <Eye className="w-8 h-8 text-purple-400" />
                            <div>
                              <p className="text-slate-400 text-sm">Total Views</p>
                              <p className="text-2xl font-bold text-white">{dashboardData.totalViews}</p>
                            </div>
                          </div>
                        </div>
                        
                        <div className="bg-slate-700/30 rounded-lg p-4">
                          <div className="flex items-center space-x-3">
                            <Activity className="w-8 h-8 text-orange-400" />
                            <div>
                              <p className="text-slate-400 text-sm">Recent Activity (24h)</p>
                              <p className="text-2xl font-bold text-white">{dashboardData.recentActivity}</p>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Feedback Stats */}
                      <div className="bg-slate-700/30 rounded-lg p-6">
                        <h3 className="text-lg font-semibold text-white mb-4 flex items-center">
                          <Heart className="w-5 h-5 mr-2 text-pink-400" />
                          Client Feedback
                        </h3>
                        <div className="grid grid-cols-3 gap-4">
                          <div className="text-center">
                            <div className="text-2xl font-bold text-pink-400">{dashboardData.feedbackStats.love}</div>
                            <div className="text-sm text-slate-400">Love It! ❤️</div>
                          </div>
                          <div className="text-center">
                            <div className="text-2xl font-bold text-green-400">{dashboardData.feedbackStats.like}</div>
                            <div className="text-sm text-slate-400">Let's Talk 💬</div>
                          </div>
                          <div className="text-center">
                            <div className="text-2xl font-bold text-orange-400">{dashboardData.feedbackStats.dislike}</div>
                            <div className="text-sm text-slate-400">Not for Me ❌</div>
                          </div>
                        </div>
                      </div>

                      {/* Engagement */}
                      <div className="bg-slate-700/30 rounded-lg p-6">
                        <h3 className="text-lg font-semibold text-white mb-4 flex items-center">
                          <TrendingUp className="w-5 h-5 mr-2 text-blue-400" />
                          Engagement
                        </h3>
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <p className="text-slate-400 text-sm">Active Timelines (24h)</p>
                            <p className="text-2xl font-bold text-white">{dashboardData.activeTimelines}</p>
                          </div>
                          <div>
                            <p className="text-slate-400 text-sm">Engagement Rate</p>
                            <p className="text-2xl font-bold text-white">
                              {dashboardData.totalClients > 0 
                                ? Math.round((dashboardData.activeTimelines / dashboardData.totalClients) * 100) 
                                : 0}%
                            </p>
                          </div>
                        </div>
                      </div>
                    </>
                  ) : (
                    <div className="text-center py-12">
                      <BarChart3 className="w-12 h-12 text-slate-600 mx-auto mb-4" />
                      <p className="text-slate-400">No analytics data available</p>
                    </div>
                  )}
                </div>
              )}

              {/* Client Insights Tab - STREAMLINED */}
              {activeTab === 'client' && (
                <div className="space-y-6">
                  {/* Client Selector */}
                  <div className="bg-slate-700/30 rounded-lg p-4">
                    <label className="block text-sm font-medium text-slate-300 mb-2">
                      Select Client for Insights
                    </label>
                    <select
                      value={selectedClientId}
                      onChange={(e) => setSelectedClientId(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                    >
                      <option value="">Choose a client...</option>
                      {clients.map((client) => (
                        <option key={client.id} value={client.id}>
                          {client.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Client Analytics */}
                  {selectedClientId && (
                    <div className="space-y-4">
                      {isLoading ? (
                        <div className="flex items-center justify-center py-12">
                          <RefreshCw className="w-8 h-8 text-blue-400 animate-spin" />
                        </div>
                      ) : clientAnalytics ? (
                        <>
                          {/* Key Metrics */}
                          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                            <div className="bg-slate-700/30 rounded-lg p-4 text-center">
                              <div className="text-2xl font-bold text-blue-400">{clientAnalytics.engagementScore}</div>
                              <div className="text-sm text-slate-400">Engagement Score</div>
                            </div>
                            <div className="bg-slate-700/30 rounded-lg p-4 text-center">
                              <div className="text-2xl font-bold text-green-400">{clientAnalytics.responseRate}%</div>
                              <div className="text-sm text-slate-400">Response Rate</div>
                            </div>
                            <div className="bg-slate-700/30 rounded-lg p-4 text-center">
                              <div className="text-2xl font-bold text-purple-400">{clientAnalytics.emailOpenRate}%</div>
                              <div className="text-sm text-slate-400">Email Open Rate</div>
                            </div>
                            <div className="bg-slate-700/30 rounded-lg p-4 text-center">
                              <div className="text-2xl font-bold text-orange-400">{clientAnalytics.averageResponseTime}h</div>
                              <div className="text-sm text-slate-400">Avg Response Time</div>
                            </div>
                          </div>

                          {/* Preferred Times for Scheduling */}
                          <div className="bg-slate-700/30 rounded-lg p-6">
                            <h3 className="text-lg font-semibold text-white mb-4 flex items-center">
                              <Clock className="w-5 h-5 mr-2 text-purple-400" />
                              Best Times to Send Properties
                            </h3>
                            <div className="grid grid-cols-3 gap-4">
                              {clientAnalytics.preferredTimes.map((timeSlot, idx) => (
                                <div key={idx} className="text-center p-4 bg-slate-800/50 rounded-lg">
                                  <div className="text-xl font-bold text-white">{timeSlot.percentage}%</div>
                                  <div className="text-sm text-slate-400">{timeSlot.time}</div>
                                  <div className="text-xs text-slate-500">{timeSlot.count} activities</div>
                                </div>
                              ))}
                            </div>
                          </div>

                          {/* Recent Activity */}
                          <div className="bg-slate-700/30 rounded-lg p-4">
                            <h3 className="text-lg font-semibold text-white mb-4 flex items-center">
                              <Activity className="w-5 h-5 mr-2 text-blue-400" />
                              Recent Activity ({clientActivity.length} events)
                            </h3>
                            <div className="space-y-2 max-h-60 overflow-y-auto">
                              {clientActivity.slice(0, 10).map((activity) => (
                                <div
                                  key={activity.id}
                                  className="flex items-center justify-between p-3 bg-slate-800/30 rounded-lg text-sm"
                                >
                                  <span className="text-white font-medium">
                                    {formatEventType(activity.eventType)}
                                  </span>
                                  <span className="text-xs text-slate-400">
                                    {new Date(activity.timestamp).toLocaleString()}
                                  </span>
                                </div>
                              ))}
                            </div>
                          </div>
                        </>
                      ) : (
                        <div className="text-center py-12">
                          <BarChart3 className="w-12 h-12 text-slate-600 mx-auto mb-4" />
                          <p className="text-slate-400">No analytics data available for this client</p>
                        </div>
                      )}
                    </div>
                  )}

                  {!selectedClientId && (
                    <div className="text-center py-12">
                      <Users className="w-12 h-12 text-slate-600 mx-auto mb-4" />
                      <p className="text-slate-400 mb-2">Select a client to view their insights</p>
                      <p className="text-xs text-slate-500">Response patterns • Preferred times • Engagement metrics</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}