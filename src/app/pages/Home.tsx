import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { Card } from '../components/ui/card';
import { Progress } from '../components/ui/progress';
import { CheckCircle2, Circle, Flame, Trash2, Calendar as CalendarIcon } from 'lucide-react';
import { format } from 'date-fns';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../components/ui/dialog';
import { Textarea } from '../components/ui/textarea';
import { Button } from '../components/ui/button';

export const Home: React.FC = () => {
  const { user, goals, completeGoal, deleteGoal } = useApp();
  const [reflectionDialogOpen, setReflectionDialogOpen] = useState(false);
  const [selectedGoal, setSelectedGoal] = useState<string | null>(null);
  const [reflection, setReflection] = useState('');
  
  const today = format(new Date(), 'yyyy-MM-dd');
  const myGoals = goals.filter(g => g.userId === user?.id);

  const calculateStreak = (goal: typeof goals[0]) => {
    if (goal.completions.length === 0) return 0;
    
    let streak = 0;
    const sortedCompletions = [...goal.completions].sort((a, b) => 
      new Date(b.date).getTime() - new Date(a.date).getTime()
    );
    
    let currentDate = new Date();
    for (const completion of sortedCompletions) {
      const completionDate = new Date(completion.date);
      const diffDays = Math.floor((currentDate.getTime() - completionDate.getTime()) / (1000 * 60 * 60 * 24));
      
      if (diffDays === streak) {
        streak++;
      } else {
        break;
      }
    }
    
    return streak;
  };

  const isCompletedToday = (goal: typeof goals[0]) => {
    return goal.completions.some(c => c.date === today);
  };

  const getTodayProgress = () => {
    const todayGoals = myGoals.length;
    const completedToday = myGoals.filter(g => isCompletedToday(g)).length;
    return todayGoals > 0 ? (completedToday / todayGoals) * 100 : 0;
  };

  const handleGoalClick = (goalId: string) => {
    const goal = myGoals.find(g => g.id === goalId);
    if (!goal) return;
    
    if (isCompletedToday(goal)) {
      completeGoal(goalId, today);
    } else {
      setSelectedGoal(goalId);
      setReflectionDialogOpen(true);
    }
  };

  const handleReflectionSubmit = () => {
    if (selectedGoal) {
      completeGoal(selectedGoal, today, reflection);
      setReflection('');
      setSelectedGoal(null);
      setReflectionDialogOpen(false);
      
      // Show success message
      import('sonner').then(({ toast }) => {
        const messages = [
          '🎉 Amazing work!',
          '✨ You\'re on fire!',
          '💪 Keep it up!',
          '🌟 Proud of you!',
          '🎯 Goal crushed!',
        ];
        toast.success(messages[Math.floor(Math.random() * messages.length)]);
      });
    }
  };

  return (
    <div className="pb-28 px-4 pt-6 max-w-md mx-auto">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-3xl mb-2 text-[#4A4A4A]">Hello, {user?.name}! 👋</h1>
        <p className="text-[#8A8A8A]">{format(new Date(), 'EEEE, MMMM d, yyyy')}</p>
      </div>

      {/* Today's Progress */}
      <Card className="p-6 mb-6 rounded-3xl shadow-lg border-none" style={{ background: 'linear-gradient(135deg, #FFD4C8 0%, #E0D5F0 100%)' }}>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-lg text-[#4A4A4A]">Today's Progress</h3>
          <CalendarIcon className="w-5 h-5 text-[#4A4A4A]" />
        </div>
        <div className="text-3xl mb-3 text-[#4A4A4A]">
          {myGoals.filter(g => isCompletedToday(g)).length} / {myGoals.length}
        </div>
        <Progress value={getTodayProgress()} className="h-3 bg-white/50" />
        <p className="text-sm text-[#4A4A4A] mt-2 opacity-80">
          {getTodayProgress() === 100 ? '🎉 All goals completed!' : 'Keep going!'}
        </p>
      </Card>

      {/* Goals List */}
      <div className="space-y-4">
        <h2 className="text-xl text-[#4A4A4A] mb-4">Your Goals</h2>
        
        {myGoals.length === 0 ? (
          <Card className="p-8 text-center rounded-3xl shadow-md border-none bg-white">
            <div className="w-16 h-16 rounded-full bg-[#E0D5F0] mx-auto mb-4 flex items-center justify-center">
              <CalendarIcon className="w-8 h-8 text-[#C8B3E0]" />
            </div>
            <p className="text-[#8A8A8A] mb-2">No goals yet</p>
            <p className="text-sm text-[#8A8A8A]">Tap the + button to create your first goal</p>
          </Card>
        ) : (
          myGoals.map((goal) => {
            const completed = isCompletedToday(goal);
            const streak = calculateStreak(goal);
            
            return (
              <Card 
                key={goal.id} 
                className="p-5 rounded-3xl shadow-md border-none bg-white hover:shadow-lg transition-all cursor-pointer relative overflow-hidden"
              >
                {/* Background gradient */}
                <div 
                  className="absolute inset-0 opacity-5"
                  style={{
                    background: completed 
                      ? 'linear-gradient(135deg, #C8B3E0 0%, #A8D8EA 100%)'
                      : 'transparent'
                  }}
                />
                
                <div className="relative">
                  <div className="flex items-start gap-4">
                    {/* Checkbox */}
                    <button
                      onClick={() => handleGoalClick(goal.id)}
                      className="mt-1 flex-shrink-0"
                    >
                      {completed ? (
                        <CheckCircle2 className="w-8 h-8 text-[#C8B3E0] fill-[#C8B3E0]/20" />
                      ) : (
                        <Circle className="w-8 h-8 text-[#8A8A8A]" />
                      )}
                    </button>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <h3 className={`text-lg mb-1 ${completed ? 'line-through text-[#8A8A8A]' : 'text-[#4A4A4A]'}`}>
                        {goal.title}
                      </h3>
                      {goal.description && (
                        <p className="text-sm text-[#8A8A8A] mb-3">{goal.description}</p>
                      )}
                      
                      {/* Metadata */}
                      <div className="flex items-center gap-4 text-sm">
                        <div className="flex items-center gap-1">
                          <Flame className="w-4 h-4 text-[#FFB5A0]" />
                          <span className="text-[#4A4A4A]">{streak} day{streak !== 1 ? 's' : ''}</span>
                        </div>
                        <span className="px-3 py-1 rounded-full text-xs" style={{ backgroundColor: '#FFE5A0', color: '#4A4A4A' }}>
                          {goal.frequency}
                        </span>
                      </div>
                    </div>

                    {/* Delete button */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        if (confirm('Delete this goal?')) {
                          deleteGoal(goal.id);
                        }
                      }}
                      className="flex-shrink-0 p-2 hover:bg-red-50 rounded-xl transition-colors"
                    >
                      <Trash2 className="w-5 h-5 text-red-400" />
                    </button>
                  </div>
                </div>
              </Card>
            );
          })
        )}
      </div>

      {/* Reflection Dialog */}
      <Dialog open={reflectionDialogOpen} onOpenChange={setReflectionDialogOpen}>
        <DialogContent className="rounded-3xl max-w-md mx-4 bg-white">
          <DialogHeader>
            <DialogTitle className="text-2xl text-[#4A4A4A]">Add a Reflection</DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4 mt-4">
            <p className="text-[#8A8A8A]">How did completing this goal make you feel?</p>
            <Textarea
              value={reflection}
              onChange={(e) => setReflection(e.target.value)}
              placeholder="Optional reflection..."
              rows={4}
              className="rounded-2xl border-[#E0D5F0] focus:border-[#C8B3E0] bg-[#FFFBF7]"
            />
            
            <div className="flex gap-3">
              <Button
                onClick={() => {
                  setReflection('');
                  setSelectedGoal(null);
                  setReflectionDialogOpen(false);
                }}
                variant="outline"
                className="flex-1 rounded-2xl"
              >
                Cancel
              </Button>
              <Button 
                onClick={handleReflectionSubmit}
                className="flex-1 rounded-2xl text-white"
                style={{ background: 'linear-gradient(135deg, #C8B3E0 0%, #B39DD1 100%)' }}
              >
                Complete
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};