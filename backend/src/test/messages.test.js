const { describe, it } = require("node:test");
const assert = require("node:assert");
const request = require("supertest");
const path = require("path");

require("dotenv").config({ path: path.resolve(__dirname, "../../../.env") });
require("dotenv").config({ path: path.resolve(__dirname, "../../.env") });

const app = require("../app");

describe("Messages API", () => {
  it("GET /api/messages?channel=general returns 200 and channel + messages array", async () => {
    const res = await request(app).get("/api/messages").query({ channel: "general" });
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body?.channel, "general");
    assert(Array.isArray(res.body?.messages), "messages should be an array");
  });

  it("GET /api/messages defaults to general when channel omitted", async () => {
    const res = await request(app).get("/api/messages");
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body?.channel, "general");
  });
});
