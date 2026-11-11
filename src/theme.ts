/** Rename the product here (shown in onboarding and the Profile screen). */
export const APP_NAME = 'LiftRank';
export const APP_TAGLINE = 'TRACK. PROGRESS. RANK.';

export const colors = {
  bg: '#0A0A0B',
  card: '#141416',
  cardAlt: '#1D1D20',
  border: '#2A2A2F',
  text: '#FFFFFF',
  textDim: '#9A9AA3',
  accent: '#C6F432', // lime
  accentDim: '#2B3A08',
  onAccent: '#0A0A0B',
  danger: '#FF6B6B',
};

export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24 };
export const radius = { sm: 10, md: 14, lg: 20 };

export const fmtDate = (ts: number) =>
  new Date(ts).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });

export const fmtDuration = (ms: number) => {
  const m = Math.round(ms / 60000);
  if (m < 60) return `${m} min`;
  return `${Math.floor(m / 60)}h ${m % 60}m`;
};
