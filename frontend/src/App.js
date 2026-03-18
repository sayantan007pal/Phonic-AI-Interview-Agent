import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'sonner';
import { ThemeProvider } from './contexts/ThemeContext';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import Layout from './components/Layout';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import InterviewsList from './pages/InterviewsList';
import NewInterview from './pages/NewInterview';
import InterviewDetail from './pages/InterviewDetail';
import EvaluationReport from './pages/EvaluationReport';
import JDLibrary from './pages/JDLibrary';
import Settings from './pages/Settings';
import InterviewRoom from './pages/InterviewRoom';

function ProtectedRoute({ children }) {
  const { user, loading } = useAuth();
  if (loading) return (
    <div className="flex items-center justify-center min-h-screen" style={{background: 'var(--color-background)'}}>
      <div className="flex gap-2">
        {[0,1,2].map(i => (
          <div key={i} className="w-2 h-2 rounded-full bg-accent animate-bounce" style={{animationDelay: `${i*0.15}s`}} />
        ))}
      </div>
    </div>
  );
  if (!user) return <Navigate to="/login" replace />;
  return children;
}

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <BrowserRouter>
          <Toaster position="top-right" richColors closeButton />
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/interview/:token" element={<InterviewRoom />} />
            <Route path="/dashboard" element={
              <ProtectedRoute>
                <Layout />
              </ProtectedRoute>
            }>
              <Route index element={<Dashboard />} />
              <Route path="interviews" element={<InterviewsList />} />
              <Route path="interviews/new" element={<NewInterview />} />
              <Route path="interviews/:sessionId" element={<InterviewDetail />} />
              <Route path="interviews/:sessionId/report" element={<EvaluationReport />} />
              <Route path="jd" element={<JDLibrary />} />
              <Route path="settings" element={<Settings />} />
            </Route>
            <Route path="*" element={<Navigate to="/dashboard" replace />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </ThemeProvider>
  );
}
