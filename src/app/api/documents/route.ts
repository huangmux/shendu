import { NextRequest, NextResponse } from 'next/server';
import { writeFile } from 'fs/promises';
import { join } from 'path';
import { randomUUID } from 'crypto';
import { prisma } from '@/lib/prisma';
import { extractText } from 'unpdf';

// Helper function to generate client ID from cookies or create new one
function getClientId(request: NextRequest): string {
  const clientId = request.cookies.get('clientId')?.value;
  return clientId || randomUUID();
}

// Helper function to parse PDF chapters
async function parseChapters(pdfBuffer: Buffer, title: string) {
  try {
    // Extract text and metadata from PDF
    const { text, totalPages } = await extractText(pdfBuffer, { mergePages: true });
    
    const chapters: Array<{
      index: number;
      title: string;
      pageStart: number;
      pageEnd: number;
      text: string;
      source: string;
    }> = [];

    // First, try to extract chapters from PDF outline/bookmarks
    // For now, we'll implement a simple chapter detection based on common patterns
    const lines = text.split('\n').filter(line => line.trim().length > 0);
    const chapterPattern = /^(第[一二三四五六七八九十\d]+章|Chapter\s+\d+|CHAPTER\s+\d+|\d+\.|第\d+章)/i;
    
    let currentChapter: { 
      index: number; 
      title: string; 
      pageStart: number; 
      text: string; 
    } | null = null;
    let chapterIndex = 0;
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      
      if (chapterPattern.test(line)) {
        // Save previous chapter if exists
        if (currentChapter) {
          chapters.push({
            ...currentChapter,
            pageEnd: Math.min(currentChapter.pageStart + Math.floor(totalPages / (chapterIndex + 1)), totalPages),
            source: 'auto'
          });
        }
        
        // Start new chapter
        chapterIndex++;
        currentChapter = {
          index: chapterIndex,
          title: line.length > 100 ? line.substring(0, 100) + '...' : line,
          pageStart: Math.max(1, Math.floor((i / lines.length) * totalPages)),
          text: ''
        };
      } else if (currentChapter) {
        // Add content to current chapter
        currentChapter.text += line + '\n';
      }
    }
    
    // Save last chapter if exists
    if (currentChapter) {
      chapters.push({
        ...currentChapter,
        pageEnd: totalPages,
        source: 'auto'
      });
    }
    
    // If no chapters found, create a single chapter for the entire document
    if (chapters.length === 0) {
      chapters.push({
        index: 1,
        title: `${title} - 完整文档`,
        pageStart: 1,
        pageEnd: totalPages,
        text: text,
        source: 'auto'
      });
    }
    
    return { chapters, totalPages, parseStatus: chapters.length > 1 ? 'ok' : 'poor' };
  } catch (error) {
    console.error('PDF parsing error:', error);
    return { chapters: [], totalPages: 0, parseStatus: 'failed' };
  }
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;
    const intent = formData.get('intent') as string;
    
    if (!file) {
      return NextResponse.json({ message: '请上传PDF文件' }, { status: 400 });
    }
    
    if (!intent) {
      return NextResponse.json({ message: '请选择阅读类型' }, { status: 400 });
    }
    
    if (file.type !== 'application/pdf') {
      return NextResponse.json({ message: '只支持PDF文件' }, { status: 400 });
    }
    
    const maxSize = 10 * 1024 * 1024; // 10MB
    if (file.size > maxSize) {
      return NextResponse.json({ message: '文件大小不能超过10MB' }, { status: 400 });
    }
    
    // Generate unique filename
    const fileName = `${randomUUID()}.pdf`;
    const filePath = join(process.cwd(), 'uploads', fileName);
    
    // Save file
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    await writeFile(filePath, buffer);
    
    // Get or create client ID
    const clientId = getClientId(request);
    
    // Parse PDF and extract chapters
    const title = file.name.replace(/\.pdf$/i, '');
    const { chapters, totalPages, parseStatus } = await parseChapters(buffer, title);
    
    // Create document record
    const document = await prisma.document.create({
      data: {
        title,
        filePath: fileName,
        pageCount: totalPages,
        intent,
        parseStatus,
        clientId,
        chapters: {
          create: chapters
        }
      },
      include: {
        chapters: true
      }
    });
    
    // Set client ID cookie if it's new
    const response = NextResponse.json({ 
      id: document.id, 
      title: document.title,
      parseStatus: document.parseStatus,
      chaptersCount: chapters.length 
    });
    
    if (!request.cookies.get('clientId')?.value) {
      response.cookies.set('clientId', clientId, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 60 * 60 * 24 * 365 // 1 year
      });
    }
    
    return response;
    
  } catch (error) {
    console.error('Document upload error:', error);
    return NextResponse.json(
      { message: '服务器错误，请重试' }, 
      { status: 500 }
    );
  }
}