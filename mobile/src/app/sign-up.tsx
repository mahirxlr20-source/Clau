import { Link } from 'expo-router';
import { useState } from 'react';
import { Text, TextInput } from 'react-native';
import { authInput, AuthScreen } from '../components/AuthScreen';
import { Field } from '../components/controls';
import { Btn, t } from '../components/tabula';
import { useAuth } from '../context/AuthContext';
import { colors, fonts } from '../theme';

export default function SignUp() {
  const { signUp } = useAuth();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function submit() {
    setError('');
    if (password.length < 8) return setError('Password must be at least 8 characters');
    setLoading(true);
    try {
      await signUp(name.trim(), email.trim(), password);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not create account');
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthScreen
      title="Real plans, real numbers."
      lead="Make an account and your planner is saved as you go - sign in on any phone and carry on."
      footer={
        <Link href="/sign-in" replace style={{ alignSelf: 'center', marginTop: 4 }}>
          <Text style={{ fontFamily: fonts.sansSemi, color: colors.ink, textDecorationLine: 'underline' }}>Already have an account? Sign in</Text>
        </Link>
      }
    >
      <Field label="Name">
        <TextInput value={name} onChangeText={setName} autoComplete="name" textContentType="name" style={authInput} accessibilityLabel="Name" />
      </Field>
      <Field label="Email">
        <TextInput
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          autoComplete="email"
          keyboardType="email-address"
          textContentType="emailAddress"
          style={authInput}
          accessibilityLabel="Email"
        />
      </Field>
      <Field label="Password">
        <TextInput
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          autoComplete="new-password"
          textContentType="newPassword"
          placeholder="At least 8 characters"
          placeholderTextColor={colors.placeholder}
          onSubmitEditing={submit}
          style={authInput}
          accessibilityLabel="Password"
        />
      </Field>
      {error ? <Text style={[t.small, { color: colors.bad, marginBottom: 8 }]}>{error}</Text> : null}
      <Btn title="Create account" onPress={submit} loading={loading} disabled={!name || !email || !password} />
    </AuthScreen>
  );
}
