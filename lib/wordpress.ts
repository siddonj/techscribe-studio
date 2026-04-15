import { getWordPressSettings } from "@/lib/db";

export interface WordPressConfig {
  siteUrl: string;
  username: string;
  appPassword: string;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function markdownToWordPressHtml(markdown: string): string {
  return markdown
    .replace(/```[\w]*\n([\s\S]*?)```/g, (_match, code) => {
      return `<pre><code>${escapeHtml(String(code).trim())}</code></pre>`;
    })
    .replace(/^### (.+)$/gm, "<h3>$1</h3>")
    .replace(/^## (.+)$/gm, "<h2>$1</h2>")
    .replace(/^# (.+)$/gm, "<h1>$1</h1>")
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/\*([^*]+)\*/g, "<em>$1</em>")
    .replace(/`([^`]+)`/g, (_match, code) => `<code>${escapeHtml(code)}</code>`)
    .replace(/^---$/gm, "<hr />")
    .replace(/^\d+\.\s+(.+)$/gm, "<li>$1</li>")
    .replace(/^[-*]\s+(.+)$/gm, "<li>$1</li>")
    .replace(/(<li>[\s\S]*?<\/li>)/g, "<ul>$1</ul>")
    .replace(/<\/ul>\s*<ul>/g, "")
    .replace(/\n\n/g, "</p><p>")
    .replace(/^(?!<[hupol]|<\/[hupol]|<li|<hr)(.+)$/gm, (match) =>
      match.startsWith("<") ? match : `<p>${match}</p>`
    )
    .replace(/<p><\/p>/g, "");
}

export function resolveWordPressConfig(overrides?: Partial<WordPressConfig>) {
  const savedSettings = getWordPressSettings();

  const siteUrl = overrides?.siteUrl || savedSettings?.site_url || process.env.WORDPRESS_SITE_URL?.replace(/\/$/, "");
  const username = overrides?.username || savedSettings?.username || process.env.WORDPRESS_USERNAME;
  const appPassword = overrides?.appPassword || savedSettings?.app_password || process.env.WORDPRESS_APP_PASSWORD;

  if (!siteUrl || !username || !appPassword) {
    throw new Error("Missing WordPress configuration");
  }

  return {
    siteUrl,
    username,
    appPassword,
  };
}

export function getWordPressConfig() {
  return resolveWordPressConfig();
}

export function buildWordPressAuthHeader(username: string, appPassword: string) {
  const token = Buffer.from(`${username}:${appPassword}`).toString("base64");
  return `Basic ${token}`;
}

export async function testWordPressConnection(config: WordPressConfig) {
  const response = await fetch(`${config.siteUrl}/wp-json/wp/v2/users/me`, {
    method: "GET",
    headers: {
      Authorization: buildWordPressAuthHeader(config.username, config.appPassword),
      "Content-Type": "application/json",
    },
    cache: "no-store",
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(`WordPress connection failed: ${message}`);
  }

  const user = await response.json();

  return {
    userId: user.id as number,
    userName: (user.name || user.slug || config.username) as string,
  };
}