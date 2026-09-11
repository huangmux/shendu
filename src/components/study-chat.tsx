"use client";

import Link from "next/link";
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
  llmConfigured: boolean | null;
};

async function readMentorStream(
  response: Response,
  onDelta: (content: string) => void
) {
  const contentType = response.headers.get("content-type") || "";
  if (!contentType.includes("text/event-stream")) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data.message || "导师没有回应");
  }
  if (!response.body) {
    throw new Error("导师没有回应");
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let content = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const chunks = buffer.split("\n\n");
    buffer = chunks.pop() ?? "";

    for (const chunk of chunks) {
      const line = chunk.trim();
      if (!line.startsWith("data:")) continue;
      const data = line.slice(5).trim();
      if (!data || data === "[DONE]") continue;
      const json = JSON.parse(data) as { delta?: string; error?: string };
      if (json.error) throw new Error(json.error);
      if (json.delta) {
        content += json.delta;
        onDelta(content);
      }
    }
  }

  if (!content.trim()) {
    throw new Error("大模型没有返回正文");
  }
  return content;
}

export function StudyChat({
  open,
  onOpenChange,
  documentId,
  chapterId,
  chapterTitle,
  mentorId,
  llmConfigured,
}: StudyChatProps) {
  const mentor = mentorId ? getMentor(mentorId) : undefined;
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(open && llmConfigured !== false);
  const [error, setError] = useState("");
  const bottomRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open || !mentorId || !chapterId) return;
    if (llmConfigured === false) return;

    let cancelled = false;

    fetch(`/api/documents/${documentId}/learn`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chapterId, mentorId, messages: [] }),
    })
      .then(async (response) => {
        const content = await readMentorStream(response, (next) => {
          if (!cancelled) {
            setMessages([{ role: "assistant", content: next }]);
          }
        });
        if (!cancelled) {
          setMessages([{ role: "assistant", content }]);
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
  }, [open, documentId, chapterId, mentorId, llmConfigured]);

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
      const reply = await readMentorStream(response, (next) => {
        setMessages([...nextMessages, { role: "assistant", content: next }]);
      });
      setMessages([...nextMessages, { role: "assistant", content: reply }]);
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
            {llmConfigured ? " · 大模型陪学" : ""}
          </DialogDescription>
        </DialogHeader>

        <div className="min-h-0 flex-1 space-y-3 overflow-y-auto rounded-lg bg-[#F7F1E8]/70 p-3">
          {llmConfigured === false && (
            <p className="text-sm text-orange-800">
              导师陪学需要先接入大模型。请到
              <Link href="/settings" className="mx-1 underline">
                模型设置
              </Link>
              填写兼容 OpenAI 的接口。
            </p>
          )}
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
          <div ref={bottomRef} />
        </div>

        <div className="flex items-end gap-2">
          <Textarea
            value={input}
            onChange={(event) => setInput(event.target.value)}
            placeholder="写下你的理解，按 Enter 发送"
            className="min-h-16 bg-white"
            disabled={llmConfigured === false}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                void send();
              }
            }}
          />
          <Button onClick={() => void send()} disabled={loading || !input.trim() || llmConfigured === false}>
            发送
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
