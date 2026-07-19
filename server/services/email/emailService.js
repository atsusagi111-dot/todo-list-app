// メール送信機能のエントリーポイント。他の機能（プロジェクト招待など）はこのファイルだけを通して
// メールを送る。SMTP接続情報はすべて環境変数から読み込み、コードには直書きしない。
// プロバイダーを変える場合（Gmail・SendGrid・さくらメール等）も、環境変数を書き換えるだけでよい。
import nodemailer from 'nodemailer';
import { EmailConfigError, EmailSendError } from './emailErrors.js';

let cachedTransporter = null;

function getTransporter() {
  if (cachedTransporter) {
    return cachedTransporter;
  }
  const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS } = process.env;
  if (!SMTP_HOST || !SMTP_PORT || !SMTP_USER || !SMTP_PASS) {
    throw new EmailConfigError(
      'メール送信設定（SMTP_HOST/SMTP_PORT/SMTP_USER/SMTP_PASS）が未設定です'
    );
  }

  cachedTransporter = nodemailer.createTransport({
    host: SMTP_HOST,
    port: Number(SMTP_PORT),
    // 465番ポートのみ暗号化接続(SMTPS)。587番などは平文接続後にSTARTTLSで暗号化する。
    secure: Number(SMTP_PORT) === 465,
    auth: { user: SMTP_USER, pass: SMTP_PASS },
  });
  return cachedTransporter;
}

async function sendMail({ to, subject, text }) {
  const transporter = getTransporter();
  const fromAddress = process.env.MAIL_FROM || process.env.SMTP_USER;
  try {
    await transporter.sendMail({ from: fromAddress, to, subject, text });
  } catch (error) {
    throw new EmailSendError(`メールの送信に失敗しました: ${error.message}`);
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
