type NoticeBannerProps = {
  message: string
  type: 'success' | 'error'
}

export function NoticeBanner({ message, type }: NoticeBannerProps) {
  if (!message) return null
  return <p className={`toast ${type}`}>{message}</p>
}
