// プロジェクト機能のビジネスロジック（権限の考え方・招待の流れ・既存Todoの移行など）をまとめたモジュール。
// ルート（projectsRoutes.js / todosRoutes.js / commentsRoutes.js）はここを通してのみ
// プロジェクトのデータを扱う。生のスプレッドシート操作は projectsSheet.js に閉じ込めている。
import crypto from 'crypto';
import {
  addMember,
  addPendingInvitation,
  addProject,
  deleteProjectRow,
  findMembership,
  findMembershipsByUser,
  findMembersByProject,
  findPendingInvitation,
  findPendingInvitationsByEmail,
  findPendingInvitationsByProject,
  findProjectById,
  findProjectsByIds,
  markPendingInvitationConsumed,
  removeAllMembersOfProject,
  removeMember as removeMemberRow,
  updateMemberStatus,
} from './projectsSheet.js';
import { EmailConfigError, EmailSendError } from '../email/emailErrors.js';
import { sendProjectInvitationEmail } from '../email/emailService.js';
import {
  assignProjectToRows,
  clearAssigneeInProject,
  deleteTodosByProjectId,
  findOrphanTodosByUser,
  findUserByEmail,
  findUserById,
  toDisplayName,
} from '../../sheets.js';

export class ProjectAccessError extends Error {
  constructor(message, status = 403) {
    super(message);
    this.name = 'ProjectAccessError';
    this.status = status;
  }
}

const DEFAULT_PROJECT_NAME = '個人プロジェクト';

// 「参加済み」のメンバーシップだけを判定する。招待中(invited)・辞退済み(declined)は
// プロジェクトの中身を見る権限には含めない。
function isJoined(membership) {
  return !!membership && membership.status === 'joined';
}

// 指定ユーザーが、指定プロジェクトの「参加済みメンバー」であることを確認する。
// 満たさない場合は ProjectAccessError を投げる（＝APIからも他プロジェクトは見えない）。
export async function requireJoinedMembership(projectId, userId) {
  const membership = await findMembership(projectId, userId);
  if (!isJoined(membership)) {
    throw new ProjectAccessError('このプロジェクトにアクセスする権限がありません');
  }
  return membership;
}

// オーナー権限が必要な操作用のチェック
export async function requireOwnerMembership(projectId, userId) {
  const membership = await requireJoinedMembership(projectId, userId);
  if (membership.role !== 'owner') {
    throw new ProjectAccessError('この操作はプロジェクトのオーナーのみ実行できます');
  }
  return membership;
}

// このユーザーが「参加済み」であるプロジェクトのid一覧（Todo一覧の絞り込みに使う）
export async function getJoinedProjectIds(userId) {
  const memberships = await findMembershipsByUser(userId);
  return memberships.filter(isJoined).map((m) => m.projectId);
}

// 既存Todo（チーム共有機能の導入前に作成されたもの）を保持しているユーザーのために、
// 初回アクセス時だけ「個人プロジェクト」を自動生成し、孤立しているTodoをそこへ引き継ぐ。
// 2回目以降はすでに個人プロジェクトが見つかるため、この関数は何もしない。
export async function ensureDefaultProject(userId) {
  const memberships = await findMembershipsByUser(userId);
  const ownedProjectIds = memberships.filter((m) => m.role === 'owner').map((m) => m.projectId);
  if (ownedProjectIds.length > 0) {
    const ownedProjects = await findProjectsByIds(ownedProjectIds);
    // 「オーナーである」だけでなく、実際に isDefault フラグが立っているプロジェクトを探す。
    // そうしないと、ユーザーが自分で新規作成したプロジェクトのオーナーになった時点で
    // 個人プロジェクトの自動生成が誤ってスキップされてしまう。
    const existingDefault = ownedProjects.find((project) => project.isDefault);
    if (existingDefault) {
      return existingDefault;
    }
  }

  const now = new Date().toISOString();
  const project = {
    id: crypto.randomUUID(),
    name: DEFAULT_PROJECT_NAME,
    ownerId: userId,
    isDefault: true,
    createdAt: now,
  };
  await addProject(project);
  await addMember({
    id: crypto.randomUUID(),
    projectId: project.id,
    userId,
    role: 'owner',
    status: 'joined',
    createdAt: now,
  });

  // チーム共有機能の導入前から存在する、このユーザー作成のTodoを個人プロジェクトへ引き継ぐ
  const orphans = await findOrphanTodosByUser(userId);
  if (orphans.length > 0) {
    await assignProjectToRows(orphans.map((o) => o.rowNumber), project.id);
  }

  return project;
}

function withDisplayName(user) {
  return user ? { id: user.id, email: user.email, displayName: toDisplayName(user.email) } : null;
}

// ユーザーがアクセスできる（参加済みの）プロジェクト一覧。各プロジェクトに自分の役割(role)も付与する。
export async function listMyProjects(userId) {
  await ensureDefaultProject(userId);
  const memberships = (await findMembershipsByUser(userId)).filter(isJoined);
  const projects = await findProjectsByIds(memberships.map((m) => m.projectId));
  const roleByProjectId = new Map(memberships.map((m) => [m.projectId, m.role]));
  return projects
    .map((project) => ({ ...project, role: roleByProjectId.get(project.id) || 'member' }))
    .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
}

