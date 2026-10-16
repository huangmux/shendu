import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { chatWithLlmJson, isLlmEnabled, llmRequiredPayload } from "@/lib/llm";
import { buildInsightMessages, parseInsight, serializeChapter } from "@/lib/insight";

export const maxDuration = 60;

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; chapterId: string }> }
) {
  const { id: documentId, chapterId } = await params;
  const chapter = await prisma.chapter.findFirst({
    where: { id: chapterId, documentId },
  });
  if (!chapter) {
    return NextResponse.json({ message: "章节不存在" }, { status: 404 });
  }
  return NextResponse.json(serializeChapter(chapter));
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; chapterId: string }> }
) {
  try {
    if (!(await isLlmEnabled())) {
      return NextResponse.json(llmRequiredPayload(), { status: 503 });
    }

    const { id: documentId, chapterId } = await params;
    const body = await request.json().catch(() => ({}));
    const force = Boolean(body.force);

    const chapter = await prisma.chapter.findFirst({
      where: { id: chapterId, documentId },
      include: { document: true },
    });
    if (!chapter) {
      return NextResponse.json({ message: "章节不存在" }, { status: 404 });
    }

    if (chapter.summary && !force) {
      return NextResponse.json(serializeChapter(chapter));
    }

    const insight = parseInsight(
      await chatWithLlmJson(
        buildInsightMessages({
          intent: chapter.document.intent,
          chapterTitle: chapter.title,
          chapterText: chapter.text ?? "",
        }),
        { timeoutMs: 90_000 }
      )
    );

    const updated = await prisma.chapter.update({
      where: { id: chapter.id },
      data: {
        summary: insight.summary,
        keyPoints: JSON.stringify(insight.keyPoints),
        questions: JSON.stringify(insight.questions),
        insightAt: new Date(),
      },
    });

    return NextResponse.json(serializeChapter(updated));
  } catch (error) {
    console.error("Chapter insight error:", error);
    const message = error instanceof Error ? error.message : "导读生成失败，请重试";
    return NextResponse.json({ message }, { status: 502 });
  }
}
