"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ArrowLeft, BookOpen, Edit3, CheckCircle, AlertCircle, XCircle, Sparkles } from "lucide-react";
import { MENTORS, type MentorId } from "@/lib/mentors";
import { StudyChat } from "@/components/study-chat";
import { AppHeader } from "@/components/app-header";
import { LlmBanner } from "@/components/llm-banner";
import { ChapterInsight } from "@/components/chapter-insight";

interface Chapter {
  id: string;
  index: number;
  title: string;
  pageStart: number;
  pageEnd: number;
  text?: string | null;
  source: string;
  summary?: string | null;
  keyPoints?: string[];
  questions?: string[];
}

interface Document {
  id: string;
  title: string;
  pageCount: number;
  intent: string;
  parseStatus: string;
  createdAt: string;
  chapters: Chapter[];
}

const INTENT_LABELS = {
  academic: "教材",
  work: "工作材料",
  interest: "兴趣读物",
};

const PARSE_STATUS_CONFIG = {
  pending: { label: "解析中", color: "bg-yellow-100 text-yellow-800", icon: AlertCircle },
  ok: { label: "解析完成", color: "bg-green-100 text-green-800", icon: CheckCircle },
  poor: { label: "解析质量较低", color: "bg-orange-100 text-orange-800", icon: AlertCircle },
  failed: { label: "解析失败", color: "bg-red-100 text-red-800", icon: XCircle },
};

