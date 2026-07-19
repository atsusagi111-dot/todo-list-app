// パスワードのハッシュ化・照合だけを担当するモジュール。
// bcryptjs はネイティブビルドが不要な純JS実装のため、環境を問わず動作する。
import bcrypt from 'bcryptjs';

const SALT_ROUNDS = 10;

export async function hashPassword(plainPassword) {
  return bcrypt.hash(plainPassword, SALT_ROUNDS);
}

export async function verifyPassword(plainPassword, passwordHash) {
  return bcrypt.compare(plainPassword, passwordHash);
}
