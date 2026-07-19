// 通知APIのエンドポイント。通知は「宛先ユーザー本人」だけが読み書きできる
// （URLにprojectIdやtodoIdを含まないため、プロジェクトメンバーかどうかのチェックは不要）。
import { Router } from 'express';
import {
  listNotificationsForUser,
  markAllNotificationsRead,
  markNotificationRead,
} from './notificationsService.js';

const router = Router();

router.get('/', async (req, res) => {
  try {
    const notifications = await listNotificationsForUser(req.userId);
    res.json(notifications);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: '通知の取得に失敗しました' });
  }
});

router.put('/read-all', async (req, res) => {
  try {
    await markAllNotificationsRead(req.userId);
    res.status(204).end();
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: '通知の既読処理に失敗しました' });
  }
});

router.put('/:id/read', async (req, res) => {
  try {
    const success = await markNotificationRead(req.params.id, req.userId);
    if (!success) {
      res.status(404).json({ error: '通知が見つかりません' });
      return;
    }
    res.status(204).end();
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: '通知の既読処理に失敗しました' });
  }
});

export default router;
