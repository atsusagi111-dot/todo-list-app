// Todo本体のAPIエンドポイント。
// もともとindex.jsに直接書かれていたものを、チーム共有機能の追加にあわせて
// 「Todo管理」として独立したファイルに切り出した。
//
// 重要な設計：
// - projectIdを指定せずに呼び出した場合（＝これまでのTodoFormPage/TodoListPageの挙動）は
//   自分の「個人プロジェクト」に自動的に紐づく。これにより既存2画面のコードは無変更のまま動く。
// - どのエンドポイントも、最終的には「リクエストしたユーザーがそのTodoの属するプロジェクトの
//   参加済みメンバーかどうか」をバックエンド側で必ず確認してから処理する。
import { Router } from 'express';
import crypto from 'crypto';
import {
  addTodo,
  addTodoWithSubtasks,
  deleteTodo,
  findTodoById,
  getTodosByProjectIds,
  updateTodo,
  updateTodoAssignee,
} from '../../sheets.js';
import {
  ProjectAccessError,
  ensureDefaultProject,
  getJoinedProjectIds,
  getMembership,
  requireJoinedMembership,
  requireOwnerMembership,
} from '../projects/projectsService.js';
import { deleteCommentsForTodos } from '../comments/commentsService.js';
import { notifyTodoCompleted } from '../notifications/notificationsService.js';

const router = Router();

function handleError(res, error, fallbackMessage) {
  if (error instanceof ProjectAccessError || error.status) {
    res.status(error.status || 403).json({ error: error.message });
    return;
  }
  console.error(error);
  res.status(500).json({ error: fallbackMessage });
}

// projectIdが指定されていればそのプロジェクトのメンバーであることを確認し、
// 指定されていなければ「個人プロジェクト」を（無ければ自動生成して）使う。
async function resolveProjectId(userId, requestedProjectId) {
  if (requestedProjectId) {
    await requireJoinedMembership(requestedProjectId, userId);
    return requestedProjectId;
  }
  const defaultProject = await ensureDefaultProject(userId);
  return defaultProject.id;
}

// Todo一覧の取得。
// ?projectId=xxx を指定すればそのプロジェクトのTodoだけ、指定しなければ
// 自分が参加している全プロジェクトのTodoをまとめて返す（＝既存画面はこれまで通り全件表示される）。
router.get('/', async (req, res) => {
  try {
    const { projectId } = req.query;
    let projectIds;
    if (projectId) {
      await requireJoinedMembership(projectId, req.userId);
      projectIds = [projectId];
    } else {
      await ensureDefaultProject(req.userId);
      projectIds = await getJoinedProjectIds(req.userId);
    }
    const todos = await getTodosByProjectIds(projectIds);
    res.json(todos);
  } catch (error) {
    handleError(res, error, 'Todoの取得に失敗しました');
  }
});

router.post('/', async (req, res) => {
  try {
    const { title, content, dueDate, subtasks, projectId } = req.body;
    if (!title || title.trim() === '') {
      res.status(400).json({ error: 'タイトルは必須です' });
      return;
    }

    const resolvedProjectId = await resolveProjectId(req.userId, projectId);

    const todo = {
      id: crypto.randomUUID(),
      title: title.trim(),
      content: content ? content.trim() : '',
      dueDate: dueDate || '',
      completed: false,
      userId: req.userId,
      parentId: '',
      projectId: resolvedProjectId,
      assigneeId: '',
    };

    // AIタスク細分化で提案されたサブタスクが一緒に送られてきた場合は、
    // 親Todoと子Todoをまとめて登録する（階層構造）。それ以外は従来どおり単体Todoとして登録する。
    if (Array.isArray(subtasks) && subtasks.length > 0) {
      const childTodos = subtasks.map((subtask, index) => ({
        id: crypto.randomUUID(),
        title: (subtask.title || '').trim(),
        content: '',
        dueDate: subtask.dueDate || '',
        completed: false,
        userId: req.userId,
        parentId: todo.id,
        sortOrder: index,
        projectId: resolvedProjectId,
        assigneeId: '',
      }));
      const result = await addTodoWithSubtasks(todo, childTodos);
      res.status(201).json(result);
      return;
    }

    await addTodo(todo);
    res.status(201).json(todo);
  } catch (error) {
    handleError(res, error, 'Todoの追加に失敗しました');
  }
});

router.put('/:id', async (req, res) => {
  try {
    const existing = await findTodoById(req.params.id);
    if (!existing) {
      res.status(404).json({ error: 'Todoが見つかりません' });
      return;
    }
    // メンバー（オーナー含む）であれば編集・完了操作が可能
    await requireJoinedMembership(existing.projectId, req.userId);

    const { title, content, dueDate, completed } = req.body;
    const updated = await updateTodo(req.params.id, { title, content, dueDate, completed });
    if (!updated) {
      res.status(404).json({ error: 'Todoが見つかりません' });
      return;
    }

    // 「未完了→完了」に変わった瞬間だけ、プロジェクトの他のメンバーに完了通知を送る
    if (!existing.completed && updated.completed) {
      await notifyTodoCompleted({
        projectId: updated.projectId,
        todoId: updated.id,
        todoTitle: updated.title,
        completedByUserId: req.userId,
      });
    }

    res.json(updated);
  } catch (error) {
    handleError(res, error, 'Todoの更新に失敗しました');
  }
});

// 担当者の変更。仕様上、担当変更はプロジェクトのオーナーのみが行える。
router.put('/:id/assignee', async (req, res) => {
  try {
    const existing = await findTodoById(req.params.id);
    if (!existing) {
      res.status(404).json({ error: 'Todoが見つかりません' });
      return;
    }
    await requireOwnerMembership(existing.projectId, req.userId);

    const { assigneeId } = req.body;
    // 空文字（未割り当てに戻す）以外は、指定した相手が本当にこのプロジェクトの
    // 参加済みメンバーであることを確認する（無関係な第三者を担当者にできないように）
    if (assigneeId) {
      const membership = await getMembership(existing.projectId, assigneeId);
      if (!membership || membership.status !== 'joined') {
        res.status(400).json({ error: '担当者はこのプロジェクトの参加済みメンバーから選択してください' });
        return;
      }
    }

    const updated = await updateTodoAssignee(req.params.id, assigneeId || '');
    res.json(updated);
  } catch (error) {
    handleError(res, error, '担当者の変更に失敗しました');
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const existing = await findTodoById(req.params.id);
    if (!existing) {
      res.status(404).json({ error: 'Todoが見つかりません' });
      return;
    }
    await requireJoinedMembership(existing.projectId, req.userId);

    const deletedIds = await deleteTodo(req.params.id);
    if (!deletedIds) {
      res.status(404).json({ error: 'Todoが見つかりません' });
      return;
    }
    await deleteCommentsForTodos(deletedIds);
    res.status(204).end();
  } catch (error) {
    handleError(res, error, 'Todoの削除に失敗しました');
  }
});

export default router;
