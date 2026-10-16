import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { chatWithLlmJson, isLlmEnabled, llmRequiredPayload } from "@/lib/llm";
import { buildReparseMessages, parseChapterPlan, serializeChapter } from "@/lib/insight";
import { applyChapterPlan, extractPdfPages, resolveUploadPath } from "@/lib/pdf";
import { readFile } from "fs/promises";

export const maxDuration = 60;

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    if (!(await isLlmEnabled())) {
      return NextResponse.json(llmRequiredPayload(), { status: 503 });
    }

    const { id: documentId } = await params;
    const document = await prisma.document.findUnique({ where: { id: documentId } });
    if (!document) {
      return NextResponse.json({ message: "文档不存在" }, { status: 404 });
    }

    const pdfBytes = new Uint8Array(await readFile(resolveUploadPath(document.filePath)));
    const { pages, totalPages } = await extractPdfPages(pdfBytes);
    if (pages.length === 0) {
      return NextResponse.json({ message: "无法读取 PDF 文本" }, { status: 422 });
    }

    const plan = parseChapterPlan(
      await chatWithLlmJson(buildReparseMessages({ title: document.title, pages }), {
        timeoutMs: 90_000,
      }),
      totalPages
    );
    const chapters = applyChapterPlan(pages, plan, "llm");

    await prisma.document.update({
      where: { id: documentId },
      data: {
        pageCount: totalPages,
        parseStatus: chapters.length > 1 ? "ok" : "poor",
        chapters: {
          deleteMany: {},
          create: chapters.map((chapter) => ({
            index: chapter.index,
            title: chapter.title,
            pageStart: chapter.pageStart,
            pageEnd: chapter.pageEnd,
            text: chapter.text,
            source: chapter.source,
          })),
        },
      },
    });

    const updated = await prisma.document.findUnique({
      where: { id: documentId },
      include: { chapters: { orderBy: { index: "asc" } } },
    });

    return NextResponse.json(
      updated
        ? { ...updated, chapters: updated.chapters.map(serializeChapter) }
        : updated
    );
  } catch (error) {
    console.error("LLM reparse error:", error);
    const message = error instanceof Error ? error.message : "智能划分章节失败，请重试";
    return NextResponse.json({ message }, { status: 502 });
  }
}
