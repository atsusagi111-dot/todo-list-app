// メール送信機能のエントリーポイント。他の機能（プロジェクト招待など）はこのファイルだけを通して
// メールを送る。
// Renderなど一部のホスティング環境は送信SMTP（465/587）への発信そのものをブロックしているため、
// SMTP直接接続ではなくResendのHTTP API（ポート443）経由で送信する。
import { EmailConfigError, EmailSendError } from './emailErrors.js';

const RESEND_API_URL = 'https://api.resend.com/emails';

async function sendMail({ to, subject, text }) {
  const { RESEND_API_KEY } = process.env;
  if (!RESEND_API_KEY) {
    throw new EmailConfigError('メール送信設定（RESEND_API_KEY）が未設定です');
  }
  // 独自ドメインをResendで検証していない場合、送信元は onboarding@resend.dev 固定になる
  const fromAddress = process.env.MAIL_FROM || 'onboarding@resend.dev';

  const response = await fetch(RESEND_API_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ from: fromAddress, to, subject, text }),
  });

  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new EmailSendError(`メールの送信に失敗しました: ${body.message || response.statusText}`);
  }
}

// プロジェクトへの招待メール。
// - 招待相手がまだ会員登録していない場合：新規登録を促す文面を送る
// - すでに会員登録済みの場合：ログインしてプロジェクトを確認するよう促す文面を送る
export async function sendProjectInvitationEmail({
  to,
  projectName,
  inviterDisplayName,
  isRegistered,
  appUrl,
}) {
  const subject = `【Todoリスト】「${projectName}」プロジェクトへの招待`;
  const text = isRegistered
    ? [
        `${inviterDisplayName}さんから、プロジェクト「${projectName}」に招待されました。`,
        '',
        `ログイン後、画面上部の通知または「プロジェクト」タブから招待を確認し、参加・辞退を選択してください。`,
        `${appUrl}/login`,
      ].join('\n')
    : [
        `${inviterDisplayName}さんから、Todoリストアプリのプロジェクト「${projectName}」に招待されました。`,
        '',
        'このメールアドレスはまだ会員登録されていません。以下のリンクから新規登録すると、',
        '自動的にこのプロジェクトへの招待が届いた状態になります。',
        '',
        `${appUrl}/register?email=${encodeURIComponent(to)}`,
      ].join('\n');

  await sendMail({ to, subject, text });
}
