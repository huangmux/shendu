import { mkdir } from "fs/promises";
import { join } from "path";
import { extractText, getDocumentProxy } from "unpdf";

export type ParsedChapter = {
  index: number;
  title: string;
  pageStart: number;
  pageEnd: number;
  text: string;
  source: string;
};

export type ChapterPlan = {
  title: string;
  pageStart: number;
  pageEnd: number;
};

const CHAPTER_HEADING =
  /^(第[一二三四五六七八九十百千零〇两\d]+[章节回部篇]|Chapter\s+\d+|CHAPTER\s+\d+|第\d+[章节])\s*.{0,80}$/i;

export function getUploadDir() {
  return process.env.UPLOAD_DIR || join(process.cwd(), "uploads");
}

export async function ensureUploadDir() {
  const dir = getUploadDir();
  await mkdir(dir, { recursive: true });
  return dir;
}

export function resolveUploadPath(fileName: string) {
  return join(getUploadDir(), fileName);
}

export async function extractPdfPages(pdfBytes: Uint8Array) {
  const pdf = await getDocumentProxy(pdfBytes);
  const extracted = await extractText(pdf, { mergePages: false });
  const pages = (Array.isArray(extracted.text) ? extracted.text : [extracted.text]).map(
    (page) => page.replace(/\u0000/g, "").trimEnd()
  );
  return {
    pages,
    totalPages: extracted.totalPages || pages.length,
  };
}

export function textForPages(pages: string[], pageStart: number, pageEnd: number) {
  return pages
    .slice(Math.max(0, pageStart - 1), Math.max(pageStart, pageEnd))
    .join("\n")
    .trim();
}

export function applyChapterPlan(
  pages: string[],
  plan: ChapterPlan[],
  source = "auto"
): ParsedChapter[] {
  const totalPages = pages.length;
  const normalized = plan
    .map((chapter) => ({
      title: chapter.title.replace(/\s+/g, " ").trim().slice(0, 120) || "未命名章节",
      pageStart: Math.min(totalPages, Math.max(1, Math.round(chapter.pageStart))),
      pageEnd: Math.min(totalPages, Math.max(1, Math.round(chapter.pageEnd))),
    }))
    .filter((chapter) => chapter.pageEnd >= chapter.pageStart)
    .sort((a, b) => a.pageStart - b.pageStart);

  const chapters: ParsedChapter[] = [];
  for (const chapter of normalized) {
    const pageStart = chapters.length === 0 ? 1 : chapters[chapters.length - 1].pageEnd + 1;
    if (pageStart > totalPages) continue;
    const pageEnd = Math.min(totalPages, Math.max(pageStart, chapter.pageEnd));
    chapters.push({
      index: chapters.length + 1,
      title: chapter.title,
      pageStart,
      pageEnd,
      text: textForPages(pages, pageStart, pageEnd),
      source,
    });
  }

  if (chapters.length === 0) {
    return [
      {
        index: 1,
        title: "完整文档",
        pageStart: 1,
        pageEnd: totalPages,
        text: pages.join("\n"),
        source: "auto",
      },
    ];
  }

  const last = chapters[chapters.length - 1];
  if (last.pageEnd < totalPages) {
    last.pageEnd = totalPages;
    last.text = textForPages(pages, last.pageStart, last.pageEnd);
  }

  return chapters;
}

export function detectChaptersByPattern(pages: string[], title: string): ParsedChapter[] {
  const found: ChapterPlan[] = [];

  for (let i = 0; i < pages.length; i++) {
    const lines = pages[i]
      .split(/\n+/)
      .map((line) => line.trim())
      .filter(Boolean);

    for (const line of lines.slice(0, 16)) {
      if (line.length < 2 || line.length > 80) continue;
      if (!CHAPTER_HEADING.test(line)) continue;
      const page = i + 1;
      const prev = found[found.length - 1];
      if (prev && prev.pageStart === page) break;
      found.push({ title: line, pageStart: page, pageEnd: page });
      break;
    }
  }

  if (found.length === 0) {
    return [
      {
        index: 1,
        title: `${title} - 完整文档`,
        pageStart: 1,
        pageEnd: pages.length,
        text: pages.join("\n"),
        source: "auto",
      },
    ];
  }

  const plan = found.map((chapter, index) => ({
    ...chapter,
    pageEnd: found[index + 1] ? found[index + 1].pageStart - 1 : pages.length,
  }));

  return applyChapterPlan(pages, plan, "auto");
}

export async function parsePdfChapters(pdfBytes: Uint8Array, title: string) {
  try {
    const { pages, totalPages } = await extractPdfPages(pdfBytes);
    const chapters = detectChaptersByPattern(pages, title);
    return {
      chapters,
      pages,
      totalPages,
      parseStatus: chapters.length > 1 ? "ok" : "poor",
    };
  } catch (error) {
    console.error("PDF parsing error:", error);
    return {
      chapters: [] as ParsedChapter[],
      pages: [] as string[],
      totalPages: 0,
      parseStatus: "failed",
    };
  }
}
