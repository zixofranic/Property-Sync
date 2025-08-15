'use client';

import { withAuth } from '@/providers/AuthProvider';
import { MissionControl } from '@/components/dashboard/MissionControl';

function DashboardPage() {
console.log('🟢 DASHBOARD: Loading');
  return <MissionControl />;
}

export default withAuth(DashboardPage);