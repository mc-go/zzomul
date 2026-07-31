import { useEffect, useState } from 'react';
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { ProfilesProvider } from './contexts/ProfilesContext';
import { AppDataProvider } from './contexts/AppDataContext';
import { AnniversariesProvider } from './contexts/AnniversariesContext';
import Layout from './components/Layout';
import LoginPage from './pages/LoginPage';
import CalendarPage from './pages/CalendarPage';
import LunchPage from './pages/LunchPage';
import ReportPage from './pages/ReportPage';

function RequireAuth({ children }: { children: React.ReactNode }) {
  const { session, ready } = useAuth();
  const location = useLocation();
  if (!ready) return null;
  if (!session) return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  return <>{children}</>;
}

export default function App() {
  const [booted, setBooted] = useState(false);
  useEffect(() => {
    setBooted(true);
  }, []);
  if (!booted) return null;

  return (
    <AuthProvider>
      <AppDataProvider>
        <ProfilesProvider>
        <AnniversariesProvider>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route
            element={
              <RequireAuth>
                <Layout />
              </RequireAuth>
            }
          >
            <Route path="/" element={<Navigate to="/calendar" replace />} />
            <Route path="/calendar" element={<CalendarPage />} />
            <Route path="/lunch" element={<LunchPage />} />
            <Route path="/report" element={<ReportPage />} />
          </Route>
          <Route path="*" element={<Navigate to="/calendar" replace />} />
        </Routes>
        </AnniversariesProvider>
        </ProfilesProvider>
      </AppDataProvider>
    </AuthProvider>
  );
}
