/**
 * Member palette (§5.4a) — muted, editorial tones that stay distinguishable
 * on light and dark map tiles without reading as toy colors. One per member,
 * 12-member cap.
 */
export const MEMBER_PALETTE = [
  '#5B8DEF', // cobalt
  '#E0885A', // terracotta
  '#D06A9C', // rose
  '#4CAF83', // sage
  '#8B7CF6', // violet
  '#D9A13B', // amber
  '#3FA8A8', // teal
  '#D95757', // brick
  '#7080E0', // indigo
  '#A08363', // taupe
  '#52B48C', // mint
  '#8A94A6', // slate
] as const;

export const UI = {
  bg: '#0B0D12',
  card: 'rgba(255,255,255,0.05)',
  cardAlt: 'rgba(255,255,255,0.08)',
  border: 'rgba(255,255,255,0.09)',
  text: '#F5F6F8',
  textDim: '#8A94A6',
  accent: '#5B8DEF',
  danger: '#D95757',
  success: '#4CAF83',
  /** solid near-black for on-map chips where blur isn't available */
  chip: 'rgba(13,15,21,0.88)',
} as const;
