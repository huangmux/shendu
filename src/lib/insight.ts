import type { LlmMessage } from "@/lib/llm";
import { extractJsonObject } from "@/lib/llm";
import type { ChapterPlan } from "@/lib/pdf";

export type ChapterInsight = {
  summary: string;
  keyPoints: string[];
  questions: string[];
};

const INTENT_HINT: Record<string, string> = {
  academic: "这是教材或学术材料，导读要抓住概念、论证和定义。",
  work: "这是工作材料，导读要抓住结论、方法和可执行要点。",
  interest: "这是兴趣读物，导读要抓住主题、情节或作者意图。",
};

function asStringArray(value: unknown, max = 8) {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.replace(/\s+/g, " ").trim())
    .filter(Boolean)
    .slice(0, max);
}

export function parseStringArray(value: string | null | undefined) {
  if (!value) return [];
  try {
    return asStringArray(JSON.parse(value));
  } catch {
    return value
      .split(/\n+/)
      .map((item) => item.replace(/^[-*•\d.\s]+/, "").trim())
      .filter(Boolean);
  }
}

export function serializeChapter<T extends {
  keyPoints: string | null;
  questions: string | null;
}>(chapter: T): Omit<T, "keyPoints" | "questions"> & {
  keyPoints: string[];
  questions: string[];
} {
  return {
    ...chapter,
    keyPoints: parseStringArray(chapter.keyPoints),
    questions: parseStringArray(chapter.questions),
  };
}

export function parseInsight(raw: unknown): ChapterInsight {
  const data =
    typeof raw === "string" ? (extractJsonObject(raw) as Record<string, unknown>) : (raw as Record<string, unknown>);
  const summary = typeof data?.summary === "string" ? data.summary.trim() : "";
  const keyPoints = asStringArray(data?.keyPoints ?? data?.key_points, 6);
  const questions = asStringArray(data?.questions, 4);

  if (!summary || keyPoints.length === 0) {
    throw new Error("大模型返回的导读不完整");
  }

  return { summary, keyPoints, questions };
}

export function parseChapterPlan(raw: unknown, totalPages: number): ChapterPlan[] {
  const data =
    typeof raw === "string" ? (extractJsonObject(raw) as Record<string, unknown>) : (raw as Record<string, unknown>);
  const list = Array.isArray(data?.chapters) ? data.chapters : [];
  const chapters = list
    .map((item) => {
      if (!item || typeof item !== "object") return null;
      const chapter = item as Record<string, unknown>;
      const title = typeof chapter.title === "string" ? chapter.title : "";
      const pageStart = Number(chapter.pageStart ?? chapter.page_start);
      const pageEnd = Number(chapter.pageEnd ?? chapter.page_end);
      if (!title || !Number.isFinite(pageStart) || !Number.isFinite(pageEnd)) return null;
      return {
        title,
        pageStart: Math.min(totalPages, Math.max(1, pageStart)),
        pageEnd: Math.min(totalPages, Math.max(1, pageEnd)),
      };
    })
    .filter((item): item is ChapterPlan => item !== null);

  if (chapters.length === 0) {
    throw new Error("大模型没有给出有效的章节划分");
  }
  return chapters;
}

export function buildInsightMessages(input: {
  intent: string;
  chapterTitle: string;
  chapterText: string;
}): LlmMessage[] {
  const text = input.chapterText.slice(0, 12000);
  return [
    {
      role: "system",
      content: `你是「深读」的阅读导师，根据章节原文生成导读。${INTENT_HINT[input.intent] ?? ""}
只输出 JSON，不要 Markdown。格式：
{"summary":"120到200字的中文导读","keyPoints":["要点1","要点2"],"questions":["思考题1","思考题2"]}
要求：紧扣原文，不编造原文没有的信息；keyPoints 3到6条；questions 3条，用于引导学生自己思考。`,
    },
    {
      role: "user",
      content: `章节标题：${input.chapterTitle}\n\n章节正文：\n${text || "（正文为空，请根据标题做谨慎导读，并说明依据不足。）"}`,
    },
  ];
}

export function buildReparseMessages(input: {
  title: string;
  pages: string[];
}): LlmMessage[] {
  const outline = input.pages
    .map((page, index) => {
      const snippet = page.replace(/\s+/g, " ").trim().slice(0, 280);
      return `第${index + 1}页：${snippet || "（空白页）"}`;
    })
    .join("\n");

  return [
    {
      role: "system",
      content: `你是 PDF 目录分析助手，根据各页摘要划分章节。
只输出 JSON，不要 Markdown。格式：
{"chapters":[{"title":"第一章 标题","pageStart":1,"pageEnd":3}]}
规则：页码从 1 开始，不超过总页数；章节按页码递增且不重叠；覆盖全书；标题简洁，优先使用原文中的章名。`,
    },
    {
      role: "user",
      content: `文档标题：${input.title}\n总页数：${input.pages.length}\n\n${outline}`,
    },
  ];
}
