/**
 * Wire-format tests: verify that the Alibaba OpenAI-compatible provider
 * sends the correct request shape for different reasoning configurations.
 *
 * The critical invariants:
 *   - All requests use "system" role, never "developer".
 *   - enable_thinking is a top-level boolean.
 *   - reasoning_effort is present only when thinking is enabled AND the
 *     model declares supportsReasoningEffort.
 *   - max_tokens (not max_completion_tokens) is used.
 *   - store field is absent.
 */

import assert from "node:assert/strict";
import test from "node:test";

import {
  openAICompletionsApi,
  type Context,
  type Model,
  type SimpleStreamOptions,
} from "@earendil-works/pi-ai/compat";

import { resolveAlibabaModelCapabilities } from "../src/model-capabilities.js";

type RequestPayload = Record<string, unknown>;

const BASE_URL = "https://example.invalid/compatible-mode/v1";

function modelFor(id: string): Model<"openai-completions"> {
  return {
    id,
    name: id,
    api: "openai-completions",
    provider: "alibaba-token-cn",
    baseUrl: BASE_URL,
    ...resolveAlibabaModelCapabilities(id),
    cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
  };
}

const context: Context = {
  systemPrompt: "Reply in one sentence.",
  messages: [{ role: "user", content: "Hello", timestamp: 1 }],
};

const sse = [
  'data: {"id":"chatcmpl-test","object":"chat.completion.chunk","created":1,"model":"test","choices":[{"index":0,"delta":{"role":"assistant","content":"ok"},"finish_reason":null}]}',
  "",
  'data: {"id":"chatcmpl-test","object":"chat.completion.chunk","created":1,"model":"test","choices":[{"index":0,"delta":{},"finish_reason":"stop"}]}',
  "",
  "data: [DONE]",
  "",
].join("\n");

async function capturePayload(
  id: string,
  options: Pick<SimpleStreamOptions, "reasoning">,
): Promise<RequestPayload> {
  let payload: RequestPayload | undefined;
  const fetch: typeof globalThis.fetch = async (_input, init) => {
    payload = JSON.parse(String(init?.body)) as RequestPayload;
    return new Response(sse, {
      status: 200,
      headers: { "content-type": "text/event-stream" },
    });
  };

  const stream = openAICompletionsApi().streamSimple(modelFor(id), context, {
    ...options,
    apiKey: "test-key",
    fetch,
    maxRetries: 0,
  });
  for await (const event of stream) {
    if (event.type === "error") {
      throw new Error(event.error.errorMessage);
    }
  }

  assert.ok(payload, `no payload captured for ${id}`);
  return payload;
}

// ── Core wire invariants ────────────────────────────────────────────────────

test("uses system role, never developer", async () => {
  const payload = await capturePayload("qwen3.8-max", {
    reasoning: "medium",
  });
  const messages = payload.messages as Array<{ role: string }>;
  assert.equal(messages[0]?.role, "system");
});

test("uses max_tokens, never max_completion_tokens", async () => {
  const payload = await capturePayload("deepseek-v4-pro", {
    reasoning: "high",
  });
  assert.equal(typeof payload.max_tokens, "number");
  assert.equal("max_completion_tokens" in payload, false);
});

test("never sends store field", async () => {
  const payload = await capturePayload("qwen3.8-max", {});
  assert.equal("store" in payload, false);
});

// ── Reasoning: off (default) ────────────────────────────────────────────────

test("off disables thinking and omits reasoning_effort", async () => {
  const payload = await capturePayload("deepseek-v4-pro", {});

  assert.equal(payload.enable_thinking, false);
  assert.equal("reasoning_effort" in payload, false);
});

test("off disables thinking for toggle-only models", async () => {
  const payload = await capturePayload("qwen3.7-plus", {});

  assert.equal(payload.enable_thinking, false);
  assert.equal("reasoning_effort" in payload, false);
});

// ── Reasoning: enabled with effort scale ────────────────────────────────────

test("high effort sends enable_thinking + reasoning_effort", async () => {
  const payload = await capturePayload("deepseek-v4-pro", {
    reasoning: "high",
  });

  assert.equal(payload.enable_thinking, true);
  assert.equal(payload.reasoning_effort, "high");
});

test("max effort sends enable_thinking + reasoning_effort", async () => {
  const payload = await capturePayload("deepseek-v4-pro", {
    reasoning: "max",
  });

  assert.equal(payload.enable_thinking, true);
  assert.equal(payload.reasoning_effort, "max");
});

test("qwen3.8-max medium effort maps correctly", async () => {
  const payload = await capturePayload("qwen3.8-max", {
    reasoning: "medium",
  });

  assert.equal(payload.enable_thinking, true);
  assert.equal(payload.reasoning_effort, "medium");
});

test("qwen3.8-max xhigh effort maps correctly", async () => {
  const payload = await capturePayload("qwen3.8-max", {
    reasoning: "xhigh",
  });

  assert.equal(payload.enable_thinking, true);
  assert.equal(payload.reasoning_effort, "xhigh");
});

// ── Reasoning: toggle-only models (no effort scale) ─────────────────────────

test("toggle-only model sends enable_thinking without reasoning_effort", async () => {
  const payload = await capturePayload("qwen3.7-max", {
    reasoning: "high",
  });

  assert.equal(payload.enable_thinking, true);
  // Toggle-only models have supportsReasoningEffort=false, so no effort field
  assert.equal("reasoning_effort" in payload, false);
});

test("qwen3.8-flash toggle sends enable_thinking only", async () => {
  const payload = await capturePayload("qwen3.8-flash", {
    reasoning: "high",
  });

  assert.equal(payload.enable_thinking, true);
  assert.equal("reasoning_effort" in payload, false);
});

// ── Reasoning: GLM-5 models ────────────────────────────────────────────────

test("glm-5.3 high effort sends enable_thinking + reasoning_effort", async () => {
  const payload = await capturePayload("glm-5.3", {
    reasoning: "high",
  });

  assert.equal(payload.enable_thinking, true);
  assert.equal(payload.reasoning_effort, "high");
});

test("glm-5.3 max effort sends enable_thinking + reasoning_effort", async () => {
  const payload = await capturePayload("glm-5.3", {
    reasoning: "max",
  });

  assert.equal(payload.enable_thinking, true);
  assert.equal(payload.reasoning_effort, "max");
});

// ── Reasoning: DeepSeek V4.1 ───────────────────────────────────────────────

test("deepseek-v4.1-flash high effort with vision model", async () => {
  const payload = await capturePayload("deepseek-v4.1-flash", {
    reasoning: "high",
  });

  assert.equal(payload.enable_thinking, true);
  assert.equal(payload.reasoning_effort, "high");
});

// ── Reasoning: dated DeepSeek V4 with low effort ────────────────────────────

test("deepseek-v4-pro-0813 low effort", async () => {
  const payload = await capturePayload("deepseek-v4-pro-0813", {
    reasoning: "low",
  });

  assert.equal(payload.enable_thinking, true);
  assert.equal(payload.reasoning_effort, "low");
});