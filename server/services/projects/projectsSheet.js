// プロジェクト機能（Projects / ProjectMembers タブ）に関する、Googleスプレッドシートへの
// 生データアクセスをまとめたモジュール。Todo用のsheets.jsとは別ファイルに分離し、
// 「プロジェクト管理」の変更がTodo本体のデータアクセスに影響しないようにしている。
import { google } from 'googleapis';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const PROJECTS_SHEET_NAME = 'Projects';
// id: プロジェクトid / name: プロジェクト名 / ownerId: 作成者(オーナー)のuserId
// isDefault: 既存Todo互換のために自動生成される「個人プロジェクト」かどうか
const PROJECT_HEADERS = ['id', 'name', 'ownerId', 'isDefault', 'createdAt'];

const MEMBERS_SHEET_NAME = 'ProjectMembers';
// role: 'owner' | 'member'
// status: 'invited'（招待中）| 'joined'（参加済み）| 'declined'（辞退）
const MEMBER_HEADERS = ['id', 'projectId', 'userId', 'role', 'status', 'createdAt'];

const PENDING_INVITATIONS_SHEET_NAME = 'PendingInvitations';
// まだ会員登録していない相手をメールアドレスで招待した際の記録。
// status: 'pending'（登録待ち）| 'consumed'（登録済みProjectMembersへ変換済み）
const PENDING_INVITATION_HEADERS = [
  'id',
  'projectId',
  'email',
  'invitedByUserId',
  'status',
  'createdAt',
];

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

// 指定した名前のタブ情報を取得する。存在しない場合は新規作成する（Usersタブと同じ方式）。
async function getOrCreateSheetInfo(sheetTitle, cacheRef) {
  if (cacheRef.value) {
    return cacheRef.value;
  }
  const sheets = getSheetsClient();
  const SPREADSHEET_ID = process.env.SPREADSHEET_ID;
  const meta = await sheets.spreadsheets.get({ spreadsheetId: SPREADSHEET_ID });
  let sheet = meta.data.sheets.find((s) => s.properties.title === sheetTitle);

  if (!sheet) {
    const created = await sheets.spreadsheets.batchUpdate({
      spreadsheetId: SPREADSHEET_ID,
      requestBody: {
        requests: [{ addSheet: { properties: { title: sheetTitle } } }],
      },
    });
    sheet = created.data.replies[0].addSheet;
  }

  cacheRef.value = { sheetId: sheet.properties.sheetId, sheetName: sheet.properties.title };
  return cacheRef.value;
}

const projectsSheetCache = { value: null };
const membersSheetCache = { value: null };
const pendingInvitationsSheetCache = { value: null };

async function getProjectsSheetInfo() {
  return getOrCreateSheetInfo(PROJECTS_SHEET_NAME, projectsSheetCache);
}

async function getMembersSheetInfo() {
  return getOrCreateSheetInfo(MEMBERS_SHEET_NAME, membersSheetCache);
}

async function getPendingInvitationsSheetInfo() {
  return getOrCreateSheetInfo(PENDING_INVITATIONS_SHEET_NAME, pendingInvitationsSheetCache);
}

async function ensureHeaderRow(getSheetInfoFn, headers, lastColumnLetter) {
  const sheets = getSheetsClient();
  const SPREADSHEET_ID = process.env.SPREADSHEET_ID;
  const { sheetName } = await getSheetInfoFn();
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: `${sheetName}!A1:${lastColumnLetter}1`,
  });
  const firstRow = res.data.values ? res.data.values[0] : null;
  if (!firstRow || firstRow.length < headers.length) {
    await sheets.spreadsheets.values.update({
      spreadsheetId: SPREADSHEET_ID,
      range: `${sheetName}!A1:${lastColumnLetter}1`,
      valueInputOption: 'RAW',
      requestBody: { values: [headers] },
    });
  }
}

export async function ensureProjectsHeaderRow() {
  await ensureHeaderRow(getProjectsSheetInfo, PROJECT_HEADERS, 'E');
}

export async function ensureProjectMembersHeaderRow() {
  await ensureHeaderRow(getMembersSheetInfo, MEMBER_HEADERS, 'F');
}

export async function ensurePendingInvitationsHeaderRow() {
  await ensureHeaderRow(getPendingInvitationsSheetInfo, PENDING_INVITATION_HEADERS, 'F');
}

function rowToProject(row) {
  return {
    id: row[0] || '',
    name: row[1] || '',
    ownerId: row[2] || '',
    isDefault: row[3] === 'TRUE',
    createdAt: row[4] || '',
  };
}

function projectToRow(project) {
  return [
    project.id,
    project.name,
    project.ownerId,
    project.isDefault ? 'TRUE' : 'FALSE',
    project.createdAt,
  ];
}

