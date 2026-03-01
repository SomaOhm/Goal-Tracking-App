import React, { useState, useRef, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import { useApp } from '../context/AppContext';
import { Card } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Textarea } from '../components/ui/textarea';
import { Send, Sparkles, Loader2, Bot, User as UserIcon, Trash2 } from 'lucide-react';
import { askGemini, isGeminiEnabled, getBackendUrl, coachAskBackend } from '../lib/gemini';
import { format } from 'date-fns';

interface Message { role: 'user' | 'ai'; text: string }

const buildContext = (user: ReturnType<typeof useApp>['user'], goals: ReturnType<typeof useApp>['goals'], checkIns: ReturnType<typeof useApp>['checkIns']) => {
  const my = goals.filter(g => g.userId === user?.id);
  const myCIs = checkIns.filter(c => c.userId === user?.id);
  const today = format(new Date(), 'yyyy-MM-dd');

  let ctx = `User: ${user?.name}\nToday: ${today}\n\n`;

  if (my.length === 0) {
    ctx += 'This user has no goals yet.\n';
  } else {
    ctx += `Goals (${my.length}):\n`;
    for (const g of my) {
      const streak = (() => {
        if (!g.completions.length) return 0;
        const sorted = [...g.completions].sort((a, b) => b.date.localeCompare(a.date));
        let s = 0, d = new Date();
        for (const c of sorted) {
          const diff = Math.floor((d.getTime() - new Date(c.date).getTime()) / 86400000);
          if (diff === s) s++; else break;
        }
        return s;
      })();
      ctx += `\n- "${g.title}" (${g.frequency})`;
      if (g.description) ctx += `\n  Description: ${g.description}`;
      if (g.startDate || g.endDate) ctx += `\n  Time frame: ${g.startDate ?? '?'} to ${g.endDate ?? 'ongoing'}`;
      if (g.checklist?.length) ctx += `\n  Tasks: ${g.checklist.join(', ')}`;
      ctx += `\n  Streak: ${streak} days, Total completions: ${g.completions.length}`;
      const recent = g.completions.filter(c => c.reflection).slice(-3);
      if (recent.length) ctx += `\n  Recent reflections: ${recent.map(c => `[${c.date}] "${c.reflection}"`).join('; ')}`;
    }
  }

  if (myCIs.length) {
    ctx += `\n\nRecent check-ins:\n`;
    for (const ci of myCIs.slice(-5)) {
      ctx += `- ${ci.date}: mood ${ci.mood}/5${ci.reflection ? ` — "${ci.reflection}"` : ''}\n`;
    }
  }

  return ctx;
};

const QUICK_PROMPTS = [
  { label: 'Create a plan', prompt: 'Based on my goals, create a detailed weekly action plan I can follow. Be specific with days and times.' },
  { label: 'Progress review', prompt: 'Review my goal progress so far. What am I doing well? Where am I falling behind? Give honest, constructive feedback.' },
  { label: 'Motivate me', prompt: 'Give me a personalized motivational message based on my actual goals and progress. Reference specific things I\'ve done.' },
  { label: 'Adjust my goals', prompt: 'Based on my progress and reflections, suggest adjustments to my goals. Are any too ambitious? Too easy? What should I change?' },
];

