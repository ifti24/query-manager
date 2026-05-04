import { createRoot } from 'react-dom/client';
import { Analytics } from '@vercel/analytics/react';
import { AuthProvider } from './contexts/AuthContext';
import App from './App.tsx';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <AuthProvider>
    <App />
    <Analytics />
  </AuthProvider>
);