export async function addProject(project) {
  const sheets = getSheetsClient();
  const SPREADSHEET_ID = process.env.SPREADSHEET_ID;
  const { sheetName } = await getProjectsSheetInfo();
  await sheets.spreadsheets.values.append({
    spreadsheetId: SPREADSHEET_ID,
    range: `${sheetName}!A2:E`,
    valueInputOption: 'RAW',
    insertDataOption: 'INSERT_ROWS',
    requestBody: { values: [projectToRow(project)] },
  });
  return project;
}

export async function findProjectById(id) {
  const sheets = getSheetsClient();
  const SPREADSHEET_ID = process.env.SPREADSHEET_ID;
  const { sheetName } = await getProjectsSheetInfo();
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: `${sheetName}!A2:E`,
  });
  const rows = res.data.values || [];
  const found = rows.find((row) => row[0] === id);
  return found ? rowToProject(found) : null;
}

export async function findProjectsByIds(ids) {
  const idSet = new Set(ids);
  const sheets = getSheetsClient();
  const SPREADSHEET_ID = process.env.SPREADSHEET_ID;
  const { sheetName } = await getProjectsSheetInfo();
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: `${sheetName}!A2:E`,
  });
  const rows = res.data.values || [];
  return rows.map(rowToProject).filter((project) => project.id !== '' && idSet.has(project.id));
}

// idからシート上の行番号を調べる（削除処理で使用）
async function findProjectRowNumberById(id) {
  const sheets = getSheetsClient();
  const SPREADSHEET_ID = process.env.SPREADSHEET_ID;
  const { sheetName } = await getProjectsSheetInfo();
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: `${sheetName}!A2:E`,
  });
  const rows = res.data.values || [];
  const index = rows.findIndex((row) => row[0] === id);
  return index === -1 ? null : index + 2;
}

export async function deleteProjectRow(id) {
  const rowNumber = await findProjectRowNumberById(id);
  if (!rowNumber) {
    return false;
  }
  const sheets = getSheetsClient();
  const SPREADSHEET_ID = process.env.SPREADSHEET_ID;
  const { sheetId } = await getProjectsSheetInfo();
  await sheets.spreadsheets.batchUpdate({
    spreadsheetId: SPREADSHEET_ID,
    requestBody: {
      requests: [
        {
          deleteDimension: {
            range: { sheetId, dimension: 'ROWS', startIndex: rowNumber - 1, endIndex: rowNumber },
          },
        },
      ],
    },
  });
  return true;
}

function rowToMember(row) {
  return {
    id: row[0] || '',
    projectId: row[1] || '',
    userId: row[2] || '',
    role: row[3] || 'member',
    status: row[4] || 'invited',
    createdAt: row[5] || '',
  };
}

function memberToRow(member) {
  return [member.id, member.projectId, member.userId, member.role, member.status, member.createdAt];
}

async function getAllMemberRows() {
  const sheets = getSheetsClient();
  const SPREADSHEET_ID = process.env.SPREADSHEET_ID;
  const { sheetName } = await getMembersSheetInfo();
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: `${sheetName}!A2:F`,
  });
  return res.data.values || [];
}

export async function addMember(member) {
  const sheets = getSheetsClient();
  const SPREADSHEET_ID = process.env.SPREADSHEET_ID;
  const { sheetName } = await getMembersSheetInfo();
  await sheets.spreadsheets.values.append({
    spreadsheetId: SPREADSHEET_ID,
    range: `${sheetName}!A2:F`,
    valueInputOption: 'RAW',
    insertDataOption: 'INSERT_ROWS',
    requestBody: { values: [memberToRow(member)] },
  });
  return member;
}

// あるユーザーの、あるプロジェクトにおけるメンバーシップ（役割・参加状況）を取得する
export async function findMembership(projectId, userId) {
  const rows = await getAllMemberRows();
  const found = rows.find((row) => row[1] === projectId && row[2] === userId);
  return found ? rowToMember(found) : null;
}

// あるユーザーが所属している（招待中・参加済み・辞退済みを問わない）すべてのメンバーシップ
export async function findMembershipsByUser(userId) {
  const rows = await getAllMemberRows();
  return rows.map(rowToMember).filter((member) => member.userId === userId);
}

// あるプロジェクトの全メンバー一覧
export async function findMembersByProject(projectId) {
  const rows = await getAllMemberRows();
  return rows.map(rowToMember).filter((member) => member.projectId === projectId);
}

async function findMemberRowNumber(projectId, userId) {
  const rows = await getAllMemberRows();
  const index = rows.findIndex((row) => row[1] === projectId && row[2] === userId);
  return index === -1 ? null : index + 2;
}

