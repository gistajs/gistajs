export type SharedRegion = {
  id: string
  label: string
  vercel: string
}

export const sharedRegions: SharedRegion[] = [
  {
    id: 'aws-us-west-2',
    label: 'Oregon',
    vercel: 'sfo1',
  },
  {
    id: 'aws-us-east-1',
    label: 'Virginia',
    vercel: 'iad1',
  },
  {
    id: 'aws-eu-central-1',
    label: 'Frankfurt',
    vercel: 'fra1',
  },
  {
    id: 'aws-ap-northeast-1',
    label: 'Tokyo',
    vercel: 'hnd1',
  },
  {
    id: 'aws-ap-southeast-1',
    label: 'Singapore',
    vercel: 'sin1',
  },
]

export const defaultSharedRegionId = 'aws-us-west-2'

export function getSharedRegion(id: string) {
  return sharedRegions.find((region) => region.id === id)
}

export function getDefaultSharedRegion() {
  return getSharedRegion(defaultSharedRegionId)!
}

export function parseSharedRegion(value: string) {
  let normalized = value.trim().toLowerCase()

  if (!normalized) return null

  return (
    sharedRegions.find((region) => region.id === normalized) ||
    sharedRegions.find((region) => region.label.toLowerCase() === normalized)
  )
}
