/**
 * @project LLMira
 * @file apps/api/src/postgres.integration.test.ts
 * @author fangtoast <fangtoast@foxmail.com>
 * @date 2026-08-13
 * @description 在临时 pgvector 实例中验证迁移、RLS 用户上下文与租户隔离。
 */
import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { PostgresTeamStore } from "./store/postgres.js";

const databaseUrl = process.env.TEST_DATABASE_URL;
const integration = databaseUrl ? describe : describe.skip;

integration("PostgreSQL RLS integration", () => {
  it("allows a member workspace and hides it from another principal", async () => {
    const store = new PostgresTeamStore(databaseUrl!);
    try {
      const result = await store.bootstrap({
        organizationName: "LLMira 集成测试",
        displayName: "管理员",
        email: "integration@example.com",
        passwordHash: "not-used-in-store-test",
      });
      const visible = await store.runAsUser(result.principal.userId, async () =>
        store.listWorkspaces(result.principal.userId),
      );
      const outsiderId = randomUUID();
      const hidden = await store.runAsUser(outsiderId, async () =>
        store.listWorkspaces(outsiderId),
      );
      expect(visible).toHaveLength(1);
      expect(hidden).toHaveLength(0);
    } finally {
      await store.close();
    }
  });
});
