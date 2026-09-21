import assert from "node:assert/strict";
import test from "node:test";

import {
  isAlibabaChatModel,
  resolveAlibabaModelCapabilities,
  TOKEN_PLAN_MODELS,
} from "../src/model-capabilities.js";

// ── Static catalog completeness ──────────────────────────────────────────────

test("static catalog contains exactly 12 models", () => {
  assert.equal(TOKEN_PLAN_MODELS.length, 12);
});

test("every static model resolves to its own capabilities", () => {
  for (const entry of TOKEN_PLAN_MODELS) {
    const resolved = resolveAlibabaModelCapabilities(entry.id);
    assert.deepEqual(resolved, entry.capabilities, `mismatch for ${entry.id}`);
  }
});

// ── Individual model capabilities ────────────────────────────────────────────

test("auto model is non-reasoning conservative router", () => {
  const m = resolveAlibabaModelCapabilities("auto");
  assert.equal(m.reasoning, false);
  assert.deepEqual(m.input, ["text"]);
  assert.equal(m.thinkingLevelMap, undefined);
});

test("qwen3.8-max has three distinct effort levels and vision", () => {
  const m = resolveAlibabaModelCapabilities("qwen3.8-max");
  assert.equal(m.reasoning, true);
  assert.deepEqual(m.input, ["text", "image"]);
  assert.deepEqual(m.thinkingLevelMap, {
    minimal: null,
    low: "low",
    medium: "medium",
    high: null,
    xhigh: "xhigh",
    max: null,
  });
  assert.equal(m.compat.thinkingFormat, "qwen");
  assert.equal(m.compat.supportsReasoningEffort, true);
  assert.equal(m.contextWindow, 1_000_000);
  assert.equal(m.maxTokens, 131_072);
});

test("qwen3.8-flash is toggle-only reasoning with vision", () => {
  const m = resolveAlibabaModelCapabilities("qwen3.8-flash");
  assert.equal(m.reasoning, true);
  assert.deepEqual(m.input, ["text", "image"]);
  assert.equal(m.thinkingLevelMap?.high, "high");
  assert.equal(m.thinkingLevelMap?.low, null);
  assert.equal(m.thinkingLevelMap?.medium, null);
  assert.equal(m.compat.supportsReasoningEffort, false);
  assert.equal(m.contextWindow, 1_000_000);
});

test("qwen3.7-max is toggle-only reasoning text-only", () => {
  const m = resolveAlibabaModelCapabilities("qwen3.7-max");
  assert.equal(m.reasoning, true);
  assert.deepEqual(m.input, ["text"]);
  assert.equal(m.thinkingLevelMap?.high, "high");
  assert.equal(m.compat.supportsReasoningEffort, false);
});

test("qwen3.7-plus has vision input", () => {
  const m = resolveAlibabaModelCapabilities("qwen3.7-plus");
  assert.deepEqual(m.input, ["text", "image"]);
});

test("qwen3.6-flash has vision input", () => {
  const m = resolveAlibabaModelCapabilities("qwen3.6-flash");
  assert.deepEqual(m.input, ["text", "image"]);
});

test("deepseek-v4.1-flash supports off/high/max with vision", () => {
  const m = resolveAlibabaModelCapabilities("deepseek-v4.1-flash");
  assert.equal(m.reasoning, true);
  assert.deepEqual(m.input, ["text", "image"]);
  assert.deepEqual(m.thinkingLevelMap, {
    minimal: null,
    low: null,
    medium: null,
    high: "high",
    xhigh: null,
    max: "max",
  });
  assert.equal(m.compat.supportsReasoningEffort, true);
  assert.equal(m.contextWindow, 1_000_000);
  assert.equal(m.maxTokens, 393_216);
});

test("deepseek-v4-pro supports off/high/max text-only", () => {
  const m = resolveAlibabaModelCapabilities("deepseek-v4-pro");
  assert.equal(m.reasoning, true);
  assert.deepEqual(m.input, ["text"]);
  assert.deepEqual(m.thinkingLevelMap, {
    minimal: null,
    low: null,
    medium: null,
    high: "high",
    xhigh: null,
    max: "max",
  });
  assert.equal(m.compat.supportsReasoningEffort, true);
});

test("deepseek-v4-pro-0813 supports off/low/high/max", () => {
  const m = resolveAlibabaModelCapabilities("deepseek-v4-pro-0813");
  assert.equal(m.thinkingLevelMap?.low, "low");
  assert.equal(m.thinkingLevelMap?.high, "high");
  assert.equal(m.thinkingLevelMap?.max, "max");
  assert.equal(m.thinkingLevelMap?.medium, null);
});

test("deepseek-v4-flash-0731 supports off/low/high/max", () => {
  const m = resolveAlibabaModelCapabilities("deepseek-v4-flash-0731");
  assert.equal(m.thinkingLevelMap?.low, "low");
  assert.equal(m.thinkingLevelMap?.high, "high");
  assert.equal(m.thinkingLevelMap?.max, "max");
});

test("glm-5.3 supports off/high/max", () => {
  const m = resolveAlibabaModelCapabilities("glm-5.3");
  assert.equal(m.reasoning, true);
  assert.deepEqual(m.input, ["text"]);
  assert.deepEqual(m.thinkingLevelMap, {
    minimal: null,
    low: null,
    medium: null,
    high: "high",
    xhigh: null,
    max: "max",
  });
  assert.equal(m.compat.supportsReasoningEffort, true);
  assert.equal(m.contextWindow, 1_000_000);
  assert.equal(m.maxTokens, 131_072);
});

