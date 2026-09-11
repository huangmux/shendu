import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isLlmEnabled, llmRequiredPayload, streamChatWithLlm } from "@/lib/llm";
import { buildMentorMessages, getMentor, type ChatMessage } from "@/lib/mentors";

export const maxDuration = 60;

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    if (!(await isLlmEnabled())) {
      return NextResponse.json(llmRequiredPayload(), { status: 503 });
    }

    const { id: documentId } = await params;
    const body = await request.json();
    const chapterId = String(body.chapterId ?? "");
    const mentorId = String(body.mentorId ?? "");
    const messages: ChatMessage[] = Array.isArray(body.messages)
      ? body.messages.filter(
          (message: ChatMessage) =>
            message &&
            (message.role === "user" || message.role === "assistant") &&
            typeof message.content === "string"
        )
      : [];

    if (!getMentor(mentorId)) {
      return NextResponse.json({ message: "未知的导师" }, { status: 400 });
    }

    const chapter = await prisma.chapter.findFirst({
      where: { id: chapterId, documentId },
    });

    if (!chapter) {
      return NextResponse.json({ message: "章节不存在" }, { status: 404 });
    }

    const llmMessages = buildMentorMessages({
      mentorId,
      chapterTitle: chapter.title,
      chapterText: chapter.text ?? "",
      messages,
    });

    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        try {
          for await (const delta of streamChatWithLlm(llmMessages)) {
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ delta })}\n\n`));
          }
          controller.enqueue(encoder.encode("data: [DONE]\n\n"));
          controller.close();
        } catch (error) {
          const message = error instanceof Error ? error.message : "导师暂时无法应答，请重试";
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ error: message })}\n\n`));
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream; charset=utf-8",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
        "X-Accel-Buffering": "no",
      },
    });
  } catch (error) {
    console.error("Learn chat error:", error);
    const message = error instanceof Error ? error.message : "导师暂时无法应答，请重试";
    return NextResponse.json({ message }, { status: 502 });
  }
}
