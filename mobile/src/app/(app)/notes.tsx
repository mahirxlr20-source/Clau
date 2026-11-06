import { TextInput } from 'react-native';
import { Card, colors, Muted, Screen } from '../../components/ui';
import { SyncBadge } from '../../components/SyncBadge';
import { useProgress } from '../../context/ProgressContext';

export default function Notes() {
  const { progress, update } = useProgress();
  return (
    <Screen>
      <SyncBadge />
      <Card>
        <TextInput
          multiline
          value={progress.notes}
          onChangeText={(notes) => update((p) => ({ ...p, notes }))}
          placeholder="Write anything. It's saved to your account as you type."
          placeholderTextColor={colors.muted}
          style={{ minHeight: 240, fontSize: 16, color: colors.text, textAlignVertical: 'top' }}
        />
      </Card>
      <Muted>Sign out and back in, or log in on another phone: you'll come back to this screen with your notes.</Muted>
    </Screen>
  );
}
