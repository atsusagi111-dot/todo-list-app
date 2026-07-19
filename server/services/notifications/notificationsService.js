// 通知機能のビジネスロジック。
// Todoが完了したときに「担当者以外のメンバーにも」お知らせを届けるための組み立てをここで行う。
import crypto from 'crypto';
import { addNotificationRows, findNotificationsByUser, markAllAsRead, markAsRead } from './notificationsSheet.js';
import { listJoinedMembers } from '../projects/projectsService.js';
import { findUserById, toDisplayName } from '../../sheets.js';

export async function listNotificationsForUser(userId) {
  return findNotificationsByUser(userId);
}

export async function markNotificationRead(id, userId) {
  return markAsRead(id, userId);
}

export async function markAllNotificationsRead(userId) {
  return markAllAsRead(userId);
}

// Todoが「未完了→完了」に変わったタイミングで、そのプロジェクトの他のメンバー全員に通知する。
// 完了させた本人には通知しない（自分の操作結果を自分に知らせても意味がないため）。
export async function notifyTodoCompleted({ projectId, todoId, todoTitle, completedByUserId }) {
  const members = await listJoinedMembers(projectId);
  const recipients = members.filter((member) => member.userId !== completedByUserId);
  if (recipients.length === 0) {
    return;
  }

  const completedByUser = await findUserById(completedByUserId);
  const completedByName = completedByUser ? toDisplayName(completedByUser.email) : '誰か';
  const message = `${completedByName}さんが『${todoTitle}』を完了しました`;
  const createdAt = new Date().toISOString();

  const notifications = recipients.map((member) => ({
    id: crypto.randomUUID(),
    userId: member.userId,
    message,
    projectId,
    todoId,
    isRead: false,
    createdAt,
  }));

  await addNotificationRows(notifications);
}
