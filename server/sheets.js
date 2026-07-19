// Todo本体とUsersに関する、Googleスプレッドシートへの生データアクセスをまとめたモジュール。
// ここには「認可（権限チェック）」のロジックは持たせない方針にしている。
// 権限チェックは呼び出し元のルート（server/services/*/**Routes.js）で行う。
import { google } from 'googleapis';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// parentId: 親Todoのid（空文字は「親を持たない=最上位のTodo」を表す）
// sortOrder: 同じ親を持つサブタスク同士の表示順（将来のガントチャート表示にも利用できる）
// projectId: このTodoが所属するプロジェクトのid（チーム共有機能で追加。必ずいずれかのプロジェクトに属す）
// assigneeId: 担当者のuserId（空文字は「未割り当て」を表す）
const HEADERS = [
  'id',
  'title',
  'content',
  'dueDate',
  'completed',
  'userId',
  'parentId',
  'sortOrder',
  'projectId',
  'assigneeId',
];
const USER_HEADERS = ['id', 'email', 'passwordHash', 'createdAt'];
const USERS_SHEET_NAME = 'Users';

// process.env はここではなく関数の中で読む。
// dotenv.config() が実行されるより前にこのファイルが import されるため、
// トップレベルで process.env を読むと値がまだ空の状態で固定されてしまう。
let cachedSheetsClient = null;

function getSheetsClient() {
  if (cachedSheetsClient) {
    return cachedSheetsClient;
  }
  const scopes = ['https://www.googleapis.com/auth/spreadsheets'];
  // Renderなどのホスティング環境では秘密鍵ファイルをリポジトリにコミットできないため、
  // JSONの中身をまるごと環境変数に入れる方式にも対応する（ローカル開発では従来どおりファイルパスを使う）
  const auth = process.env.GOOGLE_SERVICE_ACCOUNT_KEY_JSON
    ? new google.auth.GoogleAuth({
        credentials: JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_KEY_JSON),
        scopes,
      })
    : new google.auth.GoogleAuth({
        keyFile: path.resolve(
          __dirname,
          '..',
          process.env.GOOGLE_SERVICE_ACCOUNT_KEY_FILE || './service-account-key.json'
        ),
        scopes,
      });
  cachedSheetsClient = google.sheets({ version: 'v4', auth });
  return cachedSheetsClient;
}

let cachedSheetInfo = null;

// Todoを保存している「1番目のシート」の情報を取得する（既存の挙動を維持）
async function getSheetInfo() {
  if (cachedSheetInfo) {
    return cachedSheetInfo;
  }
  const sheets = getSheetsClient();
  const SPREADSHEET_ID = process.env.SPREADSHEET_ID;
  const res = await sheets.spreadsheets.get({ spreadsheetId: SPREADSHEET_ID });
  const firstSheet = res.data.sheets[0].properties;
  cachedSheetInfo = { sheetId: firstSheet.sheetId, sheetName: firstSheet.title };
  return cachedSheetInfo;
}

let cachedUsersSheetInfo = null;

// ユーザー情報専用の「Users」タブの情報を取得する。存在しない場合は新規作成する。
async function getUsersSheetInfo() {
  if (cachedUsersSheetInfo) {
    return cachedUsersSheetInfo;
  }
  const sheets = getSheetsClient();
  const SPREADSHEET_ID = process.env.SPREADSHEET_ID;
  const meta = await sheets.spreadsheets.get({ spreadsheetId: SPREADSHEET_ID });
  let usersSheet = meta.data.sheets.find(
    (sheet) => sheet.properties.title === USERS_SHEET_NAME
  );

  if (!usersSheet) {
    const created = await sheets.spreadsheets.batchUpdate({
      spreadsheetId: SPREADSHEET_ID,
      requestBody: {
        requests: [{ addSheet: { properties: { title: USERS_SHEET_NAME } } }],
      },
    });
    usersSheet = created.data.replies[0].addSheet;
  }

  cachedUsersSheetInfo = { sheetId: usersSheet.properties.sheetId, sheetName: usersSheet.properties.title };
  return cachedUsersSheetInfo;
}

