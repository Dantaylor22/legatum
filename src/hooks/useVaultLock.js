// Detects if the vault encryption key has been lost
// (e.g. after inactivity timeout) and prompts re-authentication

import { useState, useEffect } from 'react'
import { hasSessionKey } from '../lib/crypto'
import { useAuth } from '../context/AuthContext'

export function useVaultLock() {
  const { user } = useAuth()
  const [isLocked, setIsLocked] = useState(false)

  useEffect(() => {
    if (!user) { setIsLocked(false); return }

    // Check immediately
    setIsLocked(!hasSessionKey())

    // Poll every 10 seconds to detect inactivity lock
    const interval = setInterval(() => {
      setIsLocked(!hasSessionKey())
    }, 10_000)

    return () => clearInterval(interval)
  }, [user])

  return { isLocked }
}
