import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Button, Card, colors, ErrorText, Field, Loading, Muted, Screen, Title } from '../../components/ui';
import { useAuth } from '../../context/AuthContext';
import { api, PaymentStatus, Plan } from '../../lib/api';
import { payWithSslCommerz } from '../../lib/payments';

const RESULT_TEXT: Record<PaymentStatus, string> = {
  PAID: 'Payment successful. Premium is active!',
  REVIEW: 'Payment received and under review. Premium activates once it is approved.',
  PENDING: 'Your payment is still processing. Check back in a minute.',
  FAILED: 'The payment failed. You have not been charged.',
  CANCELLED: 'Payment cancelled.',
};

function formatDate(iso: string | null) {
  return iso ? new Date(iso).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' }) : '';
}

export default function Subscribe() {
  const { subscription, setSubscription } = useAuth();
  const [plans, setPlans] = useState<Plan[] | null>(null);
  const [selected, setSelected] = useState<string>('monthly');
  const [phone, setPhone] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<PaymentStatus | null>(null);

  useEffect(() => {
    api
      .plans()
      .then(({ plans }) => setPlans(plans))
      .catch((err) => setError(err.message));
  }, []);

  async function pay() {
    setError('');
    setResult(null);
    setBusy(true);
    try {
      const { payment, subscription: next } = await payWithSslCommerz(selected, phone);
      setSubscription(next);
      setResult(payment.status);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Payment could not be started');
    } finally {
      setBusy(false);
    }
  }

  if (!plans && !error) return <Loading />;

  return (
    <Screen>
      <Title>Premium</Title>
      {subscription.active ? (
        <Card>
          <Text style={styles.active}>Premium is active</Text>
          <Muted>
            Your access runs until {formatDate(subscription.currentPeriodEnd)}. Paying again adds time on top of
            that.
          </Muted>
        </Card>
      ) : (
        <Muted>Unlimited tasks and support future features. Pay securely with card, mobile banking or internet banking via SSLCommerz.</Muted>
      )}

      {plans?.map((plan) => (
        <Pressable
          key={plan.id}
          onPress={() => setSelected(plan.id)}
          accessibilityRole="radio"
          aria-checked={selected === plan.id}
          style={[styles.plan, selected === plan.id && styles.planOn]}
        >
          <View style={{ flex: 1 }}>
            <Text style={styles.planName}>{plan.name}</Text>
            <Muted>{plan.durationDays} days of Premium</Muted>
          </View>
          <Text style={styles.price}>
            ৳{Number(plan.amount).toLocaleString()} <Text style={styles.currency}>{plan.currency}</Text>
          </Text>
        </Pressable>
      ))}

      <Card>
        <Field
          label="Mobile number"
          value={phone}
          onChangeText={setPhone}
          keyboardType="phone-pad"
          autoComplete="tel"
          textContentType="telephoneNumber"
          placeholder="01XXXXXXXXX"
        />
        <Muted>Required by the payment gateway for the receipt.</Muted>
        <ErrorText>{error}</ErrorText>
        {result && (
          <Text style={{ color: result === 'PAID' ? colors.success : colors.text, fontWeight: '600' }}>
            {RESULT_TEXT[result]}
          </Text>
        )}
        <Button
          title={subscription.active ? 'Extend Premium' : 'Pay with SSLCommerz'}
          onPress={pay}
          loading={busy}
          disabled={!plans || phone.replace(/\D/g, '').length < 6}
        />
      </Card>
      <Muted>
        Plans are prepaid and do not renew automatically. We'll never store your card details: payment happens on
        SSLCommerz's secure page.
      </Muted>
    </Screen>
  );
}

const styles = StyleSheet.create({
  active: { fontSize: 18, fontWeight: '700', color: colors.success },
  plan: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 16,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: colors.border,
    backgroundColor: colors.card,
  },
  planOn: { borderColor: colors.primary },
  planName: { fontSize: 17, fontWeight: '700', color: colors.text },
  price: { fontSize: 20, fontWeight: '700', color: colors.text },
  currency: { fontSize: 12, color: colors.muted },
});
