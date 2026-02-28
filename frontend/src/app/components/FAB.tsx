import React, { useState } from 'react';
import { Plus } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../components/ui/dialog';
import { Input } from '../components/ui/input';
import { Textarea } from '../components/ui/textarea';
import { Button } from '../components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { useApp } from '../context/AppContext';

export const FAB: React.FC = () => {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [frequency, setFrequency] = useState<'daily' | 'weekly' | 'custom'>('daily');
  const { addGoal } = useApp();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    addGoal({
      title,
      description,
      frequency,
      visibleToGroups: [],
    });
    setTitle('');
    setDescription('');
    setFrequency('daily');
    setOpen(false);
  };

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="fixed bottom-24 right-6 w-16 h-16 rounded-full shadow-2xl flex items-center justify-center z-40 transition-transform hover:scale-110 active:scale-95"
        style={{
          background: 'linear-gradient(135deg, #FFB5A0 0%, #FF9A7E 100%)',
        }}
      >
        <Plus className="w-8 h-8 text-white" />
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="rounded-3xl max-w-md mx-4 bg-white">
          <DialogHeader>
            <DialogTitle className="text-2xl text-[#4A4A4A]">Create New Goal</DialogTitle>
          </DialogHeader>
          
          <form onSubmit={handleSubmit} className="space-y-4 mt-4">
            <div>
              <label className="block mb-2 text-[#4A4A4A]">Goal Title</label>
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="E.g., Morning meditation"
                required
                className="rounded-2xl border-[#E0D5F0] focus:border-[#C8B3E0] bg-[#FFFBF7]"
              />
            </div>

            <div>
              <label className="block mb-2 text-[#4A4A4A]">Description</label>
              <Textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="What does this goal mean to you?"
                rows={3}
                className="rounded-2xl border-[#E0D5F0] focus:border-[#C8B3E0] bg-[#FFFBF7]"
              />
            </div>

            <div>
              <label className="block mb-2 text-[#4A4A4A]">Frequency</label>
              <Select value={frequency} onValueChange={(v: any) => setFrequency(v)}>
                <SelectTrigger className="rounded-2xl border-[#E0D5F0] bg-[#FFFBF7]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="daily">Daily</SelectItem>
                  <SelectItem value="weekly">Weekly</SelectItem>
                  <SelectItem value="custom">Custom</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <Button 
              type="submit" 
              className="w-full rounded-2xl h-12 text-white"
              style={{ background: 'linear-gradient(135deg, #C8B3E0 0%, #B39DD1 100%)' }}
            >
              Create Goal
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
};
