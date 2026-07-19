// プロジェクト管理のAPIエンドポイント。
// 「認証済みであること」はindex.jsでこのルーター全体にrequireAuthをかけて保証し、
// 「そのプロジェクトのメンバーであること」「オーナーであること」は
// projectsService内の各関数がチェックする（＝バックエンド側でも権限チェックを行う）。
import { Router } from 'express';
import {
  ProjectAccessError,
  createProject,
  deleteProject,
  getProjectDetail,
  inviteMemberByEmail,
  listMyInvitations,
  listMyProjects,
  removeMemberFromProject,
  respondToInvitation,
} from './projectsService.js';
import { deleteCommentsForTodos } from '../comments/commentsService.js';

const router = Router();

// 権限エラー・入力エラーをHTTPレスポンスに変換する共通ハンドラ
function handleError(res, error, fallbackMessage) {
  if (error instanceof ProjectAccessError) {
    res.status(error.status).json({ error: error.message });
    return;
  }
  if (error.status) {
    res.status(error.status).json({ error: error.message });
    return;
  }
  console.error(error);
  res.status(500).json({ error: fallbackMessage });
}

// 自分が参加しているプロジェクトの一覧
router.get('/', async (req, res) => {
  try {
    const projects = await listMyProjects(req.userId);
    res.json(projects);
  } catch (error) {
    handleError(res, error, 'プロジェクト一覧の取得に失敗しました');
  }
});

// 自分宛ての招待（返答待ち）一覧。/:id より先に定義し、"invitations" がidとして
// マッチしてしまわないようにする。
router.get('/invitations', async (req, res) => {
  try {
    const invitations = await listMyInvitations(req.userId);
    res.json(invitations);
  } catch (error) {
    handleError(res, error, '招待一覧の取得に失敗しました');
  }
});

// 新規プロジェクト作成
router.post('/', async (req, res) => {
  try {
    const { name } = req.body;
    if (!name || name.trim() === '') {
      res.status(400).json({ error: 'プロジェクト名は必須です' });
      return;
    }
    const project = await createProject(req.userId, name.trim());
    res.status(201).json(project);
  } catch (error) {
    handleError(res, error, 'プロジェクトの作成に失敗しました');
  }
});

// プロジェクト詳細（メンバー一覧を含む）。参加済みメンバーのみ閲覧可能。
router.get('/:id', async (req, res) => {
  try {
    const detail = await getProjectDetail(req.params.id, req.userId);
    res.json(detail);
  } catch (error) {
    handleError(res, error, 'プロジェクト詳細の取得に失敗しました');
  }
});

// メンバー招待（オーナーのみ）。
// 登録済みのメールアドレスならプロジェクトへの招待として、未登録のメールアドレスなら
// 新規登録を促すメールとして送信する（inviteMemberByEmail内で自動的に振り分ける）。
router.post('/:id/members', async (req, res) => {
  try {
    const { email } = req.body;
    if (!email || email.trim() === '') {
      res.status(400).json({ error: 'メールアドレスは必須です' });
      return;
    }
    // メール本文中の登録・ログインリンクを組み立てるためのフロントエンドのURL
    const appUrl = process.env.CORS_ORIGIN || 'http://localhost:5173';
    const invited = await inviteMemberByEmail(req.params.id, req.userId, email.trim(), appUrl);
    res.status(201).json(invited);
  } catch (error) {
    handleError(res, error, 'メンバーの招待に失敗しました');
  }
});

// 招待への応答（参加 or 辞退）
router.post('/:id/respond', async (req, res) => {
  try {
    const { action } = req.body;
    if (action !== 'accept' && action !== 'decline') {
      res.status(400).json({ error: 'actionはacceptまたはdeclineを指定してください' });
      return;
    }
    const result = await respondToInvitation(req.params.id, req.userId, action);
    res.json(result);
  } catch (error) {
    handleError(res, error, '招待への応答に失敗しました');
  }
});

// メンバー削除（オーナーのみ）
router.delete('/:id/members/:userId', async (req, res) => {
  try {
    await removeMemberFromProject(req.params.id, req.userId, req.params.userId);
    res.status(204).end();
  } catch (error) {
    handleError(res, error, 'メンバーの削除に失敗しました');
  }
});

// プロジェクト削除（オーナーのみ）。所属するTodo・コメントもまとめて削除する。
router.delete('/:id', async (req, res) => {
  try {
    const deletedTodoIds = await deleteProject(req.params.id, req.userId);
    await deleteCommentsForTodos(deletedTodoIds);
    res.status(204).end();
  } catch (error) {
    handleError(res, error, 'プロジェクトの削除に失敗しました');
  }
});

export default router;
