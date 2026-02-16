const { describe, it } = require("node:test");
const assert = require("node:assert");
const request = require("supertest");
const path = require("path");

require("dotenv").config({ path: path.resolve(__dirname, "../../../.env") });
require("dotenv").config({ path: path.resolve(__dirname, "../../.env") });

const app = require("../app");

describe("Health endpoint", () => {
  it("GET /health returns 200 and status ok", async () => {
    const res = await request(app).get("/health");
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body?.status, "ok");
    assert.strictEqual(res.body?.service, "meeps-backend");
  });
});
