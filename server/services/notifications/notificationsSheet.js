// 通知機能（Notificationsタブ）に関する、Googleスプレッドシートへの生データアクセス。
import { google } from 'googleapis';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const SHEET_NAME = 'Notifications';
// userId: 通知の宛先ユーザー / message: 表示文言 / projectId・todoId: 関連先
// isRead: 既読管理フラグ（TRUE/FALSE）
const HEADERS = ['id', 'userId', 'message', 'projectId', 'todoId', 'isRead', 'createdAt'];

let cachedSheetsClient = null;

function getSheetsClient() {
  if (cachedSheetsClient) {
    return cachedSheetsClient;
  }
  const keyFile = path.resolve(
    __dirname,
    '..',
    '..',
    '..',
    process.env.GOOGLE_SERVICE_ACCOUNT_KEY_FILE || './service-account-key.json'
  );
  const auth = new google.auth.GoogleAuth({
    keyFile,
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });
  cachedSheetsClient = google.sheets({ version: 'v4', auth });
  return cachedSheetsClient;
}

let cachedSheetInfo = null;

async function getSheetInfo() {
  if (cachedSheetInfo) {
    return cachedSheetInfo;
  }
  const sheets = getSheetsClient();
  const SPREADSHEET_ID = process.env.SPREADSHEET_ID;
  const meta = await sheets.spreadsheets.get({ spreadsheetId: SPREADSHEET_ID });
  let sheet = meta.data.sheets.find((s) => s.properties.title === SHEET_NAME);

  if (!sheet) {
    const created = await sheets.spreadsheets.batchUpdate({
      spreadsheetId: SPREADSHEET_ID,
      requestBody: { requests: [{ addSheet: { properties: { title: SHEET_NAME } } }] },
    });
    sheet = created.data.replies[0].addSheet;
  }

  cachedSheetInfo = { sheetId: sheet.properties.sheetId, sheetName: sheet.properties.title };
  return cachedSheetInfo;
}

export async function ensureNotificationsHeaderRow() {
  const sheets = getSheetsClient();
  const SPREADSHEET_ID = process.env.SPREADSHEET_ID;
  const { sheetName } = await getSheetInfo();
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: `${sheetName}!A1:G1`,
  });
  const firstRow = res.data.values ? res.data.values[0] : null;
  if (!firstRow || firstRow.length < HEADERS.length) {
    await sheets.spreadsheets.values.update({
      spreadsheetId: SPREADSHEET_ID,
      range: `${sheetName}!A1:G1`,
      valueInputOption: 'RAW',
      requestBody: { values: [HEADERS] },
    });
  }
}

function rowToNotification(row) {
  return {
    id: row[0] || '',
    userId: row[1] || '',
    message: row[2] || '',
    projectId: row[3] || '',
    todoId: row[4] || '',
    isRead: row[5] === 'TRUE',
    createdAt: row[6] || '',
  };
}

function notificationToRow(notification) {
  return [
    notification.id,
    notification.userId,
    notification.message,
    notification.projectId || '',
    notification.todoId || '',
    notification.isRead ? 'TRUE' : 'FALSE',
    notification.createdAt,
  ];
}

// 複数の通知をまとめて1回のAPI呼び出しで登録する（Todo完了時、複数メンバーへ同時に通知するため）
export async function addNotificationRows(notifications) {
  if (notifications.length === 0) {
    return;
  }
  const sheets = getSheetsClient();
  const SPREADSHEET_ID = process.env.SPREADSHEET_ID;
  const { sheetName } = await getSheetInfo();
  await sheets.spreadsheets.values.append({
    spreadsheetId: SPREADSHEET_ID,
    range: `${sheetName}!A2:G`,
    valueInputOption: 'RAW',
    insertDataOption: 'INSERT_ROWS',
    requestBody: { values: notifications.map(notificationToRow) },
  });
}

async function getAllRows() {
  const sheets = getSheetsClient();
  const SPREADSHEET_ID = process.env.SPREADSHEET_ID;
  const { sheetName } = await getSheetInfo();
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: `${sheetName}!A2:G`,
  });
  return res.data.values || [];
}

// あるユーザー宛ての通知一覧を新しい順に返す
export async function findNotificationsByUser(userId) {
  const rows = await getAllRows();
  return rows
    .map(rowToNotification)
    .filter((n) => n.userId === userId)
    .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
}

async function findRowNumberById(id, userId) {
  const rows = await getAllRows();
  const index = rows.findIndex((row) => row[0] === id && row[1] === userId);
  return index === -1 ? null : index + 2;
}

// 1件だけ既読にする（他人の通知を既読にできないよう、宛先本人であることも確認する）
export async function markAsRead(id, userId) {
  const rowNumber = await findRowNumberById(id, userId);
  if (!rowNumber) {
    return false;
  }
  const sheets = getSheetsClient();
  const SPREADSHEET_ID = process.env.SPREADSHEET_ID;
  const { sheetName } = await getSheetInfo();
  await sheets.spreadsheets.values.update({
    spreadsheetId: SPREADSHEET_ID,
    range: `${sheetName}!F${rowNumber}:F${rowNumber}`,
    valueInputOption: 'RAW',
    requestBody: { values: [['TRUE']] },
  });
  return true;
}

// 自分宛ての未読通知をまとめて既読にする
export async function markAllAsRead(userId) {
  const rows = await getAllRows();
  const targetRowNumbers = rows
    .map((row, index) => ({ row, rowNumber: index + 2 }))
    .filter(({ row }) => row[1] === userId && row[5] !== 'TRUE')
    .map(({ rowNumber }) => rowNumber);

  if (targetRowNumbers.length === 0) {
    return;
  }
  const sheets = getSheetsClient();
  const SPREADSHEET_ID = process.env.SPREADSHEET_ID;
  const { sheetName } = await getSheetInfo();
  await sheets.spreadsheets.values.batchUpdate({
    spreadsheetId: SPREADSHEET_ID,
    requestBody: {
      valueInputOption: 'RAW',
      data: targetRowNumbers.map((rowNumber) => ({
        range: `${sheetName}!F${rowNumber}:F${rowNumber}`,
        values: [['TRUE']],
      })),
    },
  });
}
