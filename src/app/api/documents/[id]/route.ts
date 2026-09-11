import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { serializeChapter } from "@/lib/insight";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const document = await prisma.document.findUnique({
      where: { id },
      include: {
        chapters: {
          orderBy: { index: "asc" },
        },
      },
    });

    if (!document) {
      return NextResponse.json({ message: "文档不存在" }, { status: 404 });
    }

    return NextResponse.json({
      ...document,
      chapters: document.chapters.map(serializeChapter),
    });
  } catch (error) {
    console.error("Fetch document error:", error);
    return NextResponse.json({ message: "服务器错误" }, { status: 500 });
  }
}
