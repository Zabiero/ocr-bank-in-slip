import React, { Suspense, lazy } from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';

// Lazy-loaded, not a static import: the admin bundle pulls in jsPDF (and its
// own hefty dependencies, html2canvas/purify) for PDF export, plus xlsx -
// weight a cashier scanning slips should never have to download just to open
// the app. Code-splitting this means that cost is only paid by whoever
// actually opens #admin.
const AdminApp = lazy(() => import('./admin/AdminApp'));

// Hash-based, not a path (e.g. /admin) - GitHub Pages is static hosting with
// no server-side routing, so a path-based deep link 404s on a hard refresh
// unless a SPA-fallback trick is set up; a hash never even reaches the
// server, so this needs no extra hosting config.
const isAdmin = window.location.hash === '#admin';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    {isAdmin ? (
      <Suspense fallback={<p className="py-24 text-center text-sm text-slate-500">Loading…</p>}>
        <AdminApp />
      </Suspense>
    ) : (
      <App />
    )}
  </React.StrictMode>,
);
