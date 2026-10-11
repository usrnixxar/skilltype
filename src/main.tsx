import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';
const AdminPage = React.lazy(() => import('./admin/AdminPage'));
import { CompetitionProvider } from './context/CompetitionContext';

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    {window.location.pathname.replace(/\/$/, '') === '/admin'
      ? <React.Suspense fallback={<div style={{ padding: 32 }}>Loading Admin…</div>}><AdminPage /></React.Suspense>
      : <CompetitionProvider><App /></CompetitionProvider>}
  </React.StrictMode>
);
