import { NextRequest } from 'next/server';
import { getKindeServerSession } from '@kinde-oss/kinde-auth-nextjs/server';
import { sendMessageValidator } from '@/lib/validators/sendMessageValidator';

export const POST = async (req: NextRequest) => {
  const body = await req.json();

  const { getUser } = getKindeServerSession();

  const user = await getUser();

  if (!user?.id) return new Response('Unauthorized', { status: 401 });

  const {} = sendMessageValidator.parse(body);
};
