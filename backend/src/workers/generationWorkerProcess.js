import { Worker } from "bullmq";
import { GENERATION_QUEUE_NAME } from "../jobs/generationQueue.js";
import { runGenerationJob } from "../jobs/generationWorker.js";

const connection = {
  url: process.env.REDIS_URL || "redis://127.0.0.1:6379",
};

export const generationWorkerProcess = new Worker(
  GENERATION_QUEUE_NAME,
  async (bullJob) => {
    const data = bullJob.data || {};
    await runGenerationJob(data.job_id, data.request_body);
    return { ok: true };
  },
  {
    connection,
    concurrency: 2,
  },
);

generationWorkerProcess.on("completed", (job) => {
  console.log("Generation worker completed:", job.id);
});

generationWorkerProcess.on("failed", (job, err) => {
  console.error("Generation worker failed:", job?.id, err);
});
