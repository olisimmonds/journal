import { useEffect } from 'react'
import { triggerSync } from './triggerSync'

/** Triggers a Drive sync on app load and whenever the device comes back
 *  online, in addition to the per-action sync triggers on mutations. */
export function useBackgroundSync(): void {
  useEffect(() => {
    triggerSync()
    window.addEventListener('online', triggerSync)
    return () => window.removeEventListener('online', triggerSync)
  }, [])
}
