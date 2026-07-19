// Google Gemini API を呼び出すプロバイダー実装。
// 他のプロバイダーと同じ interface: callChat({ systemPrompt, userPrompt, timeoutMs }) => string
import { AiConfigError, AiRequestError, AiTimeoutError } from '../aiErrors.js';

export async function callChat({ systemPrompt, userPrompt, timeoutMs }) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new AiConfigError('GEMINI_API_KEYが設定されていません');
  }
  const model = process.env.GEMINI_MODEL || 'gemini-1.5-flash';

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: systemPrompt }] },
        contents: [{ role: 'user', parts: [{ text: userPrompt }] }],
        generationConfig: { temperature: 0.3 },
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      const errorBody = await response.text().catch(() => '');
      throw new AiRequestError(`Gemini APIがエラーを返しました (status: ${response.status}) ${errorBody}`);
    }

    const data = await response.json();
    const content = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!content) {
      throw new AiRequestError('Gemini APIの応答に本文が含まれていません');
    }
    return content;
  } catch (error) {
    if (error.name === 'AbortError') {
      throw new AiTimeoutError();
    }
    if (error instanceof AiRequestError) {
      throw error;
    }
    throw new AiRequestError(`Gemini APIへの通信に失敗しました: ${error.message}`);
  } finally {
    clearTimeout(timer);
  }
}
