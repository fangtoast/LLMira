/**
 * @project LLMira
 * @file apps/api/src/queue.ts
 * @author fangtoast <fangtoast@foxmail.com>
 * @date 2026-08-13
 * @function
 *   - 将知识摄取和 Agent 运行提交到 BullMQ
 *   - 通过稳定 jobId 保证重复请求幂等
 * @description 队列只传递资源 ID，不传递 Provider 密钥或文档正文。
 */
import { Queue } from "bullmq";
import { Redis } from "ioredis";

export interface JobDispatcher {
  enqueueDocument(documentId: string): Promise<void>;
  enqueueRun(runId: string): Promise<void>;
  close(): Promise<void>;
}

/** BullMQ-backed production dispatcher. */
export class BullJobDispatcher implements JobDispatcher {
  private readonly connection: Redis;
  private readonly knowledgeQueue: Queue;
  private readonly agentQueue: Queue;

  constructor(redisUrl: string) {
    this.connection = new Redis(redisUrl, { maxRetriesPerRequest: null });
    this.knowledgeQueue = new Queue("knowledge-ingest", { connection: this.connection });
    this.agentQueue = new Queue("agent-runs", { connection: this.connection });
  }

  async enqueueDocument(documentId: string): Promise<void> {
    await this.knowledgeQueue.add("ingest", { documentId }, { jobId: `document-${documentId}`, attempts: 3, backoff: { type: "exponential", delay: 2_000 }, removeOnComplete: 500, removeOnFail: 1_000 });
  }

  async enqueueRun(runId: string): Promise<void> {
    await this.agentQueue.add("execute", { runId }, { jobId: `run-${runId}`, attempts: 2, backoff: { type: "exponential", delay: 1_000 }, removeOnComplete: 500, removeOnFail: 1_000 });
  }

  async close(): Promise<void> {
    await Promise.all([this.knowledgeQueue.close(), this.agentQueue.close()]);
    this.connection.disconnect();
  }
}

/** 测试或显式无队列场景使用的空实现。 */
export class NoopJobDispatcher implements JobDispatcher {
  async enqueueDocument(): Promise<void> {}
  async enqueueRun(): Promise<void> {}
  async close(): Promise<void> {}
}
