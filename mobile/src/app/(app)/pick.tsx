import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SvgXml } from 'react-native-svg';
import { H1, Lead, MarkerUnderline, Pill, Small, Tag } from '../../components/tabula';
import { useOpenPlanner } from '../../context/PlannerContext';
import { useProgress } from '../../context/ProgressContext';
import { CATALOG } from '../../planners/catalog';
import { colors, fonts } from '../../theme';

const UNIS = Array.from(new Map(CATALOG.map((c) => [c.uni, { key: c.uni, name: c.uniName, short: c.uniShort }])).values());

export default function Pick() {
  const { progress } = useProgress();
  const open = useOpenPlanner();
  const activeUni = CATALOG.find((c) => c.id === progress.activePlanner)?.uni;
  const [uni, setUni] = useState(activeUni || UNIS[0].key);
  const list = CATALOG.filter((c) => c.uni === uni);
  const started = (id: string) => {
    const s = progress.planners[id];
    return !!s && (Object.keys(s.courses || {}).length > 0 || !!s.profile?.name || (s.tasks || []).length > 0);
  };

  return (
    <ScrollView style={{ backgroundColor: colors.parchment }} contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
      <H1>Your degree, on one map</H1>
      <MarkerUnderline width={110} />
      <Lead>Pick your university and your department. Each planner is built on that department&apos;s own courses, prerequisites, grading scale and fees.</Lead>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginBottom: 10 }}>
        {UNIS.map((u) => (
          <Pill key={u.key} on={uni === u.key} onPress={() => setUni(u.key)}>
            {u.name}
          </Pill>
        ))}
      </View>
      <View style={s.grid}>
        {list.map((c) => {
          const motif = c.motif;
          const isActive = progress.activePlanner === c.id;
          return (
            <View key={c.id} style={s.cell}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`${c.title}, ${c.uniShort}`}
                onPress={() => {
                  open(c.id);
                  router.dismissTo('/home');
                }}
                style={({ pressed }) => [s.block, { backgroundColor: c.accent }, pressed && { opacity: 0.85 }]}
              >
                {motif ? (
                  <View pointerEvents="none" style={s.motif}>
                    <SvgXml xml={motif} width="100%" height="100%" color="#FFFFFF" />
                  </View>
                ) : null}
                <Text style={s.short}>{c.deptShort}</Text>
                <Text style={s.title} numberOfLines={2}>{c.title}</Text>
              </Pressable>
              <View style={{ flexDirection: 'row', gap: 6, marginTop: 6, minHeight: 20 }}>
                {isActive ? <Tag tone="info">Open now</Tag> : started(c.id) ? <Tag tone="ok">Saved</Tag> : null}
              </View>
            </View>
          );
        })}
      </View>
      <Small style={{ marginTop: 8 }}>
        Independent, unofficial study products. Not produced by, affiliated with or endorsed by the universities named. Always confirm with your Registrar, your advisor and your department.
      </Small>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', marginHorizontal: -6 },
  cell: { width: '50%', paddingHorizontal: 6, marginBottom: 8 },
  block: { borderRadius: 14, padding: 14, minHeight: 116, overflow: 'hidden', justifyContent: 'flex-end' },
  motif: { position: 'absolute', right: -8, bottom: -10, width: '80%', height: '80%', opacity: 0.26 },
  short: { fontFamily: fonts.sansSemi, fontSize: 10.5, letterSpacing: 1.2, textTransform: 'uppercase', color: '#fff', opacity: 0.9, marginBottom: 4 },
  title: { fontFamily: fonts.serif, fontSize: 17, lineHeight: 20, color: '#fff' },
});
