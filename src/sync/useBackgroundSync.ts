import { useEffect } from 'react'
import { initProactiveDriveRefresh } from './googleAuth'
import { triggerSync } from './triggerSync'

/** Triggers a Drive sync on app load and whenever the device comes back
 *  online, in addition to the per-action sync triggers on mutations. Also
 *  arms the proactive token keep-alive so long-open sessions and tabs woken
 *  from sleep don't hit an interactive re-auth mid-use. */
export function useBackgroundSync(): void {
  useEffect(() => {
    initProactiveDriveRefresh()
    triggerSync()
    window.addEventListener('online', triggerSync)
    return () => window.removeEventListener('online', triggerSync)
  }, [])
}