export const Chat: React.FC = () => {
  const { user, goals, checkIns } = useApp();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages]);

  const send = async (text: string) => {
    if (!text.trim() || loading) return;
    const userMsg = text.trim();
    setInput('');
    setMessages(prev => [...prev, { role: 'user', text: userMsg }]);
    setLoading(true);

    try {
      abortRef.current = new AbortController();
      const signal = abortRef.current.signal;
      const backendUrl = getBackendUrl();
      let reply: string;
      if (backendUrl && user?.id) {
        reply = await coachAskBackend(user.id, userMsg, signal);
      } else if (backendUrl && !user?.id) {
        setMessages(prev => [...prev, { role: 'ai', text: 'Please sign in to use the AI coach.' }]);
        return;
      } else {
        const ctx = buildContext(user, goals, checkIns);
        const prompt = `You are MindBuddy, a supportive mental health and wellness AI coach. You have access to this user's goal data:\n\n${ctx}\n\nUser message: ${userMsg}\n\nRespond helpfully. Use markdown formatting. Be warm but actionable. Reference their specific goals and progress when relevant.`;
        reply = await askGemini(prompt, signal);
      }
      setMessages(prev => [...prev, { role: 'ai', text: reply }]);
    } catch (e: any) {
      if (e.name !== 'AbortError') {
        setMessages(prev => [...prev, { role: 'ai', text: `Sorry, I couldn't process that. ${e.message}` }]);
      }
    } finally {
      setLoading(false);
      abortRef.current = null;
    }
  };

  const clear = () => {
    abortRef.current?.abort();
    setMessages([]);
    setLoading(false);
  };

  if (!isGeminiEnabled()) {
    return (
      <div className="pb-28 px-4 pt-6 max-w-md mx-auto">
        <h1 className="text-3xl mb-2 text-[#4A4A4A]">AI Coach</h1>
        <Card className="p-8 text-center rounded-3xl shadow-md border-none bg-white mt-4">
          <div className="w-16 h-16 rounded-full bg-[#E0D5F0] mx-auto mb-4 flex items-center justify-center">
            <Sparkles className="w-8 h-8 text-[#C8B3E0]" />
          </div>
          <p className="text-[#4A4A4A] mb-2 font-medium">AI Coach not configured</p>
          <p className="text-sm text-[#8A8A8A]">Set <code className="bg-[#F5F0FF] px-1.5 py-0.5 rounded text-xs">VITE_API_URL</code> to your backend (recommended) or <code className="bg-[#F5F0FF] px-1.5 py-0.5 rounded text-xs">VITE_GEMINI_API_KEY</code> in <code className="bg-[#F5F0FF] px-1.5 py-0.5 rounded text-xs">.env</code> to enable.</p>
        </Card>
      </div>
    );
  }

  return (
    <div className="pb-28 pt-6 max-w-md mx-auto flex flex-col" style={{ height: 'calc(100vh - 5rem)' }}>
      <div className="px-4 flex items-center justify-between mb-3">
        <div>
          <h1 className="text-3xl text-[#4A4A4A]">AI Coach</h1>
          <p className="text-sm text-[#8A8A8A]">Personalized guidance for your goals</p>
        </div>
        {messages.length > 0 && (
          <button onClick={clear} className="p-2 hover:bg-red-50 rounded-xl transition-colors">
            <Trash2 className="w-5 h-5 text-red-400" />
          </button>
        )}
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 space-y-3">
        {messages.length === 0 && (
          <div className="space-y-3 mt-4">
            <Card className="p-5 rounded-3xl shadow-md border-none bg-gradient-to-br from-[#E0D5F0] to-[#FFD4C8]">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-full bg-white/60 flex items-center justify-center">
                  <Sparkles className="w-5 h-5 text-[#C8B3E0]" />
                </div>
                <div>
                  <p className="text-sm font-medium text-[#4A4A4A]">Hey {user?.name}!</p>
                  <p className="text-xs text-[#6A6A6A]">I can see your goals and progress. Ask me anything.</p>
                </div>
              </div>
            </Card>
            <p className="text-xs text-[#8A8A8A] px-1">Quick actions:</p>
            <div className="grid grid-cols-2 gap-2">
              {QUICK_PROMPTS.map(qp => (
                <button key={qp.label} onClick={() => send(qp.prompt)}
                  className="p-3 rounded-2xl bg-white border border-[#E0D5F0] text-left hover:bg-[#FAFAFA] transition-colors">
                  <p className="text-sm text-[#4A4A4A] font-medium">{qp.label}</p>
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((msg, i) => (
          <div key={i} className={`flex gap-2 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            {msg.role === 'ai' && (
              <div className="w-7 h-7 rounded-full bg-[#E0D5F0] flex items-center justify-center shrink-0 mt-1">
                <Bot className="w-4 h-4 text-[#C8B3E0]" />
              </div>
            )}
            <div className={`max-w-[85%] px-4 py-3 rounded-2xl text-sm ${
              msg.role === 'user'
                ? 'bg-gradient-to-br from-[#C8B3E0] to-[#B39DD1] text-white whitespace-pre-wrap'
                : 'bg-white border border-[#F0F0F0] text-[#4A4A4A] prose prose-sm max-w-none'
            }`}>
              {msg.role === 'ai' ? (
                <ReactMarkdown
                  components={{
                    p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
                    ul: ({ children }) => <ul className="list-disc pl-4 my-2 space-y-0.5">{children}</ul>,
                    ol: ({ children }) => <ol className="list-decimal pl-4 my-2 space-y-0.5">{children}</ol>,
                    li: ({ children }) => <li className="leading-snug">{children}</li>,
                    strong: ({ children }) => <strong className="font-semibold text-[#3A3A3A]">{children}</strong>,
                    code: ({ children }) => <code className="bg-[#F5F0FF] px-1.5 py-0.5 rounded text-xs">{children}</code>,
                    h1: ({ children }) => <h1 className="text-base font-semibold mt-3 mb-1">{children}</h1>,
                    h2: ({ children }) => <h2 className="text-sm font-semibold mt-3 mb-1">{children}</h2>,
                    h3: ({ children }) => <h3 className="text-sm font-semibold mt-2 mb-1">{children}</h3>,
                  }}
                >
                  {msg.text}
                </ReactMarkdown>
              ) : (
                <span className="whitespace-pre-wrap">{msg.text}</span>
              )}
            </div>
            {msg.role === 'user' && (
              <div className="w-7 h-7 rounded-full bg-[#FFD4C8] flex items-center justify-center shrink-0 mt-1">
                <UserIcon className="w-4 h-4 text-[#FFB5A0]" />
              </div>
            )}
          </div>
        ))}

        {loading && (
          <div className="flex gap-2 justify-start">
            <div className="w-7 h-7 rounded-full bg-[#E0D5F0] flex items-center justify-center shrink-0 mt-1">
              <Bot className="w-4 h-4 text-[#C8B3E0]" />
            </div>
            <div className="px-4 py-3 rounded-2xl bg-white border border-[#F0F0F0]">
              <Loader2 className="w-5 h-5 text-[#C8B3E0] animate-spin" />
            </div>
          </div>
        )}
      </div>

      <div className="px-4 pt-3">
        <div className="flex gap-2">
          <Textarea
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(input); } }}
            placeholder="Ask about your goals..."
            rows={1}
            className="rounded-2xl border-[#E0D5F0] focus:border-[#C8B3E0] bg-[#FFFBF7] text-sm resize-none min-h-[44px]"
          />
          <Button onClick={() => send(input)} disabled={loading || !input.trim()}
            className="rounded-2xl h-11 w-11 shrink-0 p-0 text-white"
            style={{ background: 'linear-gradient(135deg, #C8B3E0 0%, #B39DD1 100%)' }}>
            <Send className="w-5 h-5" />
          </Button>
        </div>
      </div>
    </div>
  );
};