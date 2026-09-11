"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Upload, BookOpen, FileText, Heart } from "lucide-react";
import { AppHeader } from "@/components/app-header";
import { LlmBanner } from "@/components/llm-banner";

const INTENT_OPTIONS = [
  {
    id: "academic",
    label: "教材",
    description: "学术论文、教材、研究资料",
    icon: BookOpen,
    color: "bg-blue-100 text-blue-800 border-blue-200 hover:bg-blue-200",
  },
  {
    id: "work",
    label: "工作材料",
    description: "报告、手册、技术文档",
    icon: FileText,
    color: "bg-green-100 text-green-800 border-green-200 hover:bg-green-200",
  },
  {
    id: "interest",
    label: "兴趣读物",
    description: "小说、随笔、自传",
    icon: Heart,
    color: "bg-rose-100 text-rose-800 border-rose-200 hover:bg-rose-200",
  },
];

export default function Home() {
  const [selectedIntent, setSelectedIntent] = useState<string>("");
  const [uploading, setUploading] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [llmConfigured, setLlmConfigured] = useState<boolean | null>(null);
  const router = useRouter();

  useEffect(() => {
    fetch("/api/health")
      .then((response) => response.json())
      .then((data) => setLlmConfigured(Boolean(data.llm?.configured)))
      .catch(() => setLlmConfigured(null));
  }, []);

  const handleFileUpload = async (file: File) => {
    if (!file || !selectedIntent) {
      alert("请选择阅读类型并上传PDF文件");
      return;
    }

    if (file.type !== "application/pdf") {
      alert("请上传PDF文件");
      return;
    }

    setUploading(true);

    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("intent", selectedIntent);

      const response = await fetch("/api/documents", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "上传失败");
      }

      const { id } = await response.json();
      router.push(`/documents/${id}`);
    } catch (error) {
      console.error("Upload error:", error);
      alert("上传失败，请重试");
    } finally {
      setUploading(false);
    }
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileUpload(e.dataTransfer.files[0]);
    }
  };

  return (
    <div className="min-h-screen bg-[#F7F1E8] flex flex-col">
      <AppHeader />

      <main className="flex-1 flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-2xl space-y-8">
          <div className="text-center space-y-4">
            <h2 className="text-4xl font-bold text-gray-800 mb-2">深度阅读，智慧启迪</h2>
            <p className="text-lg text-gray-600">
              上传 PDF，由大模型生成导读，并与苏格拉底、费曼、诸葛亮一起精读每一章
            </p>
          </div>

          <LlmBanner configured={llmConfigured} />

          <Card className="bg-white/70 backdrop-blur-sm border-amber-200/50 shadow-lg">
            <CardHeader>
              <CardTitle className="text-xl text-gray-800">选择阅读类型</CardTitle>
              <CardDescription>请先选择您要阅读的文档类型</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {INTENT_OPTIONS.map((option) => {
                  const Icon = option.icon;
                  return (
                    <div
                      key={option.id}
                      className={`p-4 border-2 rounded-lg cursor-pointer transition-all duration-200 ${
                        selectedIntent === option.id
                          ? option.color + " border-current"
                          : "bg-white/50 border-gray-200 hover:border-gray-300"
                      }`}
                      onClick={() => setSelectedIntent(option.id)}
                    >
                      <div className="flex flex-col items-center text-center space-y-2">
                        <Icon className="w-8 h-8" />
                        <h3 className="font-semibold">{option.label}</h3>
                        <p className="text-sm opacity-80">{option.description}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          <Card className="bg-white/70 backdrop-blur-sm border-amber-200/50 shadow-lg">
            <CardHeader>
              <CardTitle className="text-xl text-gray-800">上传PDF文档</CardTitle>
              <CardDescription>支持拖拽上传或点击选择文件</CardDescription>
            </CardHeader>
            <CardContent>
              <div
                className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
                  dragActive
                    ? "border-blue-400 bg-blue-50"
                    : "border-gray-300 hover:border-gray-400"
                } ${!selectedIntent ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}`}
                onDragEnter={handleDrag}
                onDragLeave={handleDrag}
                onDragOver={handleDrag}
                onDrop={handleDrop}
                onClick={() => {
                  if (!selectedIntent) {
                    alert("请先选择阅读类型");
                    return;
                  }
                  const input = document.createElement("input");
                  input.type = "file";
                  input.accept = ".pdf";
                  input.onchange = (e) => {
                    const target = e.target as HTMLInputElement;
                    if (target.files && target.files[0]) {
                      handleFileUpload(target.files[0]);
                    }
                  };
                  input.click();
                }}
              >
                <Upload className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                <p className="text-lg font-medium text-gray-700 mb-2">
                  {uploading ? "正在上传..." : "点击或拖拽PDF文件到此处"}
                </p>
                <p className="text-sm text-gray-500">支持最大 10MB 的PDF文件</p>
                {!selectedIntent && (
                  <p className="text-sm text-red-500 mt-2">请先选择阅读类型</p>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}
