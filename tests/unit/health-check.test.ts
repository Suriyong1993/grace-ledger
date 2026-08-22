import { describe, it, expect } from "vitest";
import { SystemHealthCheckService } from "../../src/lib/observability/health-check";

describe("REAL-21: System Health Check & Observability Probe", () => {
  it("reports overall healthy status when all subsystems respond normally", async () => {
    const mockSupabase = {
      from: (_table: string) => {
        const query: any = {
          select: () => query,
          limit: () => Promise.resolve({ data: [{ id: "1" }], error: null, count: 0 }),
          order: () => query,
          eq: () => query,
        };
        return query;
      },
    } as any;

    const service = new SystemHealthCheckService(mockSupabase);
    const report = await service.getHealthReport();

    expect(report.overall_status).toBe("healthy");
    expect(report.components.database.status).toBe("healthy");
    expect(report.components.action_confirmations.status).toBe("healthy");
    expect(report.components.idempotency_engine.status).toBe("healthy");
    expect(report.components.audit_logs.status).toBe("healthy");
    expect(report.components.ai_boundary.status).toBe("healthy");
    expect(report.components.ai_boundary.details?.execute_privilege).toBe("NONE");
  });

  it("reports unhealthy when database connection is down", async () => {
    const mockSupabase = {
      from: (table: string) => {
        const query: any = {
          select: () => query,
          limit: () => {
            if (table === "funds") {
              return Promise.resolve({ data: null, error: { message: "Connection refused" } });
            }
            return Promise.resolve({ data: [], error: null });
          },
          order: () => query,
          eq: () => query,
        };
        return query;
      },
    } as any;

    const service = new SystemHealthCheckService(mockSupabase);
    const report = await service.getHealthReport();

    expect(report.overall_status).toBe("unhealthy");
    expect(report.components.database.status).toBe("unhealthy");
    expect(report.components.database.message).toContain("Connection refused");
  });
});
