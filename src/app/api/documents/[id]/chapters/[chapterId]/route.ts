import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; chapterId: string }> }
) {
  try {
    const { id: documentId, chapterId } = await params;
    const { title, pageStart, pageEnd } = await request.json();

    // Validate input
    if (!title || typeof pageStart !== 'number' || typeof pageEnd !== 'number') {
      return NextResponse.json(
        { message: '请提供有效的章节标题和页码范围' },
        { status: 400 }
      );
    }

    if (pageStart < 1 || pageEnd < pageStart) {
      return NextResponse.json(
        { message: '页码范围无效' },
        { status: 400 }
      );
    }

    // Check if chapter exists and belongs to the document
    const existingChapter = await prisma.chapter.findFirst({
      where: {
        id: chapterId,
        documentId: documentId
      }
    });

    if (!existingChapter) {
      return NextResponse.json(
        { message: '章节不存在' },
        { status: 404 }
      );
    }

    // Update chapter
    const updatedChapter = await prisma.chapter.update({
      where: { id: chapterId },
      data: {
        title,
        pageStart,
        pageEnd,
        source: 'manual' // Mark as manually edited
      }
    });

    return NextResponse.json(updatedChapter);
  } catch (error) {
    console.error('Update chapter error:', error);
    return NextResponse.json(
      { message: '服务器错误' },
      { status: 500 }
    );
  }
}