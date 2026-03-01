import React, { useMemo, useState } from 'react';
import { useApp } from '../context/AppContext';
import { Card } from '../components/ui/card';
import { Progress } from '../components/ui/progress';
import { CheckCircle2, Circle, Trash2, Calendar as CalendarIcon, ChevronDown, ChevronUp, Square, CheckSquare, Clock, TrendingUp, Smile } from 'lucide-react';
import { format, subWeeks, startOfWeek, subDays } from 'date-fns';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  LineChart, Line,
} from 'recharts';
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '../components/ui/chart';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../components/ui/dialog';
import { Textarea } from '../components/ui/textarea';
import { Button } from '../components/ui/button';

export const Home: React.FC = () => {
  const { user, goals, checkIns, completeGoal, deleteGoal, updateGoal } = useApp();
  type ChartRange = 'week' | 'twoWeeks' | 'month';
  const [completionsRange, setCompletionsRange] = useState<ChartRange>('twoWeeks');
  const [moodRange, setMoodRange] = useState<ChartRange>('twoWeeks');
  const [reflectionDialogOpen, setReflectionDialogOpen] = useState(false);
  const [selectedGoal, setSelectedGoal] = useState<string | null>(null);
  const [reflection, setReflection] = useState('');
  const [expandedGoal, setExpandedGoal] = useState<string | null>(null);
  const [taskDone, setTaskDone] = useState<Record<string, Set<number>>>({});
  
  const toggleTask = (goalId: string, idx: number) => {
    setTaskDone(prev => {
      const s = new Set(prev[goalId] ?? []);
      s.has(idx) ? s.delete(idx) : s.add(idx);
      return { ...prev, [goalId]: s };
    });
  };

  const fmtDate = (d: string) => format(new Date(d + 'T00:00:00'), 'MMM d');

  const timeFrameLabel = (goal: { startDate?: string; endDate?: string }) => {
    if (goal.startDate && goal.endDate) return `${fmtDate(goal.startDate)} – ${fmtDate(goal.endDate)}`;
    if (goal.startDate) return `From ${fmtDate(goal.startDate)}`;
    if (goal.endDate) return `Until ${fmtDate(goal.endDate)}`;
    return null;
  };

  const today = format(new Date(), 'yyyy-MM-dd');
  const myGoals = goals.filter(g => g.userId === user?.id);
  const myCheckIns = checkIns.filter(c => c.userId === user?.id);

  const weekCount = completionsRange === 'week' ? 1 : completionsRange === 'twoWeeks' ? 2 : 4;
  const dayCount = moodRange === 'week' ? 7 : moodRange === 'twoWeeks' ? 14 : 30;

  const weeklyCompletionsData = useMemo(() => {
    const weekStart = (d: Date) => startOfWeek(d, { weekStartsOn: 0 });
    const weeks: { week: string; completions: number }[] = [];
    for (let i = weekCount - 1; i >= 0; i--) {
      const w = subWeeks(new Date(), i);
      const key = format(weekStart(w), 'MMM d');
      weeks.push({ week: key, completions: 0 });
    }
    const keyToIdx = Object.fromEntries(weeks.map((w, i) => [w.week, i]));
    const cutoff = subWeeks(new Date(), weekCount);
    for (const goal of myGoals) {
      for (const c of goal.completions) {
        const d = new Date(c.date + 'T00:00:00');
        if (d >= cutoff) {
          const key = format(weekStart(d), 'MMM d');
          const idx = keyToIdx[key];
          if (idx !== undefined) weeks[idx].completions++;
        }
      }
    }
    return weeks;
  }, [myGoals, weekCount]);

  const moodData = useMemo(() => {
    return Array.from({ length: dayCount }, (_, i) => {
      const d = subDays(new Date(), dayCount - 1 - i);
      const key = format(d, 'yyyy-MM-dd');
      const ci = myCheckIns.find(c => c.date === key);
      return {
        date: format(d, dayCount <= 14 ? 'MMM d' : 'M/d'),
        mood: ci?.mood ?? null,
        fullDate: key,
      };
    });
  }, [myCheckIns, dayCount]);

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
          '✨ Nice one!',
          '💪 Keep it up!',
          '🌟 Proud of you!',
          '🎯 Goal crushed!',
        ];
        toast.success(messages[Math.floor(Math.random() * messages.length)]);
      });
    }
  };

  return (
    <div className="pb-28 pt-6 w-full">
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

      {/* Charts side by side */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        {/* Weekly Completions */}
        <Card className="p-6 rounded-3xl shadow-md border-none bg-white flex flex-col min-w-0">
          <div className="flex items-center justify-between gap-2 mb-3 flex-wrap">
            <div className="flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-[#C8B3E0]" />
              <h3 className="text-lg text-[#4A4A4A]">Completions</h3>
            </div>
            <div className="flex gap-1.5">
              {(['week', 'twoWeeks', 'month'] as const).map((range) => (
                <button
                  key={range}
                  type="button"
                  onClick={() => setCompletionsRange(range)}
                  className={`cursor-pointer px-2.5 py-1 rounded-lg text-xs font-medium transition-colors ${
                    completionsRange === range ? 'text-white' : 'text-[#4A4A4A] bg-[#F5F5F5] hover:bg-[#EEE]'
                  }`}
                  style={completionsRange === range ? { background: 'linear-gradient(135deg, #C8B3E0 0%, #B39DD1 100%)' } : undefined}
                >
                  {range === 'week' ? 'Week' : range === 'twoWeeks' ? '2 wks' : 'Month'}
                </button>
              ))}
            </div>
          </div>
          <ChartContainer config={{ completions: { label: 'Completions', color: '#C8B3E0' } }} className="h-[180px] w-full min-h-0">
            <BarChart data={weeklyCompletionsData} margin={{ top: 8, right: 8, bottom: 8, left: 8 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#F0F0F0" />
              <XAxis dataKey="week" tick={{ fill: '#8A8A8A', fontSize: 10 }} />
              <YAxis tick={{ fill: '#8A8A8A', fontSize: 10 }} allowDecimals={false} width={24} />
              <ChartTooltip content={<ChartTooltipContent />} />
              <Bar dataKey="completions" fill="#C8B3E0" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ChartContainer>
        </Card>

        {/* Mood Over Time */}
        <Card className="p-6 rounded-3xl shadow-md border-none bg-white flex flex-col min-w-0">
          <div className="flex items-center justify-between gap-2 mb-3 flex-wrap">
            <div className="flex items-center gap-2">
              <Smile className="w-5 h-5 text-[#FFB5A0]" />
              <h3 className="text-lg text-[#4A4A4A]">Mood</h3>
            </div>
            <div className="flex gap-1.5">
              {(['week', 'twoWeeks', 'month'] as const).map((range) => (
                <button
                  key={range}
                  type="button"
                  onClick={() => setMoodRange(range)}
                  className={`cursor-pointer px-2.5 py-1 rounded-lg text-xs font-medium transition-colors ${
                    moodRange === range ? 'text-white' : 'text-[#4A4A4A] bg-[#F5F5F5] hover:bg-[#EEE]'
                  }`}
                  style={moodRange === range ? { background: 'linear-gradient(135deg, #FFB5A0 0%, #E09A85 100%)' } : undefined}
                >
                  {range === 'week' ? 'Week' : range === 'twoWeeks' ? '2 wks' : 'Month'}
                </button>
              ))}
            </div>
          </div>
          <ChartContainer config={{ mood: { label: 'Mood', color: '#FFB5A0' } }} className="h-[180px] w-full min-h-0">
            <LineChart data={moodData} margin={{ top: 8, right: 8, bottom: 8, left: 8 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#F0F0F0" />
              <XAxis dataKey="date" tick={{ fill: '#8A8A8A', fontSize: 10 }} />
              <YAxis domain={[1, 5]} ticks={[1, 2, 3, 4, 5]} tick={{ fill: '#8A8A8A', fontSize: 10 }} width={20} />
              <ChartTooltip content={<ChartTooltipContent formatter={(v) => [v != null ? `${v}/5` : '—', 'Mood']} />} />
              <Line type="monotone" dataKey="mood" stroke="#FFB5A0" strokeWidth={2} dot={{ fill: '#FFB5A0', r: 3 }} connectNulls />
            </LineChart>
          </ChartContainer>
        </Card>
      </div>

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
                      type="button"
                      onClick={() => handleGoalClick(goal.id)}
                      className="cursor-pointer mt-1 flex-shrink-0"
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
                      
                      <div className="flex items-center gap-3 text-sm flex-wrap">
                        <span className="text-[#4A4A4A]">{streak} day{streak !== 1 ? 's' : ''} streak</span>
                        <span className="px-3 py-1 rounded-full text-xs" style={{ backgroundColor: '#FFE5A0', color: '#4A4A4A' }}>
                          {goal.frequency}
                        </span>
                        {timeFrameLabel(goal) && (
                          <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-[#E0F4F4] text-[#4A8A8A]">
                            <Clock className="w-3 h-3" />{timeFrameLabel(goal)}
                          </span>
                        )}
                        {goal.checklist && goal.checklist.length > 0 && (
                          <button type="button" onClick={(e) => { e.stopPropagation(); setExpandedGoal(expandedGoal === goal.id ? null : goal.id); }}
                            className="cursor-pointer flex items-center gap-1 text-xs text-[#C8B3E0] hover:text-[#B39DD1] transition-colors">
                            {(taskDone[goal.id]?.size ?? 0)}/{goal.checklist.length} tasks
                            {expandedGoal === goal.id ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                          </button>
                        )}
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); if (confirm('Delete this goal?')) deleteGoal(goal.id); }}
                      className="cursor-pointer flex-shrink-0 p-2 hover:bg-red-50 rounded-xl transition-colors"
                    >
                      <Trash2 className="w-5 h-5 text-red-400" />
                    </button>
                  </div>

                  {expandedGoal === goal.id && goal.checklist && goal.checklist.length > 0 && (
                    <div className="mt-3 pt-3 border-t border-[#F0F0F0] space-y-1.5">
                      {goal.checklist.map((task, i) => {
                        const done = taskDone[goal.id]?.has(i);
                        return (
                          <button key={i} type="button" onClick={() => toggleTask(goal.id, i)} className="cursor-pointer w-full flex items-center gap-2.5 px-2 py-1.5 rounded-xl hover:bg-[#FAFAFA] transition-colors text-left">
                            {done
                              ? <CheckSquare className="w-4 h-4 text-[#C8B3E0] shrink-0" />
                              : <Square className="w-4 h-4 text-[#C8C8C8] shrink-0" />}
                            <span className={`text-sm ${done ? 'line-through text-[#B0B0B0]' : 'text-[#4A4A4A]'}`}>{task}</span>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              </Card>
            );
          })
        )}
      </div>

      {/* Reflection Dialog */}
      <Dialog open={reflectionDialogOpen} onOpenChange={setReflectionDialogOpen}>
        <DialogContent className="rounded-3xl w-[92vw] max-w-lg mx-auto bg-white p-8">
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