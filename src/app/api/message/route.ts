import { NextRequest } from 'next/server';
import { getKindeServerSession } from '@kinde-oss/kinde-auth-nextjs/server';
import { sendMessageValidator } from '@/lib/validators/sendMessageValidator';
import { db } from '@/db';

export const POST = async (req: NextRequest) => {
  const body = await req.json();

  const { getUser } = getKindeServerSession();

  const user = await getUser();

  if (!user?.id) return new Response('Unauthorized', { status: 401 });

  const { fileId, message } = sendMessageValidator.parse(body);

  const file = await db.file.findFirst({
    where: {
      id: fileId,
      userId: user.id,
    },
  });

  if (!file) return new Response('File not found', { status: 404 });
};
