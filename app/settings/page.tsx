"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Cpu } from "lucide-react";
import { PageContainer, PageHeader, SectionCard, SectionHeader, SurfaceNotice } from "@/components/DashboardPrimitives";

const MODEL_OPTIONS = [
  { id: "claude-haiku-4-5-20251001", label: "Haiku 4.5", description: "Fast & economical. Best for short-form content and quick drafts." },
  { id: "claude-sonnet-4-6", label: "Sonnet 4.6", description: "Balanced performance. Recommended for most tools. (Default)" },
  { id: "claude-opus-4-7", label: "Opus 4.7", description: "Most capable. Ideal for long-form, research-heavy, or complex content." },
];
const MODEL_STORAGE_KEY = "techscribe_model";

interface WordPressSettingsResponse {
  site_url: string;
  username: string;
  has_app_password: boolean;
  has_successful_test: boolean;
  last_tested_at: string | null;
  updated_at: string | null;
  source: "database" | "env" | "none";
}

function getConfigSignature(siteUrl: string, username: string, passwordToken: string) {
  return JSON.stringify({
    siteUrl: siteUrl.trim().replace(/\/$/, ""),
    username: username.trim(),
    passwordToken,
  });
}

function formatDate(value: string | null) {
  if (!value) return null;
  return new Date(value).toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function SettingsPage() {
  const [siteUrl, setSiteUrl] = useState("");
  const [username, setUsername] = useState("");
  const [appPassword, setAppPassword] = useState("");
  const [hasSavedPassword, setHasSavedPassword] = useState(false);
  const [hasSuccessfulTest, setHasSuccessfulTest] = useState(false);
  const [source, setSource] = useState<WordPressSettingsResponse["source"]>("none");
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);
  const [lastTestedAt, setLastTestedAt] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [testMessage, setTestMessage] = useState<string | null>(null);
  const [verifiedSignature, setVerifiedSignature] = useState<string | null>(null);
  const [selectedModel, setSelectedModel] = useState("claude-sonnet-4-6");
  const [modelSaved, setModelSaved] = useState(false);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(MODEL_STORAGE_KEY);
      if (saved && MODEL_OPTIONS.some((m) => m.id === saved)) setSelectedModel(saved);
    } catch { /* ignore */ }
  }, []);

  const currentPasswordToken = appPassword || (hasSavedPassword ? "__saved_password__" : "");
  const currentConfigSignature = getConfigSignature(siteUrl, username, currentPasswordToken);
  const isCurrentConfigVerified = verifiedSignature === currentConfigSignature;

  useEffect(() => {
    const loadSettings = async () => {
      setLoading(true);
      setError(null);

      try {
        const res = await fetch("/api/settings/wordpress");
        const data = (await res.json()) as WordPressSettingsResponse | { error: string };

        if (!res.ok || "error" in data) {
          throw new Error("error" in data ? data.error : "Failed to load settings");
        }

        setSiteUrl(data.site_url || "");
        setUsername(data.username || "");
        setHasSavedPassword(data.has_app_password);
        setHasSuccessfulTest(data.has_successful_test);
        setSource(data.source);
        setUpdatedAt(data.updated_at);
        setLastTestedAt(data.last_tested_at);
        setVerifiedSignature(
          data.has_successful_test
            ? getConfigSignature(
                data.site_url || "",
                data.username || "",
                data.has_app_password ? "__saved_password__" : ""
              )
            : null
        );
      } catch (loadError) {
        setError(loadError instanceof Error ? loadError.message : "Failed to load settings");
      } finally {
        setLoading(false);
      }
    };

    void loadSettings();
  }, []);

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    setMessage(null);
    setTestMessage(null);

    try {
      const res = await fetch("/api/settings/wordpress", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          site_url: siteUrl,
          username,
          app_password: appPassword,
          has_successful_test: isCurrentConfigVerified,
          last_tested_at: isCurrentConfigVerified ? new Date().toISOString() : null,
        }),
      });

      const data = (await res.json()) as WordPressSettingsResponse | { error: string };
      if (!res.ok || "error" in data) {
        throw new Error("error" in data ? data.error : "Failed to save settings");
      }

      setHasSavedPassword(data.has_app_password);
      setHasSuccessfulTest(data.has_successful_test);
      setSource(data.source);
      setUpdatedAt(data.updated_at);
      setLastTestedAt(data.last_tested_at);
      setAppPassword("");
      setVerifiedSignature(
        data.has_successful_test
          ? getConfigSignature(
              data.site_url || "",
              data.username || "",
              data.has_app_password ? "__saved_password__" : ""
            )
          : null
      );
      setMessage("WordPress settings saved.");
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Failed to save settings");
    } finally {
      setSaving(false);
    }
  };

  const handleTestConnection = async () => {
    setTesting(true);
    setError(null);
    setMessage(null);
    setTestMessage(null);

    try {
      const res = await fetch("/api/settings/wordpress/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          site_url: siteUrl,
          username,
          app_password: appPassword,
        }),
      });

      const data = (await res.json()) as { message?: string; error?: string; user_name?: string; has_successful_test?: boolean; last_tested_at?: string };
      if (!res.ok) {
        throw new Error(data.error || "Failed to test WordPress connection");
      }

      setTestMessage(data.message || "Connection successful.");
      setHasSuccessfulTest(true);
      setLastTestedAt(data.last_tested_at ?? new Date().toISOString());
      setVerifiedSignature(currentConfigSignature);
    } catch (testError) {
      setError(testError instanceof Error ? testError.message : "Failed to test WordPress connection");
    } finally {
      setTesting(false);
    }
  };

  const handleSaveModel = () => {
    try { localStorage.setItem(MODEL_STORAGE_KEY, selectedModel); } catch { /* ignore */ }
    setModelSaved(true);
    setTimeout(() => setModelSaved(false), 2000);
  };

  const inputClassName = "shell-input w-full rounded-2xl px-3.5 py-3 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none transition-colors";

  return (
    <div className="min-h-screen flex flex-col">
      <PageContainer maxWidthClassName="max-w-6xl" className="space-y-6">
        <PageHeader
          eyebrow="Configuration"
          title="Settings"
          description="Manage your publishing credentials, generation model, and other workspace preferences."
          stats={[
            { label: "Source", value: loading ? "..." : source },
            { label: "Password", value: hasSavedPassword ? "Saved" : "Missing" },
            { label: "Verified", value: hasSuccessfulTest ? "Passed" : "Pending" },
            { label: "Current Form", value: isCurrentConfigVerified ? "Trusted" : "Untested" },
          ]}
        />

        <SectionCard className="space-y-5">
          <div className="flex items-center gap-3">
            <Cpu className="h-5 w-5 text-accent shrink-0" />
            <div>
              <p className="font-mono text-xs text-slate-500 uppercase tracking-wider mb-0.5">Generation Model</p>
              <p className="text-sm text-slate-400">Choose which Claude model powers all content generation. Applies to every tool.</p>
            </div>
          </div>
          <div className="grid gap-2 sm:grid-cols-3">
            {MODEL_OPTIONS.map((m) => (
              <button
                key={m.id}
                onClick={() => setSelectedModel(m.id)}
                className={`text-left rounded-2xl border p-4 transition-colors ${
                  selectedModel === m.id
                    ? "border-accent bg-accent/10 text-white"
                    : "border-white/10 text-slate-300 hover:border-white/20 hover:text-white"
                }`}
              >
                <p className="font-medium text-sm">{m.label}</p>
                <p className="text-xs text-slate-400 mt-1 leading-relaxed">{m.description}</p>
              </button>
            ))}
          </div>
          <button
            onClick={handleSaveModel}
            className="inline-flex items-center gap-2 bg-accent text-white font-semibold px-5 py-3 rounded-2xl text-sm hover:bg-accent-dim transition-colors"
          >
            {modelSaved ? "Saved ✓" : "Save Model Preference"}
          </button>
        </SectionCard>

        <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
          <SectionHeader
            className="col-span-full"
            eyebrow="WordPress Integration"
            title="Publishing Connection"
            description="Save credentials once, verify them, and unlock draft publishing across the workspace."
          />
          <SectionCard className="space-y-5">
            <div>
              <p className="font-mono text-xs text-slate-500 uppercase tracking-wider mb-1">Connection</p>
              <p className="text-sm text-slate-400">
                Use your WordPress site root URL and an Application Password from your WordPress user profile.
              </p>
            </div>

            <div>
              <label className="block text-xs font-mono text-slate-500 uppercase tracking-wider mb-1.5">
                Site URL
              </label>
              <input
                type="url"
                className={inputClassName}
                value={siteUrl}
                placeholder="https://your-site.com"
                onChange={(event) => setSiteUrl(event.target.value)}
              />
            </div>

            <div>
              <label className="block text-xs font-mono text-slate-500 uppercase tracking-wider mb-1.5">
                Username
              </label>
              <input
                type="text"
                className={inputClassName}
                value={username}
                placeholder="your-wordpress-username"
                onChange={(event) => setUsername(event.target.value)}
              />
            </div>

            <div>
              <label className="block text-xs font-mono text-slate-500 uppercase tracking-wider mb-1.5">
                Application Password
              </label>
              <input
                type="password"
                className={inputClassName}
                value={appPassword}
                placeholder={hasSavedPassword ? "Leave blank to keep current password" : "xxxx xxxx xxxx xxxx xxxx xxxx"}
                onChange={(event) => setAppPassword(event.target.value)}
              />
              <p className="text-xs text-slate-500 mt-2">
                {hasSavedPassword
                  ? "A password is already saved. Enter a new one only if you want to replace it."
                  : "The password is stored locally in your SQLite database for this self-hosted app."}
              </p>
            </div>

            <p className="text-xs text-accent/80">
              Test before save to verify these exact credentials. Draft publishing stays disabled until the saved settings pass a successful connection test.
            </p>

            {error && (
              <SurfaceNotice tone="error">{error}</SurfaceNotice>
            )}

            {message && (
              <SurfaceNotice tone="success">{message}</SurfaceNotice>
            )}

            {testMessage && (
              <SurfaceNotice tone="success">{testMessage}</SurfaceNotice>
            )}

            <div className="flex flex-wrap gap-3">
              <button
                onClick={handleSave}
                disabled={saving || loading || testing}
                className="bg-accent text-white font-semibold px-5 py-3 rounded-2xl text-sm hover:bg-accent-dim transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {saving ? "Saving..." : "Save WordPress Settings"}
              </button>
              <button
                onClick={handleTestConnection}
                disabled={testing || loading || saving}
                className="border border-slate-300 text-slate-900 font-semibold px-5 py-3 rounded-2xl text-sm hover:border-accent/40 hover:text-accent transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {testing ? "Testing..." : "Test Connection"}
              </button>
            </div>
          </SectionCard>

          <SectionCard className="space-y-5 h-fit">
            <div>
              <p className="font-mono text-xs text-slate-500 uppercase tracking-wider mb-1">Current Source</p>
              <p className="text-white text-sm capitalize">{loading ? "Loading..." : source}</p>
            </div>

            <div>
              <p className="font-mono text-xs text-slate-500 uppercase tracking-wider mb-1">Saved Password</p>
              <p className="text-white text-sm">{hasSavedPassword ? "Configured" : "Not configured"}</p>
            </div>

            <div>
              <p className="font-mono text-xs text-slate-500 uppercase tracking-wider mb-1">Connection Verified</p>
              <p className="text-white text-sm">{hasSuccessfulTest ? "Passed" : "Not yet"}</p>
            </div>

            <div>
              <p className="font-mono text-xs text-slate-500 uppercase tracking-wider mb-1">Last Test</p>
              <p className="text-white text-sm">{formatDate(lastTestedAt) || "Not tested yet"}</p>
            </div>

            <div>
              <p className="font-mono text-xs text-slate-500 uppercase tracking-wider mb-1">Last Updated</p>
              <p className="text-white text-sm">{formatDate(updatedAt) || "Not saved yet"}</p>
            </div>

            <div className="border-t border-white/5 pt-5">
              <p className="font-mono text-xs text-slate-500 uppercase tracking-wider mb-2">Notes</p>
              <div className="space-y-2 text-sm text-slate-400">
                <p>Draft publishing uses the in-app settings first.</p>
                <p>Env vars still work as a fallback if no saved settings exist.</p>
                <p>{isCurrentConfigVerified ? "The current form values have been verified." : "The current form values have not been verified yet."}</p>
                <p>Your WordPress user needs permission to create posts.</p>
              </div>
            </div>
          </SectionCard>
        </div>
      </PageContainer>
    </div>
  );
}
