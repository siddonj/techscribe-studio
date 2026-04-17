"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

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

      const data = (await res.json()) as { message?: string; error?: string; user_name?: string };
      if (!res.ok) {
        throw new Error(data.error || "Failed to test WordPress connection");
      }

      setTestMessage(data.message || "Connection successful.");
      setHasSuccessfulTest(true);
      setLastTestedAt(new Date().toISOString());
      setVerifiedSignature(currentConfigSignature);
    } catch (testError) {
      setError(testError instanceof Error ? testError.message : "Failed to test WordPress connection");
    } finally {
      setTesting(false);
    }
  };

  const inputClassName = "w-full bg-surface border border-border rounded-lg px-3 py-2.5 text-sm text-white placeholder-muted focus:outline-none focus:border-accent/60 transition-colors";

  return (
    <div className="min-h-screen flex flex-col">
      <header className="border-b border-border px-8 py-4 flex items-center gap-4">
        <Link href="/" className="text-muted hover:text-white text-sm transition-colors">
          ← Dashboard
        </Link>
        <span className="text-border">|</span>
        <span className="text-xl">⚙️</span>
        <h1 className="text-white font-medium">Settings</h1>
      </header>

      <div className="p-8 max-w-4xl">
        <div className="mb-8">
          <div className="font-mono text-accent text-xs tracking-widest uppercase mb-3">
            Integrations
          </div>
          <h2
            className="text-4xl text-white mb-4"
            style={{ fontFamily: "var(--font-display)" }}
          >
            WordPress Setup
          </h2>
          <p className="text-slate-200 text-lg max-w-2xl">
            Save your WordPress site URL and application password here so draft publishing works without editing environment files.
          </p>
        </div>

        <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
          <section className="bg-card border border-border rounded-2xl p-6 space-y-5">
            <div>
              <p className="font-mono text-xs text-muted uppercase tracking-wider mb-1">Connection</p>
              <p className="text-sm text-slate-200">
                Use your WordPress site root URL and an Application Password from your WordPress user profile.
              </p>
            </div>

            <div>
              <label className="block text-xs font-mono text-muted uppercase tracking-wider mb-1.5">
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
              <label className="block text-xs font-mono text-muted uppercase tracking-wider mb-1.5">
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
              <label className="block text-xs font-mono text-muted uppercase tracking-wider mb-1.5">
                Application Password
              </label>
              <input
                type="password"
                className={inputClassName}
                value={appPassword}
                placeholder={hasSavedPassword ? "Leave blank to keep current password" : "xxxx xxxx xxxx xxxx xxxx xxxx"}
                onChange={(event) => setAppPassword(event.target.value)}
              />
              <p className="text-xs text-muted mt-2">
                {hasSavedPassword
                  ? "A password is already saved. Enter a new one only if you want to replace it."
                  : "The password is stored locally in your SQLite database for this self-hosted app."}
              </p>
            </div>

            <p className="text-xs text-accent/80">
              Test before save to verify these exact credentials. Draft publishing stays disabled until the saved settings pass a successful connection test.
            </p>

            {error && (
              <div className="text-red-400 text-sm bg-red-400/10 border border-red-400/20 rounded-lg px-3 py-2">
                {error}
              </div>
            )}

            {message && (
              <div className="text-green-300 text-sm bg-green-400/10 border border-green-400/20 rounded-lg px-3 py-2">
                {message}
              </div>
            )}

            {testMessage && (
              <div className="text-green-300 text-sm bg-green-400/10 border border-green-400/20 rounded-lg px-3 py-2">
                {testMessage}
              </div>
            )}

            <div className="flex flex-wrap gap-3">
              <button
                onClick={handleSave}
                disabled={saving || loading || testing}
                className="bg-accent text-bg font-semibold px-5 py-3 rounded-lg text-sm hover:bg-accent-dim transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {saving ? "Saving..." : "Save WordPress Settings"}
              </button>
              <button
                onClick={handleTestConnection}
                disabled={testing || loading || saving}
                className="border border-border text-white font-semibold px-5 py-3 rounded-lg text-sm hover:border-accent/40 hover:text-accent transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {testing ? "Testing..." : "Test Connection"}
              </button>
            </div>
          </section>

          <aside className="bg-card border border-border rounded-2xl p-6 space-y-5 h-fit">
            <div>
              <p className="font-mono text-xs text-muted uppercase tracking-wider mb-1">Current Source</p>
              <p className="text-white text-sm capitalize">{loading ? "Loading..." : source}</p>
            </div>

            <div>
              <p className="font-mono text-xs text-muted uppercase tracking-wider mb-1">Saved Password</p>
              <p className="text-white text-sm">{hasSavedPassword ? "Configured" : "Not configured"}</p>
            </div>

            <div>
              <p className="font-mono text-xs text-muted uppercase tracking-wider mb-1">Connection Verified</p>
              <p className="text-white text-sm">{hasSuccessfulTest ? "Passed" : "Not yet"}</p>
            </div>

            <div>
              <p className="font-mono text-xs text-muted uppercase tracking-wider mb-1">Last Test</p>
              <p className="text-white text-sm">{formatDate(lastTestedAt) || "Not tested yet"}</p>
            </div>

            <div>
              <p className="font-mono text-xs text-muted uppercase tracking-wider mb-1">Last Updated</p>
              <p className="text-white text-sm">{formatDate(updatedAt) || "Not saved yet"}</p>
            </div>

            <div className="border-t border-border pt-5">
              <p className="font-mono text-xs text-muted uppercase tracking-wider mb-2">Notes</p>
              <div className="space-y-2 text-sm text-slate-200">
                <p>Draft publishing uses the in-app settings first.</p>
                <p>Env vars still work as a fallback if no saved settings exist.</p>
                <p>{isCurrentConfigVerified ? "The current form values have been verified." : "The current form values have not been verified yet."}</p>
                <p>Your WordPress user needs permission to create posts.</p>
              </div>
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}