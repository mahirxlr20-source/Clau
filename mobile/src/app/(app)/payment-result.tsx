import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Text } from 'react-native';
import { Button, Card, colors, Loading, Muted, Screen, Title } from '../../components/ui';
import { useAuth } from '../../context/AuthContext';
import { PaymentStatus } from '../../lib/api';
import { waitForPayment } from '../../lib/payments';

// Opened by the deep link clau://payment-result?tranId=... when the OS hands the
// payment redirect to the app directly instead of to the in-app browser session.
const TEXT: Record<PaymentStatus, [string, string]> = {
  PAID: ['Payment successful', 'Premium is now active on your account.'],
  REVIEW: ['Payment under review', 'Premium will activate once the payment is approved.'],
  PENDING: ['Still processing', 'We are confirming your payment. Check again in a minute.'],
  FAILED: ['Payment failed', 'No subscription was activated.'],
  CANCELLED: ['Payment cancelled', 'No subscription was activated.'],
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
    <Screen>
      <Card>
        <Title>{title}</Title>
        <Text style={{ color: status === 'PAID' ? colors.success : colors.text }}>{body}</Text>
        {tranId && <Muted>Reference: {tranId}</Muted>}
      </Card>
      <Button title="Continue" onPress={() => router.replace('/')} />
    </Screen>
  );
}
