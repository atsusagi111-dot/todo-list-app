// Dify API（chat-messagesエンドポイント）を呼び出すプロバイダー実装。
// 他のプロバイダーと同じ interface: callChat({ systemPrompt, userPrompt, timeoutMs }) => string
//
// Difyはアプリ側（Dify管理画面）でシステムプロンプトを設定する構成が一般的なため、
// ここでは system/user のプロンプトを1つのqueryにまとめて送信する。
import { AiConfigError, AiRequestError, AiTimeoutError } from '../aiErrors.js';

export async function callChat({ systemPrompt, userPrompt, timeoutMs }) {
  const apiKey = process.env.DIFY_API_KEY;
  if (!apiKey) {
    throw new AiConfigError('DIFY_API_KEYが設定されていません');
  }
  const baseUrl = process.env.DIFY_API_URL || 'https://api.dify.ai/v1';

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(`${baseUrl}/chat-messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        inputs: {},
        query: `${systemPrompt}\n\n${userPrompt}`,
        response_mode: 'blocking',
        user: 'todo-app-ai-breakdown',
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      const errorBody = await response.text().catch(() => '');
      throw new AiRequestError(`Dify APIがエラーを返しました (status: ${response.status}) ${errorBody}`);
    }

    const data = await response.json();
    const content = data.answer;
    if (!content) {
      throw new AiRequestError('Dify APIの応答に本文が含まれていません');
    }
    return content;
  } catch (error) {
    if (error.name === 'AbortError') {
      throw new AiTimeoutError();
    }
    if (error instanceof AiRequestError) {
      throw error;
    }
    throw new AiRequestError(`Dify APIへの通信に失敗しました: ${error.message}`);
  } finally {
    clearTimeout(timer);
  }
}
