# pi-provider-alibaba-universal

Alibaba Cloud Model Studio providers for [Pi](https://pi.dev/).

Six providers covering every Alibaba plan — Coding Plan, Token Plan, and
Pay-as-you-go — across both international and Chinese endpoints. All chat
models appear with correct reasoning levels, context windows, and input
types without extra configuration.

## Providers

| Provider ID | Plan | Endpoint |
|---|---|---|
| `alibaba-coding-intl` | Coding Plan (Intl) | `coding-intl.dashscope.aliyuncs.com` |
| `alibaba-coding-cn` | Coding Plan (CN) | `coding.dashscope.aliyuncs.com` |
| `alibaba-token-intl` | Token Plan (Intl) | `token-plan.ap-southeast-1.maas.aliyuncs.com` |
| `alibaba-token-cn` | Token Plan (CN) | `token-plan.cn-beijing.maas.aliyuncs.com` |
| `alibaba-api-intl` | DashScope API (Intl) | `dashscope-intl.aliyuncs.com` |
| `alibaba-api-cn` | DashScope API (CN) | `dashscope.aliyuncs.com` |

## Install

Do not install this package together with `pi-provider-alibaba` or
`pi-provider-alibaba-complete`: all three register the same provider IDs.

```sh
pi install npm:pi-provider-alibaba-universal
```

Or try it for a single session:

```sh
pi -e npm:pi-provider-alibaba-universal
```

## Configure

Set the credential for the product you purchased, restart Pi, then select
the matching provider and model:

```sh
# Token Plan
export ALIBABA_TOKEN_PLAN_API_KEY="<your-token-plan-key>"

# Coding Plan
export ALIBABA_CODING_API_KEY="<your-coding-plan-key>"

# Pay-as-you-go DashScope API
export ALIBABA_API_KEY="<your-api-key>"
```

China and international routes use different endpoints. Select the route
matching your key's product and region.

## Token Plan models

The Token Plan providers ship with a complete static catalog of all 12
chat-capable models documented by Alibaba, available immediately without
waiting for API discovery:

| Model | Reasoning | Input | Context | Max output |
|---|---|---|---|---|
| `auto` | — (router) | text | 128K | 8K |
| `qwen3.8-max` | low · medium · xhigh | text · image | 1M | 256K |
| `qwen3.8-flash` | off · high | text · image | 1M | 64K |
| `qwen3.7-max` | off · high | text | 1M | 64K |
| `qwen3.7-plus` | off · high | text · image | 1M | 64K |
| `qwen3.6-flash` | off · high | text · image | 1M | 64K |
| `deepseek-v4.1-flash` | off · high · max | text · image | 1M | 384K |
| `deepseek-v4-pro` | off · high · max | text | 1M | 384K |
| `deepseek-v4-pro-0813` | off · low · high · max | text | 1M | 384K |
| `deepseek-v4-flash-0731` | off · low · high · max | text | 1M | 384K |
| `glm-5.3` | off · high · max | text | 1M | 128K |
| `glm-5.2` | off · high · max | text | 1M | 128K |

Multimodal generation models (`qwen-image-3.0-pro`, `qwen-audio-*`,
`wan2.7-*`, `happyhorse-*`) are excluded because they use dedicated
non-chat endpoints. See Alibaba's [multimodal integration guide](https://docs.modelstudio.console.alibabacloud.com/en/model-studio/token-plan-multimodal-gen).

## Coding Plan and API models

Coding Plan and DashScope API providers use dynamic model discovery via
the `/v1/models` endpoint. Open `/model` in Pi to refresh the list. Models
appear with correct capability metadata even when discovered dynamically.

## Reasoning controls

| Model family | Selectable levels | Wire format |
|---|---|---|
| DeepSeek V4 (current) | off · high · max | `enable_thinking` + `reasoning_effort` |
| DeepSeek V4 (dated 0813/0731) | off · low · high · max | `enable_thinking` + `reasoning_effort` |
| Qwen 3.8 Max | low · medium · xhigh | `enable_thinking` + `reasoning_effort` |
| Qwen 3.6 / 3.7 / 3.8 Flash | off · high | `enable_thinking` only |
| GLM-5 | off · high · max | `enable_thinking` + `reasoning_effort` |

All providers use `system` role, `max_tokens` field, and Alibaba's
`enable_thinking` wire format. Unknown model families stay conservative
until their protocol is confirmed.

## Model refresh

Pi refreshes the model list each time you open `/model`:

- **Token Plan**: the static catalog is always present. Dynamic discovery
  adds any newly released models without replacing existing entries.
- **Coding Plan / API**: dynamic discovery replaces the current list with
  fresh results from the endpoint.

## Verification

```sh
npm install
npm run verify
```

Runs typecheck, 38 tests, and packaging dry-run.

## License

MIT

## Acknowledgments

This package is based on the provider architecture and capability projection
work from:

- [`dinhe/pi-provider-alibaba`](https://gitlab.com/dinhe/pi-provider-alibaba) —
  the original Alibaba Cloud provider for Pi, which established the route,
  transport, and authentication layer for all six Alibaba endpoints.
- [`weijiafu14/pi-provider-alibaba-complete`](https://github.com/weijiafu14/pi-provider-alibaba-complete) —
  which added the first reasoning capability projection, model-specific
  compatibility switches, and wire-format verification.

This package extends that foundation with a static-first model catalog for
Token Plan, expanded capability mappings for newer models, and a dynamic
merge strategy that preserves curated metadata across refreshes.