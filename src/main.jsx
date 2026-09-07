import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

// Catch lazy loading errors globally (e.g., stale chunk on new deployment) and reload the page automatically
window.addEventListener('vite:preloadError', (event) => {
  console.warn('Vite preload error (likely stale chunk). Reloading page...', event);
  window.location.reload();
});

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
