const API_KEY = import.meta.env.VITE_GEMINI_API_KEY as string | undefined;
const BACKEND_URL = (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/$/, '') ?? '';
const BASE = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-3-flash-preview:generateContent';

export const isGeminiEnabled = () => Boolean(API_KEY || BACKEND_URL);

export function getBackendUrl(): string {
  return BACKEND_URL;
}

export async function askGemini(prompt: string, signal?: AbortSignal): Promise<string> {
  if (!API_KEY) throw new Error('Gemini API key not configured');

  const res = await fetch(`${BASE}?key=${API_KEY}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    signal,
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0.7, maxOutputTokens: 2048 },
    }),
  });

  if (!res.ok) {
    const err = await res.text().catch(() => '');
    throw new Error(`Gemini error ${res.status}: ${err}`);
  }

  const data = await res.json();
  return data.candidates?.[0]?.content?.parts?.[0]?.text ?? 'No response generated.';
}

export async function coachAskBackend(userId: string, message: string, signal?: AbortSignal): Promise<string> {
  if (!BACKEND_URL) throw new Error('Backend URL not configured');
  const res = await fetch(`${BACKEND_URL}/coach/ask`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    signal,
    body: JSON.stringify({ user_id: userId, message }),
  });
  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    let detail = errText;
    try {
      const j = JSON.parse(errText);
      if (j.detail) detail = typeof j.detail === 'string' ? j.detail : JSON.stringify(j.detail);
    } catch (_) {}
    throw new Error(detail || `Coach error ${res.status}`);
  }
  const data = await res.json();
  return data.reply ?? 'No response generated.';
}

export async function coachGroupAnalysisBackend(groupId: string, instruction: string, signal?: AbortSignal): Promise<string> {
  if (!BACKEND_URL) throw new Error('Backend URL not configured');
  const res = await fetch(`${BACKEND_URL}/coach/group-analysis`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    signal,
    body: JSON.stringify({ group_id: groupId, instruction }),
  });
  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    let detail = errText;
    try {
      const j = JSON.parse(errText);
      if (j.detail) detail = typeof j.detail === 'string' ? j.detail : JSON.stringify(j.detail);
    } catch (_) {}
    throw new Error(detail || `Group analysis error ${res.status}`);
  }
  const data = await res.json();
  return data.reply ?? 'No response generated.';
}
