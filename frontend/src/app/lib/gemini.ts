const API_BASE_URL = 'http://127.0.0.1:8000';

export async function askGemini(
  userId: string,
  message: string,
  groupId?: string | null,
  context?: string | null
): Promise<string> {
  const response = await fetch(`${API_BASE_URL}/chat/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      user_id: userId,
      group_id: groupId ?? null,
      message: message,
      context: context ?? null,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => '');
    throw new Error(`Backend API error: ${response.status} - ${errorText}`);
  }

  const data = await response.json();
  return data.ai_reply;
}

export function isGeminiEnabled(): boolean {
  return true;
}