import { NextResponse } from "next/server";
import { getLlmStatus } from "@/lib/llm";

export async function GET() {
  const llm = await getLlmStatus();
  return NextResponse.json({
    status: "ok",
    timestamp: new Date().toISOString(),
    service: "Deep Read (深读)",
    llm: {
      configured: llm.configured,
      source: llm.source,
      model: llm.configured ? llm.model : "",
    },
  });
}
