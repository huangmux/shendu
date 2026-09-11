"use client";

import Link from "next/link";
import { useState } from "react";
import { Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";

type ChapterInsightProps = {
  documentId: string;
  chapterId: string;
  summary?: string | null;
  keyPoints?: string[];
  questions?: string[];
  llmConfigured: boolean | null;
  onUpdated: (insight: {
    summary: string;
    keyPoints: string[];
    questions: string[];
  }) => void;
};

export function ChapterInsight({
  documentId,
  chapterId,
  summary,
  keyPoints = [],
  questions = [],
  llmConfigured,
  onUpdated,
}: ChapterInsightProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const hasInsight = Boolean(summary);

  const generate = async (force: boolean) => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch(
        `/api/documents/${documentId}/chapters/${chapterId}/insight`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ force }),
        }
      );
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.message || "导读生成失败");
      }
      onUpdated({
        summary: data.summary,
        keyPoints: Array.isArray(data.keyPoints) ? data.keyPoints : [],
        questions: Array.isArray(data.questions) ? data.questions : [],
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "导读生成失败");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="rounded-xl border border-amber-200/70 bg-white/80 p-5">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h3 className="flex items-center gap-2 font-medium text-gray-800">
            <Sparkles className="h-4 w-4 text-blue-700" />
            本章导读
          </h3>
          <p className="mt-1 text-xs text-gray-500">由大模型根据章节原文生成摘要、要点和思考题</p>
        </div>
        <Button
          size="sm"
          variant={hasInsight ? "outline" : "default"}
          disabled={loading || llmConfigured === false}
          onClick={() => void generate(hasInsight)}
        >
          {loading ? "生成中…" : hasInsight ? "重新生成" : "生成导读"}
        </Button>
      </div>

      {llmConfigured === false && (
        <p className="text-sm text-orange-800">
          请先到
          <Link href="/settings" className="mx-1 underline">
            模型设置
          </Link>
          接入大模型。
        </p>
      )}

      {error && (
        <p className="text-sm text-red-600">
          {error}
          {error.includes("尚未配置") && (
            <>
              {" "}
              <Link href="/settings" className="underline">
                去配置
              </Link>
            </>
          )}
        </p>
      )}

      {hasInsight && (
        <div className="space-y-4 text-sm leading-relaxed text-gray-700">
          <p>{summary}</p>
          {keyPoints.length > 0 && (
            <div>
              <h4 className="mb-2 font-medium text-gray-800">关键要点</h4>
              <ul className="list-disc space-y-1 pl-5">
                {keyPoints.map((point) => (
                  <li key={point}>{point}</li>
                ))}
              </ul>
            </div>
          )}
          {questions.length > 0 && (
            <div>
              <h4 className="mb-2 font-medium text-gray-800">思考题</h4>
              <ol className="list-decimal space-y-1 pl-5">
                {questions.map((question) => (
                  <li key={question}>{question}</li>
                ))}
              </ol>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
