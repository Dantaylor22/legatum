// Detects if the vault encryption key has been lost
// (e.g. after inactivity timeout) and prompts re-authentication

import { useState, useEffect, useCallback } from 'react'
import { hasSessionKey } from '../lib/crypto'
import { useAuth } from '../context/AuthContext'

export function useVaultLock() {
  const { user } = useAuth()
  const [isLocked, setIsLocked] = useState(false)

  const checkLock = useCallback(() => {
    setIsLocked(!hasSessionKey())
  }, [])

  useEffect(() => {
    if (!user) { setIsLocked(false); return }

    // Check immediately
    checkLock()

    // Poll every 2 seconds to detect inactivity lock
    const interval = setInterval(checkLock, 2_000)

    return () => clearInterval(interval)
  }, [user, checkLock])

  return { isLocked, checkLock }
}