export async function ensureHeaderRow() {
  const sheets = getSheetsClient();
  const SPREADSHEET_ID = process.env.SPREADSHEET_ID;
  const { sheetName } = await getSheetInfo();
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: `${sheetName}!A1:J1`,
  });
  const firstRow = res.data.values ? res.data.values[0] : null;
  // 既存シート（列数がこれより少ない古い構成）にも対応できるよう、
  // ヘッダーが足りない場合は10列分に書き直す
  if (!firstRow || firstRow.length < HEADERS.length) {
    await sheets.spreadsheets.values.update({
      spreadsheetId: SPREADSHEET_ID,
      range: `${sheetName}!A1:J1`,
      valueInputOption: 'RAW',
      requestBody: { values: [HEADERS] },
    });
  }
}

export async function ensureUsersHeaderRow() {
  const sheets = getSheetsClient();
  const SPREADSHEET_ID = process.env.SPREADSHEET_ID;
  const { sheetName } = await getUsersSheetInfo();
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: `${sheetName}!A1:D1`,
  });
  const firstRow = res.data.values ? res.data.values[0] : null;
  if (!firstRow || firstRow.length === 0) {
    await sheets.spreadsheets.values.update({
      spreadsheetId: SPREADSHEET_ID,
      range: `${sheetName}!A1:D1`,
      valueInputOption: 'RAW',
      requestBody: { values: [USER_HEADERS] },
    });
  }
}

function rowToTodo(row) {
  return {
    id: row[0] || '',
    title: row[1] || '',
    content: row[2] || '',
    dueDate: row[3] || '',
    completed: row[4] === 'TRUE',
    userId: row[5] || '',
    // 空文字は「親を持たない=最上位のTodo」を表す
    parentId: row[6] || '',
    sortOrder: row[7] !== undefined && row[7] !== '' ? Number(row[7]) : 0,
    projectId: row[8] || '',
    // 空文字は「担当者未設定」を表す
    assigneeId: row[9] || '',
  };
}

function todoToRow(todo) {
  return [
    todo.id,
    todo.title,
    todo.content || '',
    todo.dueDate || '',
    todo.completed ? 'TRUE' : 'FALSE',
    todo.userId,
    todo.parentId || '',
    todo.sortOrder !== undefined ? todo.sortOrder : 0,
    todo.projectId || '',
    todo.assigneeId || '',
  ];
}

async function getAllTodoRows() {
  const sheets = getSheetsClient();
  const SPREADSHEET_ID = process.env.SPREADSHEET_ID;
  const { sheetName } = await getSheetInfo();
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: `${sheetName}!A2:J`,
  });
  return res.data.values || [];
}

// 指定したプロジェクトID群に所属するTodoだけを返す（プロジェクトメンバー以外には見せないようにする）。
// 権限チェック（本当にそのプロジェクトのメンバーか）は呼び出し元で行う。
// 親子関係はフラットな配列のまま返し、階層への組み立てはフロントエンド側で行う。
export async function getTodosByProjectIds(projectIds) {
  const projectIdSet = new Set(projectIds);
  const rows = await getAllTodoRows();
  return rows
    .map(rowToTodo)
    .filter((todo) => todo.id !== '' && projectIdSet.has(todo.projectId));
}

// プロジェクトに未割り当て（projectIdが空）の、指定ユーザーが作成したTodoを探す。
// チーム共有機能の導入前から存在する既存Todoを、初回アクセス時に自動生成した
// 「個人プロジェクト」へ引き継ぐための移行処理で使用する。
export async function findOrphanTodosByUser(userId) {
  const rows = await getAllTodoRows();
  return rows
    .map((row, index) => ({ todo: rowToTodo(row), rowNumber: index + 2 }))
    .filter(({ todo }) => todo.id !== '' && todo.userId === userId && todo.projectId === '');
}

// 上記の「孤立Todo」に対して、まとめてprojectIdを設定する（1件ずつ更新すると低速なため一括更新にしている）
export async function assignProjectToRows(rowNumbers, projectId) {
  if (rowNumbers.length === 0) {
    return;
  }
  const sheets = getSheetsClient();
  const SPREADSHEET_ID = process.env.SPREADSHEET_ID;
  const { sheetName } = await getSheetInfo();
  await sheets.spreadsheets.values.batchUpdate({
    spreadsheetId: SPREADSHEET_ID,
    requestBody: {
      valueInputOption: 'RAW',
      data: rowNumbers.map((rowNumber) => ({
        range: `${sheetName}!I${rowNumber}:I${rowNumber}`,
        values: [[projectId]],
      })),
    },
  });
}

export async function addTodo(todo) {
  const sheets = getSheetsClient();
  const SPREADSHEET_ID = process.env.SPREADSHEET_ID;
  const { sheetName } = await getSheetInfo();
  await sheets.spreadsheets.values.append({
    spreadsheetId: SPREADSHEET_ID,
    range: `${sheetName}!A2:J`,
    valueInputOption: 'RAW',
    insertDataOption: 'INSERT_ROWS',
    requestBody: { values: [todoToRow(todo)] },
  });
  return todo;
}