test("glm-5.2 matches same family", () => {
  const m = resolveAlibabaModelCapabilities("glm-5.2");
  assert.equal(m.reasoning, true);
  assert.equal(m.thinkingLevelMap?.high, "high");
  assert.equal(m.thinkingLevelMap?.max, "max");
});

// ── Base compat invariants ──────────────────────────────────────────────────

test("all models use system role, not developer", () => {
  for (const entry of TOKEN_PLAN_MODELS) {
    assert.equal(
      entry.capabilities.compat.supportsDeveloperRole,
      false,
      `${entry.id} should not use developer role`,
    );
    assert.equal(
      entry.capabilities.compat.maxTokensField,
      "max_tokens",
      `${entry.id} should use max_tokens field`,
    );
  }
});

// ── Chat model filter ───────────────────────────────────────────────────────

test("isAlibabaChatModel filters non-chat entries", () => {
  // Chat models
  assert.equal(isAlibabaChatModel("deepseek-v4-pro"), true);
  assert.equal(isAlibabaChatModel("qwen3.8-max"), true);
  assert.equal(isAlibabaChatModel("glm-5.3"), true);
  assert.equal(isAlibabaChatModel("auto"), true);

  // Non-chat (multimodal generation)
  assert.equal(isAlibabaChatModel("qwen-audio-3.0-realtime-plus"), false);
  assert.equal(isAlibabaChatModel("qwen-audio-3.0-tts-plus"), false);
  assert.equal(isAlibabaChatModel("qwen-audio-3.0-asr-flash"), false);
  assert.equal(isAlibabaChatModel("wan2.7-image-pro"), false);
  assert.equal(isAlibabaChatModel("wan2.7-image"), false);
  assert.equal(isAlibabaChatModel("happyhorse-1.1-t2v"), false);
  assert.equal(isAlibabaChatModel("happyhorse-1.1-i2v"), false);
  assert.equal(isAlibabaChatModel("happyhorse-1.1-r2v"), false);

  // Non-chat (embeddings)
  assert.equal(isAlibabaChatModel("text-embedding-v4"), false);
});

// ── Regex-based fallback heuristics ─────────────────────────────────────────

test("unknown qwen3.8 variant resolves via regex fallback", () => {
  const m = resolveAlibabaModelCapabilities("qwen3.8-special");
  assert.equal(m.reasoning, true);
  assert.equal(m.thinkingLevelMap?.high, "high");
  assert.equal(m.compat.supportsReasoningEffort, false);
  assert.equal(m.contextWindow, 1_000_000);
});

test("unknown deepseek-v4.1 variant resolves via regex fallback", () => {
  const m = resolveAlibabaModelCapabilities("deepseek-v4.1-special");
  assert.equal(m.reasoning, true);
  assert.equal(m.thinkingLevelMap?.high, "high");
  assert.equal(m.thinkingLevelMap?.max, "max");
  assert.equal(m.compat.supportsReasoningEffort, true);
});

test("unknown deepseek v3 variant resolves", () => {
  const m = resolveAlibabaModelCapabilities("deepseek-v3.2-special");
  assert.equal(m.reasoning, true);
  assert.equal(m.thinkingLevelMap?.high, "high");
  assert.equal(m.compat.supportsReasoningEffort, false);
  assert.equal(m.contextWindow, 131_072);
});

// ── Conservative fallback ───────────────────────────────────────────────────

test("completely unknown model stays conservative", () => {
  const text = resolveAlibabaModelCapabilities("future-chat-model");
  assert.equal(text.reasoning, false);
  assert.equal(text.thinkingLevelMap, undefined);
  assert.deepEqual(text.input, ["text"]);
  assert.equal(text.contextWindow, 128_000);
  assert.equal(text.maxTokens, 8_192);
  assert.equal(text.compat.supportsDeveloperRole, false);
});

test("unknown model with vision naming gets image input", () => {
  const vision = resolveAlibabaModelCapabilities("future-vl-model");
  assert.deepEqual(vision.input, ["text", "image"]);
});

// ── Always-thinking models ──────────────────────────────────────────────────

test("always-thinking models hide off switch", () => {
  const kimi = resolveAlibabaModelCapabilities("kimi/kimi-k3");
  const r1 = resolveAlibabaModelCapabilities("deepseek-r1");

  assert.equal(kimi.thinkingLevelMap?.off, null);
  assert.equal(kimi.thinkingLevelMap?.max, "max");
  assert.equal(r1.thinkingLevelMap?.off, null);
  assert.equal(r1.thinkingLevelMap?.high, "high");
});

// ── Case insensitivity ──────────────────────────────────────────────────────

test("model id lookup is case-insensitive", () => {
  const lower = resolveAlibabaModelCapabilities("qwen3.8-max");
  const upper = resolveAlibabaModelCapabilities("QWEN3.8-MAX");
  const mixed = resolveAlibabaModelCapabilities("Qwen3.8-Max");

  assert.deepEqual(lower, upper);
  assert.deepEqual(lower, mixed);
});