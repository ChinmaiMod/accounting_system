import { useCallback, useState } from 'react'

type NoticeType = 'success' | 'error'

export function useNotice() {
  const [message, setMessage] = useState('')
  const [type, setType] = useState<NoticeType>('success')

  const showError = useCallback((nextMessage: string) => {
    setType('error')
    setMessage(nextMessage)
  }, [])

  const showSuccess = useCallback((nextMessage: string) => {
    setType('success')
    setMessage(nextMessage)
  }, [])

  const clearNotice = useCallback(() => {
    setMessage('')
  }, [])

  return {
    message,
    type,
    showError,
    showSuccess,
    clearNotice,
  }
}
