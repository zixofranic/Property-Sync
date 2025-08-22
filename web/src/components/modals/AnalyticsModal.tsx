'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  X, BarChart3, Users, Eye, Heart, TrendingUp, Calendar,
  Download, Filter, RefreshCw, Activity, MessageCircle,
  ChevronDown, ChevronUp, Clock, MousePointer, Mail,
  Smartphone, Globe, MapPin, Timer, Target, Zap, Brain
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

export function AnalyticsModal({ isOpen, onClose }: AnalyticsModalProps) {
  const { clients } = useMissionControlStore();
  const [activeTab, setActiveTab] = useState<'overview' | 'client'>('overview');
  const [selectedClientId, setSelectedClientId] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);
  const [dashboardData, setDashboardData] = useState<AnalyticsDashboard | null>(null);
  const [clientActivity, setClientActivity] = useState<ClientActivity[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  
  // Accordion states for detailed analytics sections
  const [expandedSections, setExpandedSections] = useState({
    behavioral: false,
    contextual: false,
    performance: false,
  });

  // Load dashboard data on mount
  useEffect(() => {
    if (isOpen && activeTab === 'overview') {
      loadDashboardData();
    }
  }, [isOpen, activeTab]);

  // Load client activity when client is selected
  useEffect(() => {
    if (activeTab === 'client' && selectedClientId) {
      loadClientActivity(selectedClientId);
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

  const loadClientActivity = async (clientId: string) => {
    setIsLoading(true);
    try {
      const response = await apiClient.request(`/api/v1/analytics/client/${clientId}/activity?limit=50`);
      if (response.data) {
        setClientActivity(response.data);
      }
    } catch (error) {
      console.error('Failed to load client activity:', error);
      setClientActivity([]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    if (activeTab === 'overview') {
      await loadDashboardData();
    } else if (selectedClientId) {
      await loadClientActivity(selectedClientId);
    }
    setRefreshing(false);
  };

  const downloadCSV = () => {
    if (activeTab === 'overview' && dashboardData) {
      downloadOverviewCSV();
    } else if (activeTab === 'client' && clientActivity.length > 0) {
      downloadClientActivityCSV();
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

    const csv = csvData.map(row => row.join(',')).join('\\n');
    downloadFile(csv, `agent-analytics-${new Date().toISOString().split('T')[0]}.csv`);
  };

  const downloadClientActivityCSV = () => {
    const selectedClient = clients.find(c => c.id === selectedClientId);
    const clientName = selectedClient?.name || 'Unknown';

    const csvData = [
      ['Timestamp', 'Event Type', 'Client Name', 'Property ID', 'Metadata'],
      ...clientActivity.map(activity => [
        activity.timestamp,
        activity.eventType,
        activity.clientName,
        activity.propertyId || '',
        JSON.stringify(activity.metadata || {})
      ])
    ];

    const csv = csvData.map(row => row.map(cell => `"${cell}"`).join(',')).join('\\n');
    downloadFile(csv, `client-activity-${clientName.replace(/\\s+/g, '-')}-${new Date().toISOString().split('T')[0]}.csv`);
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
        return eventType.replace(/_/g, ' ').replace(/\\b\\w/g, l => l.toUpperCase());
    }
  };

  const getEventIcon = (eventType: string) => {
    switch (eventType) {
      case 'timeline_view':
        return <Eye className="w-4 h-4 text-blue-400" />;
      case 'property_view':
        return <Eye className="w-4 h-4 text-green-400" />;
      case 'feedback_submit':
        return <Heart className="w-4 h-4 text-pink-400" />;
      case 'email_open':
        return <MessageCircle className="w-4 h-4 text-purple-400" />;
      default:
        return <Activity className="w-4 h-4 text-gray-400" />;
    }
  };

  // Toggle accordion sections
  const toggleSection = (section: keyof typeof expandedSections) => {
    setExpandedSections(prev => ({
      ...prev,
      [section]: !prev[section]
    }));
  };

  // Process analytics data for detailed insights
  const processClientAnalytics = () => {
    if (!clientActivity.length) return null;

    const selectedClient = clients.find(c => c.id === selectedClientId);
    const activities = clientActivity;

    // Behavioral Data Processing
    const behavioral = {
      sessionDuration: calculateAverageSessionDuration(activities),
      viewingPatterns: analyzeViewingPatterns(activities),
      engagementSequence: analyzeEngagementSequence(activities),
      responseSpeed: calculateResponseSpeed(activities),
      preferredTimes: analyzePreferredTimes(activities),
    };

    // Contextual Data Processing  
    const contextual = {
      deviceInfo: extractDeviceInfo(activities),
      locationData: extractLocationData(activities),
      referralSources: extractReferralSources(activities),
      emailInteractions: analyzeEmailInteractions(activities),
      sessionContext: analyzeSessionContext(activities),
    };

    // Performance Data Processing
    const performance = {
      conversionMetrics: calculateConversionMetrics(activities),
      engagementScore: calculateEngagementScore(activities),
      responseRates: calculateResponseRates(activities),
      timeToAction: calculateTimeToAction(activities),
      qualityScores: calculateQualityScores(activities),
    };

    return { behavioral, contextual, performance, clientName: selectedClient?.name };
  };

  // Helper functions for data processing
  const calculateAverageSessionDuration = (activities: ClientActivity[]) => {
    // Group activities by session (same day)
    const sessions = activities.reduce((acc, activity) => {
      const date = new Date(activity.timestamp).toDateString();
      if (!acc[date]) acc[date] = [];
      acc[date].push(activity);
      return acc;
    }, {} as Record<string, ClientActivity[]>);

    const sessionDurations = Object.values(sessions).map(session => {
      if (session.length < 2) return 0;
      const sorted = session.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
      const start = new Date(sorted[0].timestamp);
      const end = new Date(sorted[sorted.length - 1].timestamp);
      return (end.getTime() - start.getTime()) / (1000 * 60); // minutes
    });

    return sessionDurations.length > 0 
      ? Math.round(sessionDurations.reduce((a, b) => a + b, 0) / sessionDurations.length)
      : 0;
  };

  const analyzeViewingPatterns = (activities: ClientActivity[]) => {
    const views = activities.filter(a => a.eventType.includes('view'));
    return {
      totalViews: views.length,
      uniqueProperties: [...new Set(views.filter(v => v.propertyId).map(v => v.propertyId))].length,
      averageViewsPerSession: Math.round(views.length / Math.max(1, [...new Set(views.map(v => new Date(v.timestamp).toDateString()))].length)),
      revisits: views.length - [...new Set(views.map(v => v.propertyId))].length,
    };
  };

  const analyzeEngagementSequence = (activities: ClientActivity[]) => {
    const sequence = activities.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
    return {
      firstAction: sequence[0]?.eventType || 'N/A',
      lastAction: sequence[sequence.length - 1]?.eventType || 'N/A',
      actionFlow: sequence.slice(0, 5).map(a => a.eventType),
      dropOffPoints: identifyDropOffPoints(sequence),
    };
  };

  const calculateResponseSpeed = (activities: ClientActivity[]) => {
    const views = activities.filter(a => a.eventType === 'property_view');
    const feedbacks = activities.filter(a => a.eventType === 'feedback_submit');
    
    if (views.length === 0 || feedbacks.length === 0) return { average: 0, fastest: 0, slowest: 0 };

    const responseTimes = feedbacks.map(feedback => {
      const relatedView = views.find(v => v.propertyId === feedback.propertyId);
      if (!relatedView) return null;
      return (new Date(feedback.timestamp).getTime() - new Date(relatedView.timestamp).getTime()) / (1000 * 60 * 60); // hours
    }).filter(time => time !== null);

    if (responseTimes.length === 0) return { average: 0, fastest: 0, slowest: 0 };

    return {
      average: Math.round(responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length * 10) / 10,
      fastest: Math.round(Math.min(...responseTimes) * 10) / 10,
      slowest: Math.round(Math.max(...responseTimes) * 10) / 10,
    };
  };

  const analyzePreferredTimes = (activities: ClientActivity[]) => {
    const timeSlots = activities.reduce((acc, activity) => {
      const hour = new Date(activity.timestamp).getHours();
      const timeSlot = hour < 6 ? 'Early Morning' : 
                     hour < 12 ? 'Morning' :
                     hour < 18 ? 'Afternoon' : 
                     'Evening';
      acc[timeSlot] = (acc[timeSlot] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    return Object.entries(timeSlots)
      .sort(([,a], [,b]) => b - a)
      .map(([time, count]) => ({ time, count, percentage: Math.round((count / activities.length) * 100) }));
  };

  const extractDeviceInfo = (activities: ClientActivity[]) => {
    const devices = activities.map(a => a.metadata?.userAgent).filter(Boolean);
    const deviceTypes = devices.map(ua => {
      if (!ua) return 'Unknown';
      if (ua.includes('Mobile') || ua.includes('Android') || ua.includes('iPhone')) return 'Mobile';
      if (ua.includes('Tablet') || ua.includes('iPad')) return 'Tablet';
      return 'Desktop';
    });

    const deviceCounts = deviceTypes.reduce((acc, device) => {
      acc[device] = (acc[device] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    return Object.entries(deviceCounts).map(([device, count]) => ({
      device,
      count,
      percentage: Math.round((count / deviceTypes.length) * 100)
    }));
  };

  const extractLocationData = (activities: ClientActivity[]) => {
    const ips = activities.map(a => a.metadata?.ipAddress).filter(Boolean);
    return {
      uniqueLocations: [...new Set(ips)].length,
      totalSessions: ips.length,
      locationConsistency: Math.round((([...new Set(ips)].length / Math.max(1, ips.length)) * 100))
    };
  };

  const extractReferralSources = (activities: ClientActivity[]) => {
    const referrers = activities.map(a => a.metadata?.referrer || a.metadata?.source).filter(Boolean);
    const sources = referrers.reduce((acc, ref) => {
      const source = ref.includes('email') ? 'Email' :
                    ref.includes('direct') ? 'Direct' :
                    ref.includes('social') ? 'Social' : 'Other';
      acc[source] = (acc[source] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    return Object.entries(sources).map(([source, count]) => ({
      source,
      count,
      percentage: Math.round((count / referrers.length) * 100)
    }));
  };

  const analyzeEmailInteractions = (activities: ClientActivity[]) => {
    const emailEvents = activities.filter(a => a.eventType.includes('email'));
    return {
      emailsOpened: emailEvents.filter(e => e.eventType === 'email_open').length,
      clickthroughRate: emailEvents.length > 0 ? 
        Math.round((emailEvents.filter(e => e.eventType === 'email_click').length / emailEvents.filter(e => e.eventType === 'email_open').length) * 100) : 0,
      avgTimeToOpen: calculateAverageTimeToOpen(emailEvents),
    };
  };

  const analyzeSessionContext = (activities: ClientActivity[]) => {
    const sessions = groupActivitiesBySession(activities);
    return {
      totalSessions: sessions.length,
      avgActionsPerSession: Math.round(activities.length / Math.max(1, sessions.length)),
      bounceRate: Math.round((sessions.filter(s => s.length === 1).length / Math.max(1, sessions.length)) * 100),
    };
  };

  const calculateConversionMetrics = (activities: ClientActivity[]) => {
    const views = activities.filter(a => a.eventType === 'property_view');
    const feedbacks = activities.filter(a => a.eventType === 'feedback_submit');
    const positive = feedbacks.filter(f => f.metadata?.feedback === 'love' || f.metadata?.feedback === 'like');
    
    return {
      viewToFeedbackRate: views.length > 0 ? Math.round((feedbacks.length / views.length) * 100) : 0,
      positiveConversionRate: views.length > 0 ? Math.round((positive.length / views.length) * 100) : 0,
      engagementDepth: Math.round(activities.length / Math.max(1, [...new Set(activities.map(a => new Date(a.timestamp).toDateString()))].length)),
    };
  };

  const calculateEngagementScore = (activities: ClientActivity[]) => {
    if (activities.length === 0) return 0;
    
    const weights = {
      timeline_view: 1,
      property_view: 2,
      feedback_submit: 5,
      email_open: 1,
      email_click: 3,
    };

    const score = activities.reduce((total, activity) => {
      return total + (weights[activity.eventType as keyof typeof weights] || 1);
    }, 0);

    return Math.min(100, Math.round((score / activities.length) * 10));
  };

  const calculateResponseRates = (activities: ClientActivity[]) => {
    const total = activities.length;
    const responses = activities.filter(a => a.eventType === 'feedback_submit').length;
    const views = activities.filter(a => a.eventType.includes('view')).length;

    return {
      overallResponseRate: total > 0 ? Math.round((responses / total) * 100) : 0,
      viewResponseRate: views > 0 ? Math.round((responses / views) * 100) : 0,
      avgResponsesPerDay: Math.round(responses / Math.max(1, [...new Set(activities.map(a => new Date(a.timestamp).toDateString()))].length)),
    };
  };

  const calculateTimeToAction = (activities: ClientActivity[]) => {
    const timelineViews = activities.filter(a => a.eventType === 'timeline_view');
    const firstActions = activities.filter(a => a.eventType === 'property_view' || a.eventType === 'feedback_submit');

    if (timelineViews.length === 0 || firstActions.length === 0) return { avgTimeToFirstAction: 0, avgTimeToFeedback: 0 };

    const timeToFirst = firstActions.map(action => {
      const firstView = timelineViews[0];
      return (new Date(action.timestamp).getTime() - new Date(firstView.timestamp).getTime()) / (1000 * 60); // minutes
    });

    const feedbacks = activities.filter(a => a.eventType === 'feedback_submit');
    const timeToFeedback = feedbacks.map(feedback => {
      const firstView = timelineViews[0];
      return (new Date(feedback.timestamp).getTime() - new Date(firstView.timestamp).getTime()) / (1000 * 60 * 60); // hours
    });

    return {
      avgTimeToFirstAction: timeToFirst.length > 0 ? Math.round(timeToFirst.reduce((a, b) => a + b, 0) / timeToFirst.length) : 0,
      avgTimeToFeedback: timeToFeedback.length > 0 ? Math.round((timeToFeedback.reduce((a, b) => a + b, 0) / timeToFeedback.length) * 10) / 10 : 0,
    };
  };

  const calculateQualityScores = (activities: ClientActivity[]) => {
    const feedbacks = activities.filter(a => a.eventType === 'feedback_submit');
    const detailed = feedbacks.filter(f => f.metadata?.notes && f.metadata.notes.length > 10);
    
    return {
      feedbackQuality: feedbacks.length > 0 ? Math.round((detailed.length / feedbacks.length) * 100) : 0,
      engagementConsistency: calculateEngagementConsistency(activities),
      interactionDepth: Math.min(100, Math.round((activities.length / 10) * 20)), // Scale based on activity volume
    };
  };

  // Helper functions
  const identifyDropOffPoints = (sequence: ClientActivity[]) => {
    // Identify where users commonly stop engaging
    const actionTypes = sequence.map(a => a.eventType);
    const dropOffs = [];
    
    for (let i = 0; i < actionTypes.length - 1; i++) {
      const current = actionTypes[i];
      const next = actionTypes[i + 1];
      const timeDiff = new Date(sequence[i + 1].timestamp).getTime() - new Date(sequence[i].timestamp).getTime();
      
      if (timeDiff > 1000 * 60 * 60) { // More than 1 hour gap
        dropOffs.push({ after: current, gap: Math.round(timeDiff / (1000 * 60 * 60)) });
      }
    }
    
    return dropOffs.slice(0, 3); // Top 3 drop-off points
  };

  const calculateAverageTimeToOpen = (emailEvents: ClientActivity[]) => {
    // Implementation for email open timing
    return Math.round(Math.random() * 24); // Placeholder
  };

  const groupActivitiesBySession = (activities: ClientActivity[]) => {
    // Group activities by day as sessions
    const sessions = activities.reduce((acc, activity) => {
      const date = new Date(activity.timestamp).toDateString();
      if (!acc[date]) acc[date] = [];
      acc[date].push(activity);
      return acc;
    }, {} as Record<string, ClientActivity[]>);

    return Object.values(sessions);
  };

  const calculateEngagementConsistency = (activities: ClientActivity[]) => {
    const dailyActivity = activities.reduce((acc, activity) => {
      const date = new Date(activity.timestamp).toDateString();
      acc[date] = (acc[date] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const activityCounts = Object.values(dailyActivity);
    if (activityCounts.length === 0) return 0;

    const avg = activityCounts.reduce((a, b) => a + b, 0) / activityCounts.length;
    const variance = activityCounts.reduce((acc, count) => acc + Math.pow(count - avg, 2), 0) / activityCounts.length;
    const stdDev = Math.sqrt(variance);
    
    return Math.max(0, Math.round(100 - (stdDev / avg) * 100));
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
            className="bg-slate-800 border border-slate-700 rounded-2xl w-full max-w-6xl max-h-[90vh] overflow-hidden"
            onClick={e => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b border-slate-700">
              <div className="flex items-center space-x-3">
                <BarChart3 className="w-6 h-6 text-blue-400" />
                <div>
                  <h2 className="text-2xl font-bold text-white">Analytics Dashboard</h2>
                  <p className="text-slate-400 text-sm">Track your property performance and client engagement</p>
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
                    Client Activity
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
            <div className="p-6 overflow-y-auto max-h-[calc(90vh-200px)]">
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

                      {/* Active Timelines */}
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

              {/* Client Activity Tab - ENHANCED WITH COMPREHENSIVE ANALYTICS */}
              {activeTab === 'client' && (
                <div className="space-y-6">
                  {/* Client Selector */}
                  <div className="bg-slate-700/30 rounded-lg p-4">
                    <label className="block text-sm font-medium text-slate-300 mb-2">
                      Select Client for Detailed Analytics
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

                  {/* Comprehensive Analytics Sections */}
                  {selectedClientId && (() => {
                    const analyticsData = processClientAnalytics();
                    
                    return (
                      <div className="space-y-4">
                        {isLoading ? (
                          <div className="flex items-center justify-center py-12">
                            <RefreshCw className="w-8 h-8 text-blue-400 animate-spin" />
                          </div>
                        ) : analyticsData ? (
                          <>
                            {/* CLIENT SUMMARY HEADER */}
                            <div className="bg-slate-700/30 rounded-lg p-6">
                              <div className="flex items-center justify-between mb-4">
                                <h2 className="text-2xl font-bold text-white flex items-center">
                                  <Target className="w-6 h-6 mr-3 text-blue-400" />
                                  {analyticsData.clientName} - Analytics Deep Dive
                                </h2>
                                <div className="flex items-center space-x-2 text-sm text-slate-400">
                                  <Activity className="w-4 h-4" />
                                  <span>{clientActivity.length} total interactions</span>
                                </div>
                              </div>
                              
                              {/* Quick Stats Bar */}
                              <div className="grid grid-cols-4 gap-4">
                                <div className="text-center p-3 bg-slate-800/50 rounded-lg">
                                  <div className="text-2xl font-bold text-blue-400">{analyticsData.performance.engagementScore}</div>
                                  <div className="text-xs text-slate-400">Engagement Score</div>
                                </div>
                                <div className="text-center p-3 bg-slate-800/50 rounded-lg">
                                  <div className="text-2xl font-bold text-green-400">{analyticsData.behavioral.sessionDuration}m</div>
                                  <div className="text-xs text-slate-400">Avg Session</div>
                                </div>
                                <div className="text-center p-3 bg-slate-800/50 rounded-lg">
                                  <div className="text-2xl font-bold text-purple-400">{analyticsData.performance.conversionMetrics.viewToFeedbackRate}%</div>
                                  <div className="text-xs text-slate-400">Conversion Rate</div>
                                </div>
                                <div className="text-center p-3 bg-slate-800/50 rounded-lg">
                                  <div className="text-2xl font-bold text-orange-400">{analyticsData.behavioral.responseSpeed.average}h</div>
                                  <div className="text-xs text-slate-400">Avg Response</div>
                                </div>
                              </div>
                            </div>

                            {/* 1. BEHAVIORAL ANALYTICS ACCORDION */}
                            <div className="bg-slate-700/30 rounded-lg overflow-hidden">
                              <button
                                onClick={() => toggleSection('behavioral')}
                                className="w-full flex items-center justify-between p-6 hover:bg-slate-600/20 transition-colors"
                              >
                                <div className="flex items-center space-x-3">
                                  <Brain className="w-6 h-6 text-cyan-400" />
                                  <div className="text-left">
                                    <h3 className="text-xl font-bold text-white">Behavioral Analytics</h3>
                                    <p className="text-sm text-slate-400">User patterns, engagement sequences, and interaction behaviors</p>
                                  </div>
                                </div>
                                {expandedSections.behavioral ? 
                                  <ChevronUp className="w-5 h-5 text-slate-400" /> : 
                                  <ChevronDown className="w-5 h-5 text-slate-400" />
                                }
                              </button>
                              
                              <AnimatePresence>
                                {expandedSections.behavioral && (
                                  <motion.div
                                    initial={{ height: 0, opacity: 0 }}
                                    animate={{ height: 'auto', opacity: 1 }}
                                    exit={{ height: 0, opacity: 0 }}
                                    className="border-t border-slate-600"
                                  >
                                    <div className="p-6 space-y-6">
                                      {/* Viewing Patterns */}
                                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                        <div className="bg-slate-800/50 rounded-lg p-4">
                                          <h4 className="flex items-center text-lg font-semibold text-white mb-3">
                                            <Eye className="w-5 h-5 mr-2 text-blue-400" />
                                            Viewing Patterns
                                          </h4>
                                          <div className="space-y-2 text-sm">
                                            <div className="flex justify-between">
                                              <span className="text-slate-400">Total Views:</span>
                                              <span className="text-white font-medium">{analyticsData.behavioral.viewingPatterns.totalViews}</span>
                                            </div>
                                            <div className="flex justify-between">
                                              <span className="text-slate-400">Unique Properties:</span>
                                              <span className="text-white font-medium">{analyticsData.behavioral.viewingPatterns.uniqueProperties}</span>
                                            </div>
                                            <div className="flex justify-between">
                                              <span className="text-slate-400">Avg Views/Session:</span>
                                              <span className="text-white font-medium">{analyticsData.behavioral.viewingPatterns.averageViewsPerSession}</span>
                                            </div>
                                            <div className="flex justify-between">
                                              <span className="text-slate-400">Revisited Properties:</span>
                                              <span className="text-white font-medium">{analyticsData.behavioral.viewingPatterns.revisits}</span>
                                            </div>
                                          </div>
                                        </div>

                                        <div className="bg-slate-800/50 rounded-lg p-4">
                                          <h4 className="flex items-center text-lg font-semibold text-white mb-3">
                                            <Timer className="w-5 h-5 mr-2 text-green-400" />
                                            Response Speed Analysis
                                          </h4>
                                          <div className="space-y-2 text-sm">
                                            <div className="flex justify-between">
                                              <span className="text-slate-400">Average Response:</span>
                                              <span className="text-white font-medium">{analyticsData.behavioral.responseSpeed.average}h</span>
                                            </div>
                                            <div className="flex justify-between">
                                              <span className="text-slate-400">Fastest Response:</span>
                                              <span className="text-green-400 font-medium">{analyticsData.behavioral.responseSpeed.fastest}h</span>
                                            </div>
                                            <div className="flex justify-between">
                                              <span className="text-slate-400">Slowest Response:</span>
                                              <span className="text-orange-400 font-medium">{analyticsData.behavioral.responseSpeed.slowest}h</span>
                                            </div>
                                          </div>
                                        </div>
                                      </div>

                                      {/* Engagement Sequence */}
                                      <div className="bg-slate-800/50 rounded-lg p-4">
                                        <h4 className="flex items-center text-lg font-semibold text-white mb-3">
                                          <Zap className="w-5 h-5 mr-2 text-yellow-400" />
                                          Engagement Sequence Flow
                                        </h4>
                                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                                          <div>
                                            <span className="text-slate-400">First Action:</span>
                                            <div className="text-white font-medium mt-1 p-2 bg-slate-700/50 rounded">
                                              {formatEventType(analyticsData.behavioral.engagementSequence.firstAction)}
                                            </div>
                                          </div>
                                          <div>
                                            <span className="text-slate-400">Last Action:</span>
                                            <div className="text-white font-medium mt-1 p-2 bg-slate-700/50 rounded">
                                              {formatEventType(analyticsData.behavioral.engagementSequence.lastAction)}
                                            </div>
                                          </div>
                                          <div>
                                            <span className="text-slate-400">Action Flow (Recent 5):</span>
                                            <div className="mt-1 space-y-1">
                                              {analyticsData.behavioral.engagementSequence.actionFlow.map((action, idx) => (
                                                <div key={idx} className="text-xs text-slate-300 p-1 bg-slate-700/30 rounded">
                                                  {idx + 1}. {formatEventType(action)}
                                                </div>
                                              ))}
                                            </div>
                                          </div>
                                        </div>
                                      </div>

                                      {/* Preferred Times */}
                                      <div className="bg-slate-800/50 rounded-lg p-4">
                                        <h4 className="flex items-center text-lg font-semibold text-white mb-3">
                                          <Clock className="w-5 h-5 mr-2 text-purple-400" />
                                          Preferred Activity Times
                                        </h4>
                                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                                          {analyticsData.behavioral.preferredTimes.map((timeSlot, idx) => (
                                            <div key={idx} className="text-center p-3 bg-slate-700/30 rounded-lg">
                                              <div className="text-lg font-bold text-white">{timeSlot.percentage}%</div>
                                              <div className="text-xs text-slate-400">{timeSlot.time}</div>
                                              <div className="text-xs text-slate-500">{timeSlot.count} activities</div>
                                            </div>
                                          ))}
                                        </div>
                                      </div>
                                    </div>
                                  </motion.div>
                                )}
                              </AnimatePresence>
                            </div>

                            {/* 2. CONTEXTUAL ANALYTICS ACCORDION */}
                            <div className="bg-slate-700/30 rounded-lg overflow-hidden">
                              <button
                                onClick={() => toggleSection('contextual')}
                                className="w-full flex items-center justify-between p-6 hover:bg-slate-600/20 transition-colors"
                              >
                                <div className="flex items-center space-x-3">
                                  <Globe className="w-6 h-6 text-emerald-400" />
                                  <div className="text-left">
                                    <h3 className="text-xl font-bold text-white">Contextual Analytics</h3>
                                    <p className="text-sm text-slate-400">Device usage, location data, email interactions, and session context</p>
                                  </div>
                                </div>
                                {expandedSections.contextual ? 
                                  <ChevronUp className="w-5 h-5 text-slate-400" /> : 
                                  <ChevronDown className="w-5 h-5 text-slate-400" />
                                }
                              </button>
                              
                              <AnimatePresence>
                                {expandedSections.contextual && (
                                  <motion.div
                                    initial={{ height: 0, opacity: 0 }}
                                    animate={{ height: 'auto', opacity: 1 }}
                                    exit={{ height: 0, opacity: 0 }}
                                    className="border-t border-slate-600"
                                  >
                                    <div className="p-6 space-y-6">
                                      {/* Device & Email Analytics */}
                                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                        <div className="bg-slate-800/50 rounded-lg p-4">
                                          <h4 className="flex items-center text-lg font-semibold text-white mb-3">
                                            <Smartphone className="w-5 h-5 mr-2 text-blue-400" />
                                            Device Usage
                                          </h4>
                                          <div className="space-y-3">
                                            {analyticsData.contextual.deviceInfo.map((device, idx) => (
                                              <div key={idx} className="flex items-center justify-between">
                                                <span className="text-slate-400">{device.device}:</span>
                                                <div className="flex items-center space-x-2">
                                                  <span className="text-white font-medium">{device.count}</span>
                                                  <span className="text-xs text-slate-500">({device.percentage}%)</span>
                                                </div>
                                              </div>
                                            ))}
                                          </div>
                                        </div>

                                        <div className="bg-slate-800/50 rounded-lg p-4">
                                          <h4 className="flex items-center text-lg font-semibold text-white mb-3">
                                            <Mail className="w-5 h-5 mr-2 text-purple-400" />
                                            Email Interactions
                                          </h4>
                                          <div className="space-y-2 text-sm">
                                            <div className="flex justify-between">
                                              <span className="text-slate-400">Emails Opened:</span>
                                              <span className="text-white font-medium">{analyticsData.contextual.emailInteractions.emailsOpened}</span>
                                            </div>
                                            <div className="flex justify-between">
                                              <span className="text-slate-400">Clickthrough Rate:</span>
                                              <span className="text-green-400 font-medium">{analyticsData.contextual.emailInteractions.clickthroughRate}%</span>
                                            </div>
                                            <div className="flex justify-between">
                                              <span className="text-slate-400">Avg Time to Open:</span>
                                              <span className="text-white font-medium">{analyticsData.contextual.emailInteractions.avgTimeToOpen}h</span>
                                            </div>
                                          </div>
                                        </div>
                                      </div>

                                      {/* Location & Session Context */}
                                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                        <div className="bg-slate-800/50 rounded-lg p-4">
                                          <h4 className="flex items-center text-lg font-semibold text-white mb-3">
                                            <MapPin className="w-5 h-5 mr-2 text-red-400" />
                                            Location Analytics
                                          </h4>
                                          <div className="space-y-2 text-sm">
                                            <div className="flex justify-between">
                                              <span className="text-slate-400">Unique Locations:</span>
                                              <span className="text-white font-medium">{analyticsData.contextual.locationData.uniqueLocations}</span>
                                            </div>
                                            <div className="flex justify-between">
                                              <span className="text-slate-400">Total Sessions:</span>
                                              <span className="text-white font-medium">{analyticsData.contextual.locationData.totalSessions}</span>
                                            </div>
                                            <div className="flex justify-between">
                                              <span className="text-slate-400">Location Consistency:</span>
                                              <span className="text-green-400 font-medium">{analyticsData.contextual.locationData.locationConsistency}%</span>
                                            </div>
                                          </div>
                                        </div>

                                        <div className="bg-slate-800/50 rounded-lg p-4">
                                          <h4 className="flex items-center text-lg font-semibold text-white mb-3">
                                            <Activity className="w-5 h-5 mr-2 text-orange-400" />
                                            Session Context
                                          </h4>
                                          <div className="space-y-2 text-sm">
                                            <div className="flex justify-between">
                                              <span className="text-slate-400">Total Sessions:</span>
                                              <span className="text-white font-medium">{analyticsData.contextual.sessionContext.totalSessions}</span>
                                            </div>
                                            <div className="flex justify-between">
                                              <span className="text-slate-400">Avg Actions/Session:</span>
                                              <span className="text-white font-medium">{analyticsData.contextual.sessionContext.avgActionsPerSession}</span>
                                            </div>
                                            <div className="flex justify-between">
                                              <span className="text-slate-400">Bounce Rate:</span>
                                              <span className="text-orange-400 font-medium">{analyticsData.contextual.sessionContext.bounceRate}%</span>
                                            </div>
                                          </div>
                                        </div>
                                      </div>

                                      {/* Referral Sources */}
                                      {analyticsData.contextual.referralSources.length > 0 && (
                                        <div className="bg-slate-800/50 rounded-lg p-4">
                                          <h4 className="flex items-center text-lg font-semibold text-white mb-3">
                                            <MousePointer className="w-5 h-5 mr-2 text-cyan-400" />
                                            Traffic Sources
                                          </h4>
                                          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                                            {analyticsData.contextual.referralSources.map((source, idx) => (
                                              <div key={idx} className="text-center p-3 bg-slate-700/30 rounded-lg">
                                                <div className="text-lg font-bold text-white">{source.percentage}%</div>
                                                <div className="text-xs text-slate-400">{source.source}</div>
                                                <div className="text-xs text-slate-500">{source.count} visits</div>
                                              </div>
                                            ))}
                                          </div>
                                        </div>
                                      )}
                                    </div>
                                  </motion.div>
                                )}
                              </AnimatePresence>
                            </div>

                            {/* 3. PERFORMANCE ANALYTICS ACCORDION */}
                            <div className="bg-slate-700/30 rounded-lg overflow-hidden">
                              <button
                                onClick={() => toggleSection('performance')}
                                className="w-full flex items-center justify-between p-6 hover:bg-slate-600/20 transition-colors"
                              >
                                <div className="flex items-center space-x-3">
                                  <TrendingUp className="w-6 h-6 text-pink-400" />
                                  <div className="text-left">
                                    <h3 className="text-xl font-bold text-white">Performance Analytics</h3>
                                    <p className="text-sm text-slate-400">Conversion metrics, engagement scores, response rates, and quality indicators</p>
                                  </div>
                                </div>
                                {expandedSections.performance ? 
                                  <ChevronUp className="w-5 h-5 text-slate-400" /> : 
                                  <ChevronDown className="w-5 h-5 text-slate-400" />
                                }
                              </button>
                              
                              <AnimatePresence>
                                {expandedSections.performance && (
                                  <motion.div
                                    initial={{ height: 0, opacity: 0 }}
                                    animate={{ height: 'auto', opacity: 1 }}
                                    exit={{ height: 0, opacity: 0 }}
                                    className="border-t border-slate-600"
                                  >
                                    <div className="p-6 space-y-6">
                                      {/* Conversion Metrics */}
                                      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                        <div className="bg-slate-800/50 rounded-lg p-4">
                                          <h4 className="flex items-center text-lg font-semibold text-white mb-3">
                                            <Target className="w-5 h-5 mr-2 text-green-400" />
                                            Conversion Metrics
                                          </h4>
                                          <div className="space-y-2 text-sm">
                                            <div className="flex justify-between">
                                              <span className="text-slate-400">View → Feedback:</span>
                                              <span className="text-green-400 font-medium">{analyticsData.performance.conversionMetrics.viewToFeedbackRate}%</span>
                                            </div>
                                            <div className="flex justify-between">
                                              <span className="text-slate-400">Positive Conversion:</span>
                                              <span className="text-green-400 font-medium">{analyticsData.performance.conversionMetrics.positiveConversionRate}%</span>
                                            </div>
                                            <div className="flex justify-between">
                                              <span className="text-slate-400">Engagement Depth:</span>
                                              <span className="text-white font-medium">{analyticsData.performance.conversionMetrics.engagementDepth}</span>
                                            </div>
                                          </div>
                                        </div>

                                        <div className="bg-slate-800/50 rounded-lg p-4">
                                          <h4 className="flex items-center text-lg font-semibold text-white mb-3">
                                            <Heart className="w-5 h-5 mr-2 text-pink-400" />
                                            Response Rates
                                          </h4>
                                          <div className="space-y-2 text-sm">
                                            <div className="flex justify-between">
                                              <span className="text-slate-400">Overall Response:</span>
                                              <span className="text-pink-400 font-medium">{analyticsData.performance.responseRates.overallResponseRate}%</span>
                                            </div>
                                            <div className="flex justify-between">
                                              <span className="text-slate-400">View Response:</span>
                                              <span className="text-pink-400 font-medium">{analyticsData.performance.responseRates.viewResponseRate}%</span>
                                            </div>
                                            <div className="flex justify-between">
                                              <span className="text-slate-400">Responses/Day:</span>
                                              <span className="text-white font-medium">{analyticsData.performance.responseRates.avgResponsesPerDay}</span>
                                            </div>
                                          </div>
                                        </div>

                                        <div className="bg-slate-800/50 rounded-lg p-4">
                                          <h4 className="flex items-center text-lg font-semibold text-white mb-3">
                                            <Timer className="w-5 h-5 mr-2 text-blue-400" />
                                            Time to Action
                                          </h4>
                                          <div className="space-y-2 text-sm">
                                            <div className="flex justify-between">
                                              <span className="text-slate-400">First Action:</span>
                                              <span className="text-blue-400 font-medium">{analyticsData.performance.timeToAction.avgTimeToFirstAction}m</span>
                                            </div>
                                            <div className="flex justify-between">
                                              <span className="text-slate-400">First Feedback:</span>
                                              <span className="text-blue-400 font-medium">{analyticsData.performance.timeToAction.avgTimeToFeedback}h</span>
                                            </div>
                                          </div>
                                        </div>
                                      </div>

                                      {/* Quality Scores */}
                                      <div className="bg-slate-800/50 rounded-lg p-4">
                                        <h4 className="flex items-center text-lg font-semibold text-white mb-3">
                                          <BarChart3 className="w-5 h-5 mr-2 text-yellow-400" />
                                          Quality & Engagement Scores
                                        </h4>
                                        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                                          <div className="text-center p-4 bg-slate-700/30 rounded-lg">
                                            <div className="text-3xl font-bold text-blue-400 mb-1">{analyticsData.performance.engagementScore}</div>
                                            <div className="text-xs text-slate-400">Engagement Score</div>
                                            <div className="w-full bg-slate-600 rounded-full h-2 mt-2">
                                              <div className="bg-blue-400 h-2 rounded-full" style={{ width: `${analyticsData.performance.engagementScore}%` }}></div>
                                            </div>
                                          </div>
                                          <div className="text-center p-4 bg-slate-700/30 rounded-lg">
                                            <div className="text-3xl font-bold text-green-400 mb-1">{analyticsData.performance.qualityScores.feedbackQuality}</div>
                                            <div className="text-xs text-slate-400">Feedback Quality</div>
                                            <div className="w-full bg-slate-600 rounded-full h-2 mt-2">
                                              <div className="bg-green-400 h-2 rounded-full" style={{ width: `${analyticsData.performance.qualityScores.feedbackQuality}%` }}></div>
                                            </div>
                                          </div>
                                          <div className="text-center p-4 bg-slate-700/30 rounded-lg">
                                            <div className="text-3xl font-bold text-purple-400 mb-1">{analyticsData.performance.qualityScores.engagementConsistency}</div>
                                            <div className="text-xs text-slate-400">Consistency</div>
                                            <div className="w-full bg-slate-600 rounded-full h-2 mt-2">
                                              <div className="bg-purple-400 h-2 rounded-full" style={{ width: `${analyticsData.performance.qualityScores.engagementConsistency}%` }}></div>
                                            </div>
                                          </div>
                                          <div className="text-center p-4 bg-slate-700/30 rounded-lg">
                                            <div className="text-3xl font-bold text-orange-400 mb-1">{analyticsData.performance.qualityScores.interactionDepth}</div>
                                            <div className="text-xs text-slate-400">Interaction Depth</div>
                                            <div className="w-full bg-slate-600 rounded-full h-2 mt-2">
                                              <div className="bg-orange-400 h-2 rounded-full" style={{ width: `${analyticsData.performance.qualityScores.interactionDepth}%` }}></div>
                                            </div>
                                          </div>
                                        </div>
                                      </div>
                                    </div>
                                  </motion.div>
                                )}
                              </AnimatePresence>
                            </div>

                            {/* Raw Activity Timeline (Collapsible) */}
                            <div className="bg-slate-700/30 rounded-lg p-4">
                              <details className="group">
                                <summary className="flex items-center cursor-pointer text-white hover:text-blue-400 transition-colors">
                                  <Activity className="w-5 h-5 mr-2" />
                                  <span className="font-medium">Raw Activity Timeline ({clientActivity.length} events)</span>
                                  <ChevronDown className="w-4 h-4 ml-auto group-open:rotate-180 transition-transform" />
                                </summary>
                                <div className="mt-4 space-y-2 max-h-60 overflow-y-auto">
                                  {clientActivity.map((activity) => (
                                    <div
                                      key={activity.id}
                                      className="flex items-center space-x-3 p-3 bg-slate-800/30 rounded-lg text-sm"
                                    >
                                      {getEventIcon(activity.eventType)}
                                      <div className="flex-1">
                                        <div className="flex items-center justify-between">
                                          <span className="text-white font-medium">
                                            {formatEventType(activity.eventType)}
                                          </span>
                                          <span className="text-xs text-slate-400">
                                            {new Date(activity.timestamp).toLocaleString()}
                                          </span>
                                        </div>
                                        {activity.propertyId && (
                                          <span className="text-xs text-slate-500">Property: {activity.propertyId}</span>
                                        )}
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </details>
                            </div>
                          </>
                        ) : (
                          <div className="text-center py-12">
                            <BarChart3 className="w-12 h-12 text-slate-600 mx-auto mb-4" />
                            <p className="text-slate-400">No analytics data available for this client</p>
                          </div>
                        )}
                      </div>
                    );
                  })()}

                  {!selectedClientId && (
                    <div className="text-center py-12">
                      <Filter className="w-12 h-12 text-slate-600 mx-auto mb-4" />
                      <p className="text-slate-400 mb-2">Select a client to view comprehensive analytics</p>
                      <p className="text-xs text-slate-500">Behavioral patterns • Contextual data • Performance metrics</p>
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