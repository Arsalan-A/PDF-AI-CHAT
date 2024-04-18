import { createUploadthing, type FileRouter } from 'uploadthing/next';
import { UploadThingError } from 'uploadthing/server';
import { getKindeServerSession } from '@kinde-oss/kinde-auth-nextjs/server';
import { db } from '@/db';
import { WebPDFLoader } from 'langchain/document_loaders/web/pdf';

import { Pinecone } from '@pinecone-database/pinecone';
import { OpenAIEmbeddings } from '@langchain/openai';
import { PineconeStore } from '@langchain/pinecone';
import { getUserSubscriptionPlan } from '@/lib/stripe';
import { PLANS } from '@/config/stripe';

const f = createUploadthing();

const middleware = async () => {
  const { getUser } = getKindeServerSession();
  const user = await getUser();

  if (!user || !user.id) {
    throw new UploadThingError('Unauthorized');
  }

  const subscriptionPlan = await getUserSubscriptionPlan();

  return { subscriptionPlan, userId: user.id };
};

const onUploadComplete = async ({
  metadata,
  file,
}: {
  metadata: Awaited<ReturnType<typeof middleware>>;
  file: { key: string; name: string; url?: string };
}) => {
  // Save file to database

  const isFileExists = await db.file.findFirst({
    where: { key: file.key },
  });

  if (isFileExists) {
    return;
  }

  const fileUrl =
    file.url ||
    `https://uploadthing-prod.s3.us-west-2.amazonaws.com/${file.key}`;

  const createdFile = await db.file.create({
    data: {
      key: file.key,
      userId: metadata.userId,
      name: file.name,
      url: fileUrl,
      uploadStatus: 'PROCESSING',
    },
  });

  try {
    const response = await fetch(fileUrl);

    const blob = await response.blob();

    const loader = new WebPDFLoader(blob);

    const pageLevelDocs = await loader.load();

    const pageAmt = pageLevelDocs.length;

    const { subscriptionPlan } = metadata;
    const { isSubscribed } = subscriptionPlan;

    const isProExceeded =
      pageAmt > PLANS.find((plan) => plan.name === 'Pro')!.pagesPerPdf;
    const isFreeExceeded =
      pageAmt > PLANS.find((plan) => plan.name === 'Free')!.pagesPerPdf;

    if ((isSubscribed && isProExceeded) || (!isSubscribed && isFreeExceeded)) {
      await db.file.update({
        data: { uploadStatus: 'FAILED' },
        where: { id: createdFile.id },
      });
    }

    const pinecone = new Pinecone();

    const pineconeIndex = pinecone.Index(process.env.PINECONE_INDEX!);

    const embeddings = new OpenAIEmbeddings({
      openAIApiKey: process.env.OPENAI_API_KEY,
    });

    await PineconeStore.fromDocuments(pageLevelDocs, embeddings, {
      pineconeIndex,
      namespace: createdFile.id,
    });

    await db.file.update({
      data: { uploadStatus: 'SUCCESS' },
      where: { id: createdFile.id },
    });
  } catch (err) {
    console.error('ERROR', err);
    await db.file.update({
      data: { uploadStatus: 'FAILED' },
      where: { id: createdFile.id },
    });
  }
};

// FileRouter for your app, can contain multiple FileRoutes
export const ourFileRouter = {
  // Define as many FileRoutes as you like, each with a unique routeSlug
  freePlanUploader: f({ pdf: { maxFileSize: '4MB' } })
    // Set permissions and file types for this FileRoute
    .middleware(middleware)
    .onUploadComplete(onUploadComplete),
  proPlanUploader: f({ pdf: { maxFileSize: '16MB' } })
    // Set permissions and file types for this FileRoute
    .middleware(middleware)
    .onUploadComplete(onUploadComplete),
} satisfies FileRouter;

export type OurFileRouter = typeof ourFileRouter;
