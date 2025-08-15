'use client';

import { withAuth } from '@/providers/AuthProvider';
import { MissionControl } from '@/components/dashboard/MissionControl';

function DashboardPage() {
  return <MissionControl />;
}

export default withAuth(DashboardPage);