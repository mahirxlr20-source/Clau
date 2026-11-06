import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ScrollView, Text } from 'react-native';
import { Loading } from '../../components/Loading';
import { Btn, Card, H1, MarkerUnderline, Small, t } from '../../components/tabula';
import { useAuth } from '../../context/AuthContext';
import { PaymentStatus } from '../../lib/api';
import { waitForPayment } from '../../lib/payments';
import { colors } from '../../theme';

// Opened by the deep link tabula://payment-result?tranId=... when the OS hands the
// payment redirect to the app directly instead of to the in-app browser session.
const TEXT: Record<PaymentStatus, [string, string]> = {
  PAID: ['Payment successful', 'Premium is on for your account.'],
  REVIEW: ['Payment under review', 'Premium switches on once the payment is approved.'],
  PENDING: ['Still processing', 'We are confirming your payment. Check again in a minute.'],
  FAILED: ['Payment failed', 'Nothing was charged and Premium was not switched on.'],
  CANCELLED: ['Payment cancelled', 'Nothing was charged.'],
};

export default function PaymentResult() {
  const { tranId } = useLocalSearchParams<{ tranId?: string }>();
  const { setSubscription } = useAuth();
  const [status, setStatus] = useState<PaymentStatus | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!tranId) return setError('Missing payment reference');
    waitForPayment(tranId)
      .then(({ payment, subscription }) => {
        setSubscription(subscription);
        setStatus(payment.status);
      })
      .catch((err) => setError(err.message));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tranId]);

  if (!status && !error) return <Loading />;
  const [title, body] = status ? TEXT[status] : ['Something went wrong', error];

  return (
    <ScrollView style={{ backgroundColor: colors.parchment }} contentContainerStyle={{ padding: 16 }}>
      <H1>{title}</H1>
      <MarkerUnderline width={110} />
      <Card>
        <Text style={[t.body, { color: status === 'PAID' ? colors.ok : colors.ink }]}>{body}</Text>
        {tranId ? <Small>Reference: {tranId}</Small> : null}
      </Card>
      <Btn title="Back to my planner" onPress={() => router.replace('/')} />
    </ScrollView>
  );
}