// 親Todoと、AIが提案した複数のサブタスクをまとめて1回のAPI呼び出しで登録する。
// 「この内容で登録」が押されるまでは呼ばれないため、途中で画面を閉じても何も保存されない。
export async function addTodoWithSubtasks(parentTodo, childTodos) {
  const sheets = getSheetsClient();
  const SPREADSHEET_ID = process.env.SPREADSHEET_ID;
  const { sheetName } = await getSheetInfo();
  const rows = [todoToRow(parentTodo), ...childTodos.map(todoToRow)];
  await sheets.spreadsheets.values.append({
    spreadsheetId: SPREADSHEET_ID,
    range: `${sheetName}!A2:J`,
    valueInputOption: 'RAW',
    insertDataOption: 'INSERT_ROWS',
    requestBody: { values: rows },
  });
  return { ...parentTodo, subtasks: childTodos };
}

// idからシート上の行番号とTodoの内容を調べる。
// 呼び出し元（各ルート）はこれを使って「リクエストしたユーザーがこのTodoのプロジェクトの
// メンバーかどうか」を確認してからupdate/deleteを行う。
async function findRowById(id) {
  const rows = await getAllTodoRows();
  const index = rows.findIndex((row) => row[0] === id);
  if (index === -1) {
    return null;
  }
  return { rowNumber: index + 2, todo: rowToTodo(rows[index]) };
}

// ルート側の権限チェックで使うための、Todo単体の取得（見つからない場合はnull）
export async function findTodoById(id) {
  const found = await findRowById(id);
  return found ? found.todo : null;
}

// タイトル・内容・期日・完了状態の更新。
// parentId/projectId/assigneeIdは編集フォームで扱わないため、既存の値をそのまま引き継ぐ。
export async function updateTodo(id, fields) {
  const found = await findRowById(id);
  if (!found) {
    return null;
  }
  const sheets = getSheetsClient();
  const SPREADSHEET_ID = process.env.SPREADSHEET_ID;
  const { sheetName } = await getSheetInfo();
  const updated = {
    ...found.todo,
    title: fields.title,
    content: fields.content,
    dueDate: fields.dueDate,
    completed: fields.completed,
  };
  await sheets.spreadsheets.values.update({
    spreadsheetId: SPREADSHEET_ID,
    range: `${sheetName}!A${found.rowNumber}:J${found.rowNumber}`,
    valueInputOption: 'RAW',
    requestBody: { values: [todoToRow(updated)] },
  });
  return updated;
}

// 担当者の変更（オーナー専用機能。権限チェックはルート側で行う）
export async function updateTodoAssignee(id, assigneeId) {
  const found = await findRowById(id);
  if (!found) {
    return null;
  }
  const sheets = getSheetsClient();
  const SPREADSHEET_ID = process.env.SPREADSHEET_ID;
  const { sheetName } = await getSheetInfo();
  const updated = { ...found.todo, assigneeId: assigneeId || '' };
  await sheets.spreadsheets.values.update({
    spreadsheetId: SPREADSHEET_ID,
    range: `${sheetName}!A${found.rowNumber}:J${found.rowNumber}`,
    valueInputOption: 'RAW',
    requestBody: { values: [todoToRow(updated)] },
  });
  return updated;
}

// 指定したメンバーが担当になっているTodo（プロジェクト内）の担当者設定を解除する。
// メンバー削除時に「もういないメンバー」が担当のまま残ってしまうのを防ぐために使用する。
export async function clearAssigneeInProject(projectId, userId) {
  const rows = await getAllTodoRows();
  const targets = rows
    .map((row, index) => ({ todo: rowToTodo(row), rowNumber: index + 2 }))
    .filter(({ todo }) => todo.projectId === projectId && todo.assigneeId === userId);
  if (targets.length === 0) {
    return;
  }
  const sheets = getSheetsClient();
  const SPREADSHEET_ID = process.env.SPREADSHEET_ID;
  const { sheetName } = await getSheetInfo();
  await sheets.spreadsheets.values.batchUpdate({
    spreadsheetId: SPREADSHEET_ID,
    requestBody: {
      valueInputOption: 'RAW',
      data: targets.map(({ rowNumber }) => ({
        range: `${sheetName}!J${rowNumber}:J${rowNumber}`,
        values: [['']],
      })),
    },
  });
}

