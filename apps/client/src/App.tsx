import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import AppLayout from './components/layout/AppLayout';
import AuthGuard from './components/layout/AuthGuard';
import ErrorBoundary from './components/common/ErrorBoundary';
import SignInScreen from './screens/SignInScreen';
import TodayScreen from './screens/TodayScreen';
import ProgramScreen from './screens/ProgramScreen';
import TemplateEditorScreen from './screens/TemplateEditorScreen';
import SettingsScreen from './screens/SettingsScreen';
import LiveWorkoutScreen from './screens/LiveWorkoutScreen';

export default function App() {
  return (
    <BrowserRouter>
      <ErrorBoundary>
        <Routes>
          <Route path="sign-in" element={<SignInScreen />} />
          <Route element={<AuthGuard />}>
            <Route element={<AppLayout />}>
              <Route index element={<TodayScreen />} />
              <Route path="program" element={<ProgramScreen />} />
              <Route path="program/new" element={<TemplateEditorScreen />} />
              <Route path="program/:id" element={<TemplateEditorScreen />} />
              {/* Old routes - kept so bookmarks and a cached PWA shell still land somewhere. */}
              <Route path="templates" element={<Navigate to="/program" replace />} />
              <Route path="templates/*" element={<Navigate to="/program" replace />} />
              <Route path="settings" element={<SettingsScreen />} />
            </Route>
            <Route path="workout" element={<LiveWorkoutScreen />} />
          </Route>
        </Routes>
      </ErrorBoundary>
    </BrowserRouter>
  );
}
