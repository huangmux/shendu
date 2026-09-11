"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { BookOpen, Settings2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type LlmHealth = {
  configured: boolean;
  model: string;
};

export function AppHeader({ extra }: { extra?: React.ReactNode }) {
  const [llm, setLlm] = useState<LlmHealth | null>(null);

  useEffect(() => {
    fetch("/api/health")
      .then((response) => response.json())
      .then((data) => setLlm(data.llm ?? null))
      .catch(() => setLlm(null));
  }, []);

  return (
    <header className="bg-white/50 border-b border-amber-200/30 backdrop-blur-sm">
      <div className="mx-auto max-w-6xl px-6 py-4">
        <div className="flex items-center justify-between gap-4">
          <div className="flex min-w-0 items-center gap-3">
            <Link href="/" className="flex items-center gap-3">
              <BookOpen className="h-8 w-8 text-blue-700" />
              <h1 className="text-2xl font-bold text-gray-800">深读</h1>
            </Link>
            <Badge variant="secondary" className="text-xs">
              Beta
            </Badge>
          </div>
          <div className="flex items-center gap-2">
            {extra}
            {llm && (
              <Badge
                variant={llm.configured ? "secondary" : "destructive"}
                className="hidden sm:inline-flex"
              >
                {llm.configured ? `大模型 · ${llm.model}` : "未配置大模型"}
              </Badge>
            )}
            <Link
              href="/settings"
              className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
            >
              <Settings2 className="h-4 w-4" />
              模型设置
            </Link>
          </div>
        </div>
      </div>
    </header>
  );
}
