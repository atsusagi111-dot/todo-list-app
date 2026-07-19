// AIタスク細分化機能で発生しうるエラーを種類ごとに分類するためのカスタムエラー群。
// ルート側(aiRoutes.js)でこれらの種類を判別し、ユーザーに分かりやすい日本語メッセージと
// 適切なHTTPステータスを返すために使用する。

// APIキーが未設定、またはプロバイダー指定が不正な場合
export class AiConfigError extends Error {
  constructor(message) {
    super(message);
    this.name = 'AiConfigError';
  }
}

// AIプロバイダーへの通信がタイムアウトした場合
export class AiTimeoutError extends Error {
  constructor(message = 'AIとの通信がタイムアウトしました') {
    super(message);
    this.name = 'AiTimeoutError';
  }
}

// AIプロバイダーへのリクエスト自体が失敗した場合（ネットワークエラー・HTTPエラーなど）
export class AiRequestError extends Error {
  constructor(message = 'AIとの通信に失敗しました') {
    super(message);
    this.name = 'AiRequestError';
  }
}

// AIの応答が期待した形式（JSON配列）でなかった場合
export class AiResponseFormatError extends Error {
  constructor(message = 'AIの応答を解析できませんでした') {
    super(message);
    this.name = 'AiResponseFormatError';
  }
}
