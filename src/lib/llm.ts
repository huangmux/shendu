type LlmConfig = {
  apiKey: string;
  baseUrl: string;
  model: string;
};

function readEnv(name: string) {
  return process.env[name]?.trim() || "";
}

export function getLlmConfig(): LlmConfig | null {
  const apiKey = readEnv("LLM_API_KEY");
  if (!apiKey) return null;

  return {
    apiKey,
    baseUrl: (readEnv("LLM_BASE_URL") || "https://api.openai.com/v1").replace(/\/+$/, ""),
    model: readEnv("LLM_MODEL") || "gpt-4o-mini",
  };
}

export function isLlmEnabled() {
  return getLlmConfig() !== null;
}

export async function chatWithLlm(
  messages: Array<{ role: "system" | "user" | "assistant"; content: string }>
) {
  const config = getLlmConfig();
  if (!config) {
    throw new Error("未配置 LLM_API_KEY");
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
      temperature: 0.7,
    }),
    signal: AbortSignal.timeout(60_000),
  });

  const raw = await response.text();
  if (!response.ok) {
    throw new Error(`大模型接口 ${response.status}: ${raw.slice(0, 240)}`);
  }

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
