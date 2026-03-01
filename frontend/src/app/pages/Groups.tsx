import React, { useState, useCallback, useRef } from 'react';
import { useApp } from '../context/AppContext';
import { Card } from '../components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../components/ui/dialog';
import { Input } from '../components/ui/input';
import { Button } from '../components/ui/button';
import { Users, Plus, Copy, Check, UserPlus, Settings, Heart, Flame, Calendar, Trash2, LogOut, ChevronRight, Sparkles, Loader2, Bot, X } from 'lucide-react';
import { format } from 'date-fns';
import { Switch } from '../components/ui/switch';
import { CreationAnimation } from '../components/CreationAnimation';
import { askGemini, isGeminiEnabled, getBackendUrl, coachGroupAnalysisBackend } from '../lib/gemini';

export const Groups: React.FC = () => {
  const { user, groups, users, goals, checkIns, createGroup, joinGroup, leaveGroup, deleteGroup, updateGoal } = useApp();
  const [createOpen, setCreateOpen] = useState(false);
  const [joinOpen, setJoinOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);
  const [groupName, setGroupName] = useState('');
  const [inviteCode, setInviteCode] = useState('');
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [showAnim, setShowAnim] = useState(false);

  const [aiResult, setAiResult] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const [selectedMembers, setSelectedMembers] = useState<Set<string>>(new Set());
  const abortRef = useRef<AbortController | null>(null);

  const toggleMemberSelect = (uid: string) => {
    setSelectedMembers(prev => {
      const n = new Set(prev);
      n.has(uid) ? n.delete(uid) : n.add(uid);
      return n;
    });
  };

  const runGroupAnalysis = async (groupId: string) => {
    if (aiLoading) return;
    const gMembers = members(groupId);
    const targets = selectedMembers.size > 0
      ? gMembers.filter(m => selectedMembers.has(m.id))
      : gMembers;

    let ctx = `Group: "${groups.find(g => g.id === groupId)?.name}"\nMembers analyzed: ${targets.length}\nToday: ${format(new Date(), 'yyyy-MM-dd')}\n\n`;

    for (const m of targets) {
      const mg = memberGoals(m.id, groupId);
      const mc = memberCIs(m.id, groupId);
      ctx += `--- ${m.name} ---\n`;
      if (mg.length === 0) { ctx += 'No shared goals.\n\n'; continue; }
      for (const g of mg) {
        ctx += `Goal: "${g.title}" (${g.frequency})\n`;
        if (g.description) ctx += `  Why: ${g.description}\n`;
        if (g.checklist?.length) ctx += `  Tasks: ${g.checklist.join(', ')}\n`;
        ctx += `  Streak: ${streak(g)}d, Completions: ${g.completions.length}\n`;
        const recent = g.completions.filter(c => c.reflection).slice(-3);
        if (recent.length) ctx += `  Reflections: ${recent.map(c => `[${c.date}] "${c.reflection}"`).join('; ')}\n`;
      }
      if (mc.length) {
        ctx += `  Check-ins: ${mc.map(c => `${c.date} mood:${c.mood}/5${c.reflection ? ` "${c.reflection}"` : ''}`).join('; ')}\n`;
      }
      ctx += '\n';
    }

    const mode = selectedMembers.size === 1
      ? 'Give a detailed individual analysis for this person: their progress, strengths, concerns, and a personalized recommendation. A coach or therapist should find this actionable.'
      : selectedMembers.size > 1
        ? `Give a comparative analysis of these ${targets.length} selected members. Highlight who is thriving, who needs support, and recommend group interventions.`
        : `Give a full group analysis. Summarize overall group health, identify members who are excelling and who may need support, spot trends, and suggest actions a coach or group leader could take.`;

    const prompt = `You are MindBuddy, an AI wellness analyst for coaches and therapists. Analyze this accountability group data:\n\n${ctx}\n${mode}\n\nUse markdown. Be specific — reference names, goals, and data points.`;
    const contextForBackend = `${ctx}\nInstruction: ${mode}`;

    setAiLoading(true);
    setAiResult('');
    try {
      abortRef.current = new AbortController();
      const signal = abortRef.current.signal;
      const reply = getBackendUrl()
        ? await coachGroupAnalysisBackend(contextForBackend, signal)
        : await askGemini(prompt, signal);
      setAiResult(reply);
    } catch (e: any) {
      if (e.name !== 'AbortError') setAiResult(`Error: ${e.message}`);
    } finally {
      setAiLoading(false);
      abortRef.current = null;
    }
  };

  const myGroups = groups.filter(g => g.members.includes(user?.id || ''));
  const myGoals = goals.filter(g => g.userId === user?.id);
  const onAnimDone = useCallback(() => setShowAnim(false), []);

  const handleCreate = () => {
    if (!groupName.trim()) return;
    createGroup(groupName);
    setGroupName('');
    setCreateOpen(false);
    setShowAnim(true);
  };

  const handleJoin = async () => {
    if (!inviteCode.trim()) return;
    try {
      if (await joinGroup(inviteCode.toUpperCase())) { setInviteCode(''); setJoinOpen(false); }
      else alert('Invalid invite code');
    } catch { alert('Invalid invite code'); }
  };

  const copyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopiedCode(code);
    setTimeout(() => setCopiedCode(null), 2000);
  };

  const toggleVisibility = (goalId: string, groupId: string) => {
    const goal = myGoals.find(g => g.id === goalId);
    if (!goal) return;
    const current = goal.visibleToGroups ?? [];
    const vis = current.includes(groupId) ? current.filter(g => g !== groupId) : [...current, groupId];
    updateGoal(goalId, { visibleToGroups: vis });
  };

  const members = (gid: string) => users.filter(u => groups.find(g => g.id === gid)?.members.includes(u.id));
  const memberGoals = (uid: string, gid: string) => goals.filter(g => g.userId === uid && g.visibleToGroups.includes(gid));
  const memberCIs = (uid: string, gid: string) => checkIns.filter(c => c.userId === uid && c.visibleToGroups.includes(gid)).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).slice(0, 3);

  const streak = (goal: typeof goals[0]) => {
    if (!goal.completions.length) return 0;
    let s = 0;
    const sorted = [...goal.completions].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    for (const c of sorted) {
      if (Math.floor((Date.now() - new Date(c.date).getTime()) / 86400000) === s) s++;
      else break;
    }
    return s;
  };

  const moodEmoji = (m: number) => ['😞', '😕', '😐', '🙂', '😊'][m - 1] || '😐';

  const active = selected ? groups.find(g => g.id === selected) : null;
  const activeMembers = selected ? members(selected) : [];

  return (
    <div className="pb-28 px-4 pt-6 max-w-md mx-auto">
      {showAnim && <CreationAnimation variant="group" onComplete={onAnimDone} />}

      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-3xl mb-2 text-[#4A4A4A]">Groups</h1>
          <p className="text-[#8A8A8A]">Share your journey with friends</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setJoinOpen(true)} className="p-3 rounded-2xl bg-[#A8D8EA] hover:bg-[#7FC4DA] transition-colors">
            <UserPlus className="w-5 h-5 text-white" />
          </button>
          <button onClick={() => setCreateOpen(true)} className="p-3 rounded-2xl bg-[#C8B3E0] hover:bg-[#B39DD1] transition-colors">
            <Plus className="w-5 h-5 text-white" />
          </button>
        </div>
      </div>

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
          {myGroups.map(group => {
            const m = members(group.id);
            return (
              <button key={group.id} onClick={() => { setSelected(group.id); setDetailOpen(true); setAiResult(''); setSelectedMembers(new Set()); }} className="w-full flex items-center justify-center gap-3 px-4 py-3.5 hover:bg-[#FAFAFA] transition-colors">
                <div className="w-9 h-9 rounded-full bg-gradient-to-br from-[#C8B3E0] to-[#A8D8EA] flex items-center justify-center shrink-0">
                  <Users className="w-4 h-4 text-white" />
                </div>
                <div className="flex-1 min-w-0 text-center">
                  <p className="text-sm font-medium text-[#4A4A4A] truncate">{group.name}</p>
                  <p className="text-xs text-[#8A8A8A]">{m.length} member{m.length !== 1 ? 's' : ''}</p>
                </div>
                <ChevronRight className="w-4 h-4 text-[#C8C8C8] shrink-0" />
              </button>
            );
          })}
        </Card>
      )}

      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="rounded-3xl max-w-md mx-4 bg-white max-h-[85vh] overflow-y-auto">
          {active && (
            <>
              <DialogHeader><DialogTitle className="text-2xl text-[#4A4A4A]">{active.name}</DialogTitle></DialogHeader>
              <div className="space-y-4 mt-4">
                <div className="p-3 rounded-2xl bg-[#FFFBF7] flex items-center justify-between">
                  <div>
                    <p className="text-xs text-[#8A8A8A] mb-0.5">Invite Code</p>
                    <p className="text-[#4A4A4A] font-mono text-sm">{active.inviteCode}</p>
                  </div>
                  <button onClick={() => copyCode(active.inviteCode)} className="p-2 hover:bg-white rounded-xl transition-colors">
                    {copiedCode === active.inviteCode ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4 text-[#C8B3E0]" />}
                  </button>
                </div>

                <div className="flex gap-2">
                  <Button variant="outline" onClick={() => { setDetailOpen(false); setSettingsOpen(true); }} className="flex-1 rounded-2xl h-10 text-sm border-[#E0D5F0] text-[#8A8A8A]">
                    <Settings className="w-4 h-4 mr-1" /> Settings & goal visibility
                  </Button>
                  {active.createdBy === user?.id ? (
                    <Button variant="outline" onClick={() => { if (confirm('Delete this group? All members will be removed.')) { deleteGroup(active.id); setDetailOpen(false); setSelected(null); } }} className="rounded-2xl h-10 text-sm border-red-200 text-red-500 hover:bg-red-50">
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  ) : (
                    <Button variant="outline" onClick={() => { if (confirm('Leave this group?')) { leaveGroup(active.id); setDetailOpen(false); setSelected(null); } }} className="rounded-2xl h-10 text-sm border-orange-200 text-orange-500 hover:bg-orange-50">
                      <LogOut className="w-4 h-4" />
                    </Button>
                  )}
                </div>

                <div className="space-y-3">
                  {activeMembers.map(member => {
                    const mg = memberGoals(member.id, active.id);
                    const mc = memberCIs(member.id, active.id);
                    const isMe = member.id === user?.id;
                    return (
                      <div key={member.id} className="p-3 rounded-2xl" style={{ backgroundColor: isMe ? '#FFD4C8' : '#F5F5F5' }}>
                        <div className="flex items-center gap-3 mb-2">
                          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#C8B3E0] to-[#FFB5A0] flex items-center justify-center text-white text-sm">
                            {member.name.charAt(0).toUpperCase()}
                          </div>
                          <h4 className="text-sm text-[#4A4A4A]">{member.name}{isMe ? ' (You)' : ''}</h4>
                        </div>
                        {mg.length > 0 && (
                          <div className="mb-2">
                            <p className="text-xs text-[#8A8A8A] mb-1 flex items-center gap-1"><Calendar className="w-3 h-3" /> Goals</p>
                            {mg.map(g => (
                              <div key={g.id} className="flex items-center gap-2 text-xs ml-1">
                                <Flame className="w-3 h-3 text-[#FFB5A0]" />
                                <span className="text-[#4A4A4A]">{g.title}</span>
                                <span className="text-[#8A8A8A]">({streak(g)}d streak)</span>
                              </div>
                            ))}
                          </div>
                        )}
                        {mc.length > 0 && (
                          <div>
                            <p className="text-xs text-[#8A8A8A] mb-1 flex items-center gap-1"><Heart className="w-3 h-3" /> Recent</p>
                            {mc.map(ci => (
                              <div key={ci.id} className="flex items-center gap-2 text-xs ml-1 mb-0.5">
                                <span>{moodEmoji(ci.mood)}</span>
                                <span className="text-[#8A8A8A]">{format(new Date(ci.date), 'MMM d')}</span>
                                {ci.reflection && <span className="text-[#8A8A8A] italic truncate">— {ci.reflection}</span>}
                              </div>
                            ))}
                          </div>
                        )}
                        {mg.length === 0 && mc.length === 0 && (
                          <p className="text-xs text-[#8A8A8A] italic ml-1">{isMe ? 'Share goals via settings' : 'No shared activity yet'}</p>
                        )}
                      </div>
                    );
                  })}
                </div>

                {isGeminiEnabled() && (
                  <div className="border-t border-[#F0F0F0] pt-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-medium text-[#4A4A4A] flex items-center gap-1.5">
                        <Sparkles className="w-4 h-4 text-[#C8B3E0]" /> AI Analysis
                      </p>
                      {selectedMembers.size > 0 && (
                        <button onClick={() => setSelectedMembers(new Set())} className="text-xs text-[#8A8A8A] hover:text-[#4A4A4A]">
                          Clear selection
                        </button>
                      )}
                    </div>
                    <p className="text-xs text-[#8A8A8A]">
                      {selectedMembers.size === 0
                        ? 'Tap members to select specific people, or analyze everyone.'
                        : `${selectedMembers.size} member${selectedMembers.size > 1 ? 's' : ''} selected`}
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {activeMembers.map(m => (
                        <button key={m.id} onClick={() => toggleMemberSelect(m.id)}
                          className={`px-2.5 py-1 rounded-full text-xs transition-colors ${
                            selectedMembers.has(m.id)
                              ? 'bg-[#C8B3E0] text-white'
                              : 'bg-[#F5F5F5] text-[#8A8A8A] hover:bg-[#E0D5F0]'
                          }`}>
                          {m.name}
                        </button>
                      ))}
                    </div>
                    <Button onClick={() => runGroupAnalysis(active.id)} disabled={aiLoading}
                      className="w-full rounded-2xl h-10 text-white text-sm"
                      style={{ background: 'linear-gradient(135deg, #C8B3E0 0%, #A8D8EA 100%)' }}>
                      {aiLoading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Sparkles className="w-4 h-4 mr-2" />}
                      {selectedMembers.size === 0 ? 'Analyze Entire Group' : selectedMembers.size === 1 ? 'Analyze Member' : `Analyze ${selectedMembers.size} Members`}
                    </Button>
                    {aiResult && (
                      <div className="relative p-3 rounded-2xl bg-[#FFFBF7] border border-[#E0D5F0] text-sm text-[#4A4A4A] whitespace-pre-wrap max-h-64 overflow-y-auto">
                        <button onClick={() => { setAiResult(''); abortRef.current?.abort(); }}
                          className="absolute top-2 right-2 p-1 hover:bg-white rounded-lg">
                          <X className="w-3.5 h-3.5 text-[#8A8A8A]" />
                        </button>
                        <div className="flex items-center gap-1.5 mb-2">
                          <Bot className="w-4 h-4 text-[#C8B3E0]" />
                          <span className="text-xs font-medium text-[#8A8A8A]">MindBuddy Analysis</span>
                        </div>
                        {aiResult}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="rounded-3xl max-w-md mx-4 bg-white">
          <DialogHeader><DialogTitle className="text-2xl text-[#4A4A4A]">Create Group</DialogTitle></DialogHeader>
          <div className="space-y-4 mt-4">
            <div>
              <label className="block mb-2 text-[#4A4A4A]">Group Name</label>
              <Input value={groupName} onChange={e => setGroupName(e.target.value)} placeholder="E.g., Mental Health Warriors" className="rounded-2xl border-[#E0D5F0] focus:border-[#C8B3E0] bg-[#FFFBF7]" />
            </div>
            <Button onClick={handleCreate} className="w-full rounded-2xl h-12 text-white" style={{ background: 'linear-gradient(135deg, #C8B3E0 0%, #B39DD1 100%)' }}>Create Group</Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={joinOpen} onOpenChange={setJoinOpen}>
        <DialogContent className="rounded-3xl max-w-md mx-4 bg-white">
          <DialogHeader><DialogTitle className="text-2xl text-[#4A4A4A]">Join Group</DialogTitle></DialogHeader>
          <div className="space-y-4 mt-4">
            <div>
              <label className="block mb-2 text-[#4A4A4A]">Invite Code</label>
              <Input value={inviteCode} onChange={e => setInviteCode(e.target.value.toUpperCase())} placeholder="Enter 6-digit code" className="rounded-2xl border-[#E0D5F0] focus:border-[#C8B3E0] bg-[#FFFBF7] uppercase" maxLength={6} />
            </div>
            <Button onClick={handleJoin} className="w-full rounded-2xl h-12 text-white" style={{ background: 'linear-gradient(135deg, #A8D8EA 0%, #7FC4DA 100%)' }}>Join Group</Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={settingsOpen} onOpenChange={setSettingsOpen}>
        <DialogContent className="rounded-3xl max-w-md mx-4 bg-white">
          <DialogHeader><DialogTitle className="text-2xl text-[#4A4A4A]">Group Settings</DialogTitle></DialogHeader>
          <div className="space-y-4 mt-4">
            <p className="text-sm text-[#8A8A8A] font-medium">Goal Visibility</p>
            <p className="text-xs text-[#8A8A8A]">Choose which goals are visible to this group</p>
            {myGoals.length === 0 ? (
              <p className="text-center text-[#8A8A8A] py-4">No goals yet</p>
            ) : (
              <div className="space-y-3 max-h-48 overflow-y-auto">
                {myGoals.map(goal => {
                  const groupId = selected ?? '';
                  const isVisibleToGroup = Boolean(groupId && (goal.visibleToGroups ?? []).includes(groupId));
                  return (
                    <div key={goal.id} className="flex items-center justify-between p-4 rounded-2xl bg-[#FFFBF7]">
                      <span className="text-[#4A4A4A]">{goal.title}</span>
                      <Switch checked={isVisibleToGroup} onCheckedChange={() => groupId && toggleVisibility(goal.id, groupId)} />
                    </div>
                  );
                })}
              </div>
            )}
            <div className="border-t border-[#F0F0F0] pt-4 space-y-3">
              {selected && groups.find(g => g.id === selected)?.createdBy === user?.id ? (
                <Button variant="outline" onClick={() => { if (confirm('Delete this group?')) { deleteGroup(selected); setSettingsOpen(false); setSelected(null); } }} className="w-full rounded-2xl h-12 border-red-200 text-red-500 hover:bg-red-50 hover:text-red-600">
                  <Trash2 className="w-4 h-4 mr-2" /> Delete Group
                </Button>
              ) : (
                <Button variant="outline" onClick={() => { if (selected && confirm('Leave this group?')) { leaveGroup(selected); setSettingsOpen(false); setSelected(null); } }} className="w-full rounded-2xl h-12 border-orange-200 text-orange-500 hover:bg-orange-50 hover:text-orange-600">
                  <LogOut className="w-4 h-4 mr-2" /> Leave Group
                </Button>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};
