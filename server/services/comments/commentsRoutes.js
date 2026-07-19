// コメントAPIのエンドポイント。 /api/todos/:todoId/comments にマウントする。
// 「そのTodoが属するプロジェクトの参加済みメンバーかどうか」をここでバックエンド側でも必ずチェックする。
import { Router } from 'express';
import { listCommentsForTodo, postComment } from './commentsService.js';
import { ProjectAccessError, requireJoinedMembership } from '../projects/projectsService.js';
import { findTodoById } from '../../sheets.js';

const router = Router({ mergeParams: true });

async function loadTodoAndCheckMembership(req) {
  const todo = await findTodoById(req.params.todoId);
  if (!todo) {
    const error = new Error('Todoが見つかりません');
    error.status = 404;
    throw error;
  }
  await requireJoinedMembership(todo.projectId, req.userId);
  return todo;
}

function handleError(res, error, fallbackMessage) {
  if (error instanceof ProjectAccessError || error.status) {
    res.status(error.status || 403).json({ error: error.message });
    return;
  }
  console.error(error);
  res.status(500).json({ error: fallbackMessage });
}

router.get('/', async (req, res) => {
  try {
    await loadTodoAndCheckMembership(req);
    const comments = await listCommentsForTodo(req.params.todoId);
    res.json(comments);
  } catch (error) {
    handleError(res, error, 'コメントの取得に失敗しました');
  }
});

router.post('/', async (req, res) => {
  try {
    await loadTodoAndCheckMembership(req);
    const { body } = req.body;
    if (!body || body.trim() === '') {
      res.status(400).json({ error: 'コメント本文は必須です' });
      return;
    }
    const comment = await postComment(req.params.todoId, req.userId, body.trim());
    res.status(201).json(comment);
  } catch (error) {
    handleError(res, error, 'コメントの投稿に失敗しました');
  }
});

export default router;
