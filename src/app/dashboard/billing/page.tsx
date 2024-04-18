import BillingForm from '@/components/BillingForm';
import { getUserSubscriptionPlan } from '@/lib/stripe';

const Page = async () => {
  const subscriptionPlan = await getUserSubscriptionPlan();

  console.log('Subscription Plan', subscriptionPlan);

  return <BillingForm subscriptionPlan={subscriptionPlan} />;
};

export default Page;
