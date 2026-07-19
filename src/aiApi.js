// AIタスク細分化機能の呼び出しをまとめたモジュール。
// Todo用の api.js とは別ファイルに分離し、AI機能の変更・障害がTodo機能に影響しないようにしている。
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001';

async function handleResponse(response) {
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data.error || `AIとの通信に失敗しました (${response.status})`);
  }
  return response.json();
}

// タスク名と期限をAIに渡し、サブタスクの提案を受け取る。
// 戻り値: [{ title, dueDate }, ...]
export async function requestAiBreakdown({ title, dueDate }) {
  const response = await fetch(`${API_BASE_URL}/api/ai/breakdown`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ title, dueDate }),
  });
  const data = await handleResponse(response);
  return data.subtasks;
}