// 指定したidのTodoを削除する。親Todoの場合は、紐づく子Todo（サブタスク）も
// 孤立させないよう一緒に削除する。戻り値は削除できたTodoのidの配列（コメントの
// 連動削除などに使う）。見つからなかった場合はnullを返す。
export async function deleteTodo(id) {
  const found = await findRowById(id);
  if (!found) {
    return null;
  }
  const rows = await getAllTodoRows();
  const childRowNumbers = rows
    .map((row, index) => ({ row, rowNumber: index + 2 }))
    .filter(({ row }) => row[6] === id)
    .map(({ rowNumber }) => rowNumber);
  const childIds = rows.filter((row) => row[6] === id).map((row) => row[0]);

  await deleteTodoRows([found.rowNumber, ...childRowNumbers]);
  return [id, ...childIds];
}

// 複数のTodo行番号をまとめて削除する内部ヘルパー。
// 行削除は下（行番号が大きい方）から順に行うことで、削除に伴う行番号のズレを避ける。
async function deleteTodoRows(rowNumbers) {
  const uniqueDescending = [...new Set(rowNumbers)].sort((a, b) => b - a);
  if (uniqueDescending.length === 0) {
    return;
  }
  const sheets = getSheetsClient();
  const SPREADSHEET_ID = process.env.SPREADSHEET_ID;
  const { sheetId } = await getSheetInfo();
  await sheets.spreadsheets.batchUpdate({
    spreadsheetId: SPREADSHEET_ID,
    requestBody: {
      requests: uniqueDescending.map((rowNumber) => ({
        deleteDimension: {
          range: {
            sheetId,
            dimension: 'ROWS',
            startIndex: rowNumber - 1,
            endIndex: rowNumber,
          },
        },
      })),
    },
  });
}

// プロジェクト削除時に、そのプロジェクトに属する全Todoをまとめて削除する。
// 戻り値は削除したTodoのidの配列（コメントの連動削除に使う）。
export async function deleteTodosByProjectId(projectId) {
  const rows = await getAllTodoRows();
  const targets = rows
    .map((row, index) => ({ todo: rowToTodo(row), rowNumber: index + 2 }))
    .filter(({ todo }) => todo.projectId === projectId);
  if (targets.length === 0) {
    return [];
  }
  await deleteTodoRows(targets.map(({ rowNumber }) => rowNumber));
  return targets.map(({ todo }) => todo.id);
}

function rowToUser(row) {
  return {
    id: row[0] || '',
    email: row[1] || '',
    passwordHash: row[2] || '',
    createdAt: row[3] || '',
  };
}

// メールアドレスからユーザーを検索する（登録済みチェック・ログイン認証・メンバー招待で使用）
export async function findUserByEmail(email) {
  const sheets = getSheetsClient();
  const SPREADSHEET_ID = process.env.SPREADSHEET_ID;
  const { sheetName } = await getUsersSheetInfo();
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: `${sheetName}!A2:D`,
  });
  const rows = res.data.values || [];
  const found = rows.find((row) => row[1] === email);
  return found ? rowToUser(found) : null;
}

// idからユーザーを検索する（コメント投稿者・担当者・通知メッセージの表示名解決に使用）
export async function findUserById(id) {
  const sheets = getSheetsClient();
  const SPREADSHEET_ID = process.env.SPREADSHEET_ID;
  const { sheetName } = await getUsersSheetInfo();
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: `${sheetName}!A2:D`,
  });
  const rows = res.data.values || [];
  const found = rows.find((row) => row[0] === id);
  return found ? rowToUser(found) : null;
}

export async function createUser(user) {
  const sheets = getSheetsClient();
  const SPREADSHEET_ID = process.env.SPREADSHEET_ID;
  const { sheetName } = await getUsersSheetInfo();
  const row = [user.id, user.email, user.passwordHash, user.createdAt];
  await sheets.spreadsheets.values.append({
    spreadsheetId: SPREADSHEET_ID,
    range: `${sheetName}!A2:D`,
    valueInputOption: 'RAW',
    insertDataOption: 'INSERT_ROWS',
    requestBody: { values: [row] },
  });
  return user;
}

// ユーザーの表示名。現状Usersにはメールアドレスしか無いため、
// メールのローカル部分（@より前）を簡易的な表示名として使う。
export function toDisplayName(email) {
  if (!email) {
    return '不明なユーザー';
  }
  return email.split('@')[0];
}
