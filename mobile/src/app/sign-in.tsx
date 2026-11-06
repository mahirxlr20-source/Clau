import { Link } from 'expo-router';
import { useState } from 'react';
import { Text, TextInput } from 'react-native';
import { authInput, AuthScreen } from '../components/AuthScreen';
import { Field } from '../components/controls';
import { Btn, t } from '../components/tabula';
import { useAuth } from '../context/AuthContext';
import { colors, fonts } from '../theme';

export default function SignIn() {
  const { signIn } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function submit() {
    setError('');
    setLoading(true);
    try {
      await signIn(email.trim(), password);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not sign in');
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthScreen
      title="Welcome back"
      lead="Sign in to pick up where you left off."
      footer={
        <Link href="/sign-up" replace style={{ alignSelf: 'center', marginTop: 4 }}>
          <Text style={{ fontFamily: fonts.sansSemi, color: colors.ink, textDecorationLine: 'underline' }}>New here? Create an account</Text>
        </Link>
      }
    >
      <Field label="Email">
        <TextInput
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          autoComplete="email"
          keyboardType="email-address"
          textContentType="emailAddress"
          style={authInput}
          placeholderTextColor={colors.placeholder}
          accessibilityLabel="Email"
        />
      </Field>
      <Field label="Password">
        <TextInput
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          autoComplete="current-password"
          textContentType="password"
          onSubmitEditing={submit}
          style={authInput}
          accessibilityLabel="Password"
        />
      </Field>
      {error ? <Text style={[t.small, { color: colors.bad, marginBottom: 8 }]}>{error}</Text> : null}
      <Btn title="Sign in" onPress={submit} loading={loading} disabled={!email || !password} />
    </AuthScreen>
  );
}
