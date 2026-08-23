// Shared promotions catalog — the single source of truth for the Promotions
// list and the promotion detail page. Kept in one place so opening a detail
// page directly by URL (/promotions/:id) still resolves the record.
export const promotions = [
  {
    id: 1,
    name: 'Black Friday Sale',
    code: 'BLACKFRIDAY2023',
    period: 'Nov 20 - Nov 30',
    status: 'active',
    benefit: 'Up to 30% OFF',
    benefitType: 'Percentage',
    description:
      'Annual store-wide clearance sale for Black Friday. Applies to all hardware components and gaming peripherals.',
    used: 245,
    limit: 500,
    banner: 'linear-gradient(135deg, #b3091a 0%, #2b0a0a 100%)',
  },
  {
    id: 2,
    name: 'Intel 14th Gen Launch',
    code: 'INTEL14TH',
    period: 'Oct 15 - Oct 31',
    status: 'active',
    benefit: 'Flat $50 OFF',
    benefitType: 'Fixed Amount',
    description: 'Launch promotion for Intel 14th generation processors.',
    used: 112,
    limit: 200,
    banner: 'linear-gradient(135deg, #0a3a6b 0%, #061b33 100%)',
  },
  {
    id: 3,
    name: 'Student Special',
    code: 'STUDENT10',
    period: 'Permanent',
    status: 'paused',
    benefit: '10% OFF Storewide',
    benefitType: 'Percentage',
    description: 'Permanent discount for verified students, applied storewide.',
    used: 892,
    limit: null,
    banner: 'linear-gradient(135deg, #1f6f5c 0%, #0c2e27 100%)',
  },
  {
    id: 4,
    name: 'NVIDIA Bundle Promo',
    code: 'RTXBUNDLE',
    period: 'Sep 01 - Sep 30',
    status: 'expired',
    benefit: 'Free Game Key',
    benefitType: 'Gift',
    description: 'Free game key bundled with select NVIDIA graphics cards.',
    used: 150,
    limit: 150,
    banner: 'linear-gradient(135deg, #2f7d3a 0%, #0c2913 100%)',
  },
]

export function findPromotion(id) {
  return promotions.find((p) => String(p.id) === String(id)) || null
}
