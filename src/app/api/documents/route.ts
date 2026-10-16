import { NextRequest, NextResponse } from "next/server";
import { writeFile } from "fs/promises";
import { randomUUID } from "crypto";
import { prisma } from "@/lib/prisma";
import { ensureUploadDir, parsePdfChapters, resolveUploadPath } from "@/lib/pdf";

function getClientId(request: NextRequest): string {
  const clientId = request.cookies.get("clientId")?.value;
  return clientId || randomUUID();
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get("file") as File;
    const intent = formData.get("intent") as string;

    if (!file) {
      return NextResponse.json({ message: "请上传PDF文件" }, { status: 400 });
    }

    if (!intent) {
      return NextResponse.json({ message: "请选择阅读类型" }, { status: 400 });
    }

    if (file.type !== "application/pdf") {
      return NextResponse.json({ message: "只支持PDF文件" }, { status: 400 });
    }

    const maxSize = 10 * 1024 * 1024;
    if (file.size > maxSize) {
      return NextResponse.json({ message: "文件大小不能超过10MB" }, { status: 400 });
    }

    const fileName = `${randomUUID()}.pdf`;
    await ensureUploadDir();
    const pdfBytes = new Uint8Array(await file.arrayBuffer());
    await writeFile(resolveUploadPath(fileName), pdfBytes);

    const clientId = getClientId(request);
    const title = file.name.replace(/\.pdf$/i, "");
    const { chapters, totalPages, parseStatus } = await parsePdfChapters(pdfBytes, title);

    const document = await prisma.document.create({
      data: {
        title,
        filePath: fileName,
        pageCount: totalPages,
        intent,
        parseStatus,
        clientId,
        chapters: {
          create: chapters,
        },
      },
      include: {
        chapters: true,
      },
    });

    const response = NextResponse.json({
      id: document.id,
      title: document.title,
      parseStatus: document.parseStatus,
      chaptersCount: chapters.length,
    });

    if (!request.cookies.get("clientId")?.value) {
      response.cookies.set("clientId", clientId, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        maxAge: 60 * 60 * 24 * 365,
      });
    }

    return response;
  } catch (error) {
    console.error("Document upload error:", error);
    return NextResponse.json({ message: "服务器错误，请重试" }, { status: 500 });
  }
}
