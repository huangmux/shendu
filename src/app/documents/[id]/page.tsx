"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ArrowLeft, BookOpen, Edit3, CheckCircle, AlertCircle, XCircle, User } from "lucide-react";

interface Chapter {
  id: string;
  index: number;
  title: string;
  pageStart: number;
  pageEnd: number;
  text?: string | null;
  source: string;
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
  interest: "兴趣读物"
};

const PARSE_STATUS_CONFIG = {
  pending: { label: "解析中", color: "bg-yellow-100 text-yellow-800", icon: AlertCircle },
  ok: { label: "解析完成", color: "bg-green-100 text-green-800", icon: CheckCircle },
  poor: { label: "解析质量较低", color: "bg-orange-100 text-orange-800", icon: AlertCircle },
  failed: { label: "解析失败", color: "bg-red-100 text-red-800", icon: XCircle }
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

  useEffect(() => {
    fetchDocument();
  }, [documentId]);

  const fetchDocument = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/documents/${documentId}`);
      if (!response.ok) {
        throw new Error("文档不存在或已被删除");
      }
      const doc = await response.json();
      setDocument(doc);
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
      pageEnd: chapter.pageEnd.toString()
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
          pageEnd: parseInt(editForm.pageEnd)
        })
      });

      if (!response.ok) {
        throw new Error("更新失败");
      }

      await fetchDocument(); // Refresh document data
      setEditingChapter(null);
    } catch (err) {
      alert("更新失败，请重试");
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

  return (
    <div className="min-h-screen bg-[#F7F1E8]">
      {/* Header */}
      <header className="bg-white/50 border-b border-amber-200/30 backdrop-blur-sm">
        <div className="max-w-6xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={() => router.push("/")}
                className="flex items-center gap-2"
              >
                <ArrowLeft className="w-4 h-4" />
                返回首页
              </Button>
              <div className="flex items-center gap-3">
                <BookOpen className="w-6 h-6 text-blue-700" />
                <h1 className="text-xl font-bold text-gray-800 truncate max-w-md">
                  {document.title}
                </h1>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="secondary">
                {INTENT_LABELS[document.intent as keyof typeof INTENT_LABELS]}
              </Badge>
              <Badge className={statusConfig.color}>
                <StatusIcon className="w-3 h-3 mr-1" />
                {statusConfig.label}
              </Badge>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-6 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Chapter List */}
          <div className="lg:col-span-1">
            <Card className="bg-white/70 backdrop-blur-sm border-amber-200/50 shadow-lg sticky top-4">
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <span>章节目录</span>
                  <Badge variant="outline">{document.chapters.length} 章</Badge>
                </CardTitle>
                <CardDescription>
                  共 {document.pageCount} 页
                  {document.parseStatus === 'poor' && (
                    <span className="text-orange-600 block mt-1">
                      解析质量较低，建议手动调整页码范围
                    </span>
                  )}
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
                        <h4 className="font-medium text-sm text-gray-900 truncate">
                          {chapter.title}
                        </h4>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-xs text-gray-500">
                            第 {chapter.pageStart}-{chapter.pageEnd} 页
                          </span>
                          {chapter.source === 'manual' && (
                            <Badge variant="outline" className="text-xs">手动</Badge>
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

          {/* Main Content Area */}
          <div className="lg:col-span-2">
            <Card className="bg-white/70 backdrop-blur-sm border-amber-200/50 shadow-lg min-h-96">
              <CardContent className="p-8">
                {selectedChapter ? (
                  <div className="space-y-6">
                    {(() => {
                      const chapter = document.chapters.find(c => c.id === selectedChapter);
                      return chapter ? (
                        <div>
                          <h2 className="text-2xl font-bold text-gray-800 mb-4">{chapter.title}</h2>
                          <div className="flex items-center gap-4 mb-6 text-sm text-gray-600">
                            <span>第 {chapter.pageStart}-{chapter.pageEnd} 页</span>
                            <span>•</span>
                            <span>共 {chapter.pageEnd - chapter.pageStart + 1} 页</span>
                          </div>
                          
                          {/* Mentor Cards Placeholder */}
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
                            {[
                              { name: "苏格拉底", description: "哲学思辨导师", avatar: "🧙‍♂️" },
                              { name: "费曼", description: "科学启蒙导师", avatar: "🔬" },
                              { name: "诸葛亮", description: "战略智慧导师", avatar: "📜" }
                            ].map((mentor) => (
                              <Card key={mentor.name} className="bg-gradient-to-br from-white/80 to-gray-50/80 border-gray-200/50 hover:shadow-md transition-shadow cursor-not-allowed opacity-60">
                                <CardContent className="p-4 text-center">
                                  <div className="text-2xl mb-2">{mentor.avatar}</div>
                                  <h4 className="font-medium text-gray-800">{mentor.name}</h4>
                                  <p className="text-xs text-gray-600">{mentor.description}</p>
                                  <div className="mt-3">
                                    <Badge variant="outline" className="text-xs">即将上线</Badge>
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
                              {chapter.text ? (
                                chapter.text.substring(0, 500) + (chapter.text.length > 500 ? '...' : '')
                              ) : (
                                <span className="text-gray-500 italic">暂无内容预览</span>
                              )}
                            </div>
                          </div>
                        </div>
                      ) : null;
                    })()}
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

      {/* Edit Chapter Dialog */}
      <Dialog open={!!editingChapter} onOpenChange={(open) => !open && setEditingChapter(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>编辑章节</DialogTitle>
            <DialogDescription>
              修改章节标题和页码范围
            </DialogDescription>
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
            <Button onClick={handleSaveChapter}>
              保存修改
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}