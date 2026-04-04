import type { ProvisionRegion } from '../utils/types.js'

export const sharedRegions: ProvisionRegion[] = [
  {
    id: 'aws-ap-northeast-1',
    label: 'Tokyo',
    vercel: 'hnd1',
  },
  {
    id: 'aws-ap-south-1',
    label: 'Mumbai',
    vercel: 'bom1',
  },
  {
    id: 'aws-eu-west-1',
    label: 'Ireland',
    vercel: 'dub1',
  },
  {
    id: 'aws-us-east-1',
    label: 'Virginia',
    vercel: 'iad1',
  },
  {
    id: 'aws-us-east-2',
    label: 'Ohio',
    vercel: 'cle1',
  },
  {
    id: 'aws-us-west-2',
    label: 'Oregon',
    vercel: 'sfo1',
  },
]

export const defaultSharedRegionId = 'aws-us-west-2'

export function getSharedRegion(value: string) {
  let normalized = value.trim().toLowerCase()

  if (!normalized) return null

  return (
    sharedRegions.find((region) => region.id === normalized) ||
    sharedRegions.find((region) => region.label.toLowerCase() === normalized)
  )
}

export function getDefaultSharedRegion() {
  return getSharedRegion(defaultSharedRegionId)!
}

export function parseSharedRegion(value: string) {
  let normalized = value.trim().toLowerCase()

  if (!normalized) return null

  return getSharedRegion(normalized)
}
