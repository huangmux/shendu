import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  DEFAULT_LLM_BASE_URL,
  DEFAULT_LLM_MODEL,
  getLlmStatus,
} from "@/lib/llm";

export async function GET() {
  const status = await getLlmStatus();
  return NextResponse.json({
    ...status,
    presets: [
      {
        id: "deepseek",
        label: "DeepSeek",
        baseUrl: "https://api.deepseek.com/v1",
        model: "deepseek-chat",
      },
      {
        id: "qwen",
        label: "通义千问",
        baseUrl: "https://dashscope.aliyuncs.com/compatible-mode/v1",
        model: "qwen-plus",
      },
      {
        id: "moonshot",
        label: "月之暗面",
        baseUrl: "https://api.moonshot.cn/v1",
        model: "moonshot-v1-8k",
      },
      {
        id: "siliconflow",
        label: "SiliconFlow",
        baseUrl: "https://api.siliconflow.cn/v1",
        model: "deepseek-ai/DeepSeek-V3",
      },
      {
        id: "openai",
        label: "OpenAI",
        baseUrl: "https://api.openai.com/v1",
        model: "gpt-4o-mini",
      },
    ],
  });
}

export async function PUT(request: NextRequest) {
  const status = await getLlmStatus();
  if (status.envLocked) {
    return NextResponse.json(
      { message: "当前已由环境变量 LLM_API_KEY 接管，无法在页面里覆盖。如需改用页面配置，请先清空容器中的 LLM_API_KEY。" },
      { status: 409 }
    );
  }

  const body = await request.json();
  const apiKey = String(body.apiKey ?? "").trim();
  const baseUrl = String(body.baseUrl ?? DEFAULT_LLM_BASE_URL).trim().replace(/\/+$/, "");
  const model = String(body.model ?? DEFAULT_LLM_MODEL).trim();

  if (!apiKey) {
    return NextResponse.json({ message: "请填写 API Key" }, { status: 400 });
  }
  if (!baseUrl) {
    return NextResponse.json({ message: "请填写接口地址" }, { status: 400 });
  }
  if (!model) {
    return NextResponse.json({ message: "请填写模型名称" }, { status: 400 });
  }

  await prisma.appSetting.upsert({
    where: { id: "default" },
    update: { llmApiKey: apiKey, llmBaseUrl: baseUrl, llmModel: model },
    create: {
      id: "default",
      llmApiKey: apiKey,
      llmBaseUrl: baseUrl,
      llmModel: model,
    },
  });

  return NextResponse.json(await getLlmStatus());
}
