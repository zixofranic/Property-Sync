'use client';

import { useEffect, useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { CheckCircle, Loader2 } from 'lucide-react';
import { useMissionControlStore } from '@/stores/missionControlStore';

function VerifyEmailContent() {
  const searchParams = useSearchParams();
  const token = searchParams.get('token');
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const { setUser, addNotification } = useMissionControlStore();

  useEffect(() => {
    if (!token) {
      window.location.href = '/login?error=invalid-token';
      return;
    }

    const verifyEmailAndLogin = async () => {
      try {
        const response = await fetch(`http://localhost:3001/api/v1/auth/verify-email`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ token }),
        });

        const data = await response.json();

        if (response.ok) {
          // Set authentication cookies
          document.cookie = `accessToken=${data.accessToken}; path=/; max-age=${60 * 60 * 24 * 7}`;
          document.cookie = `refreshToken=${data.refreshToken}; path=/; max-age=${60 * 60 * 24 * 30}`;
          
          // Set user in store
          setUser(data.user);
          
          setStatus('success');
          
          addNotification({
            type: 'success',
            title: 'Welcome to Property Sync!',
            message: `Email verified! Welcome ${data.user.firstName}!`
          });

          // Immediate redirect to dashboard
          setTimeout(() => {
            window.location.href = '/dashboard';
          }, 1500);
        } else {
          window.location.href = `/login?error=${encodeURIComponent(data.message)}`;
        }
      } catch (error) {
        window.location.href = '/login?error=verification-failed';
      }
    };

    verifyEmailAndLogin();
  }, [token]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="bg-slate-800/50 backdrop-blur-sm border border-slate-700 rounded-2xl p-8 shadow-2xl text-center">
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-white mb-2">🚀 Welcome Aboard!</h1>
            <p className="text-slate-400">Activating your Mission Control...</p>
          </div>

          {status === 'loading' && (
            <div className="flex flex-col items-center">
              <Loader2 className="w-16 h-16 text-blue-500 animate-spin mb-4" />
              <p className="text-slate-300">Verifying email and logging you in...</p>
            </div>
          )}

          {status === 'success' && (
            <div className="flex flex-col items-center">
              <CheckCircle className="w-16 h-16 text-green-500 mb-4" />
              <p className="text-green-400 font-medium mb-2">✅ Email Verified!</p>
              <p className="text-slate-300 text-sm">Redirecting to Mission Control...</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function VerifyEmailPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center">
        <div className="flex flex-col items-center">
          <Loader2 className="w-8 h-8 text-blue-500 animate-spin mb-4" />
          <p className="text-slate-300">Loading...</p>
        </div>
      </div>
    }>
      <VerifyEmailContent />
    </Suspense>
  );
}