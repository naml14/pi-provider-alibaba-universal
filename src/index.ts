/**
 * Pi provider plugin for Alibaba Cloud Model Studio.
 *
 * Registers OpenAI-compatible providers for:
 *   - Coding Plan (international + Chinese)
 *   - Token Plan (international + Chinese) — static-first complete catalog
 *   - API / Pay-as-you-go (international + Chinese)
 *
 * Token Plan uses a manually curated static catalog of every documented
 * chat model so users see all available models immediately without
 * depending on the /v1/models endpoint.
 *
 * Coding Plan and API use dynamic discovery with improved fallbacks.
 * All providers share the same capability resolver so model metadata
 * (reasoning levels, context window, input types) is always correct.
 *
 * Auth:
 *   export ALIBABA_CODING_API_KEY="..."
 *   export ALIBABA_TOKEN_PLAN_API_KEY="..."
 *   export ALIBABA_API_KEY="..."
 *   pi -e /path/to/pi-provider-alibaba-universal
 *   # then /model -> alibaba-token-intl/qwen3.8-max ...
 */

import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import {
  createProvider,
  envApiKeyAuth,
  openAICompletionsApi,
  type Model,
  type RefreshModelsContext,
} from "@earendil-works/pi-ai/compat";
import {
  isAlibabaChatModel,
  resolveAlibabaModelCapabilities,
  TOKEN_PLAN_MODELS,
  type AlibabaModelCapabilities,
} from "./model-capabilities.js";

const API = "openai-completions" as const;

// ── Endpoints ────────────────────────────────────────────────────────────────

const CODING_INTL_BASE_URL = "https://coding-intl.dashscope.aliyuncs.com/v1";
const CODING_CN_BASE_URL = "https://coding.dashscope.aliyuncs.com/v1";

const TOKEN_INTL_BASE_URL =
  "https://token-plan.ap-southeast-1.maas.aliyuncs.com/compatible-mode/v1";
const TOKEN_CN_BASE_URL =
  "https://token-plan.cn-beijing.maas.aliyuncs.com/compatible-mode/v1";

const API_INTL_BASE_URL =
  "https://dashscope-intl.aliyuncs.com/compatible-mode/v1";
const API_CN_BASE_URL =
  "https://dashscope.aliyuncs.com/compatible-mode/v1";

// ── Static fallback models ───────────────────────────────────────────────────

const CODING_FALLBACK_MODELS: Array<Pick<
  Model<typeof API>,
  "id" | "name" | "reasoning" | "input" | "cost" | "contextWindow" | "maxTokens"
>> = [
  {
    id: "qwen3-8b",
    name: "Qwen3 8B (Coding)",
    reasoning: false,
    input: ["text"],
    cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
    contextWindow: 128000,
    maxTokens: 8192,
  },
  {
    id: "qwen3-14b",
    name: "Qwen3 14B (Coding)",
    reasoning: false,
    input: ["text"],
    cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
    contextWindow: 128000,
    maxTokens: 8192,
  },
  {
    id: "qwen3-32b",
    name: "Qwen3 32B (Coding)",
    reasoning: false,
    input: ["text"],
    cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
    contextWindow: 128000,
    maxTokens: 8192,
  },
];

const API_FALLBACK_MODELS: Array<Pick<
  Model<typeof API>,
  "id" | "name" | "reasoning" | "input" | "cost" | "contextWindow" | "maxTokens"
>> = [
  {
    id: "qwen3-8b",
    name: "Qwen3 8B (API)",
    reasoning: false,
    input: ["text"],
    cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
    contextWindow: 128000,
    maxTokens: 8192,
  },
  {
    id: "qwen3-14b",
    name: "Qwen3 14B (API)",
    reasoning: false,
    input: ["text"],
    cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
    contextWindow: 128000,
    maxTokens: 8192,
  },
  {
    id: "qwen3-32b",
    name: "Qwen3 32B (API)",
    reasoning: false,
    input: ["text"],
    cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
    contextWindow: 128000,
    maxTokens: 8192,
  },
  {
    id: "qwen3.7-max",
    name: "Qwen3.7 Max (API)",
    reasoning: false,
    input: ["text"],
    cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
    contextWindow: 128000,
    maxTokens: 8192,
  },
];

// ── Token Plan model names ───────────────────────────────────────────────────

