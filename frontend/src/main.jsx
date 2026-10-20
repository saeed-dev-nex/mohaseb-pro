import React from 'react';
import ReactDOM from 'react-dom/client';
import { Provider } from 'react-redux';
import { store } from './store';
import App from './App';
import './index.css';

const CHUNK_RELOAD_KEY = 'mohaseb:stale-chunk-reload-at';
window.addEventListener('vite:preloadError', (event) => {
  event.preventDefault();
  const now = Date.now();
  let previous = 0;
  try { previous = Number(sessionStorage.getItem(CHUNK_RELOAD_KEY)) || 0; } catch { /* Storage may be disabled. */ }
  if (now - previous < 30000) return;
  try { sessionStorage.setItem(CHUNK_RELOAD_KEY, String(now)); } catch { /* A single reload still helps when storage is unavailable. */ }
  window.location.reload();
});
window.addEventListener('load', () => {
  window.setTimeout(() => {
    try { sessionStorage.removeItem(CHUNK_RELOAD_KEY); } catch { /* Storage may be disabled. */ }
  }, 5000);
}, { once: true });

if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/service-worker.js').catch(() => {
      // The app remains usable when the browser cannot register a worker.
    });
  });
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <Provider store={store}>
      <App />
    </Provider>
  </React.StrictMode>
);