export default function DocumentPage() {
  const params = useParams();
  const router = useRouter();
  const documentId = params.id as string;

  const [document, setDocument] = useState<Document | null>(null);
  const [selectedChapter, setSelectedChapter] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>("");
  const [editingChapter, setEditingChapter] = useState<Chapter | null>(null);
  const [editForm, setEditForm] = useState({ title: "", pageStart: "", pageEnd: "" });
  const [activeMentor, setActiveMentor] = useState<MentorId | "">("");
  const [llmConfigured, setLlmConfigured] = useState<boolean | null>(null);
  const [reparsing, setReparsing] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/documents/${documentId}`)
      .then(async (response) => {
        if (!response.ok) {
          throw new Error("文档不存在或已被删除");
        }
        return response.json();
      })
      .then((doc: Document) => {
        if (cancelled) return;
        setDocument(doc);
        setSelectedChapter((prev) => prev || doc.chapters?.[0]?.id || "");
        setError("");
        setLoading(false);
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : "加载失败");
        setLoading(false);
      });
    fetch("/api/health")
      .then((response) => response.json())
      .then((data) => {
        if (!cancelled) setLlmConfigured(Boolean(data.llm?.configured));
      })
      .catch(() => {
        if (!cancelled) setLlmConfigured(null);
      });
    return () => {
      cancelled = true;
    };
  }, [documentId]);

  const refreshDocument = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/documents/${documentId}`);
      if (!response.ok) {
        throw new Error("文档不存在或已被删除");
      }
      const doc = await response.json();
      setDocument(doc);
      setSelectedChapter((prev) => prev || doc.chapters?.[0]?.id || "");
    } catch (err) {
      setError(err instanceof Error ? err.message : "加载失败");
    } finally {
      setLoading(false);
    }
  };

  const handleEditChapter = (chapter: Chapter) => {
    setEditingChapter(chapter);
    setEditForm({
      title: chapter.title,
      pageStart: chapter.pageStart.toString(),
      pageEnd: chapter.pageEnd.toString(),
    });
  };

  const handleSaveChapter = async () => {
    if (!editingChapter) return;

    try {
      const response = await fetch(`/api/documents/${documentId}/chapters/${editingChapter.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: editForm.title,
          pageStart: parseInt(editForm.pageStart),
          pageEnd: parseInt(editForm.pageEnd),
        }),
      });

      if (!response.ok) {
        throw new Error("更新失败");
      }

      await refreshDocument();
      setEditingChapter(null);
    } catch {
      alert("更新失败，请重试");
    }
  };

  const handleReparse = async () => {
    setReparsing(true);
    try {
      const response = await fetch(`/api/documents/${documentId}/reparse`, { method: "POST" });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.message || "智能划分失败");
      }
      setDocument(data);
      setSelectedChapter(data.chapters?.[0]?.id || "");
    } catch (err) {
      alert(err instanceof Error ? err.message : "智能划分失败，请重试");
    } finally {
      setReparsing(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#F7F1E8] flex items-center justify-center">
        <div className="text-center">
          <BookOpen className="w-12 h-12 text-blue-600 mx-auto mb-4 animate-pulse" />
          <p className="text-lg text-gray-600">正在加载文档...</p>
        </div>
      </div>
    );
  }

  if (error || !document) {
    return (
      <div className="min-h-screen bg-[#F7F1E8] flex items-center justify-center">
        <div className="text-center">
          <XCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <p className="text-lg text-gray-700 mb-4">{error}</p>
          <Button onClick={() => router.push("/")} variant="outline">
            <ArrowLeft className="w-4 h-4 mr-2" />
            返回首页
          </Button>
        </div>
      </div>
    );
  }

  const statusConfig = PARSE_STATUS_CONFIG[document.parseStatus as keyof typeof PARSE_STATUS_CONFIG];
  const StatusIcon = statusConfig.icon;
  const currentChapter = document.chapters.find((chapter) => chapter.id === selectedChapter);

  return (
    <div className="min-h-screen bg-[#F7F1E8]">
      <AppHeader
        extra={
          <>
            <Badge variant="secondary">
              {INTENT_LABELS[document.intent as keyof typeof INTENT_LABELS]}
            </Badge>
            <Badge className={statusConfig.color}>
              <StatusIcon className="w-3 h-3 mr-1" />
              {statusConfig.label}
            </Badge>
            <Button variant="ghost" size="sm" onClick={() => router.push("/")}>
              <ArrowLeft className="w-4 h-4" />
              首页
            </Button>
          </>
        }
      />

      <div className="max-w-6xl mx-auto px-6 py-8 space-y-6">
        <div>
          <h2 className="text-2xl font-bold text-gray-800">{document.title}</h2>
          <p className="mt-1 text-sm text-gray-500">共 {document.pageCount} 页 · {document.chapters.length} 章</p>
        </div>

        <LlmBanner configured={llmConfigured} />

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-1">
            <Card className="bg-white/70 backdrop-blur-sm border-amber-200/50 shadow-lg sticky top-4">
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <span>章节目录</span>
                  <Badge variant="outline">{document.chapters.length} 章</Badge>
                </CardTitle>
                <CardDescription>
                  {document.parseStatus === "poor" && (
                    <span className="text-orange-600 block mt-1">
                      规则解析较粗，可用大模型重新划分章节
                    </span>
                  )}
                  <Button
                    size="sm"
                    variant="outline"
                    className="mt-3 w-full"
                    disabled={reparsing || llmConfigured === false}
                    onClick={() => void handleReparse()}
                  >
                    <Sparkles className="h-3.5 w-3.5" />
                    {reparsing ? "正在智能划分…" : "用大模型划分章节"}
                  </Button>
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-2 max-h-96 overflow-y-auto">
                {document.chapters.map((chapter) => (
                  <div
                    key={chapter.id}
                    className={`p-3 border rounded-lg cursor-pointer transition-all duration-200 group ${
                      selectedChapter === chapter.id
                        ? "bg-blue-50 border-blue-300 shadow-sm"
                        : "bg-white/50 border-gray-200 hover:border-gray-300 hover:bg-white/80"
                    }`}
                    onClick={() => setSelectedChapter(chapter.id)}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1 min-w-0">
                        <h4 className="font-medium text-sm text-gray-900 truncate">{chapter.title}</h4>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-xs text-gray-500">
                            第 {chapter.pageStart}-{chapter.pageEnd} 页
                          </span>
                          {chapter.source === "manual" && (
                            <Badge variant="outline" className="text-xs">
                              手动
                            </Badge>
                          )}
                          {chapter.source === "llm" && (
                            <Badge variant="outline" className="text-xs">
                              大模型
                            </Badge>
                          )}
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="opacity-0 group-hover:opacity-100 transition-opacity p-1 h-auto"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleEditChapter(chapter);
                        }}
                      >
                        <Edit3 className="w-3 h-3" />
                      </Button>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>

          <div className="lg:col-span-2">
            <Card className="bg-white/70 backdrop-blur-sm border-amber-200/50 shadow-lg min-h-96">
              <CardContent className="p-8">
                {currentChapter ? (
                  <div className="space-y-6">
                    <div>
                      <h2 className="text-2xl font-bold text-gray-800 mb-4">{currentChapter.title}</h2>
                      <div className="flex items-center gap-4 mb-6 text-sm text-gray-600">
                        <span>
                          第 {currentChapter.pageStart}-{currentChapter.pageEnd} 页
                        </span>
                        <span>•</span>
                        <span>共 {currentChapter.pageEnd - currentChapter.pageStart + 1} 页</span>
                      </div>

                      <ChapterInsight
                        documentId={documentId}
                        chapterId={currentChapter.id}
                        summary={currentChapter.summary}
                        keyPoints={currentChapter.keyPoints}
                        questions={currentChapter.questions}
                        llmConfigured={llmConfigured}
                        onUpdated={(insight) => {
                          setDocument((prev) =>
                            prev
                              ? {
                                  ...prev,
                                  chapters: prev.chapters.map((chapter) =>
                                    chapter.id === currentChapter.id
                                      ? { ...chapter, ...insight }
                                      : chapter
                                  ),
                                }
                              : prev
                          );
                        }}
                      />

                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 my-8">
                        {MENTORS.map((mentor) => (
                          <Card
                            key={mentor.id}
                            className="bg-gradient-to-br from-white/80 to-gray-50/80 border-gray-200/50 hover:shadow-md hover:border-blue-300 transition-shadow cursor-pointer"
                            onClick={() => setActiveMentor(mentor.id)}
                          >
                            <CardContent className="p-4 text-center">
                              <div className="text-2xl mb-2">{mentor.avatar}</div>
                              <h4 className="font-medium text-gray-800">{mentor.name}</h4>
                              <p className="text-xs text-gray-600">{mentor.description}</p>
                              <div className="mt-3">
                                <Button
                                  size="sm"
                                  className="w-full"
                                  onClick={(event) => {
                                    event.stopPropagation();
                                    setActiveMentor(mentor.id);
                                  }}
                                >
                                  开始学习
                                </Button>
                              </div>
                            </CardContent>
                          </Card>
                        ))}
                      </div>

                      <div className="bg-gray-50/50 rounded-lg p-6">
                        <h3 className="font-medium text-gray-800 mb-3 flex items-center gap-2">
                          <BookOpen className="w-4 h-4" />
                          章节内容预览
                        </h3>
                        <div className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap max-h-48 overflow-y-auto">
                          {currentChapter.text ? (
                            currentChapter.text.substring(0, 500) +
                            (currentChapter.text.length > 500 ? "..." : "")
                          ) : (
                            <span className="text-gray-500 italic">暂无内容预览</span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-12">
                    <BookOpen className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                    <h3 className="text-lg font-medium text-gray-600 mb-2">选择章节开始阅读</h3>
                    <p className="text-gray-500">从左侧目录中选择一个章节来查看详细内容</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      <StudyChat
        key={`${selectedChapter}-${activeMentor}`}
        open={!!activeMentor}
        onOpenChange={(open) => {
          if (!open) setActiveMentor("");
        }}
        documentId={documentId}
        chapterId={selectedChapter}
        chapterTitle={currentChapter?.title ?? ""}
        mentorId={activeMentor}
        llmConfigured={llmConfigured}
      />

      <Dialog open={!!editingChapter} onOpenChange={(open) => !open && setEditingChapter(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>编辑章节</DialogTitle>
            <DialogDescription>修改章节标题和页码范围</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">章节标题</label>
              <Input
                value={editForm.title}
                onChange={(e) => setEditForm({ ...editForm, title: e.target.value })}
                placeholder="请输入章节标题"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium text-gray-700 mb-1 block">起始页</label>
                <Input
                  type="number"
                  value={editForm.pageStart}
                  onChange={(e) => setEditForm({ ...editForm, pageStart: e.target.value })}
                  min="1"
                  max={document.pageCount}
                />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700 mb-1 block">结束页</label>
                <Input
                  type="number"
                  value={editForm.pageEnd}
                  onChange={(e) => setEditForm({ ...editForm, pageEnd: e.target.value })}
                  min="1"
                  max={document.pageCount}
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingChapter(null)}>
              取消
            </Button>
            <Button onClick={handleSaveChapter}>保存修改</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
