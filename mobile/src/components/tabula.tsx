// Tabula UI kit: the Campus planner's components (cards, KPIs, tags, callouts, the
// hand-drawn check box, the marker underline, the sticker) for React Native.
import { createContext, ReactNode, useContext, useState } from 'react';
import { ActivityIndicator, Pressable, StyleProp, StyleSheet, Text, TextStyle, View, ViewStyle } from 'react-native';
import { SvgXml } from 'react-native-svg';
import ART from '../planners/art.json';
import { colors, DEFAULT_ACCENT, fonts, radius, Tone, toneColors } from '../theme';

// ---------------------------------------------------------------- accent (department colour)
type Accent = { accent: string; tint: string };
const AccentContext = createContext<Accent>(DEFAULT_ACCENT);
export const AccentProvider = AccentContext.Provider;
export const useAccent = () => useContext(AccentContext);

// ---------------------------------------------------------------- inline markup: **bold** and *italic*
export function Inline({ text, style }: { text: string; style?: StyleProp<TextStyle> }) {
  const parts: ReactNode[] = [];
  const re = /\*\*(.+?)\*\*|\*(.+?)\*/g;
  let last = 0;
  let m: RegExpExecArray | null;
  const s = String(text ?? '');
  while ((m = re.exec(s))) {
    if (m.index > last) parts.push(s.slice(last, m.index));
    parts.push(
      m[1] != null ? (
        <Text key={m.index} style={{ fontFamily: fonts.sansBold }}>{m[1]}</Text>
      ) : (
        <Text key={m.index} style={{ fontStyle: 'italic' }}>{m[2]}</Text>
      ),
    );
    last = m.index + m[0].length;
  }
  if (last < s.length) parts.push(s.slice(last));
  return <Text style={style}>{parts}</Text>;
}

// ---------------------------------------------------------------- type
export function H1({ children, style }: { children: ReactNode; style?: StyleProp<TextStyle> }) {
  return <Text accessibilityRole="header" style={[t.h1, style]}>{children}</Text>;
}
export function H2({ children, style }: { children: ReactNode; style?: StyleProp<TextStyle> }) {
  const { accent } = useAccent();
  return <Text accessibilityRole="header" style={[t.h2, { color: accent }, style]}>{children}</Text>;
}
export function H3({ children, style }: { children: ReactNode; style?: StyleProp<TextStyle> }) {
  return <Text accessibilityRole="header" style={[t.h3, style]}>{children}</Text>;
}
export const Lead = ({ children, style }: { children: ReactNode; style?: StyleProp<TextStyle> }) => <Text style={[t.lead, style]}>{children}</Text>;
export const Body = ({ children, style }: { children: ReactNode; style?: StyleProp<TextStyle> }) => <Text style={[t.body, style]}>{children}</Text>;
export const Small = ({ children, style }: { children: ReactNode; style?: StyleProp<TextStyle> }) => <Text style={[t.small, style]}>{children}</Text>;
export const Label = ({ children, style }: { children: ReactNode; style?: StyleProp<TextStyle> }) => <Text style={[t.label, style]}>{children}</Text>;
export const Empty = ({ children }: { children: ReactNode }) => <Text style={[t.small, { fontStyle: 'italic', paddingVertical: 6 }]}>{children}</Text>;

// ---------------------------------------------------------------- surfaces
export function Card({ children, tone, style }: { children: ReactNode; tone?: 'linen' | 'tint'; style?: StyleProp<ViewStyle> }) {
  const { tint } = useAccent();
  return (
    <View
      style={[
        s.card,
        tone === 'linen' && { backgroundColor: colors.linen, borderColor: 'transparent' },
        tone === 'tint' && { backgroundColor: tint, borderColor: 'transparent' },
        style,
      ]}
    >
      {children}
    </View>
  );
}

export function Grid({ children, cols = 2, gap = 10 }: { children: ReactNode; cols?: number; gap?: number }) {
  const items = (Array.isArray(children) ? children : [children]).flat().filter(Boolean) as ReactNode[];
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginHorizontal: -gap / 2, marginBottom: 4 }}>
      {items.map((c, i) => (
        <View key={i} style={{ width: `${100 / cols}%`, paddingHorizontal: gap / 2, marginBottom: gap }}>
          {c}
        </View>
      ))}
    </View>
  );
}

export function Row({ children, style, gap = 10 }: { children: ReactNode; style?: StyleProp<ViewStyle>; gap?: number }) {
  return <View style={[{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap }, style]}>{children}</View>;
}

