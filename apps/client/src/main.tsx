import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { ClerkProvider } from '@clerk/clerk-react';
import './styles/theme.css';
import App from './App';
import QueryProvider from './lib/QueryProvider';
import AuthTokenBridge from './lib/AuthTokenBridge';

const CLERK_PUBLISHABLE_KEY = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;
if (!CLERK_PUBLISHABLE_KEY) {
  throw new Error('Missing VITE_CLERK_PUBLISHABLE_KEY environment variable');
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ClerkProvider publishableKey={CLERK_PUBLISHABLE_KEY}>
      <AuthTokenBridge />
      <QueryProvider>
        <App />
      </QueryProvider>
    </ClerkProvider>
  </StrictMode>,
);
