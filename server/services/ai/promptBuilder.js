// AIプロバイダーに送るプロンプトを組み立てるモジュール。
// どのプロバイダー（OpenAI/Claude/Gemini/Dify）を使う場合でも同じプロンプトを使い回せるよう、
// プロバイダー実装から独立させている。

// AIには「JSON配列のみ」を返させ、パース処理を単純かつ確実にする。
export const RESPONSE_FORMAT_INSTRUCTION =
  '出力は必ず次の形式のJSON配列のみとしてください。前置き・説明文・コードブロックの記号（```）は一切含めないでください。\n' +
  '[{"title": "サブタスク名", "dueDate": "YYYY-MM-DD"}, ...]';

export function buildSystemPrompt() {
  return [
    'あなたは優秀なプロジェクトマネージャーです。',
    '与えられた1件のタスクと最終期限をもとに、実行可能な粒度までタスクを細分化します。',
    '細分化の際は次のルールを守ってください。',
    '- サブタスクの数は内容に応じて3件以上10件以内で柔軟に決定する',
    '- 各サブタスクは実際に着手・完了できる具体的な作業単位にする',
    '- 最終期限から逆算し、各サブタスクに現実的な期限（YYYY-MM-DD形式）を割り当てる',
    '- サブタスクは時系列順に並べ、最後のサブタスクの期限は最終期限と同じかそれ以前にする',
    RESPONSE_FORMAT_INSTRUCTION,
  ].join('\n');
}

export function buildUserPrompt({ title, dueDate }) {
  return `タスク: ${title}\n最終期限: ${dueDate}\n\nこのタスクをサブタスクに細分化してください。`;
}
