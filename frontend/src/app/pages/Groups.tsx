import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { Card } from '../components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../components/ui/dialog';
import { Input } from '../components/ui/input';
import { Button } from '../components/ui/button';
import { Users, Plus, Copy, Check, UserPlus, Settings, Heart, Flame, Calendar } from 'lucide-react';
import { format } from 'date-fns';
import { Switch } from '../components/ui/switch';

export const Groups: React.FC = () => {
  const { user, groups, users, goals, checkIns, createGroup, joinGroup, updateGoal } = useApp();
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [joinDialogOpen, setJoinDialogOpen] = useState(false);
  const [settingsDialogOpen, setSettingsDialogOpen] = useState(false);
  const [groupName, setGroupName] = useState('');
  const [inviteCode, setInviteCode] = useState('');
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  const [selectedGroup, setSelectedGroup] = useState<string | null>(null);
  
  const myGroups = groups.filter(g => g.members.includes(user?.id || ''));
  const myGoals = goals.filter(g => g.userId === user?.id);

  const handleCreateGroup = () => {
    if (!groupName.trim()) return;
    createGroup(groupName);
    setGroupName('');
    setCreateDialogOpen(false);
  };

  const handleJoinGroup = async () => {
    if (!inviteCode.trim()) return;
    try {
      const success = await joinGroup(inviteCode.toUpperCase());
      if (success) {
        setInviteCode('');
        setJoinDialogOpen(false);
      } else {
        alert('Invalid invite code');
      }
    } catch {
      alert('Invalid invite code');
    }
  };

  const copyInviteCode = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopiedCode(code);
    setTimeout(() => setCopiedCode(null), 2000);
  };

  const toggleGoalVisibility = (goalId: string, groupId: string) => {
    const goal = myGoals.find(g => g.id === goalId);
    if (!goal) return;
    
    const isVisible = goal.visibleToGroups.includes(groupId);
    const newVisibleGroups = isVisible
      ? goal.visibleToGroups.filter(g => g !== groupId)
      : [...goal.visibleToGroups, groupId];
    
    updateGoal(goalId, { visibleToGroups: newVisibleGroups });
  };

  const getGroupMembers = (groupId: string) => {
    const group = groups.find(g => g.id === groupId);
    if (!group) return [];
    return users.filter(u => group.members.includes(u.id));
  };

  const getMemberGoals = (userId: string, groupId: string) => {
    return goals.filter(g => g.userId === userId && g.visibleToGroups.includes(groupId));
  };

  const getMemberCheckIns = (userId: string, groupId: string) => {
    return checkIns
      .filter(c => c.userId === userId && c.visibleToGroups.includes(groupId))
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .slice(0, 3);
  };

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

  const getMoodEmoji = (mood: number) => {
    const emojis = ['😞', '😕', '😐', '🙂', '😊'];
    return emojis[mood - 1] || '😐';
  };

  return (
    <div className="pb-28 px-4 pt-6 max-w-md mx-auto">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-3xl mb-2 text-[#4A4A4A]">Groups</h1>
          <p className="text-[#8A8A8A]">Share your journey with friends</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setJoinDialogOpen(true)}
            className="p-3 rounded-2xl bg-[#A8D8EA] hover:bg-[#7FC4DA] transition-colors"
          >
            <UserPlus className="w-5 h-5 text-white" />
          </button>
          <button
            onClick={() => setCreateDialogOpen(true)}
            className="p-3 rounded-2xl bg-[#C8B3E0] hover:bg-[#B39DD1] transition-colors"
          >
            <Plus className="w-5 h-5 text-white" />
          </button>
        </div>
      </div>

      {/* Groups List */}
      {myGroups.length === 0 ? (
        <Card className="p-8 text-center rounded-3xl shadow-md border-none bg-white">
          <div className="w-16 h-16 rounded-full bg-[#E0D5F0] mx-auto mb-4 flex items-center justify-center">
            <Users className="w-8 h-8 text-[#C8B3E0]" />
          </div>
          <p className="text-[#8A8A8A] mb-2">No groups yet</p>
          <p className="text-sm text-[#8A8A8A] mb-4">Create a group or join one with an invite code</p>
        </Card>
      ) : (
        <div className="space-y-4">
          {myGroups.map((group) => {
            const members = getGroupMembers(group.id);
            
            return (
              <Card key={group.id} className="p-6 rounded-3xl shadow-lg border-none bg-white">
                {/* Group Header */}
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1">
                    <h3 className="text-xl mb-1 text-[#4A4A4A]">{group.name}</h3>
                    <p className="text-sm text-[#8A8A8A]">{members.length} member{members.length !== 1 ? 's' : ''}</p>
                  </div>
                  <button
                    onClick={() => {
                      setSelectedGroup(group.id);
                      setSettingsDialogOpen(true);
                    }}
                    className="p-2 hover:bg-[#F5F0FF] rounded-xl transition-colors"
                  >
                    <Settings className="w-5 h-5 text-[#C8B3E0]" />
                  </button>
                </div>

                {/* Invite Code */}
                <div className="mb-4 p-3 rounded-2xl bg-[#FFFBF7] flex items-center justify-between">
                  <div>
                    <p className="text-xs text-[#8A8A8A] mb-1">Invite Code</p>
                    <p className="text-[#4A4A4A] font-mono">{group.inviteCode}</p>
                  </div>
                  <button
                    onClick={() => copyInviteCode(group.inviteCode)}
                    className="p-2 hover:bg-white rounded-xl transition-colors"
                  >
                    {copiedCode === group.inviteCode ? (
                      <Check className="w-5 h-5 text-green-500" />
                    ) : (
                      <Copy className="w-5 h-5 text-[#C8B3E0]" />
                    )}
                  </button>
                </div>

                {/* Members */}
                <div className="space-y-4">
                  {members.map((member) => {
                    const memberGoals = getMemberGoals(member.id, group.id);
                    const memberCheckIns = getMemberCheckIns(member.id, group.id);
                    const isMe = member.id === user?.id;
                    
                    return (
                      <div 
                        key={member.id} 
                        className="p-4 rounded-2xl"
                        style={{ backgroundColor: isMe ? '#FFD4C8' : '#F5F5F5' }}
                      >
                        <div className="flex items-center gap-3 mb-3">
                          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#C8B3E0] to-[#FFB5A0] flex items-center justify-center text-white">
                            {member.name.charAt(0).toUpperCase()}
                          </div>
                          <div className="flex-1">
                            <h4 className="text-[#4A4A4A]">{member.name} {isMe && '(You)'}</h4>
                          </div>
                        </div>

                        {/* Member Goals */}
                        {memberGoals.length > 0 && (
                          <div className="mb-3">
                            <p className="text-xs text-[#8A8A8A] mb-2 flex items-center gap-1">
                              <Calendar className="w-3 h-3" />
                              Goals
                            </p>
                            <div className="space-y-2">
                              {memberGoals.map((goal) => (
                                <div key={goal.id} className="flex items-center gap-2 text-sm">
                                  <Flame className="w-4 h-4 text-[#FFB5A0]" />
                                  <span className="text-[#4A4A4A]">{goal.title}</span>
                                  <span className="text-[#8A8A8A]">({calculateStreak(goal)} day streak)</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Recent Check-ins */}
                        {memberCheckIns.length > 0 && (
                          <div>
                            <p className="text-xs text-[#8A8A8A] mb-2 flex items-center gap-1">
                              <Heart className="w-3 h-3" />
                              Recent Check-ins
                            </p>
                            <div className="space-y-2">
                              {memberCheckIns.map((checkIn) => (
                                <div key={checkIn.id} className="text-sm">
                                  <div className="flex items-center gap-2 mb-1">
                                    <span className="text-lg">{getMoodEmoji(checkIn.mood)}</span>
                                    <span className="text-xs text-[#8A8A8A]">
                                      {format(new Date(checkIn.date), 'MMM d')}
                                    </span>
                                  </div>
                                  {checkIn.reflection && (
                                    <p className="text-[#8A8A8A] italic">"{checkIn.reflection}"</p>
                                  )}
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {memberGoals.length === 0 && memberCheckIns.length === 0 && (
                          <p className="text-xs text-[#8A8A8A] italic">
                            {isMe ? 'Share your goals to show in this group' : 'No shared activity yet'}
                          </p>
                        )}
                      </div>
                    );
                  })}
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* Create Group Dialog */}
      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent className="rounded-3xl max-w-md mx-4 bg-white">
          <DialogHeader>
            <DialogTitle className="text-2xl text-[#4A4A4A]">Create Group</DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4 mt-4">
            <div>
              <label className="block mb-2 text-[#4A4A4A]">Group Name</label>
              <Input
                value={groupName}
                onChange={(e) => setGroupName(e.target.value)}
                placeholder="E.g., Mental Health Warriors"
                className="rounded-2xl border-[#E0D5F0] focus:border-[#C8B3E0] bg-[#FFFBF7]"
              />
            </div>

            <Button 
              onClick={handleCreateGroup}
              className="w-full rounded-2xl h-12 text-white"
              style={{ background: 'linear-gradient(135deg, #C8B3E0 0%, #B39DD1 100%)' }}
            >
              Create Group
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Join Group Dialog */}
      <Dialog open={joinDialogOpen} onOpenChange={setJoinDialogOpen}>
        <DialogContent className="rounded-3xl max-w-md mx-4 bg-white">
          <DialogHeader>
            <DialogTitle className="text-2xl text-[#4A4A4A]">Join Group</DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4 mt-4">
            <div>
              <label className="block mb-2 text-[#4A4A4A]">Invite Code</label>
              <Input
                value={inviteCode}
                onChange={(e) => setInviteCode(e.target.value.toUpperCase())}
                placeholder="Enter 6-digit code"
                className="rounded-2xl border-[#E0D5F0] focus:border-[#C8B3E0] bg-[#FFFBF7] uppercase"
                maxLength={6}
              />
            </div>

            <Button 
              onClick={handleJoinGroup}
              className="w-full rounded-2xl h-12 text-white"
              style={{ background: 'linear-gradient(135deg, #A8D8EA 0%, #7FC4DA 100%)' }}
            >
              Join Group
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Group Settings Dialog */}
      <Dialog open={settingsDialogOpen} onOpenChange={setSettingsDialogOpen}>
        <DialogContent className="rounded-3xl max-w-md mx-4 bg-white">
          <DialogHeader>
            <DialogTitle className="text-2xl text-[#4A4A4A]">Goal Visibility</DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4 mt-4">
            <p className="text-sm text-[#8A8A8A]">Choose which goals are visible to this group</p>
            
            {myGoals.length === 0 ? (
              <p className="text-center text-[#8A8A8A] py-4">No goals yet</p>
            ) : (
              <div className="space-y-3">
                {myGoals.map((goal) => (
                  <div 
                    key={goal.id}
                    className="flex items-center justify-between p-4 rounded-2xl bg-[#FFFBF7]"
                  >
                    <span className="text-[#4A4A4A]">{goal.title}</span>
                    <Switch
                      checked={goal.visibleToGroups.includes(selectedGroup || '')}
                      onCheckedChange={() => toggleGoalVisibility(goal.id, selectedGroup || '')}
                    />
                  </div>
                ))}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};
