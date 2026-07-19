import { useEffect, useState } from 'react';
import {
  Bell,
  CalendarDays,
  CheckCircle2,
  Circle,
  FolderKanban,
  MessageSquare,
  Plus,
  Trash2,
  UserPlus,
  Users,
  X,
} from 'lucide-react';
import NavTabs from '../components/NavTabs';
import UserBar from '../components/UserBar';
import { createTodo, deleteTodo, fetchTodos, updateTodo } from '../api';
import {
  createProject,
  deleteProject,
  fetchComments,
  fetchMyInvitations,
  fetchMyProjects,
  fetchNotifications,
  fetchProjectDetail,
  inviteMember,
  markAllNotificationsRead,
  markNotificationRead,
  postComment,
  removeMember,
  respondToInvitation,
  updateTodoAssignee,
} from '../projectsApi';

// チーム共有機能のメイン画面。
// 左側にプロジェクト一覧（＋招待・通知）、右側に選択中プロジェクトのTodo一覧を表示する。
// Todoを押すと詳細（内容・担当者・コメント）をモーダルで表示する。
function ProjectsPage() {
  const [projects, setProjects] = useState([]);
  const [invitations, setInvitations] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [isNotificationOpen, setIsNotificationOpen] = useState(false);

  const [selectedProjectId, setSelectedProjectId] = useState(null);
  const [projectDetail, setProjectDetail] = useState(null);
  const [todos, setTodos] = useState([]);

  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');

  const [isCreateFormOpen, setIsCreateFormOpen] = useState(false);
  const [newProjectName, setNewProjectName] = useState('');

  const [isInviteFormOpen, setIsInviteFormOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteMessage, setInviteMessage] = useState('');

  const [isAddTodoFormOpen, setIsAddTodoFormOpen] = useState(false);
  const [newTodoTitle, setNewTodoTitle] = useState('');
  const [newTodoDueDate, setNewTodoDueDate] = useState('');

  const [selectedTodoId, setSelectedTodoId] = useState(null);
  const [comments, setComments] = useState([]);
  const [newCommentBody, setNewCommentBody] = useState('');
  const [detailErrorMessage, setDetailErrorMessage] = useState('');

  useEffect(() => {
    loadSidebar();
    loadNotifications();
  }, []);

  useEffect(() => {
    if (selectedProjectId) {
      loadProject(selectedProjectId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedProjectId]);

  const loadSidebar = async () => {
    setIsLoading(true);
    setErrorMessage('');
    try {
      const [projectList, invitationList] = await Promise.all([fetchMyProjects(), fetchMyInvitations()]);
      setProjects(projectList);
      setInvitations(invitationList);
      if (!selectedProjectId && projectList.length > 0) {
        setSelectedProjectId(projectList[0].id);
      }
    } catch (error) {
      setErrorMessage(error.message);
    } finally {
      setIsLoading(false);
    }
  };

  const loadProject = async (projectId) => {
    setErrorMessage('');
    try {
      const [detail, projectTodos] = await Promise.all([
        fetchProjectDetail(projectId),
        fetchTodos(projectId),
      ]);
      setProjectDetail(detail);
      setTodos(projectTodos);
    } catch (error) {
      setErrorMessage(error.message);
      setProjectDetail(null);
      setTodos([]);
    }
  };

  const loadNotifications = async () => {
    try {
      const list = await fetchNotifications();
      setNotifications(list);
    } catch {
      // 通知の取得失敗はページ全体をブロックするほどではないため、静かに無視する
    }
  };

  const handleSelectProject = (projectId) => {
    setSelectedProjectId(projectId);
    setSelectedTodoId(null);
    setIsAddTodoFormOpen(false);
    setIsInviteFormOpen(false);
  };

  const handleCreateProject = async () => {
    if (newProjectName.trim() === '') {
      return;
    }
    setErrorMessage('');
    try {
      const project = await createProject(newProjectName.trim());
      setNewProjectName('');
      setIsCreateFormOpen(false);
      await loadSidebar();
      setSelectedProjectId(project.id);
    } catch (error) {
      setErrorMessage(error.message);
    }
  };

  const handleRespondInvitation = async (projectId, action) => {
    setErrorMessage('');
    try {
      await respondToInvitation(projectId, action);
      await loadSidebar();
    } catch (error) {
      setErrorMessage(error.message);
    }
  };

  const handleInvite = async () => {
    if (inviteEmail.trim() === '' || !selectedProjectId) {
      return;
    }
    setInviteMessage('');
    try {
      const invited = await inviteMember(selectedProjectId, inviteEmail.trim());
      setInviteMessage(
        invited.emailWarning
          ? `${invited.displayName} さんを招待しましたが、メール送信に失敗しました（${invited.emailWarning}）`
          : `${invited.displayName} さんを招待しました`
      );
      setInviteEmail('');
      await loadProject(selectedProjectId);
    } catch (error) {
      setInviteMessage(error.message);
    }
  };

  const handleRemoveMember = async (userId) => {
    if (!selectedProjectId) return;
    const isConfirmed = window.confirm('このメンバーをプロジェクトから削除しますか？');
    if (!isConfirmed) return;
    setErrorMessage('');
    try {
      await removeMember(selectedProjectId, userId);
      await loadProject(selectedProjectId);
    } catch (error) {
      setErrorMessage(error.message);
    }
  };

  const handleDeleteProject = async () => {
    if (!selectedProjectId) return;
    const isConfirmed = window.confirm(
      'このプロジェクトを削除しますか？所属するTodo・コメントもすべて削除されます。'
    );
    if (!isConfirmed) return;
    setErrorMessage('');
    try {
      await deleteProject(selectedProjectId);
      setSelectedProjectId(null);
      setProjectDetail(null);
      setTodos([]);
      await loadSidebar();
    } catch (error) {
      setErrorMessage(error.message);
    }
  };

  const handleAddTodo = async () => {
    if (newTodoTitle.trim() === '' || !selectedProjectId) {
      return;
    }
    setErrorMessage('');
    try {
      const created = await createTodo({
        title: newTodoTitle.trim(),
        content: '',
        dueDate: newTodoDueDate,
        projectId: selectedProjectId,
      });
      setTodos([...todos, created]);
      setNewTodoTitle('');
      setNewTodoDueDate('');
      setIsAddTodoFormOpen(false);
    } catch (error) {
      setErrorMessage(error.message);
    }
  };

  const handleToggleComplete = async (todo) => {
    setErrorMessage('');
    try {
      const updated = await updateTodo(todo.id, {
        title: todo.title,
        content: todo.content,
        dueDate: todo.dueDate,
        completed: !todo.completed,
      });
      setTodos(todos.map((t) => (t.id === todo.id ? updated : t)));
      loadNotifications();
    } catch (error) {
      setErrorMessage(error.message);
    }
  };

  const handleDeleteTodo = async (id) => {
    const isConfirmed = window.confirm('このTodoを削除しますか？');
    if (!isConfirmed) return;
    setErrorMessage('');
    try {
      await deleteTodo(id);
      setTodos(todos.filter((todo) => todo.id !== id && todo.parentId !== id));
      if (selectedTodoId === id) {
        setSelectedTodoId(null);
      }
    } catch (error) {
      setErrorMessage(error.message);
    }
  };

  const handleOpenTodoDetail = async (todo) => {
    setSelectedTodoId(todo.id);
    setDetailErrorMessage('');
    setNewCommentBody('');
    try {
      const list = await fetchComments(todo.id);
      setComments(list);
    } catch (error) {
      setDetailErrorMessage(error.message);
    }
  };

  const handleChangeAssignee = async (todoId, assigneeId) => {
    setDetailErrorMessage('');
    try {
      const updated = await updateTodoAssignee(todoId, assigneeId);
      setTodos(todos.map((t) => (t.id === todoId ? updated : t)));
    } catch (error) {
      setDetailErrorMessage(error.message);
    }
  };

  const handlePostComment = async () => {
    if (newCommentBody.trim() === '' || !selectedTodoId) {
      return;
    }
    setDetailErrorMessage('');
    try {
      const comment = await postComment(selectedTodoId, newCommentBody.trim());
      setComments([...comments, comment]);
      setNewCommentBody('');
    } catch (error) {
      setDetailErrorMessage(error.message);
    }
  };

  const handleMarkNotificationRead = async (notification) => {
    try {
      if (!notification.isRead) {
        await markNotificationRead(notification.id);
        setNotifications(
          notifications.map((n) => (n.id === notification.id ? { ...n, isRead: true } : n))
        );
      }
      if (notification.projectId) {
        handleSelectProject(notification.projectId);
      }
      setIsNotificationOpen(false);
    } catch {
      // 通知の既読処理失敗は致命的ではないため無視する
    }
  };

  const handleMarkAllRead = async () => {
    try {
      await markAllNotificationsRead();
      setNotifications(notifications.map((n) => ({ ...n, isRead: true })));
    } catch {
      // 無視する
    }
  };

  const unreadCount = notifications.filter((n) => !n.isRead).length;
  const myRole = projectDetail?.myRole;
  const members = projectDetail?.members || [];
  const memberById = new Map(members.map((m) => [m.userId, m]));

  // 親Todo（parentIdを持たないもの）とサブタスクの階層に組み立てる（既存2画面と同じロジック）
  const parentTodos = todos.filter((todo) => !todo.parentId);
  const childTodosByParentId = {};
  todos.forEach((todo) => {
    if (todo.parentId) {
      if (!childTodosByParentId[todo.parentId]) {
        childTodosByParentId[todo.parentId] = [];
      }
      childTodosByParentId[todo.parentId].push(todo);
    }
  });
  Object.values(childTodosByParentId).forEach((children) =>
    children.sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0))
  );

  const selectedTodo = todos.find((t) => t.id === selectedTodoId) || null;

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 sm:py-16">
        <header className="mb-8 text-center">
          <div className="mb-4 inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-600 shadow-lg shadow-brand-600/30">
            <FolderKanban className="h-7 w-7 text-white" strokeWidth={2.2} />
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
            プロジェクト
          </h1>
          <p className="mt-2 text-sm text-slate-500">チームでTodoを共有・管理しよう</p>
        </header>

        <UserBar />
        <NavTabs />

        <div className="mb-6 flex justify-end">
          <div className="relative">
            <button
              onClick={() => setIsNotificationOpen((open) => !open)}
              className="relative flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-card transition-colors hover:bg-slate-50"
            >
              <Bell className="h-4 w-4" />
              通知
              {unreadCount > 0 && (
                <span className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-error-600 text-[11px] font-bold text-white">
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </button>
            {isNotificationOpen && (
              <div className="absolute right-0 z-20 mt-2 w-80 rounded-xl border border-slate-200 bg-white p-3 shadow-card-hover">
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-sm font-semibold text-slate-700">通知</span>
                  {unreadCount > 0 && (
                    <button
                      onClick={handleMarkAllRead}
                      className="text-xs font-semibold text-brand-600 hover:text-brand-700"
                    >
                      すべて既読にする
                    </button>
                  )}
                </div>
                {notifications.length === 0 ? (
                  <p className="py-4 text-center text-xs text-slate-400">通知はありません</p>
                ) : (
                  <ul className="max-h-80 space-y-1.5 overflow-y-auto">
                    {notifications.map((notification) => (
                      <li key={notification.id}>
                        <button
                          onClick={() => handleMarkNotificationRead(notification)}
                          className={`w-full rounded-lg p-2.5 text-left text-xs transition-colors hover:bg-slate-50 ${
                            notification.isRead ? 'text-slate-400' : 'bg-brand-50/60 text-slate-700'
                          }`}
                        >
                          <p>{notification.message}</p>
                          <p className="mt-1 text-[10px] text-slate-400">
                            {new Date(notification.createdAt).toLocaleString('ja-JP')}
                          </p>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </div>
        </div>

        {errorMessage && (
          <div className="mb-6 rounded-xl border border-error-100 bg-error-50 px-4 py-3 text-sm font-medium text-error-600">
            {errorMessage}
          </div>
        )}

        {isLoading ? (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-white/50 p-12 text-center text-sm text-slate-500">
            読み込み中...
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-[280px_1fr]">
            {/* 左側：プロジェクト一覧 */}
            <aside className="space-y-4">
              {invitations.length > 0 && (
                <div className="rounded-xl border border-brand-100 bg-brand-50/50 p-4">
                  <h3 className="mb-2 text-sm font-semibold text-slate-700">招待されています</h3>
                  <ul className="space-y-2">
                    {invitations.map((invitation) => (
                      <li key={invitation.projectId} className="rounded-lg bg-white p-2.5 shadow-card">
                        <p className="text-sm font-medium text-slate-800">{invitation.projectName}</p>
                        <p className="mb-2 text-xs text-slate-500">
                          {invitation.ownerDisplayName} さんから
                        </p>
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleRespondInvitation(invitation.projectId, 'accept')}
                            className="flex-1 rounded-md bg-brand-600 px-2 py-1 text-xs font-semibold text-white hover:bg-brand-700"
                          >
                            参加する
                          </button>
                          <button
                            onClick={() => handleRespondInvitation(invitation.projectId, 'decline')}
                            className="flex-1 rounded-md border border-slate-300 px-2 py-1 text-xs font-semibold text-slate-600 hover:bg-slate-50"
                          >
                            辞退する
                          </button>
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-card">
                <h3 className="mb-2 px-1 text-sm font-semibold text-slate-700">プロジェクト一覧</h3>
                <ul className="space-y-1">
                  {projects.map((project) => (
                    <li key={project.id}>
                      <button
                        onClick={() => handleSelectProject(project.id)}
                        className={`flex w-full items-center justify-between rounded-lg px-3 py-2.5 text-left text-sm font-medium transition-colors ${
                          project.id === selectedProjectId
                            ? 'bg-brand-600 text-white shadow-sm'
                            : 'text-slate-600 hover:bg-slate-100'
                        }`}
                      >
                        <span className="truncate">{project.name}</span>
                        <span
                          className={`ml-2 flex-shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                            project.id === selectedProjectId
                              ? 'bg-white/20 text-white'
                              : 'bg-slate-100 text-slate-500'
                          }`}
                        >
                          {project.role === 'owner' ? 'オーナー' : 'メンバー'}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>

                {isCreateFormOpen ? (
                  <div className="mt-2 space-y-2 border-t border-slate-100 pt-2">
                    <input
                      type="text"
                      value={newProjectName}
                      onChange={(e) => setNewProjectName(e.target.value)}
                      placeholder="プロジェクト名"
                      className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
                      autoFocus
                    />
                    <div className="flex gap-2">
                      <button
                        onClick={handleCreateProject}
                        className="flex-1 rounded-lg bg-brand-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-brand-700"
                      >
                        作成する
                      </button>
                      <button
                        onClick={() => {
                          setIsCreateFormOpen(false);
                          setNewProjectName('');
                        }}
                        className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50"
                      >
                        キャンセル
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    onClick={() => setIsCreateFormOpen(true)}
                    className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-lg border border-dashed border-slate-300 px-3 py-2 text-xs font-semibold text-slate-500 transition-colors hover:border-brand-300 hover:text-brand-600"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    新しいプロジェクト
                  </button>
                )}
              </div>
            </aside>

            {/* 右側：選択中プロジェクトのTodo一覧 */}
            <main>
              {!selectedProjectId || !projectDetail ? (
                <div className="rounded-2xl border border-dashed border-slate-300 bg-white/50 p-12 text-center text-sm text-slate-500">
                  左のプロジェクト一覧から表示したいプロジェクトを選んでください
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-card">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <h2 className="text-lg font-bold text-slate-900">{projectDetail.project.name}</h2>
                        <p className="mt-1 flex items-center gap-1.5 text-xs text-slate-500">
                          <Users className="h-3.5 w-3.5" />
                          {members.map((m) => m.displayName).join(', ')}
                        </p>
                      </div>
                      {myRole === 'owner' && (
                        <div className="flex flex-shrink-0 gap-2">
                          <button
                            onClick={() => setIsInviteFormOpen((open) => !open)}
                            className="flex items-center gap-1.5 rounded-lg border border-brand-200 bg-brand-50 px-3 py-1.5 text-xs font-semibold text-brand-700 hover:bg-brand-100"
                          >
                            <UserPlus className="h-3.5 w-3.5" />
                            招待
                          </button>
                          <button
                            onClick={handleDeleteProject}
                            className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-error-50 hover:text-error-600"
                            aria-label="プロジェクトを削除"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      )}
                    </div>

                    {isInviteFormOpen && (
                      <div className="mt-3 border-t border-slate-100 pt-3">
                        <div className="flex gap-2">
                          <input
                            type="email"
                            value={inviteEmail}
                            onChange={(e) => setInviteEmail(e.target.value)}
                            placeholder="招待するメールアドレス"
                            className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
                          />
                          <button
                            onClick={handleInvite}
                            className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700"
                          >
                            招待する
                          </button>
                        </div>
                        {inviteMessage && <p className="mt-2 text-xs text-slate-500">{inviteMessage}</p>}

                        {members.filter((m) => m.role !== 'owner').length > 0 && (
                          <ul className="mt-3 space-y-1">
                            {members
                              .filter((m) => m.role !== 'owner')
                              .map((member) => (
                                <li
                                  key={member.userId}
                                  className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-1.5 text-xs"
                                >
                                  <span className="text-slate-600">
                                    {member.displayName}
                                    <span className="ml-1.5 text-slate-400">
                                      （{member.status === 'joined' ? '参加済み' : '招待中'}）
                                    </span>
                                  </span>
                                  <button
                                    onClick={() => handleRemoveMember(member.userId)}
                                    className="text-slate-400 hover:text-error-600"
                                  >
                                    削除
                                  </button>
                                </li>
                              ))}
                          </ul>
                        )}
                      </div>
                    )}
                  </div>

                  {isAddTodoFormOpen ? (
                    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-card">
                      <div className="space-y-3">
                        <input
                          type="text"
                          value={newTodoTitle}
                          onChange={(e) => setNewTodoTitle(e.target.value)}
                          placeholder="タスク名"
                          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
                          autoFocus
                        />
                        <input
                          type="date"
                          value={newTodoDueDate}
                          onChange={(e) => setNewTodoDueDate(e.target.value)}
                          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
                        />
                        <div className="flex gap-2">
                          <button
                            onClick={handleAddTodo}
                            className="flex-1 rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700"
                          >
                            追加する
                          </button>
                          <button
                            onClick={() => setIsAddTodoFormOpen(false)}
                            className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50"
                          >
                            キャンセル
                          </button>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <button
                      onClick={() => setIsAddTodoFormOpen(true)}
                      className="flex w-full items-center justify-center gap-2 rounded-xl bg-brand-600 px-4 py-3 font-semibold text-white shadow-lg shadow-brand-600/25 transition-all hover:bg-brand-700 active:scale-[0.98]"
                    >
                      <Plus className="h-5 w-5" strokeWidth={2.2} />
                      Todoを追加する
                    </button>
                  )}

                  {parentTodos.length === 0 ? (
                    <div className="rounded-2xl border border-dashed border-slate-300 bg-white/50 p-12 text-center text-sm text-slate-500">
                      このプロジェクトにはまだTodoがありません
                    </div>
                  ) : (
                    <ul className="space-y-3">
                      {parentTodos.map((todo) => {
                        const children = childTodosByParentId[todo.id] || [];
                        const assignee = memberById.get(todo.assigneeId);
                        return (
                          <li
                            key={todo.id}
                            className="rounded-xl border border-slate-200 bg-white p-4 shadow-card transition-all hover:shadow-card-hover"
                          >
                            <div className="flex items-start gap-3">
                              <button
                                onClick={() => handleToggleComplete(todo)}
                                className="mt-0.5 flex-shrink-0 transition-transform hover:scale-110"
                                aria-label={todo.completed ? '未完了に戻す' : '完了にする'}
                              >
                                {todo.completed ? (
                                  <CheckCircle2 className="h-6 w-6 text-success-500" />
                                ) : (
                                  <Circle className="h-6 w-6 text-slate-300 transition-colors hover:text-brand-400" />
                                )}
                              </button>

                              <button
                                onClick={() => handleOpenTodoDetail(todo)}
                                className={`min-w-0 flex-1 text-left ${todo.completed ? 'opacity-60' : ''}`}
                              >
                                <div
                                  className={`font-semibold text-slate-900 ${
                                    todo.completed ? 'line-through' : ''
                                  }`}
                                >
                                  {todo.title}
                                </div>
                                <div className="mt-1.5 flex flex-wrap items-center gap-2">
                                  {todo.dueDate && (
                                    <span className="inline-flex items-center gap-1 rounded-md bg-warning-50 px-2 py-0.5 text-xs font-medium text-warning-600">
                                      <CalendarDays className="h-3 w-3" />
                                      {todo.dueDate}
                                    </span>
                                  )}
                                  <span className="inline-flex items-center gap-1 rounded-md bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-500">
                                    <Users className="h-3 w-3" />
                                    {assignee ? assignee.displayName : '未割り当て'}
                                  </span>
                                </div>
                              </button>

                              <button
                                onClick={() => handleDeleteTodo(todo.id)}
                                className="flex-shrink-0 rounded-lg p-2 text-slate-400 transition-colors hover:bg-error-50 hover:text-error-600"
                                aria-label="削除"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </div>

                            {children.length > 0 && (
                              <ul className="mt-3 space-y-2 border-l-2 border-slate-100 pl-4">
                                {children.map((child) => {
                                  const childAssignee = memberById.get(child.assigneeId);
                                  return (
                                    <li
                                      key={child.id}
                                      className="flex items-start gap-2 rounded-lg bg-slate-50 p-2.5"
                                    >
                                      <button
                                        onClick={() => handleToggleComplete(child)}
                                        className="mt-0.5 flex-shrink-0 transition-transform hover:scale-110"
                                        aria-label={child.completed ? '未完了に戻す' : '完了にする'}
                                      >
                                        {child.completed ? (
                                          <CheckCircle2 className="h-5 w-5 text-success-500" />
                                        ) : (
                                          <Circle className="h-5 w-5 text-slate-300 transition-colors hover:text-brand-400" />
                                        )}
                                      </button>
                                      <button
                                        onClick={() => handleOpenTodoDetail(child)}
                                        className={`min-w-0 flex-1 text-left ${
                                          child.completed ? 'opacity-60' : ''
                                        }`}
                                      >
                                        <div
                                          className={`text-sm font-medium text-slate-800 ${
                                            child.completed ? 'line-through' : ''
                                          }`}
                                        >
                                          {child.title}
                                        </div>
                                        <div className="mt-1 flex flex-wrap items-center gap-1.5">
                                          {child.dueDate && (
                                            <span className="inline-flex items-center gap-1 rounded-md bg-warning-50 px-1.5 py-0.5 text-[11px] font-medium text-warning-600">
                                              <CalendarDays className="h-3 w-3" />
                                              {child.dueDate}
                                            </span>
                                          )}
                                          <span className="inline-flex items-center gap-1 rounded-md bg-slate-100 px-1.5 py-0.5 text-[11px] font-medium text-slate-500">
                                            {childAssignee ? childAssignee.displayName : '未割り当て'}
                                          </span>
                                        </div>
                                      </button>
                                      <button
                                        onClick={() => handleDeleteTodo(child.id)}
                                        className="flex-shrink-0 rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-error-50 hover:text-error-600"
                                        aria-label="削除"
                                      >
                                        <Trash2 className="h-3.5 w-3.5" />
                                      </button>
                                    </li>
                                  );
                                })}
                              </ul>
                            )}
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </div>
              )}
            </main>
          </div>
        )}
      </div>

      {/* Todo詳細モーダル：内容・担当者・コメント */}
      {selectedTodo && (
        <div
          className="fixed inset-0 z-30 flex items-center justify-center bg-slate-900/40 p-4"
          onClick={() => setSelectedTodoId(null)}
        >
          <div
            className="max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-slate-200 bg-white p-6 shadow-card-hover"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4 flex items-start justify-between">
              <h2 className="text-lg font-semibold text-slate-900">{selectedTodo.title}</h2>
              <button
                onClick={() => setSelectedTodoId(null)}
                className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600"
                aria-label="閉じる"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {detailErrorMessage && (
              <div className="mb-4 rounded-lg border border-error-100 bg-error-50 px-3 py-2 text-xs font-medium text-error-600">
                {detailErrorMessage}
              </div>
            )}

            <div className="mb-4 space-y-3 text-sm">
              {selectedTodo.content && (
                <p className="whitespace-pre-wrap text-slate-600">{selectedTodo.content}</p>
              )}
              {selectedTodo.dueDate && (
                <div className="inline-flex items-center gap-1.5 rounded-md bg-warning-50 px-2 py-1 text-xs font-medium text-warning-600">
                  <CalendarDays className="h-3.5 w-3.5" />
                  {selectedTodo.dueDate}
                </div>
              )}

              <div>
                <label className="mb-1.5 block text-xs font-medium text-slate-500">担当者</label>
                {myRole === 'owner' ? (
                  <select
                    value={selectedTodo.assigneeId || ''}
                    onChange={(e) => handleChangeAssignee(selectedTodo.id, e.target.value)}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
                  >
                    <option value="">未割り当て</option>
                    {members
                      .filter((m) => m.status === 'joined')
                      .map((member) => (
                        <option key={member.userId} value={member.userId}>
                          {member.displayName}
                        </option>
                      ))}
                  </select>
                ) : (
                  <p className="text-sm text-slate-700">
                    {memberById.get(selectedTodo.assigneeId)?.displayName || '未割り当て'}
                    <span className="ml-2 text-xs text-slate-400">（担当変更はオーナーのみ）</span>
                  </p>
                )}
              </div>
            </div>

            <div className="border-t border-slate-100 pt-4">
              <h3 className="mb-3 flex items-center gap-1.5 text-sm font-semibold text-slate-700">
                <MessageSquare className="h-4 w-4" />
                コメント
              </h3>
              <ul className="mb-3 space-y-3">
                {comments.length === 0 ? (
                  <p className="text-xs text-slate-400">まだコメントはありません</p>
                ) : (
                  comments.map((comment) => (
                    <li key={comment.id} className="rounded-lg bg-slate-50 p-3">
                      <div className="mb-1 flex items-center justify-between">
                        <span className="text-xs font-semibold text-slate-700">
                          {comment.authorDisplayName}
                        </span>
                        <span className="text-[10px] text-slate-400">
                          {new Date(comment.createdAt).toLocaleString('ja-JP')}
                        </span>
                      </div>
                      <p className="whitespace-pre-wrap text-sm text-slate-600">{comment.body}</p>
                    </li>
                  ))
                )}
              </ul>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newCommentBody}
                  onChange={(e) => setNewCommentBody(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handlePostComment()}
                  placeholder="コメントを入力"
                  className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
                />
                <button
                  onClick={handlePostComment}
                  className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700"
                >
                  投稿
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default ProjectsPage;