export function Kpi({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <View style={s.kpi}>
      <Label>{label}</Label>
      <Text style={s.kpiV} numberOfLines={1} adjustsFontSizeToFit>{value}</Text>
      {sub ? <Small>{sub}</Small> : null}
    </View>
  );
}

export function Meter({ pct }: { pct: number }) {
  const { accent } = useAccent();
  return (
    <View style={s.meter} accessibilityRole="progressbar" accessibilityValue={{ min: 0, max: 100, now: Math.round(pct * 100) }}>
      <View style={{ width: `${Math.round(Math.max(0, Math.min(1, pct)) * 100)}%`, height: '100%', backgroundColor: accent, borderRadius: 99 }} />
    </View>
  );
}

export function Tag({ children, tone = 'soft' }: { children: ReactNode; tone?: Tone }) {
  const c = toneColors[tone] || toneColors.soft;
  return (
    <View style={[s.tag, { backgroundColor: c.bg }]}>
      <Text style={[s.tagT, { color: c.fg }]}>{children}</Text>
    </View>
  );
}

export function Pill({ children, on, gold, onPress }: { children: ReactNode; on?: boolean; gold?: boolean; onPress?: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole={onPress ? 'button' : undefined}
      aria-selected={on}
      style={[s.pill, on && { backgroundColor: colors.ink, borderColor: colors.ink }, gold && { backgroundColor: colors.gold, borderColor: colors.gold }]}
    >
      <Text style={[s.pillT, on && { color: '#fff' }]}>{children}</Text>
    </Pressable>
  );
}

export function Callout({ title, children, tone }: { title?: string; children?: ReactNode; tone?: 'warn' | 'gold' | 'info' }) {
  const { accent, tint } = useAccent();
  const edge = tone === 'warn' ? colors.terra : tone === 'gold' ? colors.gold : accent;
  const bg = tone === 'warn' ? colors.terraBg : tone === 'gold' ? colors.goldBg : tint;
  return (
    <View style={[s.callout, { borderLeftColor: edge, backgroundColor: bg }]}>
      {title ? <Text style={[t.h3, { marginTop: 0, marginBottom: 4, fontSize: 15, color: tone === 'warn' ? '#7A2E1D' : colors.ink }]}>{title}</Text> : null}
      {children}
    </View>
  );
}

type BtnProps = { title: string; onPress(): void; variant?: 'primary' | 'secondary' | 'gold' | 'ghost'; small?: boolean; loading?: boolean; disabled?: boolean };
export function Btn({ title, onPress, variant = 'primary', small, loading, disabled }: BtnProps) {
  const { accent } = useAccent();
  const fg = variant === 'primary' ? '#fff' : variant === 'ghost' ? accent : colors.ink;
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      disabled={disabled || loading}
      style={({ pressed }) => [
        s.btn,
        small && s.btnSmall,
        variant === 'primary' && { backgroundColor: colors.ink },
        variant === 'secondary' && { backgroundColor: colors.paper, borderWidth: 1.5, borderColor: colors.ink },
        variant === 'gold' && { backgroundColor: colors.gold },
        variant === 'ghost' && { backgroundColor: 'transparent', paddingHorizontal: 8 },
        (disabled || loading) && { opacity: 0.5 },
        pressed && { opacity: 0.75 },
      ]}
    >
      {loading ? <ActivityIndicator color={fg} size="small" /> : <Text style={[s.btnT, small && { fontSize: 13 }, { color: fg }]}>{title}</Text>}
    </Pressable>
  );
}
export const Btns = ({ children }: { children: ReactNode }) => <View style={s.btns}>{children}</View>;

// ---------------------------------------------------------------- hand-drawn pieces
const BOX =
  '<svg viewBox="0 0 24 24"><path d="M4.2 3.6 Q12 2.8 20.4 3.9 Q21.2 12 20.1 20.3 Q12 21.4 3.7 20.2 Q2.9 12 4.2 3.6 Z" fill="none" stroke="#7A6E62" stroke-width="1.7" stroke-linejoin="round"/></svg>';
const TICK =
  '<svg viewBox="0 0 24 24"><path d="M4.2 3.6 Q12 2.8 20.4 3.9 Q21.2 12 20.1 20.3 Q12 21.4 3.7 20.2 Q2.9 12 4.2 3.6 Z" fill="none" stroke="#7A6E62" stroke-width="1.7" stroke-linejoin="round"/><path d="M6.5 12.5 Q9.5 14.5 10.8 17 Q13.5 10.5 19 6.2" fill="none" stroke="#2B2520" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round"/></svg>';

