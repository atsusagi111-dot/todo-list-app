import { useEffect, useState } from 'react';
import {
  CalendarDays,
  CheckCircle2,
  Circle,
  ListTodo,
  Pencil,
  Plus,
  Sparkles,
  Trash2,
  X,
} from 'lucide-react';
import NavTabs from '../components/NavTabs';
import TodoStats from '../components/TodoStats';
import UserBar from '../components/UserBar';
import { createTodo, deleteTodo, fetchTodos, updateTodo } from '../api';
import { requestAiBreakdown } from '../aiApi';

function TodoFormPage() {
  const [todos, setTodos] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');
  const [inputTitle, setInputTitle] = useState('');
  const [inputContent, setInputContent] = useState('');
  const [inputDueDate, setInputDueDate] = useState('');
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);

  // AIタスク細分化機能用の状態。既存のTodo登録状態とは独立させている。
  const [aiSubtasks, setAiSubtasks] = useState([]);
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [aiErrorMessage, setAiErrorMessage] = useState('');

  useEffect(() => {
    loadTodos();
  }, []);

  const loadTodos = async () => {
    setIsLoading(true);
    setErrorMessage('');
    try {
      const data = await fetchTodos();
      setTodos(data);
    } catch (error) {
      setErrorMessage(error.message);
    } finally {
      setIsLoading(false);
    }
  };

  const resetForm = () => {
    setInputTitle('');
    setInputContent('');
    setInputDueDate('');
    setEditingId(null);
    setIsFormOpen(false);
    setAiSubtasks([]);
    setAiErrorMessage('');
  };

  const handleOpenAddForm = () => {
    setEditingId(null);
    setInputTitle('');
    setInputContent('');
    setInputDueDate('');
    setAiSubtasks([]);
    setAiErrorMessage('');
    setIsFormOpen(true);
  };

  const handleOpenEditForm = (todo) => {
    setEditingId(todo.id);
    setInputTitle(todo.title);
    setInputContent(todo.content);
    setInputDueDate(todo.dueDate);
    setAiSubtasks([]);
    setAiErrorMessage('');
    setIsFormOpen(true);
  };

  // タスク名・期限をもとにAIへサブタスク細分化を依頼する
  const handleRequestAiSuggestions = async () => {
    if (inputTitle.trim() === '' || inputDueDate === '') {
      setAiErrorMessage('AI提案にはタスク名と期限の両方が必要です');
      return;
    }
    setAiErrorMessage('');
    setIsAiLoading(true);
    try {
      const suggestions = await requestAiBreakdown({
        title: inputTitle.trim(),
        dueDate: inputDueDate,
      });
      setAiSubtasks(
        suggestions.map((suggestion) => ({
          tempId: crypto.randomUUID(),
          title: suggestion.title,
          dueDate: suggestion.dueDate,
        }))
      );
    } catch (error) {
      setAiErrorMessage(error.message);
    } finally {
      setIsAiLoading(false);
    }
  };

  const handleAiSubtaskChange = (tempId, field, value) => {
    setAiSubtasks((prev) =>
      prev.map((subtask) => (subtask.tempId === tempId ? { ...subtask, [field]: value } : subtask))
    );
  };

  const handleAiSubtaskDelete = (tempId) => {
    setAiSubtasks((prev) => prev.filter((subtask) => subtask.tempId !== tempId));
  };

  const handleAiSubtaskAdd = () => {
    setAiSubtasks((prev) => [...prev, { tempId: crypto.randomUUID(), title: '', dueDate: inputDueDate }]);
  };

  // 「この内容で登録」：ユーザーがこのボタンを押すまでは何も保存されない
  const handleSaveWithAiSubtasks = async () => {
    const validSubtasks = aiSubtasks.filter((subtask) => subtask.title.trim() !== '');
    if (validSubtasks.length === 0) {
      setAiErrorMessage('サブタスクを1件以上入力してください');
      return;
    }

    setErrorMessage('');
    setAiErrorMessage('');
    try {
      const created = await createTodo({
        title: inputTitle.trim(),
        content: inputContent.trim(),
        dueDate: inputDueDate,
        subtasks: validSubtasks.map((subtask) => ({
          title: subtask.title.trim(),
          dueDate: subtask.dueDate,
        })),
      });
      const { subtasks: createdSubtasks, ...parentTodo } = created;
      setTodos([...todos, parentTodo, ...(createdSubtasks || [])]);
      resetForm();
    } catch (error) {
      setErrorMessage(error.message);
    }
  };

  const handleSaveTodo = async () => {
    if (inputTitle.trim() === '') {
      return;
    }

    setErrorMessage('');
    try {
      if (editingId !== null) {
        const existing = todos.find((todo) => todo.id === editingId);
        const updated = await updateTodo(editingId, {
          title: inputTitle.trim(),
          content: inputContent.trim(),
          dueDate: inputDueDate,
          completed: existing ? existing.completed : false,
        });
        setTodos(todos.map((todo) => (todo.id === editingId ? updated : todo)));
      } else {
        const created = await createTodo({
          title: inputTitle.trim(),
          content: inputContent.trim(),
          dueDate: inputDueDate,
        });
        setTodos([...todos, created]);
      }
      resetForm();
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
    } catch (error) {
      setErrorMessage(error.message);
    }
  };

  const handleDeleteTodo = async (id) => {
    const isConfirmed = window.confirm('このTodoを削除しますか？');
    if (!isConfirmed) {
      return;
    }
    setErrorMessage('');
    try {
      await deleteTodo(id);
      // 親Todoを削除した場合、サーバー側で子Todo（サブタスク）も削除されるため、
      // ローカルの状態からも子Todoを合わせて取り除く
      setTodos(todos.filter((todo) => todo.id !== id && todo.parentId !== id));
    } catch (error) {
      setErrorMessage(error.message);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      handleSaveTodo();
    }
  };

  const isEditing = editingId !== null;

  // 親Todo（parentIdを持たないもの）と、親ごとのサブタスク一覧に組み立てる。
  // AIタスク細分化機能で登録したTodoは「親→サブタスク」の階層で表示される。
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

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="mx-auto max-w-2xl px-4 py-10 sm:px-6 sm:py-16">
        <header className="mb-8 text-center">
          <div className="mb-4 inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-600 shadow-lg shadow-brand-600/30">
            <ListTodo className="h-7 w-7 text-white" strokeWidth={2.2} />
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
            Todoリスト
          </h1>
          <p className="mt-2 text-sm text-slate-500">
            日々のタスクをすっきり管理しよう
          </p>
        </header>

        <UserBar />

        <NavTabs />

        {errorMessage && (
          <div className="mb-6 rounded-xl border border-error-100 bg-error-50 px-4 py-3 text-sm font-medium text-error-600">
            {errorMessage}
          </div>
        )}

        <TodoStats todos={todos} />

        <button
          onClick={handleOpenAddForm}
          className="mb-6 flex w-full items-center justify-center gap-2 rounded-xl bg-brand-600 px-4 py-3 font-semibold text-white shadow-lg shadow-brand-600/25 transition-all hover:bg-brand-700 hover:shadow-brand-600/30 active:scale-[0.98]"
        >
          <Plus className="h-5 w-5" strokeWidth={2.2} />
          Todoを追加する
        </button>

        {isFormOpen && (
          <div className="mb-6 animate-slide-up rounded-2xl border border-slate-200 bg-white p-6 shadow-card-hover">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-slate-900">
                {isEditing ? 'Todoを編集' : 'Todoを追加'}
              </h2>
              <button
                onClick={resetForm}
                className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600"
                aria-label="閉じる"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-700">
                  タイトル
                </label>
                <input
                  type="text"
                  value={inputTitle}
                  onChange={(e) => setInputTitle(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="タイトルを入力"
                  className="w-full rounded-lg border border-slate-300 px-4 py-2.5 text-slate-900 placeholder:text-slate-400 transition-colors focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
                  autoFocus
                />
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-700">
                  内容 <span className="font-normal text-slate-400">（任意）</span>
                </label>
                <textarea
                  value={inputContent}
                  onChange={(e) => setInputContent(e.target.value)}
                  placeholder="内容を入力"
                  rows={3}
                  className="w-full resize-none rounded-lg border border-slate-300 px-4 py-2.5 text-slate-900 placeholder:text-slate-400 transition-colors focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
                />
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-700">
                  期日 <span className="font-normal text-slate-400">（任意）</span>
                </label>
                <input
                  type="date"
                  value={inputDueDate}
                  onChange={(e) => setInputDueDate(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-4 py-2.5 text-slate-900 transition-colors focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
                />
              </div>

              {!isEditing && (
                <div>
                  <button
                    type="button"
                    onClick={handleRequestAiSuggestions}
                    disabled={isAiLoading || inputTitle.trim() === '' || inputDueDate === ''}
                    className="flex w-full items-center justify-center gap-2 rounded-lg border border-brand-200 bg-brand-50 px-4 py-2.5 font-semibold text-brand-700 transition-colors hover:bg-brand-100 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <Sparkles className="h-4 w-4" />
                    {isAiLoading ? 'AIが提案を作成中...' : 'AIでタスクを提案'}
                  </button>
                  {aiErrorMessage && (
                    <div className="mt-2 rounded-lg border border-error-100 bg-error-50 px-3 py-2 text-xs font-medium text-error-600">
                      {aiErrorMessage}
                    </div>
                  )}
                </div>
              )}

              {aiSubtasks.length > 0 && (
                <div className="rounded-xl border border-brand-100 bg-brand-50/40 p-4">
                  <h3 className="mb-3 text-sm font-semibold text-slate-700">
                    AIによるサブタスク提案（編集・削除・追加できます）
                  </h3>
                  <div className="space-y-2">
                    {aiSubtasks.map((subtask) => (
                      <div
                        key={subtask.tempId}
                        className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white p-2"
                      >
                        <input
                          type="text"
                          value={subtask.title}
                          onChange={(e) => handleAiSubtaskChange(subtask.tempId, 'title', e.target.value)}
                          placeholder="サブタスク名"
                          className="min-w-0 flex-1 rounded-md border border-slate-200 px-2 py-1.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500/20"
                        />
                        <input
                          type="date"
                          value={subtask.dueDate}
                          onChange={(e) => handleAiSubtaskChange(subtask.tempId, 'dueDate', e.target.value)}
                          className="flex-shrink-0 rounded-md border border-slate-200 px-2 py-1.5 text-sm text-slate-900 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500/20"
                        />
                        <button
                          type="button"
                          onClick={() => handleAiSubtaskDelete(subtask.tempId)}
                          className="flex-shrink-0 rounded-md p-1.5 text-slate-400 transition-colors hover:bg-error-50 hover:text-error-600"
                          aria-label="サブタスクを削除"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                  <button
                    type="button"
                    onClick={handleAiSubtaskAdd}
                    className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-lg border border-dashed border-slate-300 px-3 py-2 text-xs font-semibold text-slate-500 transition-colors hover:border-brand-300 hover:text-brand-600"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    サブタスクを追加
                  </button>
                </div>
              )}

              <div className="flex gap-3 pt-2">
                {aiSubtasks.length > 0 ? (
                  <button
                    onClick={handleSaveWithAiSubtasks}
                    className="flex-1 rounded-lg bg-brand-600 px-4 py-2.5 font-semibold text-white transition-all hover:bg-brand-700 active:scale-[0.98]"
                  >
                    この内容で登録
                  </button>
                ) : (
                  <button
                    onClick={handleSaveTodo}
                    className="flex-1 rounded-lg bg-brand-600 px-4 py-2.5 font-semibold text-white transition-all hover:bg-brand-700 active:scale-[0.98]"
                  >
                    {isEditing ? '更新する' : '登録する'}
                  </button>
                )}
                <button
                  onClick={resetForm}
                  className="rounded-lg border border-slate-300 px-5 py-2.5 font-semibold text-slate-700 transition-colors hover:bg-slate-50"
                >
                  キャンセル
                </button>
              </div>
            </div>
          </div>
        )}

        {isLoading ? (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-white/50 p-12 text-center text-sm text-slate-500">
            読み込み中...
          </div>
        ) : todos.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-white/50 p-12 text-center">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-slate-100">
              <ListTodo className="h-6 w-6 text-slate-400" />
            </div>
            <p className="text-sm text-slate-500">
              Todoがありません。「Todoを追加する」ボタンから追加してください。
            </p>
          </div>
        ) : (
          <ul className="space-y-3">
            {parentTodos.map((todo) => {
              const children = childTodosByParentId[todo.id] || [];
              return (
                <li
                  key={todo.id}
                  className="group animate-fade-in rounded-xl border border-slate-200 bg-white p-4 shadow-card transition-all hover:shadow-card-hover"
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

                    <div className={`min-w-0 flex-1 ${todo.completed ? 'opacity-60' : ''}`}>
                      <div
                        className={`font-semibold text-slate-900 ${
                          todo.completed ? 'line-through' : ''
                        }`}
                      >
                        {todo.title}
                      </div>
                      {todo.content && (
                        <p className="mt-1 whitespace-pre-wrap text-sm text-slate-600">
                          {todo.content}
                        </p>
                      )}
                      {todo.dueDate && (
                        <div className="mt-2 inline-flex items-center gap-1.5 rounded-md bg-warning-50 px-2 py-1 text-xs font-medium text-warning-600">
                          <CalendarDays className="h-3.5 w-3.5" />
                          {todo.dueDate}
                        </div>
                      )}
                    </div>

                    <div className="flex flex-shrink-0 gap-1">
                      <button
                        onClick={() => handleOpenEditForm(todo)}
                        className="rounded-lg p-2 text-slate-400 transition-colors hover:bg-slate-100 hover:text-brand-600"
                        aria-label="編集"
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => handleDeleteTodo(todo.id)}
                        className="rounded-lg p-2 text-slate-400 transition-colors hover:bg-error-50 hover:text-error-600"
                        aria-label="削除"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>

                  {children.length > 0 && (
                    <ul className="mt-3 space-y-2 border-l-2 border-slate-100 pl-4">
                      {children.map((child) => (
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

                          <div className={`min-w-0 flex-1 ${child.completed ? 'opacity-60' : ''}`}>
                            <div
                              className={`text-sm font-medium text-slate-800 ${
                                child.completed ? 'line-through' : ''
                              }`}
                            >
                              {child.title}
                            </div>
                            {child.dueDate && (
                              <div className="mt-1 inline-flex items-center gap-1 rounded-md bg-warning-50 px-1.5 py-0.5 text-[11px] font-medium text-warning-600">
                                <CalendarDays className="h-3 w-3" />
                                {child.dueDate}
                              </div>
                            )}
                          </div>

                          <div className="flex flex-shrink-0 gap-1">
                            <button
                              onClick={() => handleOpenEditForm(child)}
                              className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-slate-200 hover:text-brand-600"
                              aria-label="編集"
                            >
                              <Pencil className="h-3.5 w-3.5" />
                            </button>
                            <button
                              onClick={() => handleDeleteTodo(child.id)}
                              className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-error-50 hover:text-error-600"
                              aria-label="削除"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}

export default TodoFormPage;
