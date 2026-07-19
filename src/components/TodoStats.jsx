function TodoStats({ todos }) {
  const total = todos.length;
  const completed = todos.filter((t) => t.completed).length;
  const pending = total - completed;

  return (
    <div className="mb-8 grid grid-cols-3 gap-3">
      <div className="rounded-xl border border-slate-200 bg-white p-4 text-center shadow-card">
        <div className="text-2xl font-bold text-slate-900">{total}</div>
        <div className="mt-1 text-xs font-medium text-slate-500">全体</div>
      </div>
      <div className="rounded-xl border border-slate-200 bg-white p-4 text-center shadow-card">
        <div className="text-2xl font-bold text-brand-600">{pending}</div>
        <div className="mt-1 text-xs font-medium text-slate-500">未完了</div>
      </div>
      <div className="rounded-xl border border-slate-200 bg-white p-4 text-center shadow-card">
        <div className="text-2xl font-bold text-success-600">{completed}</div>
        <div className="mt-1 text-xs font-medium text-slate-500">完了</div>
      </div>
    </div>
  );
}

export default TodoStats;
