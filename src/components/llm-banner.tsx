"use client";

import Link from "next/link";
import { AlertCircle } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function LlmBanner({ configured }: { configured: boolean | null }) {
  if (configured !== false) return null;

  return (
    <div className="rounded-xl border border-orange-200 bg-orange-50 px-4 py-3 text-sm text-orange-900">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="flex items-start gap-2">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>
            尚未接入大模型。导师陪学、章节导读和智能目录都需要兼容 OpenAI 的接口才能使用。
          </span>
        </p>
        <Link href="/settings" className={cn(buttonVariants({ size: "sm" }), "self-start")}>
          去配置
        </Link>
      </div>
    </div>
  );
}
