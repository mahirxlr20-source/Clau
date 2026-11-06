// Subscription plans. SSLCommerz's standard API has no automatic recurring debit,
// so each plan is a prepaid period: paying again extends the current period.
export const PLANS = [
  { id: 'monthly', name: 'Premium Monthly', amount: '199.00', currency: 'BDT', durationDays: 30 },
  { id: 'yearly', name: 'Premium Yearly', amount: '1999.00', currency: 'BDT', durationDays: 365 },
];

export const findPlan = (id) => PLANS.find((p) => p.id === id);