// 自分宛ての「招待中」のプロジェクト一覧
export async function listMyInvitations(userId) {
  const memberships = (await findMembershipsByUser(userId)).filter((m) => m.status === 'invited');
  if (memberships.length === 0) {
    return [];
  }
  const projects = await findProjectsByIds(memberships.map((m) => m.projectId));
  const projectById = new Map(projects.map((p) => [p.id, p]));
  const invitations = [];
  for (const membership of memberships) {
    const project = projectById.get(membership.projectId);
    if (!project) continue;
    const owner = await findUserById(project.ownerId);
    invitations.push({
      projectId: project.id,
      projectName: project.name,
      ownerDisplayName: owner ? toDisplayName(owner.email) : '不明',
      invitedAt: membership.createdAt,
    });
  }
  return invitations;
}

// 新しいプロジェクトを作成する（作成者は自動的にオーナー兼参加済みメンバーになる）
export async function createProject(userId, name) {
  const now = new Date().toISOString();
  const project = {
    id: crypto.randomUUID(),
    name,
    ownerId: userId,
    isDefault: false,
    createdAt: now,
  };
  await addProject(project);
  await addMember({
    id: crypto.randomUUID(),
    projectId: project.id,
    userId,
    role: 'owner',
    status: 'joined',
    createdAt: now,
  });
  return { ...project, role: 'owner' };
}

// プロジェクト詳細（参加済みメンバーのみ閲覧可能）
export async function getProjectDetail(projectId, userId) {
  const myMembership = await requireJoinedMembership(projectId, userId);
  const project = await findProjectById(projectId);
  if (!project) {
    throw new ProjectAccessError('プロジェクトが見つかりません', 404);
  }
  const members = await findMembersByProject(projectId);
  const memberDetails = [];
  for (const member of members) {
    const user = await findUserById(member.userId);
    memberDetails.push({
      userId: member.userId,
      email: user ? user.email : '',
      displayName: user ? toDisplayName(user.email) : '不明なユーザー',
      role: member.role,
      status: member.status,
    });
  }
  // まだ会員登録していない相手への招待（登録待ち）も、オーナーが再送信できるよう一覧に含める
  const pendingInvitations = (await findPendingInvitationsByProject(projectId)).map((inv) => ({
    email: inv.email,
    createdAt: inv.createdAt,
  }));
  return { project, members: memberDetails, myRole: myMembership.role, pendingInvitations };
}

// メールアドレスでメンバーを招待する（オーナーのみ）。
// - すでに会員登録済みのアドレス：これまでどおりProjectMembersに「招待中」として追加する
// - まだ会員登録されていないアドレス：PendingInvitationsに記録し、新規登録を促すメールを送る。
//   相手が実際に登録すると、consumePendingInvitationsForEmail() が自動的にこの招待を有効化する。
export async function inviteMemberByEmail(projectId, userId, email, appUrl) {
  await requireOwnerMembership(projectId, userId);

  // 登録・ログイン処理はメールアドレスを trim + 小文字化してから保存・検索している
  // （server/auth/authService.js の normalizeEmail）。招待時も同じ正規化をしないと、
  // 大文字小文字の違いだけで「登録されていません」と誤判定してしまう。
  const normalizedEmail = email.trim().toLowerCase();
  const project = await findProjectById(projectId);
  const inviter = await findUserById(userId);
  const inviterDisplayName = inviter ? toDisplayName(inviter.email) : '誰か';

  const targetUser = await findUserByEmail(normalizedEmail);

  if (!targetUser) {
    // 未登録者の場合：重複招待を避けるため、既に登録待ちならエラーにする
    const existingPending = await findPendingInvitation(projectId, normalizedEmail);
    if (existingPending) {
      const error = new Error('このメールアドレスへは既に招待メールを送信済みです');
      error.status = 400;
      throw error;
    }

    await addPendingInvitation({
      id: crypto.randomUUID(),
      projectId,
      email: normalizedEmail,
      invitedByUserId: userId,
      status: 'pending',
      createdAt: new Date().toISOString(),
    });

    let emailWarning = null;
    try {
      await sendProjectInvitationEmail({
        to: normalizedEmail,
        projectName: project.name,
        inviterDisplayName,
        isRegistered: false,
        appUrl,
      });
    } catch (error) {
      // メール送信に失敗しても招待の記録自体は残す（オーナーが後で気付いて対応できるように）
      if (error instanceof EmailConfigError || error instanceof EmailSendError) {
        emailWarning = error.message;
      } else {
        throw error;
      }
    }

    return {
      email: normalizedEmail,
      displayName: normalizedEmail,
      isRegistered: false,
      emailWarning,
    };
  }

  const existing = await findMembership(projectId, targetUser.id);
  if (existing) {
    const error = new Error('すでに招待済み、または参加しているユーザーです');
    error.status = 400;
    throw error;
  }

  await addMember({
    id: crypto.randomUUID(),
    projectId,
    userId: targetUser.id,
    role: 'member',
    status: 'invited',
    createdAt: new Date().toISOString(),
  });

  let emailWarning = null;
  try {
    await sendProjectInvitationEmail({
      to: targetUser.email,
      projectName: project.name,
      inviterDisplayName,
      isRegistered: true,
      appUrl,
    });
  } catch (error) {
    if (error instanceof EmailConfigError || error instanceof EmailSendError) {
      emailWarning = error.message;
    } else {
      throw error;
    }
  }

  return { ...withDisplayName(targetUser), isRegistered: true, emailWarning };
}

