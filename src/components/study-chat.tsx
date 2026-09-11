"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { getMentor, type ChatMessage, type MentorId } from "@/lib/mentors";

type StudyChatProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  documentId: string;
  chapterId: string;
  chapterTitle: string;
  mentorId: MentorId | "";
};

export function StudyChat({
  open,
  onOpenChange,
  documentId,
  chapterId,
  chapterTitle,
  mentorId,
}: StudyChatProps) {
  const mentor = mentorId ? getMentor(mentorId) : undefined;
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [source, setSource] = useState<"llm" | "local" | "">("");
  const bottomRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open || !mentorId || !chapterId) return;

    let cancelled = false;
    setMessages([]);
    setInput("");
    setError("");
    setSource("");
    setLoading(true);

    fetch(`/api/documents/${documentId}/learn`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chapterId, mentorId, messages: [] }),
    })
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.message || "开始学习失败");
        if (!cancelled) {
          setSource(data.source === "llm" ? "llm" : "local");
          setMessages([{ role: "assistant", content: data.content }]);
        }
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : "开始学习失败");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [open, documentId, chapterId, mentorId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  const send = async () => {
    const content = input.trim();
    if (!content || loading || !mentorId) return;

    const nextMessages: ChatMessage[] = [...messages, { role: "user", content }];
    setMessages(nextMessages);
    setInput("");
    setLoading(true);
    setError("");

    try {
      const response = await fetch(`/api/documents/${documentId}/learn`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chapterId, mentorId, messages: nextMessages }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || "导师没有回应");
      setSource(data.source === "llm" ? "llm" : "local");
      setMessages([...nextMessages, { role: "assistant", content: data.content }]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "发送失败");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[85vh] w-full flex-col gap-3 sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <span className="text-xl">{mentor?.avatar}</span>
            与{mentor?.name ?? "导师"}一起学习
          </DialogTitle>
          <DialogDescription>
            当前章节：{chapterTitle || "未选择章节"}
            {source === "llm"
              ? " · 大模型陪学"
              : source === "local"
                ? " · 未配置大模型，当前为本地引导"
                : ""}
          </DialogDescription>
        </DialogHeader>

        <div className="min-h-0 flex-1 space-y-3 overflow-y-auto rounded-lg bg-[#F7F1E8]/70 p-3">
          {messages.map((message, index) => (
            <div
              key={`${message.role}-${index}`}
              className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}
            >
              <div
                className={`max-w-[85%] whitespace-pre-wrap rounded-2xl px-3 py-2 text-sm leading-relaxed ${
                  message.role === "user"
                    ? "bg-blue-700 text-white"
                    : "bg-white text-gray-800 shadow-sm"
                }`}
              >
                {message.content}
              </div>
            </div>
          ))}
          {loading && (
            <p className="text-sm text-gray-500">{mentor?.name}正在思考…</p>
          )}
          {error && <p className="text-sm text-red-600">{error}</p>}
          <div ref={bottomRef} />
        </div>

        <div className="flex items-end gap-2">
          <Textarea
            value={input}
            onChange={(event) => setInput(event.target.value)}
            placeholder="写下你的理解，按 Enter 发送"
            className="min-h-16 bg-white"
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                void send();
              }
            }}
          />
          <Button onClick={() => void send()} disabled={loading || !input.trim()}>
            发送
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
