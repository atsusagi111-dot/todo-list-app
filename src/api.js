const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001';

async function handleResponse(response) {
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data.error || `通信に失敗しました (${response.status})`);
  }
  if (response.status === 204) {
    return null;
  }
  return response.json();
}

// projectIdを省略すると、これまでどおり自分が参加している全プロジェクトのTodoをまとめて取得する
// （既存の「追加・編集」「一覧を確認」画面はこの省略形のまま呼び出しており、無変更で動く）。
// projectIdを指定すると、そのプロジェクトのTodoだけに絞り込める（プロジェクト画面で使用）。
export async function fetchTodos(projectId) {
  const query = projectId ? `?projectId=${encodeURIComponent(projectId)}` : '';
  const response = await fetch(`${API_BASE_URL}/api/todos${query}`, {
    credentials: 'include', // ログイン中ユーザーを判定するためCookieを送信する
  });
  return handleResponse(response);
}

// todo.subtasks に配列を渡すと、親Todoとサブタスクをまとめて階層構造として登録する
// （AIタスク細分化機能で「この内容で登録」を押した場合に使用）。省略時は従来どおり単体Todoとして登録される。
export async function createTodo(todo) {
  const response = await fetch(`${API_BASE_URL}/api/todos`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(todo),
  });
  return handleResponse(response);
}

export async function updateTodo(id, todo) {
  const response = await fetch(`${API_BASE_URL}/api/todos/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(todo),
  });
  return handleResponse(response);
}

export async function deleteTodo(id) {
  const response = await fetch(`${API_BASE_URL}/api/todos/${id}`, {
    method: 'DELETE',
    credentials: 'include',
  });
  return handleResponse(response);
}
