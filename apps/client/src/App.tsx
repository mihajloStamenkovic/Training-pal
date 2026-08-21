import { BrowserRouter, Routes, Route } from 'react-router-dom';
import AppLayout from './components/layout/AppLayout';
import AuthGuard from './components/layout/AuthGuard';
import ErrorBoundary from './components/common/ErrorBoundary';
import SignInScreen from './screens/SignInScreen';
import TodayScreen from './screens/TodayScreen';
import TemplatesListScreen from './screens/TemplatesListScreen';
import TemplateEditorScreen from './screens/TemplateEditorScreen';
import ProgramCycleScreen from './screens/ProgramCycleScreen';
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
              <Route path="templates" element={<TemplatesListScreen />} />
              <Route path="templates/new" element={<TemplateEditorScreen />} />
              <Route path="templates/:id" element={<TemplateEditorScreen />} />
              <Route path="program" element={<ProgramCycleScreen />} />
              <Route path="settings" element={<SettingsScreen />} />
            </Route>
            <Route path="workout" element={<LiveWorkoutScreen />} />
          </Route>
        </Routes>
      </ErrorBoundary>
    </BrowserRouter>
  );
}
