import { NextRequest, NextResponse } from "next/server";
import { testLlmConnection } from "@/lib/llm";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const result = await testLlmConnection({
      apiKey: typeof body.apiKey === "string" ? body.apiKey : undefined,
      baseUrl: typeof body.baseUrl === "string" ? body.baseUrl : undefined,
      model: typeof body.model === "string" ? body.model : undefined,
    });
    return NextResponse.json({
      ok: true,
      message: `连接成功，模型 ${result.model} 已响应。`,
      preview: result.preview,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "连接失败";
    return NextResponse.json({ ok: false, message }, { status: 502 });
  }
}
