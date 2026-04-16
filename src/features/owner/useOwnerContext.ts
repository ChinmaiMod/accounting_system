import { useOutletContext } from 'react-router-dom'
import type { OwnerContextValue } from './OwnerShell'

export function useOwnerContext() {
  return useOutletContext<OwnerContextValue>()
}
