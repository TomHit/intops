import { Queue, QueueEvents } from "bullmq";

export const GENERATION_QUEUE_NAME = "generation-queue";

const connection = {
  url: process.env.REDIS_URL || "redis://127.0.0.1:6379",
};

export const generationQueue = new Queue(GENERATION_QUEUE_NAME, {
  connection,
  defaultJobOptions: {
    removeOnComplete: 100,
    removeOnFail: 100,
    attempts: 1,
  },
});

export const generationQueueEvents = new QueueEvents(GENERATION_QUEUE_NAME, {
  connection,
});

await generationQueueEvents.waitUntilReady();

export async function enqueueGenerationJob(data) {
  const bullJob = await generationQueue.add("generate", data, {
    jobId: data.job_id,
  });

  return bullJob;
}
