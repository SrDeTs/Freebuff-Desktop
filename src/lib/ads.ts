/** Rotating fallback sponsor ads when Freebuff CLI hasn't emitted one yet.
 *  These match Freebuff's model: small text-only dev-tool ads between turns.
 */
export type SponsorAd = {
  id: string
  brand: string
  text: string
  url: string
}

export const FALLBACK_ADS: SponsorAd[] = [
  {
    id: 'carbon-1',
    brand: 'MongoDB Atlas',
    text: 'Ship faster with a free cloud database — MongoDB Atlas free forever tier',
    url: 'https://www.mongodb.com/cloud/atlas',
  },
  {
    id: 'carbon-2',
    brand: 'Vercel',
    text: 'Deploy frontend + serverless in seconds. Free hobby plan on Vercel',
    url: 'https://vercel.com',
  },
  {
    id: 'carbon-3',
    brand: 'Railway',
    text: 'Infrastructure that deploys itself. $5 free credit every month on Railway',
    url: 'https://railway.app',
  },
  {
    id: 'carbon-4',
    brand: 'Neon',
    text: 'Serverless Postgres with branching. Free plan available on Neon',
    url: 'https://neon.tech',
  },
  {
    id: 'carbon-5',
    brand: 'Cloudflare',
    text: 'Workers, R2, D1 — build on the edge free with Cloudflare',
    url: 'https://workers.cloudflare.com',
  },
]

export function pickFallbackAd(seed = Date.now()): SponsorAd {
  return FALLBACK_ADS[seed % FALLBACK_ADS.length]
}
