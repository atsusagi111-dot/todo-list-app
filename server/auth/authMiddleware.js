// Todo関連APIを保護するためのミドルウェア。
// Cookieに有効なJWTが無ければ401を返し、あれば req.userId / req.userEmail にセットする。
import { getTokenFromRequest, verifyToken } from './tokenService.js';

export function requireAuth(req, res, next) {
  const token = getTokenFromRequest(req);
  if (!token) {
    res.status(401).json({ error: 'ログインが必要です' });
    return;
  }

  try {
    const payload = verifyToken(token);
    req.userId = payload.userId;
    req.userEmail = payload.email;
    next();
  } catch (error) {
    res.status(401).json({ error: 'ログインが必要です' });
  }
}
