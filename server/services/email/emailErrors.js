// メール送信機能で発生しうるエラーを種類ごとに分類するためのカスタムエラー群。
// AIサービス（server/services/ai/aiErrors.js）と同じ考え方で、呼び出し側が
// 「設定不備なのか」「送信自体の失敗なのか」を区別できるようにしている。

// SMTP接続情報が未設定の場合
export class EmailConfigError extends Error {
  constructor(message) {
    super(message);
    this.name = 'EmailConfigError';
  }
}

// SMTPサーバーへの接続・送信自体が失敗した場合
export class EmailSendError extends Error {
  constructor(message = 'メールの送信に失敗しました') {
    super(message);
    this.name = 'EmailSendError';
  }
}
