// コメント機能（Commentsタブ）に関する、Googleスプレッドシートへの生データアクセス。
import { google } from 'googleapis';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const SHEET_NAME = 'Comments';
// id: コメントid / todoId: 対象Todoのid / userId: 投稿者 / body: 本文 / createdAt: 投稿日時
const HEADERS = ['id', 'todoId', 'userId', 'body', 'createdAt'];

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

export async function ensureCommentsHeaderRow() {
  const sheets = getSheetsClient();
  const SPREADSHEET_ID = process.env.SPREADSHEET_ID;
  const { sheetName } = await getSheetInfo();
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: `${sheetName}!A1:E1`,
  });
  const firstRow = res.data.values ? res.data.values[0] : null;
  if (!firstRow || firstRow.length < HEADERS.length) {
    await sheets.spreadsheets.values.update({
      spreadsheetId: SPREADSHEET_ID,
      range: `${sheetName}!A1:E1`,
      valueInputOption: 'RAW',
      requestBody: { values: [HEADERS] },
    });
  }
}

function rowToComment(row) {
  return {
    id: row[0] || '',
    todoId: row[1] || '',
    userId: row[2] || '',
    body: row[3] || '',
    createdAt: row[4] || '',
  };
}

function commentToRow(comment) {
  return [comment.id, comment.todoId, comment.userId, comment.body, comment.createdAt];
}

export async function addCommentRow(comment) {
  const sheets = getSheetsClient();
  const SPREADSHEET_ID = process.env.SPREADSHEET_ID;
  const { sheetName } = await getSheetInfo();
  await sheets.spreadsheets.values.append({
    spreadsheetId: SPREADSHEET_ID,
    range: `${sheetName}!A2:E`,
    valueInputOption: 'RAW',
    insertDataOption: 'INSERT_ROWS',
    requestBody: { values: [commentToRow(comment)] },
  });
  return comment;
}

export async function findCommentsByTodoId(todoId) {
  const sheets = getSheetsClient();
  const SPREADSHEET_ID = process.env.SPREADSHEET_ID;
  const { sheetName } = await getSheetInfo();
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: `${sheetName}!A2:E`,
  });
  const rows = res.data.values || [];
  return rows
    .map(rowToComment)
    .filter((comment) => comment.todoId === todoId)
    .sort((a, b) => (a.createdAt < b.createdAt ? -1 : 1)); // 新しいコメントが下に来るよう昇順
}

// Todo削除・プロジェクト削除に連動して、対象Todoに紐づくコメントをまとめて削除する
export async function deleteCommentsByTodoIds(todoIds) {
  const todoIdSet = new Set(todoIds);
  const sheets = getSheetsClient();
  const SPREADSHEET_ID = process.env.SPREADSHEET_ID;
  const { sheetId, sheetName } = await getSheetInfo();
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: `${sheetName}!A2:E`,
  });
  const rows = res.data.values || [];
  const rowNumbers = rows
    .map((row, index) => ({ row, rowNumber: index + 2 }))
    .filter(({ row }) => todoIdSet.has(row[1]))
    .map(({ rowNumber }) => rowNumber)
    .sort((a, b) => b - a);

  if (rowNumbers.length === 0) {
    return;
  }
  await sheets.spreadsheets.batchUpdate({
    spreadsheetId: SPREADSHEET_ID,
    requestBody: {
      requests: rowNumbers.map((rowNumber) => ({
        deleteDimension: {
          range: { sheetId, dimension: 'ROWS', startIndex: rowNumber - 1, endIndex: rowNumber },
        },
      })),
    },
  });
}
