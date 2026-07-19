// 入力チェック専用モジュール。
// メール形式・パスワード形式など「正しいかどうかの判定」だけを担当し、
// 実際の登録処理（authService.js）とは分離している。

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
// 英数字のみ・6文字以上
const PASSWORD_REGEX = /^[A-Za-z0-9]{6,}$/;

export function validateEmail(email) {
  if (!email || email.trim() === '') {
    return 'メールアドレスを入力してください';
  }
  if (!EMAIL_REGEX.test(email.trim())) {
    return 'メールアドレスの形式が正しくありません';
  }
  return null;
}

export function validatePassword(password) {
  if (!password) {
    return 'パスワードを入力してください';
  }
  if (!PASSWORD_REGEX.test(password)) {
    return 'パスワードは6文字以上の英数字で入力してください';
  }
  return null;
}

export function validatePasswordConfirmation(password, confirmPassword) {
  if (!confirmPassword) {
    return '確認用パスワードを入力してください';
  }
  if (password !== confirmPassword) {
    return 'パスワードと確認用パスワードが一致しません';
  }
  return null;
}
