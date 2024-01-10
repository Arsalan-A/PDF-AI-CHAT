import { getKindeServerSession } from '@kinde-oss/kinde-auth-nextjs/server';

const page = async () => {
  const { getUser } = getKindeServerSession();

  const user = await getUser();
  return <div>{user?.email ?? 'email not found'}</div>;
};

export default page;