const TOKEN_MODEL_NAMES: Record<string, string> = {
  auto: "Qwen Auto (Token)",
  "qwen3.8-max": "Qwen3.8 Max (Token)",
  "qwen3.8-flash": "Qwen3.8 Flash (Token)",
  "qwen3.7-max": "Qwen3.7 Max (Token)",
  "qwen3.7-plus": "Qwen3.7 Plus (Token)",
  "qwen3.6-flash": "Qwen3.6 Flash (Token)",
  "deepseek-v4.1-flash": "DeepSeek V4.1 Flash (Token)",
  "deepseek-v4-pro": "DeepSeek V4 Pro (Token)",
  "deepseek-v4-pro-0813": "DeepSeek V4 Pro 0813 (Token)",
  "deepseek-v4-flash-0731": "DeepSeek V4 Flash 0731 (Token)",
  "glm-5.3": "GLM-5.3 (Token)",
  "glm-5.2": "GLM-5.2 (Token)",
};

function tokenModelName(id: string): string {
  return TOKEN_MODEL_NAMES[id] ?? id;
}

// ── Shared helpers ───────────────────────────────────────────────────────────

function modelFromCapabilities(
  providerId: string,
  baseUrl: string,
  id: string,
  name: string,
  caps: AlibabaModelCapabilities,
): Model<typeof API> {
  return {
    id,
    name,
    api: API,
    provider: providerId,
    baseUrl,
    reasoning: caps.reasoning,
    thinkingLevelMap: caps.thinkingLevelMap,
    input: caps.input,
    contextWindow: caps.contextWindow,
    maxTokens: caps.maxTokens,
    compat: caps.compat,
    cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
  } satisfies Model<typeof API>;
}

function createFallbackModels(
  providerId: string,
  baseUrl: string,
  models: Array<Pick<
    Model<typeof API>,
    "id" | "name" | "reasoning" | "input" | "cost" | "contextWindow" | "maxTokens"
  >>,
): Model<typeof API>[] {
  return models.map((m) => {
    const caps = resolveAlibabaModelCapabilities(m.id);
    return {
      id: m.id,
      name: m.name,
      api: API,
      provider: providerId,
      baseUrl,
      reasoning: caps.reasoning,
      thinkingLevelMap: caps.thinkingLevelMap,
      input: caps.input,
      contextWindow: caps.contextWindow,
      maxTokens: caps.maxTokens,
      compat: caps.compat,
      cost: m.cost,
    } satisfies Model<typeof API>;
  });
}

interface AlibabaListModel {
  id: string;
  name?: string;
  object?: string;
}

async function discoverModels(
  baseUrl: string,
  authHeader: string,
  signal?: AbortSignal,
): Promise<AlibabaListModel[]> {
  const response = await fetch(`${baseUrl}/models`, {
    signal,
    headers: {
      Accept: "application/json",
      Authorization: authHeader,
    },
  });
  if (!response.ok) {
    throw new Error(`${response.status} ${response.statusText}`);
  }
  const payload = (await response.json()) as { data?: AlibabaListModel[] };
  const models = (payload.data ?? []).filter((model) =>
    isAlibabaChatModel(model.id || model.object || ""),
  );
  if (models.length === 0) {
    throw new Error("models endpoint returned no data");
  }
  return models;
}

function getAuthHeader(
  credential: RefreshModelsContext["credential"],
  envVars: string[],
): string | undefined {
  if (credential?.type === "api_key" && credential.key) {
    return `Bearer ${credential.key}`;
  }
  for (const name of envVars) {
    const value = process.env[name];
    if (typeof value === "string" && value.length > 0) {
      return `Bearer ${value}`;
    }
  }
  return undefined;
}

// ── Token Plan: static-first catalog ─────────────────────────────────────────

function buildTokenStaticModels(
  providerId: string,
  baseUrl: string,
): Model<typeof API>[] {
  return TOKEN_PLAN_MODELS.map((entry) =>
    modelFromCapabilities(
      providerId,
      baseUrl,
      entry.id,
      tokenModelName(entry.id),
      entry.capabilities,
    ),
  );
}

/**
 * Token Plan fetchModels: merge static catalog with dynamic discovery.
 * The static catalog is always present; dynamic results only add new models
 * that aren't already in the catalog.
 */
async function fetchTokenModels(
  providerId: string,
  baseUrl: string,
  envVars: string[],
  context: RefreshModelsContext,
): Promise<Model<typeof API>[]> {
  const authHeader = getAuthHeader(context.credential, envVars);
  if (!authHeader) {
    throw new Error(
      `no API key configured for ${providerId} (set one of ${envVars.join(", ")})`,
    );
  }

  // Always start with the complete static catalog
  const staticModels = buildTokenStaticModels(providerId, baseUrl);
  const knownIds = new Set(staticModels.map((m) => m.id.toLowerCase()));

  // Discover additional models
  try {
    const discovered = await discoverModels(baseUrl, authHeader, context.signal);
    for (const m of discovered) {
      const id = (m.id || m.object || "").toLowerCase();
      if (!id || knownIds.has(id)) continue;
      const caps = resolveAlibabaModelCapabilities(id);
      staticModels.push(
        modelFromCapabilities(providerId, baseUrl, id, m.name || id, caps),
      );
    }
  } catch {
    // If discovery fails, the static catalog is still returned
  }

  return staticModels;
}

