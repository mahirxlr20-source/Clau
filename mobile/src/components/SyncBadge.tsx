import { Text, View } from 'react-native';
import { SyncStatus, useProgress } from '../context/ProgressContext';
import { colors } from './ui';

const LABELS: Record<SyncStatus, [string, string]> = {
  loading: ['Loading…', colors.muted],
  saving: ['Saving…', colors.muted],
  saved: ['Saved', colors.success],
  offline: ['Offline – saved on device', '#b45309'],
  conflict: ['Updated from another device', colors.primary],
};

export function SyncBadge() {
  const { syncStatus } = useProgress();
  const [label, color] = LABELS[syncStatus];
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }} accessibilityLabel={`Sync status: ${label}`}>
      <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: color }} />
      <Text style={{ color, fontSize: 12, fontWeight: '600' }}>{label}</Text>
    </View>
  );
}
