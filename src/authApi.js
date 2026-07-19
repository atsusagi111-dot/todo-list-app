// 認証系API（登録・ログイン・ログアウト・ログイン状態確認）の呼び出しをまとめたモジュール。
// Todo用の api.js とは別ファイルに分離し、認証まわりの変更が
// Todo機能に影響しないようにしている。
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

export async function registerAccount({ email, password, confirmPassword }) {
  const response = await fetch(`${API_BASE_URL}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include', // ログイン用Cookieを受け取るために必須
    body: JSON.stringify({ email, password, confirmPassword }),
  });
  return handleResponse(response);
}

export async function loginAccount({ email, password }) {
  const response = await fetch(`${API_BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ email, password }),
  });
  return handleResponse(response);
}

export async function logoutAccount() {
  const response = await fetch(`${API_BASE_URL}/api/auth/logout`, {
    method: 'POST',
    credentials: 'include',
  });
  return handleResponse(response);
}

export async function fetchCurrentUser() {
  const response = await fetch(`${API_BASE_URL}/api/auth/me`, {
    credentials: 'include',
  });
  return handleResponse(response);
}