// ── Coding Plan / API: dynamic with fallback ─────────────────────────────────

interface ProviderDefinition {
  id: string;
  name: string;
  baseUrl: string;
  envVars: string[];
  fallback: Array<Pick<
    Model<typeof API>,
    "id" | "name" | "reasoning" | "input" | "cost" | "contextWindow" | "maxTokens"
  >>;
}

function registerDynamicProvider(
  pi: ExtensionAPI,
  definition: ProviderDefinition,
): void {
  const fallback = createFallbackModels(
    definition.id,
    definition.baseUrl,
    definition.fallback,
  );

  const provider = createProvider({
    id: definition.id,
    name: definition.name,
    baseUrl: definition.baseUrl,
    auth: {
      apiKey: envApiKeyAuth(`${definition.name} API key`, definition.envVars),
    },
    models: fallback,
    api: openAICompletionsApi(),
    fetchModels: async (context: RefreshModelsContext) => {
      const authHeader = getAuthHeader(context.credential, definition.envVars);
      if (!authHeader) {
        throw new Error(
          `no API key configured for ${definition.id} (set one of ${definition.envVars.join(", ")})`,
        );
      }
      const models = await discoverModels(
        definition.baseUrl,
        authHeader,
        context.signal,
      );
      return models.map((m) => {
        const id = m.id || m.object || "unknown";
        const caps = resolveAlibabaModelCapabilities(id);
        return modelFromCapabilities(
          definition.id,
          definition.baseUrl,
          id,
          m.name || id,
          caps,
        );
      });
    },
  });

  pi.registerProvider(provider);
}

function registerTokenProvider(
  pi: ExtensionAPI,
  definition: ProviderDefinition,
): void {
  const staticModels = buildTokenStaticModels(
    definition.id,
    definition.baseUrl,
  );

  const provider = createProvider({
    id: definition.id,
    name: definition.name,
    baseUrl: definition.baseUrl,
    auth: {
      apiKey: envApiKeyAuth(`${definition.name} API key`, definition.envVars),
    },
    models: staticModels,
    api: openAICompletionsApi(),
    fetchModels: (context: RefreshModelsContext) =>
      fetchTokenModels(
        definition.id,
        definition.baseUrl,
        definition.envVars,
        context,
      ),
  });

  pi.registerProvider(provider);
}

// ── Entry point ──────────────────────────────────────────────────────────────

export default function (pi: ExtensionAPI) {
  // Coding Plan (dynamic)
  registerDynamicProvider(pi, {
    id: "alibaba-coding-intl",
    name: "Alibaba Coding Plan (Intl)",
    baseUrl: CODING_INTL_BASE_URL,
    envVars: ["ALIBABA_CODING_API_KEY"],
    fallback: CODING_FALLBACK_MODELS,
  });

  registerDynamicProvider(pi, {
    id: "alibaba-coding-cn",
    name: "Alibaba Coding Plan (CN)",
    baseUrl: CODING_CN_BASE_URL,
    envVars: ["ALIBABA_CODING_API_KEY"],
    fallback: CODING_FALLBACK_MODELS,
  });

  // Token Plan (static-first)
  registerTokenProvider(pi, {
    id: "alibaba-token-intl",
    name: "Alibaba Token Plan (Intl)",
    baseUrl: TOKEN_INTL_BASE_URL,
    envVars: ["ALIBABA_TOKEN_PLAN_API_KEY"],
    fallback: [], // not used — static catalog is the source
  });

  registerTokenProvider(pi, {
    id: "alibaba-token-cn",
    name: "Alibaba Token Plan (CN)",
    baseUrl: TOKEN_CN_BASE_URL,
    envVars: ["ALIBABA_TOKEN_PLAN_API_KEY"],
    fallback: [],
  });

  // API / Pay-as-you-go (dynamic)
  registerDynamicProvider(pi, {
    id: "alibaba-api-intl",
    name: "Alibaba DashScope API (Intl)",
    baseUrl: API_INTL_BASE_URL,
    envVars: ["ALIBABA_API_KEY", "DASHSCOPE_API_KEY"],
    fallback: API_FALLBACK_MODELS,
  });

  registerDynamicProvider(pi, {
    id: "alibaba-api-cn",
    name: "Alibaba DashScope API (CN)",
    baseUrl: API_CN_BASE_URL,
    envVars: ["ALIBABA_API_KEY", "DASHSCOPE_API_KEY"],
    fallback: API_FALLBACK_MODELS,
  });
}