// 招待メールの再送信（オーナーのみ）。新しい招待は作らず、既存の「招待中」
// （会員登録済みならProjectMembers、未登録ならPendingInvitations）に対して同じ内容のメールを送り直す。
export async function resendInvitationEmail(projectId, userId, email, appUrl) {
  await requireOwnerMembership(projectId, userId);

  const normalizedEmail = email.trim().toLowerCase();
  const project = await findProjectById(projectId);
  const inviter = await findUserById(userId);
  const inviterDisplayName = inviter ? toDisplayName(inviter.email) : '誰か';

  const targetUser = await findUserByEmail(normalizedEmail);
  let isRegistered;
  if (targetUser) {
    const membership = await findMembership(projectId, targetUser.id);
    if (!membership || membership.status !== 'invited') {
      const error = new Error('招待中のメンバーが見つかりません');
      error.status = 404;
      throw error;
    }
    isRegistered = true;
  } else {
    const pending = await findPendingInvitation(projectId, normalizedEmail);
    if (!pending) {
      const error = new Error('招待が見つかりません');
      error.status = 404;
      throw error;
    }
    isRegistered = false;
  }

  let emailWarning = null;
  try {
    await sendProjectInvitationEmail({
      to: normalizedEmail,
      projectName: project.name,
      inviterDisplayName,
      isRegistered,
      appUrl,
    });
  } catch (error) {
    if (error instanceof EmailConfigError || error instanceof EmailSendError) {
      emailWarning = error.message;
    } else {
      throw error;
    }
  }

  return { email: normalizedEmail, emailWarning };
}

// 会員登録が完了した直後に呼ぶ。そのメールアドレス宛の「登録待ち」招待があれば、
// 実際のuserIdを使ってProjectMembersへ変換し、招待を有効化する。
export async function consumePendingInvitationsForEmail(user) {
  const pendingInvitations = await findPendingInvitationsByEmail(user.email);
  for (const invitation of pendingInvitations) {
    const alreadyMember = await findMembership(invitation.projectId, user.id);
    if (!alreadyMember) {
      await addMember({
        id: crypto.randomUUID(),
        projectId: invitation.projectId,
        userId: user.id,
        role: 'member',
        status: 'invited',
        createdAt: new Date().toISOString(),
      });
    }
    await markPendingInvitationConsumed(invitation.id);
  }
}

// 招待に対する応答（参加 or 辞退）
export async function respondToInvitation(projectId, userId, action) {
  const membership = await findMembership(projectId, userId);
  if (!membership || membership.status !== 'invited') {
    const error = new Error('招待が見つかりません');
    error.status = 404;
    throw error;
  }
  const nextStatus = action === 'accept' ? 'joined' : 'declined';
  await updateMemberStatus(projectId, userId, nextStatus);
  return { projectId, status: nextStatus };
}

// メンバー削除（オーナーのみ。オーナー自身は削除できない＝プロジェクト削除で対応する）
export async function removeMemberFromProject(projectId, requesterId, targetUserId) {
  await requireOwnerMembership(projectId, requesterId);
  const target = await findMembership(projectId, targetUserId);
  if (!target) {
    const error = new Error('メンバーが見つかりません');
    error.status = 404;
    throw error;
  }
  if (target.role === 'owner') {
    const error = new Error('オーナーを削除することはできません');
    error.status = 400;
    throw error;
  }
  await removeMemberRow(projectId, targetUserId);
  // 削除されたメンバーが担当者になっていたTodoは、担当者未設定に戻す
  await clearAssigneeInProject(projectId, targetUserId);
}

// 指定ユーザーの、指定プロジェクトにおけるメンバーシップをそのまま返す（見つからなければnull）。
// 担当者変更時に「指定した相手が本当にこのプロジェクトの参加済みメンバーか」を確認するのに使う。
export async function getMembership(projectId, userId) {
  return findMembership(projectId, userId);
}

// プロジェクトごとの参加済みメンバー一覧（完了通知の送信先を決めるのに使う）
export async function listJoinedMembers(projectId) {
  const members = await findMembersByProject(projectId);
  return members.filter(isJoined);
}

// プロジェクトの削除（オーナーのみ）。プロジェクト本体・メンバー・所属Todoをまとめて削除する。
// 戻り値は削除されたTodoのid一覧（コメントの連動削除に使う）。
export async function deleteProject(projectId, requesterId) {
  await requireOwnerMembership(projectId, requesterId);
  const deletedTodoIds = await deleteTodosByProjectId(projectId);
  await removeAllMembersOfProject(projectId);
  await deleteProjectRow(projectId);
  return deletedTodoIds;
}