// メンバーの参加状況（招待中→参加済み/辞退済み）を更新する
export async function updateMemberStatus(projectId, userId, status) {
  const rowNumber = await findMemberRowNumber(projectId, userId);
  if (!rowNumber) {
    return null;
  }
  const sheets = getSheetsClient();
  const SPREADSHEET_ID = process.env.SPREADSHEET_ID;
  const { sheetName } = await getMembersSheetInfo();
  await sheets.spreadsheets.values.update({
    spreadsheetId: SPREADSHEET_ID,
    range: `${sheetName}!E${rowNumber}:E${rowNumber}`,
    valueInputOption: 'RAW',
    requestBody: { values: [[status]] },
  });
  return true;
}

export async function removeMember(projectId, userId) {
  const rowNumber = await findMemberRowNumber(projectId, userId);
  if (!rowNumber) {
    return false;
  }
  const sheets = getSheetsClient();
  const SPREADSHEET_ID = process.env.SPREADSHEET_ID;
  const { sheetId } = await getMembersSheetInfo();
  await sheets.spreadsheets.batchUpdate({
    spreadsheetId: SPREADSHEET_ID,
    requestBody: {
      requests: [
        {
          deleteDimension: {
            range: { sheetId, dimension: 'ROWS', startIndex: rowNumber - 1, endIndex: rowNumber },
          },
        },
      ],
    },
  });
  return true;
}

// プロジェクト削除時に、そのプロジェクトの全メンバー行をまとめて削除する
export async function removeAllMembersOfProject(projectId) {
  const rows = await getAllMemberRows();
  const rowNumbers = rows
    .map((row, index) => ({ row, rowNumber: index + 2 }))
    .filter(({ row }) => row[1] === projectId)
    .map(({ rowNumber }) => rowNumber)
    .sort((a, b) => b - a);
  if (rowNumbers.length === 0) {
    return;
  }
  const sheets = getSheetsClient();
  const SPREADSHEET_ID = process.env.SPREADSHEET_ID;
  const { sheetId } = await getMembersSheetInfo();
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

// --- PendingInvitations（未登録のメールアドレス宛の招待） ---

function rowToPendingInvitation(row) {
  return {
    id: row[0] || '',
    projectId: row[1] || '',
    email: row[2] || '',
    invitedByUserId: row[3] || '',
    status: row[4] || 'pending',
    createdAt: row[5] || '',
  };
}

function pendingInvitationToRow(invitation) {
  return [
    invitation.id,
    invitation.projectId,
    invitation.email,
    invitation.invitedByUserId,
    invitation.status,
    invitation.createdAt,
  ];
}

async function getAllPendingInvitationRows() {
  const sheets = getSheetsClient();
  const SPREADSHEET_ID = process.env.SPREADSHEET_ID;
  const { sheetName } = await getPendingInvitationsSheetInfo();
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: `${sheetName}!A2:F`,
  });
  return res.data.values || [];
}

export async function addPendingInvitation(invitation) {
  const sheets = getSheetsClient();
  const SPREADSHEET_ID = process.env.SPREADSHEET_ID;
  const { sheetName } = await getPendingInvitationsSheetInfo();
  await sheets.spreadsheets.values.append({
    spreadsheetId: SPREADSHEET_ID,
    range: `${sheetName}!A2:F`,
    valueInputOption: 'RAW',
    insertDataOption: 'INSERT_ROWS',
    requestBody: { values: [pendingInvitationToRow(invitation)] },
  });
  return invitation;
}

// 同じプロジェクト・同じメールアドレスへの「登録待ち」招待がすでにあるかどうか
export async function findPendingInvitation(projectId, email) {
  const rows = await getAllPendingInvitationRows();
  const found = rows
    .map(rowToPendingInvitation)
    .find((inv) => inv.projectId === projectId && inv.email === email && inv.status === 'pending');
  return found || null;
}

// 会員登録が完了したタイミングで、そのメールアドレス宛の「登録待ち」招待を全て取得する
export async function findPendingInvitationsByEmail(email) {
  const rows = await getAllPendingInvitationRows();
  return rows
    .map(rowToPendingInvitation)
    .filter((inv) => inv.email === email && inv.status === 'pending');
}

// 登録待ち招待を「消費済み」にする（ProjectMembersへ変換した後に呼ぶ）
export async function markPendingInvitationConsumed(id) {
  const rows = await getAllPendingInvitationRows();
  const index = rows.findIndex((row) => row[0] === id);
  if (index === -1) {
    return;
  }
  const sheets = getSheetsClient();
  const SPREADSHEET_ID = process.env.SPREADSHEET_ID;
  const { sheetName } = await getPendingInvitationsSheetInfo();
  await sheets.spreadsheets.values.update({
    spreadsheetId: SPREADSHEET_ID,
    range: `${sheetName}!E${index + 2}:E${index + 2}`,
    valueInputOption: 'RAW',
    requestBody: { values: [['consumed']] },
  });
}
