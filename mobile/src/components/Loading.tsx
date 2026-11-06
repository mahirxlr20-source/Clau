import { ActivityIndicator, View } from 'react-native';
import { colors } from '../theme';

export function Loading() {
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.parchment }}>
      <ActivityIndicator size="large" color={colors.ink} />
    </View>
  );
}
