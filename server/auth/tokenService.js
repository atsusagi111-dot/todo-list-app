// JWTの発行・検証と、認証用Cookieの読み書きを担当するモジュール。
// ログイン状態はサーバー側にセッションを持たず、
// 「署名付きトークンをhttpOnly Cookieに保存する」方式で保持する。
import jwt from 'jsonwebtoken';

const TOKEN_EXPIRES_IN = '7d';
const COOKIE_NAME = 'auth_token';
const COOKIE_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000; // 7日間

function getJwtSecret() {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error('JWT_SECRET が設定されていません。.env を確認してください。');
  }
  return secret;
}

export function signToken(payload) {
  return jwt.sign(payload, getJwtSecret(), { expiresIn: TOKEN_EXPIRES_IN });
}

export function verifyToken(token) {
  return jwt.verify(token, getJwtSecret());
}

export function getTokenFromRequest(req) {
  return req.cookies ? req.cookies[COOKIE_NAME] : undefined;
}

// 本番環境ではフロントエンドとバックエンドが別ドメインになるため、
// secure(HTTPS限定) + sameSite=none が必要。開発環境では通常のlaxで十分。
function getCookieOptions() {
  const isProduction = process.env.NODE_ENV === 'production';
  return {
    httpOnly: true,
    secure: isProduction,
    sameSite: isProduction ? 'none' : 'lax',
  };
}

export function setAuthCookie(res, token) {
  res.cookie(COOKIE_NAME, token, {
    ...getCookieOptions(),
    maxAge: COOKIE_MAX_AGE_MS,
  });
}

export function clearAuthCookie(res) {
  res.clearCookie(COOKIE_NAME, getCookieOptions());
}
