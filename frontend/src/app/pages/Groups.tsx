import React, { useState, useCallback, useRef } from 'react';
import { useApp } from '../context/AppContext';
import { Card } from '../components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../components/ui/dialog';
import { Input } from '../components/ui/input';
import { Button } from '../components/ui/button';
import { Users, Plus, Copy, Check, UserPlus, Settings, Heart, Calendar, Trash2, LogOut, ChevronRight, Sparkles, Loader2, Bot, X } from 'lucide-react';
import { format } from 'date-fns';
import { Switch } from '../components/ui/switch';
import { CreationAnimation } from '../components/CreationAnimation';
import ReactMarkdown from 'react-markdown';
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

    const prompt = `You are Flock, an AI wellness analyst for coaches and therapists. Analyze this accountability group data:\n\n${ctx}\n${mode}\n\nUse markdown. Be specific — reference names, goals, and data points.`;
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
    <div className="pb-28 pt-6 w-full">
      {showAnim && <CreationAnimation variant="group" onComplete={onAnimDone} />}

      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-3xl mb-2 text-[#4A4A4A]">Groups</h1>
          <p className="text-[#8A8A8A]">Share your journey with friends</p>
        </div>
        <div className="flex gap-2">
          <button type="button" onClick={() => setJoinOpen(true)} className="cursor-pointer p-3 rounded-2xl bg-[#A8D8EA] hover:bg-[#7FC4DA] transition-colors">
            <UserPlus className="w-5 h-5 text-white" />
          </button>
          <button type="button" onClick={() => setCreateOpen(true)} className="cursor-pointer p-3 rounded-2xl bg-[#C8B3E0] hover:bg-[#B39DD1] transition-colors">
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
              <button key={group.id} type="button" onClick={() => { setSelected(group.id); setDetailOpen(true); setAiResult(''); setSelectedMembers(new Set()); }} className="cursor-pointer w-full flex items-center justify-center gap-3 px-4 py-3.5 hover:bg-[#FAFAFA] transition-colors">
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
        <DialogContent className="rounded-3xl !w-[98vw] !max-w-[1800px] sm:!max-w-[1800px] mx-auto bg-white max-h-[90vh] overflow-hidden flex flex-col p-0 gap-0">
          {active && (
            <div className="flex flex-col md:flex-row flex-1 min-h-0 overflow-hidden">
              {/* Left: People */}
              <div className="flex flex-col md:w-[42%] md:max-w-md min-w-0 border-b md:border-b-0 md:border-r border-[#F0F0F0] overflow-y-auto p-6">
                <DialogHeader className="p-0 mb-4"><DialogTitle className="text-2xl text-[#4A4A4A]">{active.name}</DialogTitle></DialogHeader>
                <div className="p-3 rounded-2xl bg-[#FFFBF7] flex items-center justify-between mb-4">
                  <div>
                    <p className="text-xs text-[#8A8A8A] mb-0.5">Invite Code</p>
                    <p className="text-base text-[#4A4A4A] font-mono">{active.inviteCode}</p>
                  </div>
                  <button type="button" onClick={() => copyCode(active.inviteCode)} className="cursor-pointer p-2 hover:bg-white rounded-xl transition-colors">
                    {copiedCode === active.inviteCode ? <Check className="w-5 h-5 text-green-500" /> : <Copy className="w-5 h-5 text-[#C8B3E0]" />}
                  </button>
                </div>
                <div className="flex flex-wrap gap-2 mb-4">
                  <Button variant="outline" onClick={() => { setDetailOpen(false); setSettingsOpen(true); }} className="rounded-2xl h-10 text-sm border-[#E0D5F0] text-[#8A8A8A]">
                    <Settings className="w-4 h-4 mr-1" /> Settings
                  </Button>
                  {active.createdBy === user?.id ? (
                    <Button variant="outline" onClick={() => { if (confirm('Delete this group?')) { deleteGroup(active.id); setDetailOpen(false); setSelected(null); } }} className="rounded-2xl h-10 text-sm border-red-200 text-red-500 hover:bg-red-50">
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  ) : (
                    <Button variant="outline" onClick={() => { if (confirm('Leave this group?')) { leaveGroup(active.id); setDetailOpen(false); setSelected(null); } }} className="rounded-2xl h-10 text-sm border-orange-200 text-orange-500 hover:bg-orange-50">
                      <LogOut className="w-4 h-4" />
                    </Button>
                  )}
                </div>
                <p className="text-sm font-medium text-[#4A4A4A] mb-2">Members</p>
                <div className="space-y-3">
                  {activeMembers.map(member => {
                    const mg = memberGoals(member.id, active.id);
                    const isMe = member.id === user?.id;
                    return (
                      <div key={member.id} className="p-4 rounded-2xl min-w-0" style={{ backgroundColor: isMe ? '#FFD4C8' : '#F5F5F5' }}>
                        <div className="flex items-center gap-3 mb-2">
                          <div className="w-9 h-9 rounded-full bg-gradient-to-br from-[#C8B3E0] to-[#FFB5A0] flex items-center justify-center text-white text-sm shrink-0">
                            {member.name.charAt(0).toUpperCase()}
                          </div>
                          <h4 className="text-sm font-medium text-[#4A4A4A] truncate">{member.name}{isMe ? ' (You)' : ''}</h4>
                        </div>
                        {mg.length > 0 ? (
                          <div>
                            <p className="text-xs text-[#8A8A8A] mb-1 flex items-center gap-1"><Calendar className="w-3 h-3" /> Goals</p>
                            {mg.map(g => (
                              <div key={g.id} className="flex items-center gap-2 text-xs ml-1 flex-wrap">
                                <span className="text-[#4A4A4A] break-words">{g.title}</span>
                                <span className="text-[#8A8A8A] shrink-0">({streak(g)}d streak)</span>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p className="text-xs text-[#8A8A8A] italic ml-1">{isMe ? 'Share goals via settings' : 'No shared goals yet'}</p>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Right: Chat (AI Analysis) */}
              {isGeminiEnabled() ? (
                <div className="flex flex-col flex-1 min-w-0 bg-[#FFFBF7] overflow-hidden">
                  <div className="p-4 border-b border-[#E0D5F0] shrink-0">
                    <p className="text-sm font-medium text-[#4A4A4A] flex items-center gap-2 mb-2">
                      <Sparkles className="w-4 h-4 text-[#C8B3E0]" /> Flock Analysis
                    </p>
                    <p className="text-xs text-[#8A8A8A] mb-2">
                      {selectedMembers.size === 0 ? 'Analyze everyone, or tap members on the left to analyze specific people.' : `${selectedMembers.size} selected — tap on left to change.`}
                    </p>
                    <div className="flex flex-wrap gap-2 mb-2">
                      {activeMembers.map(m => (
                        <button key={m.id} type="button" onClick={() => toggleMemberSelect(m.id)}
                          className={`cursor-pointer px-3 py-1.5 rounded-lg text-xs transition-colors ${
                            selectedMembers.has(m.id) ? 'bg-[#C8B3E0] text-white' : 'bg-white border border-[#E0D5F0] text-[#8A8A8A] hover:bg-[#E0D5F0]'
                          }`}>
                          {m.name}
                        </button>
                      ))}
                    </div>
                    <Button onClick={() => runGroupAnalysis(active.id)} disabled={aiLoading}
                      className="w-full rounded-2xl h-10 text-sm text-white"
                      style={{ background: 'linear-gradient(135deg, #C8B3E0 0%, #A8D8EA 100%)' }}>
                      {aiLoading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Sparkles className="w-4 h-4 mr-2" />}
                      {aiLoading ? 'Analyzing…' : selectedMembers.size === 0 ? 'Analyze entire group' : `Analyze ${selectedMembers.size} selected`}
                    </Button>
                  </div>
                  <div className="flex-1 min-h-0 overflow-y-auto p-4">
                    {aiLoading && !aiResult ? (
                      <div className="flex flex-col items-center justify-center py-12 gap-3">
                        <Loader2 className="w-8 h-8 text-[#C8B3E0] animate-spin" />
                        <p className="text-sm text-[#8A8A8A]">Analyzing group…</p>
                      </div>
                    ) : aiResult ? (
                      <div className="prose prose-sm max-w-none prose-p:my-2 prose-ul:my-2 prose-ol:my-2 prose-li:my-0.5 text-[#4A4A4A]">
                        <ReactMarkdown
                          components={{
                            p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
                            ul: ({ children }) => <ul className="list-disc pl-4 my-2 space-y-0.5">{children}</ul>,
                            ol: ({ children }) => <ol className="list-decimal pl-4 my-2 space-y-0.5">{children}</ol>,
                            li: ({ children }) => <li className="leading-snug">{children}</li>,
                            strong: ({ children }) => <strong className="font-semibold text-[#3A3A3A]">{children}</strong>,
                          }}
                        >
                          {aiResult}
                        </ReactMarkdown>
                      </div>
                    ) : (
                      <p className="text-sm text-[#8A8A8A]">Run analysis to see results here.</p>
                    )}
                  </div>
                </div>
              ) : (
                <div className="flex-1 min-w-0 flex items-center justify-center p-8 bg-[#FFFBF7]">
                  <p className="text-sm text-[#8A8A8A]">Enable AI in settings to see group analysis here.</p>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="rounded-3xl w-[92vw] max-w-xl mx-auto bg-white p-8">
          <DialogHeader><DialogTitle className="text-3xl text-[#4A4A4A]">Create Group</DialogTitle></DialogHeader>
          <div className="space-y-5 mt-6">
            <div>
              <label className="block mb-2 text-[#4A4A4A]">Group Name</label>
              <Input value={groupName} onChange={e => setGroupName(e.target.value)} placeholder="E.g., Mental Health Warriors" className="rounded-2xl border-[#E0D5F0] focus:border-[#C8B3E0] bg-[#FFFBF7] h-12 text-base" />
            </div>
            <Button onClick={handleCreate} className="w-full rounded-2xl h-14 text-base text-white" style={{ background: 'linear-gradient(135deg, #C8B3E0 0%, #B39DD1 100%)' }}>Create Group</Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={joinOpen} onOpenChange={setJoinOpen}>
        <DialogContent className="rounded-3xl w-[92vw] max-w-xl mx-auto bg-white p-8">
          <DialogHeader><DialogTitle className="text-3xl text-[#4A4A4A]">Join Group</DialogTitle></DialogHeader>
          <div className="space-y-5 mt-6">
            <div>
              <label className="block mb-2 text-[#4A4A4A]">Invite Code</label>
              <Input value={inviteCode} onChange={e => setInviteCode(e.target.value.toUpperCase())} placeholder="Enter 6-digit code" className="rounded-2xl border-[#E0D5F0] focus:border-[#C8B3E0] bg-[#FFFBF7] uppercase h-12 text-base" maxLength={6} />
            </div>
            <Button onClick={handleJoin} className="w-full rounded-2xl h-14 text-base text-white" style={{ background: 'linear-gradient(135deg, #A8D8EA 0%, #7FC4DA 100%)' }}>Join Group</Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={settingsOpen} onOpenChange={setSettingsOpen}>
        <DialogContent className="rounded-3xl w-[92vw] max-w-xl mx-auto bg-white p-8 max-h-[88vh] overflow-y-auto">
          <DialogHeader><DialogTitle className="text-3xl text-[#4A4A4A]">Group Settings</DialogTitle></DialogHeader>
          <div className="space-y-5 mt-6">
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
