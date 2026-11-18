import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '@/index.css'
import { applyDocumentLocale } from '@/lib/i18n'
import 'streamdown/styles.css'
import App from './App.tsx'
import './index.css'

applyDocumentLocale()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
