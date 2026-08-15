import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import { installHostBridge } from './shared/federation/hostBridge'

import './shared/styles/theme.css'
import './shared/styles/reset.css'
import './shared/styles/typography.css'
import './shared/styles/global.css'

// Must run before any remote app can possibly load (see hostBridge.ts for the full contract).
installHostBridge()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
