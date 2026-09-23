import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import AdminApp from './admin/AdminApp';
import './index.css';

// Hash-based, not a path (e.g. /admin) - GitHub Pages is static hosting with
// no server-side routing, so a path-based deep link 404s on a hard refresh
// unless a SPA-fallback trick is set up; a hash never even reaches the
// server, so this needs no extra hosting config.
const isAdmin = window.location.hash === '#admin';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>{isAdmin ? <AdminApp /> : <App />}</React.StrictMode>,
);
