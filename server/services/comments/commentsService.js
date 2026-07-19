// コメント機能のビジネスロジック。投稿者の表示名解決や、削除の連動処理をここでまとめる。
import crypto from 'crypto';
import { addCommentRow, deleteCommentsByTodoIds, findCommentsByTodoId } from './commentsSheet.js';
import { findUserById, toDisplayName } from '../../sheets.js';

// Todoに投稿されたコメント一覧を、投稿者の表示名付きで返す（新しい順ではなく古い順＝下に追加される表示のため）
export async function listCommentsForTodo(todoId) {
  const comments = await findCommentsByTodoId(todoId);
  const result = [];
  for (const comment of comments) {
    const user = await findUserById(comment.userId);
    result.push({
      ...comment,
      authorDisplayName: user ? toDisplayName(user.email) : '不明なユーザー',
    });
  }
  return result;
}

export async function postComment(todoId, userId, body) {
  const comment = {
    id: crypto.randomUUID(),
    todoId,
    userId,
    body,
    createdAt: new Date().toISOString(),
  };
  await addCommentRow(comment);
  const user = await findUserById(userId);
  return { ...comment, authorDisplayName: user ? toDisplayName(user.email) : '不明なユーザー' };
}

// Todo削除・プロジェクト削除に連動してコメントもまとめて削除する
export async function deleteCommentsForTodos(todoIds) {
  if (!todoIds || todoIds.length === 0) {
    return;
  }
  await deleteCommentsByTodoIds(todoIds);
}
