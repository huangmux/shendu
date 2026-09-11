import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isLlmEnabled, openLlmStream } from "@/lib/llm";
import {
  buildMentorMessages,
  generateMentorReply,
  getMentor,
  type ChatMessage,
} from "@/lib/mentors";

// Streaming responses keep the connection un-buffered so text reaches the
// browser progressively (see next.js streaming guide: Route Handlers).
function streamHeaders(source: "llm" | "local") {
  return {
    "Content-Type": "text/plain; charset=utf-8",
    "X-Content-Type-Options": "nosniff",
    "Cache-Control": "no-cache, no-transform",
    "X-Accel-Buffering": "no",
    "X-Chat-Source": source,
  };
}

// Transforms an OpenAI-compatible SSE stream into a plain UTF-8 text stream of
// just the assistant's incremental content deltas.
function createLlmTextStream(upstream: Response): ReadableStream<Uint8Array> {
  const reader = upstream.body!.getReader();
  const decoder = new TextDecoder();
  const encoder = new TextEncoder();
  let buffer = "";

  return new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });

          const lines = buffer.split("\n");
          buffer = lines.pop() ?? "";

          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed.startsWith("data:")) continue;
            const data = trimmed.slice(5).trim();
            if (data === "[DONE]") {
              controller.close();
              return;
            }
            try {
              const json = JSON.parse(data);
              const delta: string = json.choices?.[0]?.delta?.content ?? "";
              if (delta) controller.enqueue(encoder.encode(delta));
            } catch {
              // Ignore keep-alive comments or partial JSON lines.
            }
          }
        }
        controller.close();
      } catch (error) {
        controller.error(error);
      } finally {
        reader.releaseLock();
      }
    },
    cancel() {
      void reader.cancel();
    },
  });
}

// Emits the locally-generated fallback reply in small chunks so the UI reveals
// it progressively, mirroring the LLM streaming experience.
function createLocalTextStream(text: string): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  const chars = Array.from(text);
  const chunkSize = 8;
  let index = 0;

  return new ReadableStream<Uint8Array>({
    async start(controller) {
      while (index < chars.length) {
        const slice = chars.slice(index, index + chunkSize).join("");
        controller.enqueue(encoder.encode(slice));
        index += chunkSize;
        await new Promise((resolve) => setTimeout(resolve, 25));
      }
      controller.close();
    },
  });
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
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

    const payload = {
      mentorId,
      chapterTitle: chapter.title,
      chapterText: chapter.text ?? "",
      messages,
    };

    if (isLlmEnabled()) {
      let upstream: Response;
      try {
        upstream = await openLlmStream(buildMentorMessages(payload));
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "导师暂时无法应答，请重试";
        return NextResponse.json({ message }, { status: 502 });
      }
      return new Response(createLlmTextStream(upstream), {
        headers: streamHeaders("llm"),
      });
    }

    const localReply = generateMentorReply(payload);
    return new Response(createLocalTextStream(localReply), {
      headers: streamHeaders("local"),
    });
  } catch (error) {
    console.error("Learn chat error:", error);
    const message =
      error instanceof Error ? error.message : "导师暂时无法应答，请重试";
    return NextResponse.json({ message }, { status: 502 });
  }
}
