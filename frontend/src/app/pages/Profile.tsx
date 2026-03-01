import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { Card } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../components/ui/dialog';
import { Input } from '../components/ui/input';
import { Textarea } from '../components/ui/textarea';
import { Slider } from '../components/ui/slider';
import { LogOut, Heart, Calendar, TrendingUp, Smile } from 'lucide-react';
import { format, subDays } from 'date-fns';

export const Profile: React.FC = () => {
  const { user, logout, goals, checkIns, addCheckIn, groups } = useApp();
  const [checkInDialogOpen, setCheckInDialogOpen] = useState(false);
  const [mood, setMood] = useState(3);
  const [reflection, setReflection] = useState('');

  const myGoals = goals.filter(g => g.userId === user?.id);
  const myCheckIns = checkIns.filter(c => c.userId === user?.id);
  
  const today = format(new Date(), 'yyyy-MM-dd');
  const hasCheckedInToday = myCheckIns.some(c => c.date === today);

  const calculateTotalStreak = () => {
    const allCompletions = myGoals.flatMap(g => g.completions.map(c => c.date));
    const uniqueDates = [...new Set(allCompletions)].sort();
    
    if (uniqueDates.length === 0) return 0;
    
    let streak = 0;
    for (let i = 0; i >= -30; i--) {
      const date = format(subDays(new Date(), Math.abs(i)), 'yyyy-MM-dd');
      if (uniqueDates.includes(date)) {
        streak++;
      } else if (i < 0) {
        break;
      }
    }
    return streak;
  };

  const getTotalCompletions = () => {
    return myGoals.reduce((sum, goal) => sum + goal.completions.length, 0);
  };

  const getAverageMood = () => {
    if (myCheckIns.length === 0) return 0;
    const sum = myCheckIns.reduce((acc, c) => acc + c.mood, 0);
    return (sum / myCheckIns.length).toFixed(1);
  };

  const getMoodEmoji = (moodValue: number) => {
    const emojis = ['😞', '😕', '😐', '🙂', '😊'];
    return emojis[moodValue - 1] || '😐';
  };

  const handleCheckIn = () => {
    // Get all groups the user is a member of and make check-in visible to all
    const userGroups = groups.filter(g => g.members.includes(user?.id || '')).map(g => g.id);
    
    addCheckIn({
      date: today,
      mood,
      reflection,
      visibleToGroups: userGroups,
    });
    setMood(3);
    setReflection('');
    setCheckInDialogOpen(false);
    
    // Show success message
    import('sonner').then(({ toast }) => {
      toast.success('✨ Check-in saved! Keep taking care of yourself.');
    });
  };

  return (
    <div className="pb-28 pt-6 w-full">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-3xl mb-2 text-[#4A4A4A]">Profile</h1>
        <p className="text-[#8A8A8A]">Track your wellness journey</p>
      </div>

      {/* User Card */}
      <Card className="p-6 rounded-3xl shadow-lg border-none bg-gradient-to-br from-[#FFD4C8] to-[#E0D5F0] mb-6">
        <div className="flex items-center gap-4 mb-4">
          <div className="w-20 h-20 rounded-full bg-white shadow-lg flex items-center justify-center">
            <span className="text-3xl">{user?.name.charAt(0).toUpperCase()}</span>
          </div>
          <div>
            <h2 className="text-2xl text-[#4A4A4A] mb-1">{user?.name}</h2>
            <p className="text-[#8A8A8A]">{user?.email}</p>
          </div>
        </div>
      </Card>

      {/* Check-in Button */}
      {!hasCheckedInToday && (
        <Button
          onClick={() => setCheckInDialogOpen(true)}
          className="w-full rounded-2xl h-14 text-white shadow-lg mb-6"
          style={{ background: 'linear-gradient(135deg, #FFB5A0 0%, #FF9A7E 100%)' }}
        >
          <Heart className="w-5 h-5 mr-2" />
          Check In Today
        </Button>
      )}

      {/* Stats Grid */}
      <div className="grid grid-cols-2 gap-4 mb-6">
        <Card className="p-5 rounded-3xl shadow-md border-none bg-white">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-2xl bg-[#FFD4C8] flex items-center justify-center">
              <TrendingUp className="w-5 h-5 text-[#FFB5A0]" />
            </div>
          </div>
          <p className="text-2xl mb-1 text-[#4A4A4A]">{calculateTotalStreak()}</p>
          <p className="text-sm text-[#8A8A8A]">Day Streak</p>
        </Card>

        <Card className="p-5 rounded-3xl shadow-md border-none bg-white">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-2xl bg-[#E0D5F0] flex items-center justify-center">
              <Calendar className="w-5 h-5 text-[#C8B3E0]" />
            </div>
          </div>
          <p className="text-2xl mb-1 text-[#4A4A4A]">{getTotalCompletions()}</p>
          <p className="text-sm text-[#8A8A8A]">Completions</p>
        </Card>

        <Card className="p-5 rounded-3xl shadow-md border-none bg-white">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-2xl bg-[#D0EBF5] flex items-center justify-center">
              <Heart className="w-5 h-5 text-[#A8D8EA]" />
            </div>
          </div>
          <p className="text-2xl mb-1 text-[#4A4A4A]">{myCheckIns.length}</p>
          <p className="text-sm text-[#8A8A8A]">Check-ins</p>
        </Card>

        <Card className="p-5 rounded-3xl shadow-md border-none bg-white">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-2xl bg-[#FFF2CC] flex items-center justify-center">
              <Smile className="w-5 h-5 text-[#FFE5A0]" />
            </div>
          </div>
          <p className="text-2xl mb-1 text-[#4A4A4A]">{getAverageMood()}</p>
          <p className="text-sm text-[#8A8A8A]">Avg Mood</p>
        </Card>
      </div>

      {/* Recent Check-ins */}
      <Card className="p-6 rounded-3xl shadow-lg border-none bg-white mb-6">
        <h3 className="text-lg mb-4 text-[#4A4A4A]">Recent Check-ins</h3>
        
        {myCheckIns.length === 0 ? (
          <p className="text-center text-[#8A8A8A] py-4">No check-ins yet</p>
        ) : (
          <div className="space-y-3">
            {myCheckIns
              .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
              .slice(0, 5)
              .map((checkIn) => (
                <div 
                  key={checkIn.id} 
                  className="p-4 rounded-2xl bg-[#FFFBF7]"
                >
                  <div className="flex items-center gap-3 mb-2">
                    <span className="text-2xl">{getMoodEmoji(checkIn.mood)}</span>
                    <div className="flex-1">
                      <p className="text-sm text-[#8A8A8A]">
                        {format(new Date(checkIn.date), 'EEEE, MMM d')}
                      </p>
                    </div>
                    <span className="text-sm text-[#8A8A8A]">Mood: {checkIn.mood}/5</span>
                  </div>
                  {checkIn.reflection && (
                    <p className="text-sm text-[#4A4A4A] italic">"{checkIn.reflection}"</p>
                  )}
                </div>
              ))}
          </div>
        )}
      </Card>

      {/* Logout Button */}
      <Button
        onClick={logout}
        variant="outline"
        className="w-full rounded-2xl h-12 border-red-200 text-red-500 hover:bg-red-50"
      >
        <LogOut className="w-5 h-5 mr-2" />
        Log Out
      </Button>

      {/* Check-in Dialog */}
      <Dialog open={checkInDialogOpen} onOpenChange={setCheckInDialogOpen}>
        <DialogContent className="rounded-3xl w-[92vw] max-w-lg mx-auto bg-white p-8">
          <DialogHeader>
            <DialogTitle className="text-2xl text-[#4A4A4A]">Daily Check-in</DialogTitle>
          </DialogHeader>
          
          <div className="space-y-6 mt-4">
            <div>
              <label className="block mb-3 text-[#4A4A4A]">How are you feeling today?</label>
              <div className="flex justify-center items-center gap-4 mb-4">
                <span className="text-4xl">{getMoodEmoji(mood)}</span>
                <span className="text-2xl text-[#4A4A4A]">{mood}/5</span>
              </div>
              <Slider
                value={[mood]}
                onValueChange={(v) => setMood(v[0])}
                min={1}
                max={5}
                step={1}
                className="w-full"
              />
              <div className="flex justify-between text-xs text-[#8A8A8A] mt-2">
                <span>Low</span>
                <span>High</span>
              </div>
            </div>

            <div>
              <label className="block mb-2 text-[#4A4A4A]">Reflection (optional)</label>
              <Textarea
                value={reflection}
                onChange={(e) => setReflection(e.target.value)}
                placeholder="How's your day going? Any thoughts to share?"
                rows={4}
                className="rounded-2xl border-[#E0D5F0] focus:border-[#C8B3E0] bg-[#FFFBF7]"
              />
            </div>

            <Button 
              onClick={handleCheckIn}
              className="w-full rounded-2xl h-12 text-white"
              style={{ background: 'linear-gradient(135deg, #FFB5A0 0%, #FF9A7E 100%)' }}
            >
              <Heart className="w-5 h-5 mr-2" />
              Save Check-in
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};