import type { SponsorAd } from '../lib/ads'

type Props = {
  ad: SponsorAd
  inline?: boolean
  onDismiss?: () => void
}

export default function AdBanner({ ad, inline, onDismiss }: Props) {
  return (
    <div
      className={`ad-banner${inline ? ' inline' : ''}`}
      role="complementary"
      aria-label="Sponsored"
      onClick={() => window.freebuff.openExternal(ad.url)}
    >
      <span className="ad-badge">Ad</span>
      <div className="ad-body">
        <div className="ad-brand">{ad.brand}</div>
        <div className="ad-text">{ad.text}</div>
      </div>
      {onDismiss && (
        <button
          className="ad-close"
          onClick={(e) => {
            e.stopPropagation()
            onDismiss()
          }}
          aria-label="Dismiss ad"
        >
          ×
        </button>
      )}
    </div>
  )
}
