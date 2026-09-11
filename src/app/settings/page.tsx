"use client";

import { useEffect, useState } from "react";
import { AppHeader } from "@/components/app-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";

type Preset = {
  id: string;
  label: string;
  baseUrl: string;
  model: string;
};

type SettingsResponse = {
  configured: boolean;
  source: "env" | "database" | "none";
  envLocked: boolean;
  model: string;
  baseUrl: string;
  apiKeyMasked: string;
  presets: Preset[];
};

export default function SettingsPage() {
  const [settings, setSettings] = useState<SettingsResponse | null>(null);
  const [apiKey, setApiKey] = useState("");
  const [baseUrl, setBaseUrl] = useState("");
  const [model, setModel] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/settings")
      .then((response) => response.json())
      .then((data: SettingsResponse) => {
        if (cancelled) return;
        setSettings(data);
        setBaseUrl(data.baseUrl);
        setModel(data.model);
        setApiKey("");
      })
      .catch(() => {
        if (!cancelled) setError("无法加载模型设置");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const save = async () => {
    setSaving(true);
    setError("");
    setMessage("");
    try {
      const response = await fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ apiKey, baseUrl, model }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || "保存失败");
      setSettings(data);
      setApiKey("");
      setMessage("已保存。导师陪学和章节导读现在可以使用。");
    } catch (err) {
      setError(err instanceof Error ? err.message : "保存失败");
    } finally {
      setSaving(false);
    }
  };

  const test = async () => {
    setTesting(true);
    setError("");
    setMessage("");
    try {
      const response = await fetch("/api/settings/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          apiKey: apiKey || undefined,
          baseUrl,
          model,
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || "连接失败");
      setMessage(data.message);
    } catch (err) {
      setError(err instanceof Error ? err.message : "连接失败");
    } finally {
      setTesting(false);
    }
  };

  const locked = settings?.envLocked ?? false;

  return (
    <div className="flex min-h-screen flex-col bg-[#F7F1E8]">
      <AppHeader />
      <main className="mx-auto w-full max-w-3xl flex-1 px-6 py-10">
        <Card className="border-amber-200/50 bg-white/70 shadow-lg backdrop-blur-sm">
          <CardHeader>
            <CardTitle>接入大模型</CardTitle>
            <CardDescription>
              深读的导师陪学、章节导读和智能目录依赖大模型。接口需兼容 OpenAI Chat Completions：
              <code className="mx-1">POST {"{LLM_BASE_URL}"}/chat/completions</code>
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {settings && (
              <div className="flex flex-wrap items-center gap-2 text-sm">
                <Badge variant={settings.configured ? "secondary" : "destructive"}>
                  {settings.configured ? "已配置" : "未配置"}
                </Badge>
                <span className="text-gray-600">
                  {settings.source === "env"
                    ? "来源：环境变量"
                    : settings.source === "database"
                      ? "来源：页面设置"
                      : "尚未填写 API Key"}
                </span>
                {settings.apiKeyMasked && (
                  <span className="text-gray-500">Key {settings.apiKeyMasked}</span>
                )}
              </div>
            )}

            {locked && (
              <p className="rounded-lg bg-blue-50 px-3 py-2 text-sm text-blue-800">
                当前由环境变量 <code>LLM_API_KEY</code> 接管，页面无法覆盖。Docker 部署可在
                <code className="mx-1">.env</code> 或 compose 中修改后重启。
              </p>
            )}

            <div className="space-y-2">
              <p className="text-sm font-medium text-gray-700">常用服务</p>
              <div className="flex flex-wrap gap-2">
                {(settings?.presets ?? []).map((preset) => (
                  <Button
                    key={preset.id}
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={locked}
                    onClick={() => {
                      setBaseUrl(preset.baseUrl);
                      setModel(preset.model);
                    }}
                  >
                    {preset.label}
                  </Button>
                ))}
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">API Key</label>
                <Input
                  type="password"
                  value={apiKey}
                  disabled={locked}
                  placeholder={settings?.apiKeyMasked ? `已保存 ${settings.apiKeyMasked}` : "sk-..."}
                  onChange={(event) => setApiKey(event.target.value)}
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">接口地址</label>
                <Input
                  value={baseUrl}
                  disabled={locked}
                  placeholder="https://api.deepseek.com/v1"
                  onChange={(event) => setBaseUrl(event.target.value)}
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">模型名称</label>
                <Input
                  value={model}
                  disabled={locked}
                  placeholder="deepseek-chat"
                  onChange={(event) => setModel(event.target.value)}
                />
              </div>
            </div>

            {message && <p className="text-sm text-green-700">{message}</p>}
            {error && <p className="text-sm text-red-600">{error}</p>}

            <div className="flex flex-wrap gap-2">
              <Button onClick={() => void save()} disabled={saving || locked}>
                {saving ? "保存中…" : "保存"}
              </Button>
              <Button variant="outline" onClick={() => void test()} disabled={testing}>
                {testing ? "测试中…" : "测试连接"}
              </Button>
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
