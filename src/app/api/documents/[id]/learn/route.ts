import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { chatWithLlm, isLlmEnabled } from "@/lib/llm";
import {
  buildMentorMessages,
  generateMentorReply,
  getMentor,
  type ChatMessage,
} from "@/lib/mentors";

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
      const content = await chatWithLlm(buildMentorMessages(payload));
      return NextResponse.json({ content, source: "llm" });
    }

    return NextResponse.json({
      content: generateMentorReply(payload),
      source: "local",
    });
  } catch (error) {
    console.error("Learn chat error:", error);
    const message = error instanceof Error ? error.message : "导师暂时无法应答，请重试";
    return NextResponse.json({ message }, { status: 502 });
  }
}
