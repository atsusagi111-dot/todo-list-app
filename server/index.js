import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { ensureHeaderRow, ensureUsersHeaderRow } from './sheets.js';
import authRoutes from './auth/authRoutes.js';
import aiRoutes from './routes/aiRoutes.js';
import todosRoutes from './services/todos/todosRoutes.js';
import projectsRoutes from './services/projects/projectsRoutes.js';
import commentsRoutes from './services/comments/commentsRoutes.js';
import notificationsRoutes from './services/notifications/notificationsRoutes.js';
import {
  ensurePendingInvitationsHeaderRow,
  ensureProjectMembersHeaderRow,
  ensureProjectsHeaderRow,
} from './services/projects/projectsSheet.js';
import { ensureCommentsHeaderRow } from './services/comments/commentsSheet.js';
import { ensureNotificationsHeaderRow } from './services/notifications/notificationsSheet.js';
import { requireAuth } from './auth/authMiddleware.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '..', '.env') });

const app = express();

// フロントエンドとバックエンドが別オリジンでもCookieを送受信できるよう、
// origin を明示的に指定し credentials を許可する（origin: '*' は credentials と併用不可）
app.use(
  cors({
    origin: process.env.CORS_ORIGIN || 'http://localhost:5173',
    credentials: true,
  })
);
app.use(express.json());
app.use(cookieParser());

// 認証系API（登録・ログイン・ログアウト・ログイン確認）
app.use('/api/auth', authRoutes);

// これより下の全APIは、ログイン済みユーザーのみアクセスできる
app.use('/api/todos', requireAuth);
app.use('/api/ai', requireAuth);
app.use('/api/projects', requireAuth);
app.use('/api/notifications', requireAuth);

// Todo管理（追加・編集・削除・担当者変更）。既存の追加・編集・一覧画面はこのAPIをそのまま使い続ける。
app.use('/api/todos', todosRoutes);
// コメント機能は特定のTodoに紐づくため、Todo系APIの下にネストしたパスでマウントする
app.use('/api/todos/:todoId/comments', requireAuth, commentsRoutes);
// AIタスク細分化機能（既存のまま）
app.use('/api/ai', aiRoutes);
// プロジェクト管理（作成・一覧・招待・メンバー管理）
app.use('/api/projects', projectsRoutes);
// アプリ内通知（完了通知など）
app.use('/api/notifications', notificationsRoutes);

const PORT = process.env.PORT || 3001;

// 起動時に、Todo/Users/Projects/ProjectMembers/Comments/Notifications
// すべてのシートのヘッダー行を用意しておく（無ければ作成、足りなければ追記）
Promise.all([
  ensureHeaderRow(),
  ensureUsersHeaderRow(),
  ensureProjectsHeaderRow(),
  ensureProjectMembersHeaderRow(),
  ensurePendingInvitationsHeaderRow(),
  ensureCommentsHeaderRow(),
  ensureNotificationsHeaderRow(),
])
  .then(() => {
    app.listen(PORT, () => {
      console.log(`サーバーが起動しました: http://localhost:${PORT}`);
    });
  })
  .catch((error) => {
    console.error('スプレッドシートの初期化に失敗しました。');
    console.error('SPREADSHEET_ID・サービスアカウントキー・共有設定を確認してください。');
    console.error(error.message);
  });
