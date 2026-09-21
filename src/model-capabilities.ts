/**
 * Model capabilities for Alibaba Cloud Token Plan.
 *
 * Maps every documented Token Plan chat model to its Pi capability contract.
 * The static catalog is the primary source of truth — it does not depend on
 * the /v1/models endpoint returning complete or up-to-date results.
 *
 * Unknown models discovered dynamically fall back to conservative defaults
 * so they appear in /model but do not claim reasoning support they may
 * not honor.
 */

export type ThinkingLevel =
  | "off"
  | "minimal"
  | "low"
  | "medium"
  | "high"
  | "xhigh"
  | "max";

export type ThinkingLevelMap = Partial<Record<ThinkingLevel, string | null>>;

export interface AlibabaOpenAICompat {
  supportsDeveloperRole: false;
  supportsStore: false;
  supportsStrictMode: false;
  maxTokensField: "max_tokens";
  supportsLongCacheRetention: false;
  thinkingFormat?: "qwen";
  supportsReasoningEffort?: boolean;
}

export interface AlibabaModelCapabilities {
  reasoning: boolean;
  thinkingLevelMap?: ThinkingLevelMap;
  input: Array<"text" | "image">;
  contextWindow: number;
  maxTokens: number;
  compat: AlibabaOpenAICompat;
}

// ── Compat builders ─────────────────────────────────────────────────────────

const BASE_COMPAT: AlibabaOpenAICompat = {
  supportsDeveloperRole: false,
  supportsStore: false,
  supportsStrictMode: false,
  maxTokensField: "max_tokens",
  supportsLongCacheRetention: false,
};

function qwenCompat(supportsReasoningEffort: boolean): AlibabaOpenAICompat {
  return {
    ...BASE_COMPAT,
    thinkingFormat: "qwen",
    supportsReasoningEffort,
  };
}

// ── Thinking level maps ─────────────────────────────────────────────────────

/** Qwen 3.8 Max: three distinct effort levels. */
const QWEN_38_EFFORT: ThinkingLevelMap = {
  minimal: null,
  low: "low",
  medium: "medium",
  high: null,
  xhigh: "xhigh",
  max: null,
};

/** DeepSeek V4 (current): off / high / max. */
const DEEPSEEK_V4_EFFORT: ThinkingLevelMap = {
  minimal: null,
  low: null,
  medium: null,
  high: "high",
  xhigh: null,
  max: "max",
};

/** Dated DeepSeek V4 variants: off / low / high / max. */
const DEEPSEEK_V4_DATED_EFFORT: ThinkingLevelMap = {
  minimal: null,
  low: "low",
  medium: null,
  high: "high",
  xhigh: null,
  max: "max",
};

/** Toggle-only models: enable_thinking on/off via "high" level. */
const TOGGLE_ONLY: ThinkingLevelMap = {
  minimal: null,
  low: null,
  medium: null,
  high: "high",
  xhigh: null,
  max: null,
};

/** GLM-5 models: off / high / max. */
const GLM5_EFFORT: ThinkingLevelMap = {
  minimal: null,
  low: null,
  medium: null,
  high: "high",
  xhigh: null,
  max: "max",
};

// ── Capability builders ─────────────────────────────────────────────────────

function reasoningModel(
  opts: Omit<AlibabaModelCapabilities, "reasoning" | "compat"> & {
    supportsReasoningEffort: boolean;
  },
): AlibabaModelCapabilities {
  const { supportsReasoningEffort, ...rest } = opts;
  return {
    ...rest,
    reasoning: true,
    compat: qwenCompat(supportsReasoningEffort),
  };
}

function nonReasoningModel(
  opts: Omit<AlibabaModelCapabilities, "reasoning" | "compat">,
): AlibabaModelCapabilities {
  return {
    ...opts,
    reasoning: false,
    compat: { ...BASE_COMPAT },
  };
}

// ── Static catalog: every documented Token Plan chat-capable model ──────────

export interface StaticModelEntry {
  id: string;
  capabilities: AlibabaModelCapabilities;
}

