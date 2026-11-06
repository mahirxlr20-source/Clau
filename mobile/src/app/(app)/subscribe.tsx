import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Field, Input } from '../../components/controls';
import { Loading } from '../../components/Loading';
import { Btn, Callout, Card, H1, Lead, MarkerUnderline, Small, t } from '../../components/tabula';
import { useAuth } from '../../context/AuthContext';
import { api, PaymentStatus, Plan } from '../../lib/api';
import { payWithSslCommerz } from '../../lib/payments';
import { fmtDate } from '../../planners/formula';
import { colors, fonts } from '../../theme';

const RESULT_TEXT: Record<PaymentStatus, string> = {
  PAID: 'Payment successful - Premium is on.',
  REVIEW: 'Payment received and under review. Premium switches on once it is approved.',
  PENDING: 'Your payment is still processing. Check back in a minute.',
  FAILED: 'The payment did not go through. You have not been charged.',
  CANCELLED: 'Payment cancelled.',
};

const INCLUDED = [
  ['Money', "the semester bill at your university's rates and every fee date, counting down"],
  ['Semester', 'deadlines, the weekly routine with clash checks, and the semester pages'],
  ['Toolkit', "your department's guides, logs and calculators"],
  ['Paper', 'the Excel tracker, your printed degree map and assignment cover pages'],
];

export default function Subscribe() {
  const { subscription, setSubscription } = useAuth();
  const [plans, setPlans] = useState<Plan[] | null>(null);
  const [selected, setSelected] = useState('monthly');
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
    <ScrollView style={{ backgroundColor: colors.parchment }} contentContainerStyle={{ padding: 16, paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
      <H1>Premium</H1>
      <MarkerUnderline width={110} />
      {subscription.active ? (
        <Callout title="Premium is on">
          <Text style={[t.body, { marginBottom: 0 }]}>
            Until {fmtDate(subscription.currentPeriodEnd?.slice(0, 10))}. Paying again adds the time on top.
          </Text>
        </Callout>
      ) : (
        <Lead>The working tools of every planner. Your Degree map, CGPA and Rules stay free.</Lead>
      )}

      <Card tone="linen">
        {INCLUDED.map(([k, v]) => (
          <Text key={k} style={[t.body, { marginBottom: 6 }]}>
            <Text style={{ fontFamily: fonts.sansBold }}>{k}</Text> - {v}
          </Text>
        ))}
      </Card>

      {plans?.map((plan) => {
        const on = selected === plan.id;
        return (
          <Pressable key={plan.id} onPress={() => setSelected(plan.id)} accessibilityRole="radio" aria-checked={on} style={[s.plan, on && s.planOn]}>
            <View style={{ flex: 1 }}>
              <Text style={s.planName}>{plan.id === 'yearly' ? 'A year' : 'A month'}</Text>
              <Small>{plan.durationDays} days of Premium, paid once</Small>
            </View>
            <Text style={s.price}>Tk {Number(plan.amount).toLocaleString('en-US')}</Text>
          </Pressable>
        );
      })}

      <Card>
        <Field label="Mobile number">
          <Input value={phone} onLive={setPhone} keyboardType="phone-pad" autoComplete="tel" textContentType="telephoneNumber" placeholder="01XXXXXXXXX" />
        </Field>
        <Small style={{ marginBottom: 10 }}>SSLCommerz asks for it for the receipt. Pay by card, bKash, Nagad, Rocket or internet banking on their secure page.</Small>
        {error ? <Text style={[t.small, { color: colors.bad, marginBottom: 8 }]}>{error}</Text> : null}
        {result ? <Text style={[t.body, { fontFamily: fonts.sansSemi, color: result === 'PAID' ? colors.ok : colors.ink }]}>{RESULT_TEXT[result]}</Text> : null}
        <Btn title={subscription.active ? 'Extend Premium' : 'Pay with SSLCommerz'} onPress={pay} loading={busy} disabled={!plans || phone.replace(/\D/g, '').length < 6} />
      </Card>
      <Small>Prepaid: nothing renews on its own, and we never see your card - the payment happens on SSLCommerz&apos;s page.</Small>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  plan: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16, borderRadius: 14, borderWidth: 2, borderColor: colors.rule, backgroundColor: colors.paper, marginBottom: 10 },
  planOn: { borderColor: colors.ink },
  planName: { fontFamily: fonts.serif, fontSize: 18, color: colors.ink },
  price: { fontFamily: fonts.serif, fontSize: 22, color: colors.ink },
});
