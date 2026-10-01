import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

// Installable app (Android / Add to Home screen). Skipped in dev and in the single-file demo build.
if ('serviceWorker' in navigator && import.meta.env.PROD && import.meta.env.VITE_HASH_ROUTER !== '1') {
  window.addEventListener('load', () => { navigator.serviceWorker.register('/sw.js').catch(() => { /* not critical */ }) })
}
