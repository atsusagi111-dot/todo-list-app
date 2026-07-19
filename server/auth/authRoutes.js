// 認証関連のAPIエンドポイント（登録・ログイン・ログアウト・ログイン状態確認）。
import { Router } from 'express';
import { authenticateUser, registerUser, ValidationError } from './authService.js';
import { clearAuthCookie, getTokenFromRequest, setAuthCookie, signToken, verifyToken } from './tokenService.js';

const router = Router();

router.post('/register', async (req, res) => {
  try {
    const { email, password, confirmPassword } = req.body;
    const user = await registerUser({ email, password, confirmPassword });

    // 登録成功後は自動的にログイン状態にする
    const token = signToken({ userId: user.id, email: user.email });
    setAuthCookie(res, token);
    res.status(201).json({ user });
  } catch (error) {
    if (error instanceof ValidationError) {
      res.status(400).json({ error: error.message });
      return;
    }
    console.error(error);
    res.status(500).json({ error: '登録に失敗しました' });
  }
});

router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await authenticateUser({ email, password });

    const token = signToken({ userId: user.id, email: user.email });
    setAuthCookie(res, token);
    res.json({ user });
  } catch (error) {
    if (error instanceof ValidationError) {
      res.status(401).json({ error: error.message });
      return;
    }
    console.error(error);
    res.status(500).json({ error: 'ログインに失敗しました' });
  }
});

router.post('/logout', (req, res) => {
  clearAuthCookie(res);
  res.status(204).end();
});

// ページ再読み込み時に「ログイン状態を保持する」ために使う、現在のログインユーザー確認API
router.get('/me', (req, res) => {
  const token = getTokenFromRequest(req);
  if (!token) {
    res.status(401).json({ error: 'ログインしていません' });
    return;
  }
  try {
    const payload = verifyToken(token);
    res.json({ user: { id: payload.userId, email: payload.email } });
  } catch (error) {
    res.status(401).json({ error: 'ログインしていません' });
  }
});

export default router;
