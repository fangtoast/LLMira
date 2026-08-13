/**
 * @project LLMira
 * @file apps/worker/src/index.ts
 * @author fangtoast <fangtoast@foxmail.com>
 * @date 2026-08-13
 * @function
 *   - 启动知识摄取与 Agent BullMQ Worker
 *   - 管理 PostgreSQL、Redis 与优雅关闭
 * @description 队列载荷只包含资源 ID，正文与密钥均从受控存储读取。
 */
import { Queue, Worker } from "bullmq";
import { Redis } from "ioredis";
import { pino } from "pino";
import postgres from "postgres";
import { executeAgentRun } from "./agent.js";
import { ingestDocument } from "./ingest.js";
import { createDueRuns } from "./scheduler.js";

const logger = pino({ level: process.env.LOG_LEVEL ?? "info", redact: ["apiKey", "embeddingApiKey", "ENCRYPTION_MASTER_KEY"] });
const databaseUrl = process.env.DATABASE_URL ?? "postgres://llmira:llmira@localhost:5432/llmira";
const redisUrl = process.env.REDIS_URL ?? "redis://localhost:6379";
const masterKey = process.env.ENCRYPTION_MASTER_KEY ?? "development-only-master-key";
if (process.env.NODE_ENV === "production" && masterKey.startsWith("development-only")) throw new Error("Production requires ENCRYPTION_MASTER_KEY.");

const sql = postgres(databaseUrl, { max: 6, idle_timeout: 20, prepare: false });
const connection = new Redis(redisUrl, { maxRetriesPerRequest: null });
const agentQueue = new Queue("agent-runs", { connection });

const knowledgeWorker = new Worker("knowledge-ingest", async (job) => {
  await ingestDocument(sql, {
    s3Endpoint: process.env.S3_ENDPOINT ?? "http://localhost:9000",
    s3Region: process.env.S3_REGION ?? "us-east-1",
    s3Bucket: process.env.S3_BUCKET ?? "llmira",
    s3AccessKey: process.env.S3_ACCESS_KEY ?? "llmira",
    s3SecretKey: process.env.S3_SECRET_KEY ?? "llmira-development",
    embeddingBaseUrl: process.env.EMBEDDING_API_BASE_URL,
    embeddingApiKey: process.env.EMBEDDING_API_KEY,
    embeddingModel: process.env.EMBEDDING_MODEL ?? "text-embedding-3-small",
  }, String(job.data.documentId));
}, { connection, concurrency: 3 });

const agentWorker = new Worker("agent-runs", async (job) => {
  await executeAgentRun(sql, {
    masterKeyMaterial: masterKey,
    embeddingBaseUrl: process.env.EMBEDDING_API_BASE_URL,
    embeddingApiKey: process.env.EMBEDDING_API_KEY,
    embeddingModel: process.env.EMBEDDING_MODEL ?? "text-embedding-3-small",
    containerRuntime: process.env.MCP_CONTAINER_RUNTIME === "docker" || process.env.MCP_CONTAINER_RUNTIME === "podman" ? process.env.MCP_CONTAINER_RUNTIME : undefined,
  }, String(job.data.runId));
}, { connection, concurrency: 4 });

const pollSchedules = () => createDueRuns(sql)
    .then((runIds) => Promise.all(runIds.map((runId) => agentQueue.add("execute", { runId }, { jobId: `run-${runId}`, attempts: 2, backoff: { type: "exponential", delay: 1_000 } }))))
    .catch((error: Error) => logger.error({ errorCode: error.message.split(":")[0] }, "scheduled task poll failed"));
const schedulerTimer = setInterval(() => { void pollSchedules(); }, 30_000);
void pollSchedules();

knowledgeWorker.on("failed", (job, error) => logger.error({ jobId: job?.id, errorCode: error.message.split(":")[0] }, "knowledge job failed"));
agentWorker.on("failed", (job, error) => logger.error({ jobId: job?.id, errorCode: error.message.split(":")[0] }, "agent job failed"));

const shutdown = async (): Promise<void> => {
  clearInterval(schedulerTimer);
  await Promise.all([knowledgeWorker.close(), agentWorker.close(), agentQueue.close()]);
  connection.disconnect();
  await sql.end({ timeout: 5 });
  process.exit(0);
};

process.once("SIGINT", shutdown);
process.once("SIGTERM", shutdown);
logger.info("LLMira worker started");
