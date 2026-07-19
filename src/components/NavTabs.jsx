import { NavLink } from 'react-router-dom';
import { FolderKanban, ListChecks, ListTodo } from 'lucide-react';

function NavTabs() {
  const linkClass = ({ isActive }) =>
    `flex flex-1 items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold transition-colors ${
      isActive
        ? 'bg-brand-600 text-white shadow-sm'
        : 'text-slate-500 hover:bg-slate-100 hover:text-slate-700'
    }`;

  return (
    <nav className="mb-8 flex gap-2 rounded-xl border border-slate-200 bg-white p-1.5 shadow-card">
      <NavLink to="/" end className={linkClass}>
        <ListTodo className="h-4 w-4" strokeWidth={2.2} />
        追加・編集
      </NavLink>
      <NavLink to="/list" className={linkClass}>
        <ListChecks className="h-4 w-4" strokeWidth={2.2} />
        一覧を確認
      </NavLink>
      <NavLink to="/projects" className={linkClass}>
        <FolderKanban className="h-4 w-4" strokeWidth={2.2} />
        プロジェクト
      </NavLink>
    </nav>
  );
}

export default NavTabs;
