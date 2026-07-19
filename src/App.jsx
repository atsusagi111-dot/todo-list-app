import { Route, Routes } from 'react-router-dom';
import TodoFormPage from './pages/TodoFormPage';
import TodoListPage from './pages/TodoListPage';
import ProjectsPage from './pages/ProjectsPage';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import ProtectedRoute from './components/ProtectedRoute';

function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
      <Route
        path="/"
        element={
          <ProtectedRoute>
            <TodoFormPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/list"
        element={
          <ProtectedRoute>
            <TodoListPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/projects"
        element={
          <ProtectedRoute>
            <ProjectsPage />
          </ProtectedRoute>
        }
      />
    </Routes>
  );
}

export default App;
