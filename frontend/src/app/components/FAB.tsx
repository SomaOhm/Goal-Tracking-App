import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Plus, X, GripVertical } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../components/ui/dialog';
import { Input } from '../components/ui/input';
import { Textarea } from '../components/ui/textarea';
import { Button } from '../components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { useApp } from '../context/AppContext';
import { CreationAnimation } from './CreationAnimation';

export const FAB: React.FC = () => {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [frequency, setFrequency] = useState<'daily' | 'weekly' | 'custom'>('daily');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [tasks, setTasks] = useState<string[]>([]);
  const [newTask, setNewTask] = useState('');
  const [showAnim, setShowAnim] = useState(false);
  const { addGoal, goals, user, apiReady } = useApp();
  const autoOpened = useRef(false);

  useEffect(() => {
    if (!apiReady || !user || autoOpened.current) return;
    if (goals.some(g => g.userId === user.id)) { autoOpened.current = true; return; }
    const t = setTimeout(() => {
      if (!autoOpened.current && !goals.some(g => g.userId === user.id)) {
        autoOpened.current = true;
        setOpen(true);
      }
    }, 2000);
    return () => clearTimeout(t);
  }, [apiReady, user, goals]);

  const onAnimDone = useCallback(() => setShowAnim(false), []);

  const addTask = () => {
    const t = newTask.trim();
    if (!t) return;
    setTasks(prev => [...prev, t]);
    setNewTask('');
  };

  const removeTask = (i: number) => setTasks(prev => prev.filter((_, idx) => idx !== i));

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    addGoal({
      title, description, frequency,
      startDate: startDate || undefined,
      endDate: endDate || undefined,
      checklist: tasks.length ? tasks : undefined,
      visibleToGroups: [],
    });
    setTitle(''); setDescription(''); setFrequency('daily');
    setStartDate(''); setEndDate('');
    setTasks([]); setNewTask('');
    setOpen(false); setShowAnim(true);
  };

  return (
    <>
      {showAnim && <CreationAnimation variant="goal" onComplete={onAnimDone} />}
      <button
        onClick={() => setOpen(true)}
        className="fixed bottom-24 right-6 w-16 h-16 rounded-full shadow-2xl flex items-center justify-center z-40 transition-transform hover:scale-110 active:scale-95"
        style={{ background: 'linear-gradient(135deg, #FFB5A0 0%, #FF9A7E 100%)' }}
      >
        <Plus className="w-8 h-8 text-white" />
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="rounded-3xl max-w-md mx-4 bg-white max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-2xl text-[#4A4A4A]">Create New Goal</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4 mt-4">
            <div>
              <label className="block mb-2 text-[#4A4A4A]">Goal Title</label>
              <Input value={title} onChange={e => setTitle(e.target.value)} placeholder="E.g., Morning meditation" required className="rounded-2xl border-[#E0D5F0] focus:border-[#C8B3E0] bg-[#FFFBF7]" />
            </div>
            <div>
              <label className="block mb-2 text-[#4A4A4A]">Description</label>
              <Textarea value={description} onChange={e => setDescription(e.target.value)} placeholder="What does this goal mean to you?" rows={2} className="rounded-2xl border-[#E0D5F0] focus:border-[#C8B3E0] bg-[#FFFBF7]" />
            </div>
            <div>
              <label className="block mb-2 text-[#4A4A4A]">Frequency</label>
              <Select value={frequency} onValueChange={(v: any) => setFrequency(v)}>
                <SelectTrigger className="rounded-2xl border-[#E0D5F0] bg-[#FFFBF7]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="daily">Daily</SelectItem>
                  <SelectItem value="weekly">Weekly</SelectItem>
                  <SelectItem value="custom">Custom</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="block mb-2 text-[#4A4A4A]">Time Frame <span className="text-xs text-[#8A8A8A]">(optional)</span></label>
              <div className="flex gap-3">
                <div className="flex-1">
                  <label className="block mb-1 text-xs text-[#8A8A8A]">Start</label>
                  <Input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="rounded-2xl border-[#E0D5F0] focus:border-[#C8B3E0] bg-[#FFFBF7] text-sm" />
                </div>
                <div className="flex-1">
                  <label className="block mb-1 text-xs text-[#8A8A8A]">End</label>
                  <Input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} min={startDate || undefined} className="rounded-2xl border-[#E0D5F0] focus:border-[#C8B3E0] bg-[#FFFBF7] text-sm" />
                </div>
              </div>
            </div>

            <div>
              <label className="block mb-2 text-[#4A4A4A]">Tasks <span className="text-xs text-[#8A8A8A]">(optional sub-steps)</span></label>
              {tasks.length > 0 && (
                <div className="space-y-1.5 mb-2">
                  {tasks.map((task, i) => (
                    <div key={i} className="flex items-center gap-2 px-3 py-2 rounded-xl bg-[#FFFBF7] border border-[#E0D5F0]">
                      <GripVertical className="w-3.5 h-3.5 text-[#C8C8C8] shrink-0" />
                      <span className="flex-1 text-sm text-[#4A4A4A] truncate">{task}</span>
                      <button type="button" onClick={() => removeTask(i)} className="shrink-0 p-0.5 hover:bg-red-50 rounded-lg transition-colors">
                        <X className="w-3.5 h-3.5 text-red-400" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
              <div className="flex gap-2">
                <Input
                  value={newTask} onChange={e => setNewTask(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addTask(); } }}
                  placeholder="Add a task..."
                  className="rounded-2xl border-[#E0D5F0] focus:border-[#C8B3E0] bg-[#FFFBF7] text-sm"
                />
                <Button type="button" onClick={addTask} variant="outline" className="rounded-2xl border-[#E0D5F0] px-3 shrink-0">
                  <Plus className="w-4 h-4" />
                </Button>
              </div>
            </div>

            <Button type="submit" className="w-full rounded-2xl h-12 text-white" style={{ background: 'linear-gradient(135deg, #C8B3E0 0%, #B39DD1 100%)' }}>
              Create Goal
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
};