/**
 * Complete Token Plan chat model catalog.
 *
 * Source: https://docs.modelstudio.console.alibabacloud.com/en/model-studio/token-plan-personal-overview
 *
 * Models excluded (non-chat endpoints):
 *   - qwen-image-3.0-pro (image generation)
 *   - qwen-audio-3.0-tts-plus (speech synthesis)
 *   - qwen-audio-3.0-realtime-plus (real-time voice)
 *   - qwen-audio-3.0-asr-flash (speech recognition)
 *   - wan2.7-image / wan2.7-image-pro (image generation)
 *   - happyhorse-1.1-* (video generation)
 */
export const TOKEN_PLAN_MODELS: StaticModelEntry[] = [
  // ── Qwen ────────────────────────────────────────────────────────────────
  {
    id: "auto",
    capabilities: nonReasoningModel({
      input: ["text"],
      contextWindow: 128_000,
      maxTokens: 8_192,
    }),
  },
  {
    id: "qwen3.8-max",
    capabilities: reasoningModel({
      thinkingLevelMap: { ...QWEN_38_EFFORT },
      input: ["text", "image"],
      contextWindow: 1_000_000,
      maxTokens: 131_072,
      supportsReasoningEffort: true,
    }),
  },
  {
    id: "qwen3.8-flash",
    capabilities: reasoningModel({
      thinkingLevelMap: { ...TOGGLE_ONLY },
      input: ["text", "image"],
      contextWindow: 1_000_000,
      maxTokens: 65_536,
      supportsReasoningEffort: false,
    }),
  },
  {
    id: "qwen3.7-max",
    capabilities: reasoningModel({
      thinkingLevelMap: { ...TOGGLE_ONLY },
      input: ["text"],
      contextWindow: 1_000_000,
      maxTokens: 65_536,
      supportsReasoningEffort: false,
    }),
  },
  {
    id: "qwen3.7-plus",
    capabilities: reasoningModel({
      thinkingLevelMap: { ...TOGGLE_ONLY },
      input: ["text", "image"],
      contextWindow: 1_000_000,
      maxTokens: 65_536,
      supportsReasoningEffort: false,
    }),
  },
  {
    id: "qwen3.6-flash",
    capabilities: reasoningModel({
      thinkingLevelMap: { ...TOGGLE_ONLY },
      input: ["text", "image"],
      contextWindow: 1_000_000,
      maxTokens: 65_536,
      supportsReasoningEffort: false,
    }),
  },
  // ── DeepSeek ────────────────────────────────────────────────────────────
  {
    id: "deepseek-v4.1-flash",
    capabilities: reasoningModel({
      thinkingLevelMap: { ...DEEPSEEK_V4_EFFORT },
      input: ["text", "image"],
      contextWindow: 1_000_000,
      maxTokens: 393_216,
      supportsReasoningEffort: true,
    }),
  },
  {
    id: "deepseek-v4-pro",
    capabilities: reasoningModel({
      thinkingLevelMap: { ...DEEPSEEK_V4_EFFORT },
      input: ["text"],
      contextWindow: 1_000_000,
      maxTokens: 393_216,
      supportsReasoningEffort: true,
    }),
  },
  {
    id: "deepseek-v4-pro-0813",
    capabilities: reasoningModel({
      thinkingLevelMap: { ...DEEPSEEK_V4_DATED_EFFORT },
      input: ["text"],
      contextWindow: 1_000_000,
      maxTokens: 393_216,
      supportsReasoningEffort: true,
    }),
  },
  {
    id: "deepseek-v4-flash-0731",
    capabilities: reasoningModel({
      thinkingLevelMap: { ...DEEPSEEK_V4_DATED_EFFORT },
      input: ["text"],
      contextWindow: 1_000_000,
      maxTokens: 393_216,
      supportsReasoningEffort: true,
    }),
  },
  // ── Zhipu AI ────────────────────────────────────────────────────────────
  {
    id: "glm-5.3",
    capabilities: reasoningModel({
      thinkingLevelMap: { ...GLM5_EFFORT },
      input: ["text"],
      contextWindow: 1_000_000,
      maxTokens: 131_072,
      supportsReasoningEffort: true,
    }),
  },
  {
    id: "glm-5.2",
    capabilities: reasoningModel({
      thinkingLevelMap: { ...GLM5_EFFORT },
      input: ["text"],
      contextWindow: 1_000_000,
      maxTokens: 131_072,
      supportsReasoningEffort: true,
    }),
  },
];

