import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'react-hot-toast';
import { queryClient } from './api/client';
import { AuthProvider, useAuth } from './hooks/useAuth';

import Landing from './pages/Landing';
import Signup from './pages/Signup';
import Login from './pages/Login';
import Onboarding from './pages/Onboarding';
import DashboardLayout from './components/DashboardLayout';
import LinksTab from './pages/dashboard/Links';
import PostsTab from './pages/dashboard/Posts';
import PostEditor from './pages/dashboard/PostEditor';
import DesignTab from './pages/dashboard/Design';
import SubscribersTab from './pages/dashboard/Subscribers';
import StatsTab from './pages/dashboard/Stats';
import SettingsTab from './pages/dashboard/Settings';
import PublicBio from './pages/PublicBio';

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh' }}>
        <div style={{ fontSize: 16, color: '#9ca3af' }}>Loading...</div>
      </div>
    );
  }

  if (!user) return <Navigate to="/login" replace />;
  if (!user.onboarding_completed) return <Navigate to="/onboarding" replace />;

  return <>{children}</>;
}

function OnboardingRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh' }}>
        <div style={{ fontSize: 16, color: '#9ca3af' }}>Loading...</div>
      </div>
    );
  }

  if (!user) return <Navigate to="/login" replace />;
  if (user.onboarding_completed) return <Navigate to="/dashboard/links" replace />;

  return <>{children}</>;
}

function AppRoutes() {
  const { user, loading } = useAuth();

  return (
    <Routes>
      <Route path="/" element={
        loading ? null : user ? <Navigate to="/dashboard/links" replace /> : <Landing />
      } />
      <Route path="/signup" element={<Signup />} />
      <Route path="/login" element={<Login />} />
      <Route path="/onboarding" element={
        <OnboardingRoute><Onboarding /></OnboardingRoute>
      } />
      <Route path="/dashboard" element={
        <ProtectedRoute><DashboardLayout /></ProtectedRoute>
      }>
        <Route index element={<Navigate to="/dashboard/links" replace />} />
        <Route path="links" element={<LinksTab />} />
        <Route path="posts" element={<PostsTab />} />
        <Route path="posts/new" element={<PostEditor />} />
        <Route path="posts/:id" element={<PostEditor />} />
        <Route path="design" element={<DesignTab />} />
        <Route path="subscribers" element={<SubscribersTab />} />
        <Route path="stats" element={<StatsTab />} />
        <Route path="settings" element={<SettingsTab />} />
      </Route>
      <Route path="/:username" element={<PublicBio />} />
    </Routes>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AuthProvider>
          <AppRoutes />
          <Toaster
            position="bottom-right"
            toastOptions={{
              style: {
                borderRadius: 12,
                background: '#1a1a1a',
                color: '#fff',
                fontSize: 14,
              },
            }}
          />
        </AuthProvider>
      </BrowserRouter>
    </QueryClientProvider>
  );
}
