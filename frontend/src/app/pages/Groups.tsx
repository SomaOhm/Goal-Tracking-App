import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { Card } from '../components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../components/ui/dialog';
import { Input } from '../components/ui/input';
import { Button } from '../components/ui/button';
import { Users, Plus, Copy, Check, UserPlus, Settings, Heart, Flame, Calendar, Trash2, LogOut, ChevronRight } from 'lucide-react';
import { format } from 'date-fns';
import { Switch } from '../components/ui/switch';

export const Groups: React.FC = () => {
  const { user, groups, users, goals, checkIns, createGroup, joinGroup, leaveGroup, deleteGroup, updateGoal } = useApp();
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [joinDialogOpen, setJoinDialogOpen] = useState(false);
  const [settingsDialogOpen, setSettingsDialogOpen] = useState(false);
  const [detailDialogOpen, setDetailDialogOpen] = useState(false);
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
    
    for (const completion of sortedCompletions) {
      const completionDate = new Date(completion.date);
      const diffDays = Math.floor((new Date().getTime() - completionDate.getTime()) / (1000 * 60 * 60 * 24));
      
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

  const activeGroup = selectedGroup ? groups.find(g => g.id === selectedGroup) : null;
  const activeMembers = selectedGroup ? getGroupMembers(selectedGroup) : [];

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

      {/* Groups List — compact rows */}
      {myGroups.length === 0 ? (
        <Card className="p-8 text-center rounded-3xl shadow-md border-none bg-white">
          <div className="w-16 h-16 rounded-full bg-[#E0D5F0] mx-auto mb-4 flex items-center justify-center">
            <Users className="w-8 h-8 text-[#C8B3E0]" />
          </div>
          <p className="text-[#8A8A8A] mb-2">No groups yet</p>
          <p className="text-sm text-[#8A8A8A] mb-4">Create a group or join one with an invite code</p>
        </Card>
      ) : (
        <Card className="rounded-2xl shadow-md border-none bg-white overflow-hidden divide-y divide-[#F0F0F0]">
          {myGroups.map((group) => {
            const members = getGroupMembers(group.id);
            return (
              <button
                key={group.id}
                onClick={() => { setSelectedGroup(group.id); setDetailDialogOpen(true); }}
                className="w-full flex items-center gap-3 px-4 py-3 hover:bg-[#FAFAFA] transition-colors text-left"
              >
                <div className="w-9 h-9 rounded-full bg-gradient-to-br from-[#C8B3E0] to-[#A8D8EA] flex items-center justify-center shrink-0">
                  <Users className="w-4 h-4 text-white" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-[#4A4A4A] truncate">{group.name}</p>
                  <p className="text-xs text-[#8A8A8A]">{members.length} member{members.length !== 1 ? 's' : ''}</p>
                </div>
                <ChevronRight className="w-4 h-4 text-[#C8C8C8] shrink-0" />
              </button>
            );
          })}
        </Card>
      )}

      {/* Group Detail Dialog */}
      <Dialog open={detailDialogOpen} onOpenChange={setDetailDialogOpen}>
        <DialogContent className="rounded-3xl max-w-md mx-4 bg-white max-h-[85vh] overflow-y-auto">
          {activeGroup && (
            <>
              <DialogHeader>
                <DialogTitle className="text-2xl text-[#4A4A4A]">{activeGroup.name}</DialogTitle>
              </DialogHeader>

              <div className="space-y-4 mt-4">
                {/* Invite Code */}
                <div className="p-3 rounded-2xl bg-[#FFFBF7] flex items-center justify-between">
                  <div>
                    <p className="text-xs text-[#8A8A8A] mb-0.5">Invite Code</p>
                    <p className="text-[#4A4A4A] font-mono text-sm">{activeGroup.inviteCode}</p>
                  </div>
                  <button
                    onClick={() => copyInviteCode(activeGroup.inviteCode)}
                    className="p-2 hover:bg-white rounded-xl transition-colors"
                  >
                    {copiedCode === activeGroup.inviteCode ? (
                      <Check className="w-4 h-4 text-green-500" />
                    ) : (
                      <Copy className="w-4 h-4 text-[#C8B3E0]" />
                    )}
                  </button>
                </div>

                {/* Members */}
                <div className="space-y-3">
                  {activeMembers.map((member) => {
                    const memberGoals = getMemberGoals(member.id, activeGroup.id);
                    const memberCheckIns = getMemberCheckIns(member.id, activeGroup.id);
                    const isMe = member.id === user?.id;

                    return (
                      <div
                        key={member.id}
                        className="p-3 rounded-2xl"
                        style={{ backgroundColor: isMe ? '#FFD4C8' : '#F5F5F5' }}
                      >
                        <div className="flex items-center gap-3 mb-2">
                          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#C8B3E0] to-[#FFB5A0] flex items-center justify-center text-white text-sm">
                            {member.name.charAt(0).toUpperCase()}
                          </div>
                          <h4 className="text-sm text-[#4A4A4A]">{member.name}{isMe ? ' (You)' : ''}</h4>
                        </div>

                        {memberGoals.length > 0 && (
                          <div className="mb-2">
                            <p className="text-xs text-[#8A8A8A] mb-1 flex items-center gap-1">
                              <Calendar className="w-3 h-3" /> Goals
                            </p>
                            {memberGoals.map((goal) => (
                              <div key={goal.id} className="flex items-center gap-2 text-xs ml-1">
                                <Flame className="w-3 h-3 text-[#FFB5A0]" />
                                <span className="text-[#4A4A4A]">{goal.title}</span>
                                <span className="text-[#8A8A8A]">({calculateStreak(goal)}d streak)</span>
                              </div>
                            ))}
                          </div>
                        )}

                        {memberCheckIns.length > 0 && (
                          <div>
                            <p className="text-xs text-[#8A8A8A] mb-1 flex items-center gap-1">
                              <Heart className="w-3 h-3" /> Recent
                            </p>
                            {memberCheckIns.map((ci) => (
                              <div key={ci.id} className="flex items-center gap-2 text-xs ml-1 mb-0.5">
                                <span>{getMoodEmoji(ci.mood)}</span>
                                <span className="text-[#8A8A8A]">{format(new Date(ci.date), 'MMM d')}</span>
                                {ci.reflection && <span className="text-[#8A8A8A] italic truncate">— {ci.reflection}</span>}
                              </div>
                            ))}
                          </div>
                        )}

                        {memberGoals.length === 0 && memberCheckIns.length === 0 && (
                          <p className="text-xs text-[#8A8A8A] italic ml-1">
                            {isMe ? 'Share goals via settings' : 'No shared activity yet'}
                          </p>
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* Actions */}
                <div className="flex gap-2 pt-2">
                  <Button
                    variant="outline"
                    onClick={() => { setDetailDialogOpen(false); setSettingsDialogOpen(true); }}
                    className="flex-1 rounded-2xl h-10 text-sm border-[#E0D5F0] text-[#8A8A8A]"
                  >
                    <Settings className="w-4 h-4 mr-1" /> Settings
                  </Button>
                  {activeGroup.createdBy === user?.id ? (
                    <Button
                      variant="outline"
                      onClick={() => {
                        if (confirm('Delete this group? All members will be removed.')) {
                          deleteGroup(activeGroup.id);
                          setDetailDialogOpen(false);
                          setSelectedGroup(null);
                        }
                      }}
                      className="rounded-2xl h-10 text-sm border-red-200 text-red-500 hover:bg-red-50"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  ) : (
                    <Button
                      variant="outline"
                      onClick={() => {
                        if (confirm('Leave this group?')) {
                          leaveGroup(activeGroup.id);
                          setDetailDialogOpen(false);
                          setSelectedGroup(null);
                        }
                      }}
                      className="rounded-2xl h-10 text-sm border-orange-200 text-orange-500 hover:bg-orange-50"
                    >
                      <LogOut className="w-4 h-4" />
                    </Button>
                  )}
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

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
            <DialogTitle className="text-2xl text-[#4A4A4A]">Group Settings</DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4 mt-4">
            <p className="text-sm text-[#8A8A8A] font-medium">Goal Visibility</p>
            <p className="text-xs text-[#8A8A8A]">Choose which goals are visible to this group</p>
            
            {myGoals.length === 0 ? (
              <p className="text-center text-[#8A8A8A] py-4">No goals yet</p>
            ) : (
              <div className="space-y-3 max-h-48 overflow-y-auto">
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

            <div className="border-t border-[#F0F0F0] pt-4 space-y-3">
              {selectedGroup && groups.find(g => g.id === selectedGroup)?.createdBy === user?.id ? (
                <Button
                  variant="outline"
                  onClick={() => {
                    if (confirm('Delete this group? All members will be removed.')) {
                      deleteGroup(selectedGroup);
                      setSettingsDialogOpen(false);
                      setSelectedGroup(null);
                    }
                  }}
                  className="w-full rounded-2xl h-12 border-red-200 text-red-500 hover:bg-red-50 hover:text-red-600"
                >
                  <Trash2 className="w-4 h-4 mr-2" />
                  Delete Group
                </Button>
              ) : (
                <Button
                  variant="outline"
                  onClick={() => {
                    if (selectedGroup && confirm('Leave this group?')) {
                      leaveGroup(selectedGroup);
                      setSettingsDialogOpen(false);
                      setSelectedGroup(null);
                    }
                  }}
                  className="w-full rounded-2xl h-12 border-orange-200 text-orange-500 hover:bg-orange-50 hover:text-orange-600"
                >
                  <LogOut className="w-4 h-4 mr-2" />
                  Leave Group
                </Button>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};