// ── Dynamic discovery helpers ───────────────────────────────────────────────

/** Build a lookup map from the static catalog for O(1) access. */
export function buildStaticLookup(): Map<string, AlibabaModelCapabilities> {
  const map = new Map<string, AlibabaModelCapabilities>();
  for (const entry of TOKEN_PLAN_MODELS) {
    map.set(entry.id.toLowerCase(), entry.capabilities);
  }
  return map;
}

/**
 * Filter out non-chat models from dynamic /v1/models responses.
 * Alibaba's catalog mixes chat, embedding, image, audio, and video models.
 */
export function isAlibabaChatModel(modelId: string): boolean {
  return !/(?:^|[-/.])(image|audio|video|tts|asr|embed|embedding|vector|rerank|wan|realtime|happyhorse|[irt]2v)(?:[-/.]|$)/i.test(
    modelId,
  );
}

/**
 * Resolve capabilities for a model id.
 *
 * First checks the static catalog (exact match). Falls back to regex-based
 * heuristics for known model families. Unknown models stay conservative:
 * no reasoning, text-only, 128K context, 8K output.
 */
export function resolveAlibabaModelCapabilities(
  modelId: string,
): AlibabaModelCapabilities {
  const id = modelId.toLowerCase();

  // 1. Exact match in static catalog
  const staticEntry = buildStaticLookup().get(id);
  if (staticEntry) return staticEntry;

  // 2. Regex-based family heuristics (for dynamically discovered or aliased variants)

  // Qwen 3.8 Max variants
  if (/^qwen3[.-]?8-max(?:[-.]|$)/.test(id)) {
    return reasoningModel({
      thinkingLevelMap: { ...QWEN_38_EFFORT },
      input: ["text", "image"],
      contextWindow: 1_000_000,
      maxTokens: 131_072,
      supportsReasoningEffort: true,
    });
  }

  // Qwen 3.8 Flash / other 3.8 variants
  if (/^qwen3[.-]?8(?:[-.]|$)/.test(id)) {
    return reasoningModel({
      thinkingLevelMap: { ...TOGGLE_ONLY },
      input: /flash|vl|plus/.test(id) ? ["text", "image"] : ["text"],
      contextWindow: 1_000_000,
      maxTokens: 65_536,
      supportsReasoningEffort: false,
    });
  }

  // Qwen 3.6 / 3.7 series
  if (/^qwen3[.-]?[67](?:[-.]|$)/.test(id)) {
    return reasoningModel({
      thinkingLevelMap: { ...TOGGLE_ONLY },
      input: /plus|flash|vl/.test(id) ? ["text", "image"] : ["text"],
      contextWindow: 1_000_000,
      maxTokens: 65_536,
      supportsReasoningEffort: false,
    });
  }

  // Older Qwen3 base models
  if (/^qwen3(?:[-.]|$)/.test(id)) {
    return reasoningModel({
      thinkingLevelMap: { ...TOGGLE_ONLY },
      input: /vl|omni|plus|flash/.test(id) ? ["text", "image"] : ["text"],
      contextWindow: 131_072,
      maxTokens: 32_768,
      supportsReasoningEffort: false,
    });
  }

  // DeepSeek V4.1.x (newer versioned variants)
  if (/^deepseek-v4[.-]?1(?:[-.]|$)/.test(id)) {
    return reasoningModel({
      thinkingLevelMap: { ...DEEPSEEK_V4_EFFORT },
      input: /flash/.test(id) ? ["text", "image"] : ["text"],
      contextWindow: 1_000_000,
      maxTokens: 393_216,
      supportsReasoningEffort: true,
    });
  }

  // DeepSeek V4 dated variants (pro-0813, flash-0731)
  if (/^deepseek-v4-(?:pro-0813|flash-0731)(?:-|$)/.test(id)) {
    return reasoningModel({
      thinkingLevelMap: { ...DEEPSEEK_V4_DATED_EFFORT },
      input: ["text"],
      contextWindow: 1_000_000,
      maxTokens: 393_216,
      supportsReasoningEffort: true,
    });
  }

  // DeepSeek V4 current (pro, flash)
  if (/^deepseek-v4-(?:pro|flash)(?:-|$)/.test(id)) {
    return reasoningModel({
      thinkingLevelMap: { ...DEEPSEEK_V4_EFFORT },
      input: ["text"],
      contextWindow: 1_000_000,
      maxTokens: 393_216,
      supportsReasoningEffort: true,
    });
  }

  // DeepSeek V3.x
  if (/^deepseek-v3\.(?:1|2)(?:-|$)/.test(id)) {
    return reasoningModel({
      thinkingLevelMap: { ...TOGGLE_ONLY },
      input: ["text"],
      contextWindow: 131_072,
      maxTokens: 65_536,
      supportsReasoningEffort: false,
    });
  }

  // DeepSeek R1 (always-thinking)
  if (/^deepseek-r1(?:-|$)/.test(id)) {
    return {
      reasoning: true,
      thinkingLevelMap: {
        off: null,
        minimal: null,
        low: null,
        medium: null,
        high: "high",
        xhigh: null,
        max: null,
      },
      input: ["text"],
      contextWindow: 131_072,
      maxTokens: 32_768,
      compat: { ...BASE_COMPAT },
    };
  }

  // GLM-5.x (Zhipu AI)
  if (/^glm-5(?:[.-]|$)/.test(id)) {
    return reasoningModel({
      thinkingLevelMap: { ...GLM5_EFFORT },
      input: ["text"],
      contextWindow: 1_000_000,
      maxTokens: 131_072,
      supportsReasoningEffort: true,
    });
  }

  // Kimi K3 (always-thinking, max)
  if (/^(?:kimi\/kimi-k3|kimi-k3)(?:-|$)/.test(id)) {
    return {
      reasoning: true,
      thinkingLevelMap: {
        off: null,
        minimal: null,
        low: null,
        medium: null,
        high: null,
        xhigh: null,
        max: "max",
      },
      input: ["text", "image"],
      contextWindow: 1_000_000,
      maxTokens: 131_072,
      compat: { ...BASE_COMPAT },
    };
  }

  // Kimi K2.6
  if (/^kimi-k2\.6(?:-|$)/.test(id)) {
    return reasoningModel({
      thinkingLevelMap: { ...TOGGLE_ONLY },
      input: ["text", "image"],
      contextWindow: 262_144,
      maxTokens: 16_384,
      supportsReasoningEffort: false,
    });
  }

  // Kimi K2.7 Code, MiniMax M3, QwQ (always-thinking)
  if (/^(?:kimi-k2\.7-code|minimax\/minimax-m3|minimax-m3|qwq)(?:-|$)/.test(id)) {
    return {
      reasoning: true,
      thinkingLevelMap: {
        off: null,
        minimal: null,
        low: null,
        medium: null,
        high: "high",
        xhigh: null,
        max: null,
      },
      input: /kimi|minimax/.test(id) ? ["text", "image"] : ["text"],
      contextWindow: /minimax/.test(id) ? 512_000 : 262_144,
      maxTokens: 131_072,
      compat: { ...BASE_COMPAT },
    };
  }

  // 3. Conservative fallback for unknown models
  return {
    reasoning: false,
    input: /(?:^|[-/.])(vl|vision|omni)(?:[-/.]|$)/.test(id)
      ? ["text", "image"]
      : ["text"],
    contextWindow: 128_000,
    maxTokens: 8_192,
    compat: { ...BASE_COMPAT },
  };
}