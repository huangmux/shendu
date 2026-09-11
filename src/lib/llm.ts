import { prisma } from "@/lib/prisma";

export const DEFAULT_LLM_BASE_URL = "https://api.deepseek.com/v1";
export const DEFAULT_LLM_MODEL = "deepseek-chat";
export const LLM_NOT_CONFIGURED = "LLM_NOT_CONFIGURED";

export type LlmMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

export type LlmConfig = {
  apiKey: string;
  baseUrl: string;
  model: string;
  source: "env" | "database";
};

export type LlmStatus = {
  configured: boolean;
  source: "env" | "database" | "none";
  envLocked: boolean;
  model: string;
  baseUrl: string;
  apiKeyMasked: string;
};

function readEnv(name: string) {
  return process.env[name]?.trim() || "";
}

function normalizeBaseUrl(url: string) {
  return (url || DEFAULT_LLM_BASE_URL).replace(/\/+$/, "");
}

export function maskApiKey(apiKey: string) {
  const key = apiKey.trim();
  if (!key) return "";
  if (key.length <= 8) return "••••";
  return `${key.slice(0, 4)}••••${key.slice(-4)}`;
}

export async function getStoredSettings() {
  return prisma.appSetting.findUnique({ where: { id: "default" } });
}

export async function getLlmConfig(): Promise<LlmConfig | null> {
  const envKey = readEnv("LLM_API_KEY");
  if (envKey) {
    return {
      apiKey: envKey,
      baseUrl: normalizeBaseUrl(readEnv("LLM_BASE_URL")),
      model: readEnv("LLM_MODEL") || DEFAULT_LLM_MODEL,
      source: "env",
    };
  }

  const stored = await getStoredSettings();
  if (stored?.llmApiKey) {
    return {
      apiKey: stored.llmApiKey,
      baseUrl: normalizeBaseUrl(stored.llmBaseUrl),
      model: stored.llmModel || DEFAULT_LLM_MODEL,
      source: "database",
    };
  }

  return null;
}

export async function getLlmStatus(): Promise<LlmStatus> {
  const envKey = readEnv("LLM_API_KEY");
  const stored = await getStoredSettings();
  const config = await getLlmConfig();

  return {
    configured: config !== null,
    source: config?.source ?? "none",
    envLocked: Boolean(envKey),
    model: config?.model || stored?.llmModel || DEFAULT_LLM_MODEL,
    baseUrl: config?.baseUrl || stored?.llmBaseUrl || DEFAULT_LLM_BASE_URL,
    apiKeyMasked: maskApiKey(config?.apiKey || ""),
  };
}

export async function isLlmEnabled() {
  return (await getLlmConfig()) !== null;
}

export function llmRequiredPayload() {
  return {
    code: LLM_NOT_CONFIGURED,
    message: "尚未配置大模型。请打开「模型设置」填写兼容 OpenAI 的接口后重试。",
  };
}

export function extractJsonObject(raw: string): unknown {
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const text = (fenced?.[1] ?? raw).trim();
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) {
    throw new Error("大模型没有返回可解析的 JSON");
  }
  return JSON.parse(text.slice(start, end + 1));
}

async function requestChatCompletions(
  config: LlmConfig,
  body: Record<string, unknown>,
  timeoutMs: number
) {
  const response = await fetch(`${config.baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${config.apiKey}`,
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(timeoutMs),
  });

  const raw = await response.text();
  if (!response.ok) {
    throw new Error(`大模型接口 ${response.status}: ${raw.slice(0, 240)}`);
  }
  return raw;
}

function parseCompletionContent(raw: string) {
  let data: {
    choices?: Array<{ message?: { content?: string } }>;
  };
  try {
    data = JSON.parse(raw);
  } catch {
    throw new Error("大模型接口返回了无法解析的内容");
  }

  const content = data.choices?.[0]?.message?.content?.trim();
  if (!content) {
    throw new Error("大模型没有返回正文");
  }
  return content;
}

export async function chatWithLlm(
  messages: LlmMessage[],
  options?: { temperature?: number; json?: boolean; timeoutMs?: number }
) {
  const config = await getLlmConfig();
  if (!config) {
    throw new Error("未配置大模型");
  }

  const timeoutMs = options?.timeoutMs ?? 60_000;
  const payload: Record<string, unknown> = {
    model: config.model,
    messages,
    temperature: options?.temperature ?? 0.7,
  };

  if (options?.json) {
    payload.response_format = { type: "json_object" };
    try {
      return parseCompletionContent(
        await requestChatCompletions(config, payload, timeoutMs)
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : "";
      if (!/400|response_format|json_object/i.test(message)) {
        throw error;
      }
      delete payload.response_format;
    }
  }

  return parseCompletionContent(
    await requestChatCompletions(config, payload, timeoutMs)
  );
}

export async function chatWithLlmJson<T>(
  messages: LlmMessage[],
  options?: { temperature?: number; timeoutMs?: number }
): Promise<T> {
  const content = await chatWithLlm(messages, {
    ...options,
    json: true,
    temperature: options?.temperature ?? 0.2,
  });
  return extractJsonObject(content) as T;
}

export async function* streamChatWithLlm(
  messages: LlmMessage[],
  options?: { temperature?: number; timeoutMs?: number }
) {
  const config = await getLlmConfig();
  if (!config) {
    throw new Error("未配置大模型");
  }

  const response = await fetch(`${config.baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${config.apiKey}`,
    },
    body: JSON.stringify({
      model: config.model,
      messages,
      temperature: options?.temperature ?? 0.7,
      stream: true,
    }),
    signal: AbortSignal.timeout(options?.timeoutMs ?? 90_000),
  });

  if (!response.ok) {
    const raw = await response.text();
    throw new Error(`大模型接口 ${response.status}: ${raw.slice(0, 240)}`);
  }
  if (!response.body) {
    throw new Error("大模型没有返回流式内容");
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let produced = false;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split(/\r?\n/);
    buffer = lines.pop() ?? "";

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed.startsWith("data:")) continue;
      const data = trimmed.slice(5).trim();
      if (!data || data === "[DONE]") continue;
      try {
        const json = JSON.parse(data) as {
          choices?: Array<{ delta?: { content?: string } }>;
        };
        const delta = json.choices?.[0]?.delta?.content;
        if (delta) {
          produced = true;
          yield delta;
        }
      } catch {
        // Ignore malformed SSE fragments from some providers.
      }
    }
  }

  if (!produced) {
    throw new Error("大模型没有返回正文");
  }
}

export async function testLlmConnection(input?: {
  apiKey?: string;
  baseUrl?: string;
  model?: string;
}) {
  const current = await getLlmConfig();
  const apiKey = input?.apiKey?.trim() || current?.apiKey || "";
  if (!apiKey) {
    throw new Error("请先填写 API Key");
  }

  const config: LlmConfig = {
    apiKey,
    baseUrl: normalizeBaseUrl(input?.baseUrl?.trim() || current?.baseUrl || ""),
    model: input?.model?.trim() || current?.model || DEFAULT_LLM_MODEL,
    source: current?.source ?? "database",
  };

  const content = parseCompletionContent(
    await requestChatCompletions(
      config,
      {
        model: config.model,
        temperature: 0,
        messages: [
          {
            role: "user",
            content: "只回复两个字：可用",
          },
        ],
      },
      20_000
    )
  );

  return {
    ok: true,
    model: config.model,
    preview: content.slice(0, 80),
  };
}
