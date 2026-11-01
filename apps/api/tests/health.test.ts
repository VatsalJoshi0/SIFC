import { describe, it, expect } from "vitest";
import request from "supertest";
import { createApp } from "../src/server.js";

describe("Health & Readiness Endpoints", () => {
  const app = createApp();

  it("GET /healthz returns 200 with status ok and request id", async () => {
    const res = await request(app).get("/healthz");
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("ok");
    expect(res.body.timestamp).toBeDefined();
    expect(res.headers["x-request-id"]).toBeDefined();
  });

  it("GET /readyz returns 200 with status ready", async () => {
    const res = await request(app).get("/readyz");
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("ready");
    expect(res.body.timestamp).toBeDefined();
  });

  it("GET / returns prototype banner and API info", async () => {
    const res = await request(app).get("/");
    expect(res.status).toBe(200);
    expect(res.body.banner).toContain("Prototype - simulated OTP - do not enter a real PAN");
  });
});
