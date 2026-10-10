'use client'

import { useEffect, useState } from 'react'

export function useValidationAttempted() {
  const [attempted, setAttempted] = useState(false)
  useEffect(() => {
    const show = () => setAttempted(true)
    window.addEventListener('tiny-validation-attempted', show)
    return () => window.removeEventListener('tiny-validation-attempted', show)
  }, [])
  return attempted
}
