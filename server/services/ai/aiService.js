// AIタスク細分化機能のエントリーポイント。
// どのAIプロバイダー（OpenAI/Claude/Gemini/Dify）を使うかは環境変数 AI_PROVIDER で切り替える。
// 呼び出し側（aiRoutes.js）はプロバイダーの違いを一切意識せず、この generateSubtaskSuggestions だけを使う。
import { AiConfigError, AiResponseFormatError } from './aiErrors.js';
import { buildSystemPrompt, buildUserPrompt } from './promptBuilder.js';
import { callChat as callOpenAi } from './providers/openai.js';
import { callChat as callClaude } from './providers/claude.js';
import { callChat as callGemini } from './providers/gemini.js';
import { callChat as callDify } from './providers/dify.js';

const PROVIDERS = {
  openai: callOpenAi,
  claude: callClaude,
  gemini: callGemini,
  dify: callDify,
};

const DEFAULT_TIMEOUT_MS = 20000;

function getProvider() {
  const providerName = (process.env.AI_PROVIDER || '').toLowerCase();
  if (!providerName) {
    throw new AiConfigError('AI_PROVIDERが設定されていません（openai / claude / gemini / dify のいずれかを指定してください）');
  }
  const provider = PROVIDERS[providerName];
  if (!provider) {
    throw new AiConfigError(`未対応のAI_PROVIDERです: ${providerName}`);
  }
  return provider;
}

// AIの応答テキストからJSON配列を取り出す。
// モデルによっては ```json ... ``` のようにコードブロックで囲って返すことがあるため、その記号を取り除く。
function extractJsonArray(rawText) {
  const trimmed = rawText.trim();
  const withoutFence = trimmed.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/i, '');

  let parsed;
  try {
    parsed = JSON.parse(withoutFence);
  } catch {
    throw new AiResponseFormatError('AIの応答がJSON形式ではありませんでした');
  }

  if (!Array.isArray(parsed)) {
    throw new AiResponseFormatError('AIの応答がJSON配列ではありませんでした');
  }
  return parsed;
}

// 個々のサブタスクの形式を検証し、余分なフィールドを除いた安全な形に整える
function normalizeSubtasks(parsed) {
  if (parsed.length === 0) {
    throw new AiResponseFormatError('AIがサブタスクを1件も生成しませんでした');
  }

  return parsed.map((item, index) => {
    if (!item || typeof item.title !== 'string' || item.title.trim() === '') {
      throw new AiResponseFormatError(`${index + 1}件目のサブタスクにタイトルがありません`);
    }
    if (typeof item.dueDate !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(item.dueDate)) {
      throw new AiResponseFormatError(`${index + 1}件目のサブタスクの期限形式が不正です`);
    }
    return { title: item.title.trim(), dueDate: item.dueDate };
  });
}

// タスク名と期限からAIにサブタスクを提案させる。
// 戻り値: [{ title, dueDate }, ...]
export async function generateSubtaskSuggestions({ title, dueDate }) {
  const provider = getProvider();
  const timeoutMs = Number(process.env.AI_TIMEOUT_MS) || DEFAULT_TIMEOUT_MS;

  const systemPrompt = buildSystemPrompt();
  const userPrompt = buildUserPrompt({ title, dueDate });

  const rawText = await provider({ systemPrompt, userPrompt, timeoutMs });
  const parsed = extractJsonArray(rawText);
  return normalizeSubtasks(parsed);
}
