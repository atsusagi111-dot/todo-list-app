// Anthropic Claude API (Messages API) を呼び出すプロバイダー実装。
// 他のプロバイダーと同じ interface: callChat({ systemPrompt, userPrompt, timeoutMs }) => string
import { AiConfigError, AiRequestError, AiTimeoutError } from '../aiErrors.js';

export async function callChat({ systemPrompt, userPrompt, timeoutMs }) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new AiConfigError('ANTHROPIC_API_KEYが設定されていません');
  }
  const model = process.env.CLAUDE_MODEL || 'claude-sonnet-5';

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model,
        max_tokens: 2000,
        system: systemPrompt,
        messages: [{ role: 'user', content: userPrompt }],
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      const errorBody = await response.text().catch(() => '');
      throw new AiRequestError(`Claude APIがエラーを返しました (status: ${response.status}) ${errorBody}`);
    }

    const data = await response.json();
    const content = data.content?.[0]?.text;
    if (!content) {
      throw new AiRequestError('Claude APIの応答に本文が含まれていません');
    }
    return content;
  } catch (error) {
    if (error.name === 'AbortError') {
      throw new AiTimeoutError();
    }
    if (error instanceof AiRequestError) {
      throw error;
    }
    throw new AiRequestError(`Claude APIへの通信に失敗しました: ${error.message}`);
  } finally {
    clearTimeout(timer);
  }
}
