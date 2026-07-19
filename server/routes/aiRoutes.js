// AIタスク細分化APIのエンドポイント。
// Todo本体のCRUD（index.js）とは別ファイルに分離し、AI機能の変更が既存のTodo機能に影響しないようにしている。
import { Router } from 'express';
import { generateSubtaskSuggestions } from '../services/ai/aiService.js';
import { AiConfigError, AiRequestError, AiResponseFormatError, AiTimeoutError } from '../services/ai/aiErrors.js';

const router = Router();

router.post('/breakdown', async (req, res) => {
  try {
    const { title, dueDate } = req.body;
    if (!title || title.trim() === '') {
      res.status(400).json({ error: 'タスク名は必須です' });
      return;
    }
    if (!dueDate || dueDate.trim() === '') {
      res.status(400).json({ error: '期限は必須です' });
      return;
    }

    const subtasks = await generateSubtaskSuggestions({ title: title.trim(), dueDate: dueDate.trim() });
    res.json({ subtasks });
  } catch (error) {
    if (error instanceof AiConfigError) {
      console.error('[AI設定エラー]', error.message);
      res.status(503).json({ error: 'AI機能が設定されていません。管理者にお問い合わせください。' });
      return;
    }
    if (error instanceof AiTimeoutError) {
      res.status(504).json({ error: 'AIからの応答がタイムアウトしました。もう一度お試しください。' });
      return;
    }
    if (error instanceof AiResponseFormatError) {
      console.error('[AI応答形式エラー]', error.message);
      res.status(502).json({ error: 'AIの応答を正しく解析できませんでした。もう一度お試しください。' });
      return;
    }
    if (error instanceof AiRequestError) {
      console.error('[AI通信エラー]', error.message);
      res.status(502).json({ error: 'AIとの通信に失敗しました。しばらくしてから再度お試しください。' });
      return;
    }
    console.error(error);
    res.status(500).json({ error: 'タスクの提案に失敗しました' });
  }
});

export default router;
