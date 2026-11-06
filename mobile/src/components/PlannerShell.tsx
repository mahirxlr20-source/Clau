import { router } from 'expo-router';
import type { BottomTabBarProps } from 'expo-router/js-tabs';
import { ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../context/AuthContext';
import { usePlanner } from '../context/PlannerContext';
import { isPremiumTab } from '../lib/premium';
import { colors, fonts } from '../theme';
import { SyncBadge } from './SyncBadge';
import { Btn, Callout, H1, Lockup, MarkerUnderline, Small, Sticker, TabIcon, useAccent } from './tabula';

export const TABS: [string, string][] = [
  ['home', 'Home'],
  ['degree', 'Degree'],
  ['cgpa', 'CGPA'],
  ['money', 'Money'],
  ['semester', 'Semester'],
  ['toolkit', 'Toolkit'],
  ['rules', 'Rules'],
  ['more', 'More'],
];

export function PlannerHeader({ tab }: { tab: string }) {
  const { D, entry } = usePlanner();
  const insets = useSafeAreaInsets();
  const label = TABS.find((x) => x[0] === tab)?.[1] ?? '';
  return (
    <View style={[s.top, { paddingTop: insets.top + 8 }]}>
      <Lockup height={24} />
      <Pressable
        style={{ flex: 1, minWidth: 0 }}
        accessibilityRole="button"
        accessibilityLabel={`${D.product.title}, ${entry.uniShort} edition. Switch planner`}
        onPress={() => router.push('/pick')}
      >
        <Text style={s.name} numberOfLines={1}>{D.product.title}</Text>
        <Text style={s.sub} numberOfLines={1}>
          {entry.uniShort} edition · {label} ▾
        </Text>
      </Pressable>
      <Sticker size={42} />
    </View>
  );
}

export function PlannerTabBar({ state, navigateToTab, insets }: BottomTabBarProps) {
  const { accent, tint } = useAccent();
  return (
    <View style={[s.nav, { paddingBottom: Math.max(insets.bottom, 4) }]} accessibilityRole="tablist">
      {state.routes.map((route, i) => {
        const on = state.index === i;
        const label = TABS.find((x) => x[0] === route.name)?.[1] ?? route.name;
        return (
          <Pressable
            key={route.key}
            accessibilityRole="tab"
            aria-selected={on}
            accessibilityLabel={label}
            onPress={() => navigateToTab(route.key)}
            style={[s.navItem, on && { backgroundColor: tint }]}
          >
            <TabIcon name={route.name} color={on ? accent : colors.clay} />
            <Text style={[s.navT, { color: on ? accent : colors.clay }]} numberOfLines={1}>{label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

/** The scrolling page every tab sits in. Premium tabs show the paywall to free accounts. */
export function TabPage({ tab, children }: { tab: string; children: ReactNode }) {
  const { subscription } = useAuth();
  const locked = isPremiumTab(tab) && !subscription.active;
  return (
    <View testID={`tab-${tab}`} style={{ flex: 1, backgroundColor: colors.parchment }}>
      <PlannerHeader tab={tab} />
      <ScrollView contentContainerStyle={s.main} keyboardShouldPersistTaps="handled">
        <View style={{ alignSelf: 'flex-end', marginBottom: 4 }}>
          <SyncBadge />
        </View>
        {locked ? <Paywall tab={tab} /> : children}
      </ScrollView>
    </View>
  );
}

const PAYWALL: Record<string, [string, string]> = {
  money: ['Money', "The semester bill at your university's own rates, the whole-degree estimate, and every date that costs money with a countdown."],
  semester: ['This semester', 'Deadlines and tasks with countdowns, your weekly routine with clash checks, and the semester pages - one set per semester.'],
  toolkit: ['The toolkit', "Your department's guides plus the tracker's logs and calculators - counts, countdowns and flags that update as you type."],
};

export function Paywall({ tab }: { tab: string }) {
  const [title, body] = PAYWALL[tab] ?? ['Premium', ''];
  return (
    <View>
      <H1>{title}</H1>
      <MarkerUnderline width={110} />
      <Callout title="Part of Premium" tone="gold">
        <Text style={s.body}>{body}</Text>
      </Callout>
      <Small>Your Degree map, CGPA and Rules stay free. Premium is prepaid - Tk 199 a month or Tk 1,999 a year - and never renews on its own.</Small>
      <View style={{ marginTop: 14, alignItems: 'flex-start' }}>
        <Btn variant="gold" title="See Premium" onPress={() => router.push('/subscribe')} />
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  top: { backgroundColor: colors.parchment, borderBottomWidth: 1, borderBottomColor: colors.rule, paddingHorizontal: 16, paddingBottom: 8, flexDirection: 'row', alignItems: 'center', gap: 10 },
  name: { fontFamily: fonts.serif, fontSize: 15, lineHeight: 18, color: colors.ink },
  sub: { fontFamily: fonts.sans, fontSize: 11.5, color: colors.clay },
  main: { padding: 16, paddingTop: 8, paddingBottom: 40 },
  nav: { flexDirection: 'row', backgroundColor: colors.paper, borderTopWidth: 1, borderTopColor: colors.rule, paddingTop: 4, paddingHorizontal: 4 },
  navItem: { flex: 1, alignItems: 'center', gap: 2, paddingTop: 5, paddingBottom: 3, borderRadius: 10 },
  navT: { fontFamily: fonts.sansSemi, fontSize: 10, letterSpacing: -0.1 },
  body: { fontFamily: fonts.sans, fontSize: 15, lineHeight: 21, color: colors.ink },
});
