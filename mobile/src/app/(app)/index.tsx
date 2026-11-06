import { Link, router } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Button, Card, colors, Field, Muted, Screen } from '../../components/ui';
import { SyncBadge } from '../../components/SyncBadge';
import { useAuth } from '../../context/AuthContext';
import { useProgress } from '../../context/ProgressContext';
import { FREE_TASK_LIMIT } from '../../progress/model';

export default function Home() {
  const { user, subscription, signOut } = useAuth();
  const { progress, update, flush } = useProgress();
  const [draft, setDraft] = useState('');
  const [signingOut, setSigningOut] = useState(false);

  const atFreeLimit = !subscription.active && progress.tasks.length >= FREE_TASK_LIMIT;
  const done = progress.tasks.filter((t) => t.done).length;

  function addTask() {
    const title = draft.trim();
    if (!title || atFreeLimit) return;
    update((p) => ({ ...p, tasks: [...p.tasks, { id: `${Date.now()}-${Math.random()}`, title, done: false }] }));
    setDraft('');
  }

  const toggle = (id: string) =>
    update((p) => ({ ...p, tasks: p.tasks.map((t) => (t.id === id ? { ...t, done: !t.done } : t)) }));
  const remove = (id: string) => update((p) => ({ ...p, tasks: p.tasks.filter((t) => t.id !== id) }));

  async function handleSignOut() {
    setSigningOut(true);
    await flush().catch(() => {}); // save before leaving
    await signOut();
  }

  return (
    <Screen>
      <View style={styles.row}>
        <View style={{ flex: 1 }}>
          <Text style={styles.hello}>Hi, {user?.name}</Text>
          <Muted>
            {done}/{progress.tasks.length} done · {subscription.active ? 'Premium' : 'Free plan'}
          </Muted>
        </View>
        <SyncBadge />
      </View>

      <Card>
        <Field
          label="New task"
          value={draft}
          onChangeText={setDraft}
          placeholder={atFreeLimit ? 'Free plan limit reached' : 'What do you need to do?'}
          editable={!atFreeLimit}
          onSubmitEditing={addTask}
          returnKeyType="done"
        />
        <Button title="Add task" onPress={addTask} disabled={!draft.trim() || atFreeLimit} />
        {atFreeLimit && (
          <Muted>
            Free accounts can keep {FREE_TASK_LIMIT} tasks.{' '}
            <Link href="/subscribe" style={{ color: colors.primary, fontWeight: '600' }}>
              Go Premium
            </Link>{' '}
            for unlimited tasks.
          </Muted>
        )}
      </Card>

      <Card>
        {progress.tasks.length === 0 ? (
          <Muted>No tasks yet. Anything you add is saved to your account.</Muted>
        ) : (
          progress.tasks.map((task) => (
            <View key={task.id} style={styles.task}>
              <Pressable
                onPress={() => toggle(task.id)}
                style={styles.taskMain}
                accessibilityRole="checkbox"
                aria-checked={task.done}
              >
                <View style={[styles.check, task.done && styles.checkOn]}>
                  {task.done && <Text style={{ color: '#fff', fontWeight: '700' }}>✓</Text>}
                </View>
                <Text style={[styles.taskText, task.done && styles.taskDone]}>{task.title}</Text>
              </Pressable>
              <Pressable onPress={() => remove(task.id)} hitSlop={10} accessibilityLabel={`Delete ${task.title}`}>
                <Text style={{ color: colors.muted, fontSize: 18 }}>✕</Text>
              </Pressable>
            </View>
          ))
        )}
      </Card>

      <Button title="Open notes" variant="secondary" onPress={() => router.push('/notes')} />
      {!subscription.active ? (
        <Button title="Upgrade to Premium" onPress={() => router.push('/subscribe')} />
      ) : (
        <Button title="Manage Premium" variant="secondary" onPress={() => router.push('/subscribe')} />
      )}
      <Button title="Sign out" variant="danger" onPress={handleSignOut} loading={signingOut} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  hello: { fontSize: 22, fontWeight: '700', color: colors.text },
  task: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  taskMain: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 4 },
  check: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkOn: { backgroundColor: colors.primary },
  taskText: { flex: 1, fontSize: 16, color: colors.text },
  taskDone: { color: colors.muted, textDecorationLine: 'line-through' },
});
