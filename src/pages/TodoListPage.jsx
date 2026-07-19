import { useEffect, useState } from 'react';
import { CalendarDays, CheckCircle2, Circle, ListChecks } from 'lucide-react';
import NavTabs from '../components/NavTabs';
import TodoStats from '../components/TodoStats';
import UserBar from '../components/UserBar';
import { fetchTodos } from '../api';

function TodoListPage() {
  const [todos, setTodos] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');

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

  // 親Todo（parentIdを持たないもの）と、親ごとのサブタスク一覧に組み立てる
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
            <ListChecks className="h-7 w-7 text-white" strokeWidth={2.2} />
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
            Todo一覧
          </h1>
          <p className="mt-2 text-sm text-slate-500">
            スプレッドシートに登録されている内容を確認できます
          </p>
        </header>

        <UserBar />

        <NavTabs />

        {errorMessage && (
          <div className="mb-6 rounded-xl border border-error-100 bg-error-50 px-4 py-3 text-sm font-medium text-error-600">
            {errorMessage}
          </div>
        )}

        <div className="mb-6 flex items-center justify-between">
          <TodoStats todos={todos} />
        </div>

        <button
          onClick={loadTodos}
          className="mb-6 w-full rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50"
        >
          再読み込み
        </button>

        {isLoading ? (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-white/50 p-12 text-center text-sm text-slate-500">
            読み込み中...
          </div>
        ) : todos.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-white/50 p-12 text-center">
            <p className="text-sm text-slate-500">
              まだTodoが登録されていません。
            </p>
          </div>
        ) : (
          <ul className="space-y-3">
            {parentTodos.map((todo) => {
              const children = childTodosByParentId[todo.id] || [];
              return (
                <li
                  key={todo.id}
                  className="rounded-xl border border-slate-200 bg-white p-4 shadow-card"
                >
                  <div className="flex items-start gap-3">
                    {todo.completed ? (
                      <CheckCircle2 className="mt-0.5 h-6 w-6 flex-shrink-0 text-success-500" />
                    ) : (
                      <Circle className="mt-0.5 h-6 w-6 flex-shrink-0 text-slate-300" />
                    )}

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
                  </div>

                  {children.length > 0 && (
                    <ul className="mt-3 space-y-2 border-l-2 border-slate-100 pl-4">
                      {children.map((child) => (
                        <li key={child.id} className="flex items-start gap-2 rounded-lg bg-slate-50 p-2.5">
                          {child.completed ? (
                            <CheckCircle2 className="mt-0.5 h-5 w-5 flex-shrink-0 text-success-500" />
                          ) : (
                            <Circle className="mt-0.5 h-5 w-5 flex-shrink-0 text-slate-300" />
                          )}
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

export default TodoListPage;
