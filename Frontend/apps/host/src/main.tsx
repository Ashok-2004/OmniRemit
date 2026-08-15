import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClientProvider } from '@tanstack/react-query'
import App from './App'
import { installHostBridge } from './shared/federation/hostBridge'
import { createQueryClient } from './shared/query/queryClient'
import { registerSessionCleanup } from './features/auth/store/authStore'

import './shared/styles/theme.css'
import './shared/styles/reset.css'
import './shared/styles/typography.css'
import './shared/styles/global.css'

// Must run before any remote app can possibly load (see hostBridge.ts for the full contract).
installHostBridge()

const queryClient = createQueryClient()

// Cached server data belongs to the signed-in user. Clearing it on logout stops the next user from
// briefly seeing the previous user's records rendered from cache before their own load.
registerSessionCleanup(() => queryClient.clear())

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  </StrictMode>,
)