export function CheckBox({ checked, onPress, label, size = 22 }: { checked: boolean; onPress(): void; label?: string; size?: number }) {
  return (
    <Pressable onPress={onPress} hitSlop={8} accessibilityRole="checkbox" aria-checked={checked} accessibilityLabel={label}>
      <SvgXml xml={checked ? TICK : BOX} width={size} height={size} />
    </Pressable>
  );
}

/** The Marigold marker underline: two strokes, under the product name only. */
export function MarkerUnderline({ width = 120 }: { width?: number }) {
  const xml = `<svg viewBox="0 0 120 14" preserveAspectRatio="none"><path d="${ART.ul[0]}" fill="none" stroke="#F2A900" stroke-width="3.2" stroke-linecap="round"/><path d="${ART.ul[1]}" fill="none" stroke="#F2A900" stroke-width="2.2" stroke-linecap="round" opacity=".7"/></svg>`;
  return <SvgXml xml={xml} width={width} height={12} style={{ marginTop: 4, marginBottom: 10 }} />;
}

const STICKER = ART.sticker.replace(/font-family="Inter TT"/g, `font-family="${fonts.sansSemi}"`);
export const Sticker = ({ size = 44 }: { size?: number }) => <SvgXml xml={STICKER} width={size} height={size} />;

