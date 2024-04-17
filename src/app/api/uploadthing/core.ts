import { createUploadthing, type FileRouter } from 'uploadthing/next';
import { UploadThingError } from 'uploadthing/server';
import { getKindeServerSession } from '@kinde-oss/kinde-auth-nextjs/server';
import { db } from '@/db';
import { WebPDFLoader } from 'langchain/document_loaders/web/pdf';

import { Pinecone } from '@pinecone-database/pinecone';
import { OpenAIEmbeddings } from '@langchain/openai';
import { PineconeStore } from '@langchain/pinecone';

const f = createUploadthing();

// FileRouter for your app, can contain multiple FileRoutes
export const ourFileRouter = {
  // Define as many FileRoutes as you like, each with a unique routeSlug
  pdfUploader: f({ pdf: { maxFileSize: '4MB' } })
    // Set permissions and file types for this FileRoute
    .middleware(async ({ req }) => {
      const { getUser } = getKindeServerSession();
      const user = await getUser();

      if (!user || !user.id) {
        throw new UploadThingError('Unauthorized');
      }

      return { userId: user.id };
    })
    .onUploadComplete(async ({ metadata, file }) => {
      // Save file to database

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
    }),
} satisfies FileRouter;

export type OurFileRouter = typeof ourFileRouter;
