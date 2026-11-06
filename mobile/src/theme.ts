// Tabula brand tokens (Tabula Brand Guide v1.0): paper, ink and one bright thing.
// Department colours come from each planner; Parchment/Ink/Marigold are fixed.

export const colors = {
  ink: '#2B2520',
  clay: '#7A6E62',
  linen: '#EFE8DA',
  rule: '#D8CFBF',
  parchment: '#F7F2E8',
  paper: '#FFFFFF',
  gold: '#F2A900', // Marigold: the tab, the sticker, one underline, one pill. Never carries white text.
  terra: '#B5503A', // dated or conditional things
  terraBg: '#FAE9DC',
  goldBg: '#FBEFCB',
  ok: '#4D7C0F',
  okBg: '#E6EFD8',
  warnText: '#7A4B00',
  warnBg: '#FBEFCB',
  badText: '#8A2A1A',
  bad: '#B91C1C',
  badBg: '#FAE9DC',
  infoText: '#3F4A5C',
  infoBg: '#E8ECF1',
  zebra: '#FBF8F1',
  editBg: '#FFFDF7',
  placeholder: '#B3A898',
  campus: '#1F3A93', // Tabula Campus series colour
};

/** Font family names as registered in the root layout. */
export const fonts = {
  display: 'FrauncesDisplay', // Fraunces 144 pt cut, 700: cover names and openers
  serif: 'Fraunces', // Fraunces 72 pt cut, 700: section titles, headings, numbers
  serifItalic: 'Fraunces-Italic', // 400 italic: leads and series lines
  serifText: 'FrauncesText', // Fraunces 9 pt cut, 700: subheadings, callout titles
  hand: 'Caveat', // stickers and one-word notes only
  sans: 'Inter', // body, tables, labels
  sansSemi: 'Inter-SemiBold',
  sansBold: 'Inter-Bold',
};

export const radius = { card: 14, block: 18, field: 10, pill: 999 };

export type Tone = 'ok' | 'warn' | 'bad' | 'info' | 'soft';
export const toneColors: Record<Tone, { bg: string; fg: string }> = {
  ok: { bg: colors.okBg, fg: colors.ok },
  warn: { bg: colors.warnBg, fg: colors.warnText },
  bad: { bg: colors.badBg, fg: colors.badText },
  info: { bg: colors.infoBg, fg: colors.infoText },
  soft: { bg: colors.linen, fg: colors.clay },
};

/** The default accent when no planner is open: Tabula Campus. */
export const DEFAULT_ACCENT = { accent: colors.campus, tint: '#E3E8F6' };
