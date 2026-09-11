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
  const abortRef = useRef<AbortController | null>(null);

  // Streams one turn: posts `base` history, then progressively fills the
  // trailing assistant bubble as text arrives from the server.
  const runTurn = async (base: ChatMessage[], signal: AbortSignal) => {
    setError("");
    setInput("");
    setSource("");
    setLoading(true);
    setMessages([...base, { role: "assistant", content: "" }]);

    try {
      const response = await fetch(`/api/documents/${documentId}/learn`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chapterId, mentorId, messages: base }),
        signal,
      });

      if (!response.ok || !response.body) {
        let message = "导师没有回应";
        try {
          message = (await response.json()).message || message;
        } catch {
          // Non-JSON error body; keep the default message.
        }
        throw new Error(message);
      }

      setSource(response.headers.get("X-Chat-Source") === "llm" ? "llm" : "local");

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let acc = "";
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        acc += decoder.decode(value, { stream: true });
        setMessages([...base, { role: "assistant", content: acc }]);
      }

      if (!acc.trim()) {
        throw new Error("导师没有返回内容");
      }
    } catch (err) {
      if (signal.aborted || (err instanceof Error && err.name === "AbortError")) {
        return;
      }
      setMessages(base);
      setError(err instanceof Error ? err.message : "发送失败");
    } finally {
      if (!signal.aborted) setLoading(false);
    }
  };

  const startTurn = (base: ChatMessage[]) => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    void runTurn(base, controller.signal);
  };

  useEffect(() => {
    if (!open || !mentorId || !chapterId) return;
    // Kick off the opening turn (an async network load) when the dialog opens.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    startTurn([]);
    return () => abortRef.current?.abort();
    // startTurn is a stable closure; re-run only when the target session changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, documentId, chapterId, mentorId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  const send = () => {
    const content = input.trim();
    if (!content || loading || !mentorId) return;
    startTurn([...messages, { role: "user", content }]);
  };

  const lastMessage = messages[messages.length - 1];
  const showThinking =
    loading &&
    (!lastMessage ||
      (lastMessage.role === "assistant" && lastMessage.content === ""));

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
          {messages.map((message, index) =>
            message.role === "assistant" && message.content === "" ? null : (
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
            )
          )}
          {showThinking && (
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
                send();
              }
            }}
          />
          <Button onClick={send} disabled={loading || !input.trim()}>
            发送
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
