import React, { useState, useEffect } from 'react';
import { Outlet } from 'react-router';
import { useApp } from '../context/AppContext';
import { BottomNav } from '../components/BottomNav';
import { FAB } from '../components/FAB';
import { WelcomeDialog } from '../components/WelcomeDialog';
import { Login } from './Login';
import { isSupabaseEnabled } from '../lib/supabase';

export const Layout: React.FC = () => {
  const { user, apiReady } = useApp();
  const [showWelcome, setShowWelcome] = useState(false);

  useEffect(() => {
    if (user && !localStorage.getItem(`welcome_${user.id}`)) setShowWelcome(true);
  }, [user]);

  const closeWelcome = () => {
    if (user) localStorage.setItem(`welcome_${user.id}`, 'true');
    setShowWelcome(false);
  };

  if (isSupabaseEnabled() && !apiReady)
    return <div className="min-h-screen flex items-center justify-center bg-[#FFFBF7]"><div className="text-[#8A8A8A]">Loading...</div></div>;

  if (!user) return <Login />;

  return (
    <div className="min-h-screen bg-[#FFFBF7]">
      <main className="w-full max-w-6xl mx-auto px-4 sm:px-6 min-h-[calc(100vh-5rem)]">
        <Outlet />
      </main>
      <BottomNav />
      <FAB />
      <WelcomeDialog open={showWelcome} onClose={closeWelcome} />
    </div>
  );
};
