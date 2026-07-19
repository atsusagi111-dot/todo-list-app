// チーム共有機能（プロジェクト・メンバー招待・担当者・コメント・通知）の呼び出しをまとめたモジュール。
// Todo単体のCRUDは既存の api.js を引き続き使い、ここには「チーム共有」関連の呼び出しだけを置く。
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

function request(path, options = {}) {
  return fetch(`${API_BASE_URL}${path}`, {
    credentials: 'include',
    headers: options.body ? { 'Content-Type': 'application/json' } : undefined,
    ...options,
  }).then(handleResponse);
}

// --- プロジェクト ---

export function fetchMyProjects() {
  return request('/api/projects');
}

export function fetchMyInvitations() {
  return request('/api/projects/invitations');
}

export function createProject(name) {
  return request('/api/projects', { method: 'POST', body: JSON.stringify({ name }) });
}

export function fetchProjectDetail(projectId) {
  return request(`/api/projects/${projectId}`);
}

export function inviteMember(projectId, email) {
  return request(`/api/projects/${projectId}/members`, {
    method: 'POST',
    body: JSON.stringify({ email }),
  });
}

export function resendInvitation(projectId, email) {
  return request(`/api/projects/${projectId}/invitations/resend`, {
    method: 'POST',
    body: JSON.stringify({ email }),
  });
}

export function respondToInvitation(projectId, action) {
  return request(`/api/projects/${projectId}/respond`, {
    method: 'POST',
    body: JSON.stringify({ action }),
  });
}

export function removeMember(projectId, userId) {
  return request(`/api/projects/${projectId}/members/${userId}`, { method: 'DELETE' });
}

export function deleteProject(projectId) {
  return request(`/api/projects/${projectId}`, { method: 'DELETE' });
}

// --- 担当者（オーナーのみ変更可能。権限チェックはサーバー側でも行われる） ---

export function updateTodoAssignee(todoId, assigneeId) {
  return request(`/api/todos/${todoId}/assignee`, {
    method: 'PUT',
    body: JSON.stringify({ assigneeId }),
  });
}

// --- コメント ---

export function fetchComments(todoId) {
  return request(`/api/todos/${todoId}/comments`);
}

export function postComment(todoId, body) {
  return request(`/api/todos/${todoId}/comments`, {
    method: 'POST',
    body: JSON.stringify({ body }),
  });
}

// --- 通知 ---

export function fetchNotifications() {
  return request('/api/notifications');
}

export function markNotificationRead(id) {
  return request(`/api/notifications/${id}/read`, { method: 'PUT' });
}

export function markAllNotificationsRead() {
  return request('/api/notifications/read-all', { method: 'PUT' });
}
