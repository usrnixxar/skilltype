import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';
import { CompetitionProvider } from './context/CompetitionContext';

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <CompetitionProvider><App /></CompetitionProvider>
  </React.StrictMode>
);
