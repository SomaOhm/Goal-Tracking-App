import React from 'react';
import { useNavigate, useLocation } from 'react-router';
import { Home, Calendar, Users, MessageCircle, User } from 'lucide-react';

export const BottomNav: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();

  const navItems = [
    { path: '/', icon: Home, label: 'Home' },
    { path: '/calendar', icon: Calendar, label: 'Calendar' },
    { path: '/groups', icon: Users, label: 'Groups' },
    { path: '/chat', icon: MessageCircle, label: 'Coach' },
    { path: '/profile', icon: User, label: 'Profile' },
  ];

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-[#E0D5F0] shadow-2xl z-50">
      <div className="max-w-md mx-auto flex justify-around items-center h-20 px-2">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = location.pathname === item.path;

          return (
            <button
              key={item.path}
              onClick={() => navigate(item.path)}
              className="flex flex-col items-center justify-center gap-1 px-3 py-2 rounded-2xl transition-all"
              style={{
                color: isActive ? '#C8B3E0' : '#8A8A8A',
                backgroundColor: isActive ? '#F5F0FF' : 'transparent',
              }}
            >
              <Icon className={`w-5 h-5 ${isActive ? 'fill-[#C8B3E0]/20' : ''}`} />
              <span className="text-[10px]">{item.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
};
