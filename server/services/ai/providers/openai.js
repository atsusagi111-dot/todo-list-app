// OpenAI Chat Completions API を呼び出すプロバイダー実装。
// 他のプロバイダー（Claude/Gemini/Dify）と同じ interface: callChat({ systemPrompt, userPrompt, timeoutMs }) => string
import { AiConfigError, AiRequestError, AiTimeoutError } from '../aiErrors.js';

export async function callChat({ systemPrompt, userPrompt, timeoutMs }) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new AiConfigError('OPENAI_API_KEYが設定されていません');
  }
  const model = process.env.OPENAI_MODEL || 'gpt-4o-mini';

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        temperature: 0.3,
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      const errorBody = await response.text().catch(() => '');
      throw new AiRequestError(`OpenAI APIがエラーを返しました (status: ${response.status}) ${errorBody}`);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;
    if (!content) {
      throw new AiRequestError('OpenAI APIの応答に本文が含まれていません');
    }
    return content;
  } catch (error) {
    if (error.name === 'AbortError') {
      throw new AiTimeoutError();
    }
    if (error instanceof AiRequestError) {
      throw error;
    }
    throw new AiRequestError(`OpenAI APIへの通信に失敗しました: ${error.message}`);
  } finally {
    clearTimeout(timer);
  }
}
