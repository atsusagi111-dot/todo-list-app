// 会員登録・ログインの「業務ロジック」を担当するモジュール。
// バリデーション(validators.js) → 重複チェック・ハッシュ化(passwordService.js)
// → データ保存(sheets.js) という流れをまとめる。
//
// 将来Googleログインなどを追加する場合は、ここに
// 「Googleが返すIDトークンを検証してユーザーを取得/作成する」関数を追加し、
// authRoutes.js から呼び出すだけでよい（tokenService/authMiddlewareは共通利用できる）。
import crypto from 'crypto';
import { validateEmail, validatePassword, validatePasswordConfirmation } from './validators.js';
import { hashPassword, verifyPassword } from './passwordService.js';
import { createUser, findUserByEmail } from '../sheets.js';
import { consumePendingInvitationsForEmail } from '../services/projects/projectsService.js';

// 入力エラー・認証エラーを区別するための専用エラークラス
export class ValidationError extends Error {}

function normalizeEmail(email) {
  return email.trim().toLowerCase();
}

export async function registerUser({ email, password, confirmPassword }) {
  const emailError = validateEmail(email);
  if (emailError) {
    throw new ValidationError(emailError);
  }
  const passwordError = validatePassword(password);
  if (passwordError) {
    throw new ValidationError(passwordError);
  }
  const confirmError = validatePasswordConfirmation(password, confirmPassword);
  if (confirmError) {
    throw new ValidationError(confirmError);
  }

  const normalizedEmail = normalizeEmail(email);
  const existingUser = await findUserByEmail(normalizedEmail);
  if (existingUser) {
    throw new ValidationError('このメールアドレスは既に登録されています');
  }

  const passwordHash = await hashPassword(password);
  const newUser = {
    id: crypto.randomUUID(),
    email: normalizedEmail,
    passwordHash,
    createdAt: new Date().toISOString(),
  };
  await createUser(newUser);

  // このメールアドレス宛に「未登録者向けのプロジェクト招待」が届いていれば、
  // 今登録したばかりのアカウントへ自動的にひも付ける（登録後すぐ「招待されています」に表示される）
  await consumePendingInvitationsForEmail({ id: newUser.id, email: newUser.email });

  return { id: newUser.id, email: newUser.email };
}

export async function authenticateUser({ email, password }) {
  const emailError = validateEmail(email);
  if (emailError) {
    throw new ValidationError(emailError);
  }
  if (!password) {
    throw new ValidationError('パスワードを入力してください');
  }

  const normalizedEmail = normalizeEmail(email);
  const user = await findUserByEmail(normalizedEmail);
  if (!user) {
    throw new ValidationError('メールアドレスまたはパスワードが正しくありません');
  }

  const isPasswordValid = await verifyPassword(password, user.passwordHash);
  if (!isPasswordValid) {
    throw new ValidationError('メールアドレスまたはパスワードが正しくありません');
  }

  return { id: user.id, email: user.email };
}