/** The horizontal lockup: mark + wordmark. reversed = white tablet on a dark ground. */
export function Lockup({ height = 26, reversed }: { height?: number; reversed?: boolean }) {
  const xml = reversed ? ART.lockup.replace(/#2B2520/g, '#FFFFFF') : ART.lockup;
  return <SvgXml xml={xml} height={height} width={(height * 332.8) / 100} />;
}
const MARK = ART.lockup.replace(/viewBox="[^"]*"/, 'viewBox="14 8 84 84"').replace(/<g transform[\s\S]*<\/svg>$/, '</svg>');
export const Mark = ({ size = 32 }: { size?: number }) => <SvgXml xml={MARK} width={size} height={size} />;

export const TabIcon = ({ name, color, size = 22 }: { name: string; color: string; size?: number }) => {
  const xml = (ART.icons as Record<string, string>)[name];
  return xml ? <SvgXml xml={xml} width={size} height={size} color={color} /> : null;
};

/** A countdown: "5d", "today", "3d ago" in ok / warn / bad colours. */
export function DaysLeft({ d, done, late = 'ago' }: { d: number | null; done?: boolean; late?: string }) {
  if (d == null) return null;
  const tone = done ? colors.ok : d < 0 ? colors.bad : d <= 7 ? colors.warnText : colors.ok;
  return <Text style={{ fontFamily: fonts.serif, fontSize: 15, color: tone }}>{done ? 'done' : d < 0 ? `${Math.abs(d)}d ${late}` : d === 0 ? 'today' : `${d}d`}</Text>;
}

// ---------------------------------------------------------------- the cover block (hero)
export function Hero({ kicker, title, sub, motif }: { kicker: string; title: string; sub?: string; motif?: string }) {
  const { accent } = useAccent();
  return (
    <View style={[s.hero, { backgroundColor: accent }]}>
      {motif ? (
        <View pointerEvents="none" style={s.motif}>
          <SvgXml xml={motif} width="100%" height="100%" color="#FFFFFF" />
        </View>
      ) : null}
      <Text style={s.heroK}>{kicker}</Text>
      <Text style={s.heroT}>{title}</Text>
      <MarkerUnderline width={120} />
      {sub ? <Text style={s.heroSub}>{sub}</Text> : null}
    </View>
  );
}

// ---------------------------------------------------------------- collapsible section
export function Details({ title, children, initiallyOpen, sub }: { title: string; children: () => ReactNode; initiallyOpen?: boolean; sub?: boolean }) {
  const [open, setOpen] = useState(!!initiallyOpen);
  return (
    <View style={[sub ? s.detailsSub : s.details]}>
      <Pressable onPress={() => setOpen(!open)} accessibilityRole="button" aria-expanded={open} style={s.summary}>
        <Inline text={title} style={[sub ? t.h3 : s.summaryT, { flex: 1, marginTop: 0, marginBottom: 0 }]} />
        <Text style={s.chev}>{open ? '–' : '+'}</Text>
      </Pressable>
      {open ? <View style={{ paddingTop: 4 }}>{children()}</View> : null}
    </View>
  );
}

// ---------------------------------------------------------------- styles
export const t = StyleSheet.create({
  h1: { fontFamily: fonts.display, fontSize: 28, lineHeight: 31, color: colors.ink, letterSpacing: -0.3, marginBottom: 8 },
  h2: { fontFamily: fonts.serif, fontSize: 21, lineHeight: 25, marginTop: 22, marginBottom: 8, letterSpacing: -0.2 },
  h3: { fontFamily: fonts.serifText, fontSize: 16, lineHeight: 20, color: colors.ink, marginTop: 14, marginBottom: 6 },
  lead: { fontFamily: fonts.serif, fontSize: 17, lineHeight: 24, color: colors.ink, marginBottom: 14 },
  body: { fontFamily: fonts.sans, fontSize: 15, lineHeight: 21.5, color: colors.ink, marginBottom: 8 },
  small: { fontFamily: fonts.sans, fontSize: 12.5, lineHeight: 18, color: colors.clay },
  label: { fontFamily: fonts.sansSemi, fontSize: 11.5, color: colors.clay, textTransform: 'uppercase', letterSpacing: 0.9 },
});

const s = StyleSheet.create({
  card: { backgroundColor: colors.paper, borderWidth: 1, borderColor: colors.rule, borderRadius: radius.card, padding: 14, marginBottom: 14 },
  kpi: { backgroundColor: colors.paper, borderWidth: 1, borderColor: colors.rule, borderRadius: radius.card, paddingVertical: 10, paddingHorizontal: 12, minHeight: 74 },
  kpiV: { fontFamily: fonts.serif, fontSize: 26, lineHeight: 31, color: colors.ink },
  meter: { height: 8, backgroundColor: colors.linen, borderRadius: 99, overflow: 'hidden', marginTop: 8, marginBottom: 4 },
  tag: { borderRadius: 99, paddingHorizontal: 8, paddingVertical: 2, alignSelf: 'flex-start' },
  tagT: { fontFamily: fonts.sansSemi, fontSize: 11.5 },
  pill: { borderRadius: 99, borderWidth: 1, borderColor: colors.ink, paddingHorizontal: 11, paddingVertical: 4, backgroundColor: colors.paper, marginRight: 6, marginBottom: 6 },
  pillT: { fontFamily: fonts.sansSemi, fontSize: 12.5, color: colors.ink },
  callout: { borderLeftWidth: 5, paddingVertical: 10, paddingHorizontal: 12, borderTopRightRadius: 10, borderBottomRightRadius: 10, marginTop: 6, marginBottom: 14 },
  btn: { borderRadius: 999, paddingVertical: 10, paddingHorizontal: 16, alignItems: 'center', justifyContent: 'center', minHeight: 42 },
  btnSmall: { paddingVertical: 7, paddingHorizontal: 12, minHeight: 34 },
  btnT: { fontFamily: fonts.sansSemi, fontSize: 14 },
  btns: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginVertical: 10 },
  hero: { borderRadius: radius.block, paddingTop: 22, paddingHorizontal: 20, paddingBottom: 20, marginBottom: 18, overflow: 'hidden' },
  motif: { position: 'absolute', right: -10, bottom: -14, width: '56%', height: '70%', opacity: 0.26 },
  heroK: { fontFamily: fonts.sansSemi, fontSize: 10.5, letterSpacing: 1.4, textTransform: 'uppercase', color: '#fff', opacity: 0.9, marginBottom: 10 },
  heroT: { fontFamily: fonts.display, fontSize: 30, lineHeight: 33, color: '#fff', maxWidth: '78%', letterSpacing: -0.4 },
  heroSub: { fontFamily: fonts.serifItalic, fontSize: 15, lineHeight: 21, color: '#fff', opacity: 0.95, maxWidth: '85%' },
  details: { backgroundColor: colors.paper, borderWidth: 1, borderColor: colors.rule, borderRadius: radius.card, paddingHorizontal: 14, paddingVertical: 4, marginBottom: 12 },
  detailsSub: { borderTopWidth: 1, borderTopColor: colors.linen, paddingVertical: 2, marginVertical: 4 },
  summary: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10 },
  summaryT: { fontFamily: fonts.serif, fontSize: 16, lineHeight: 21, color: colors.ink },
  chev: { fontFamily: fonts.sansSemi, fontSize: 20, color: colors.clay, width: 18, textAlign: 'center' },
});
