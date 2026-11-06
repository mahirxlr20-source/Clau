import { Text, View } from 'react-native';
import { SyncStatus, useProgress } from '../context/ProgressContext';
import { colors, fonts } from '../theme';

const LABELS: Record<SyncStatus, [string, string]> = {
  loading: ['Loading…', colors.clay],
  saving: ['Saving…', colors.clay],
  saved: ['Saved to your account', colors.ok],
  offline: ['Offline - kept on this phone', colors.warnText],
  conflict: ['Updated from another device', colors.infoText],
};

export function SyncBadge() {
  const { syncStatus } = useProgress();
  const [label, color] = LABELS[syncStatus];
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }} accessibilityLabel={`Sync status: ${label}`}>
      <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: color }} />
      <Text style={{ color, fontSize: 11.5, fontFamily: fonts.sansSemi }}>{label}</Text>
    </View>
  );
}
