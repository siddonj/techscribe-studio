import { marked } from "marked";
import { getWordPressSettings } from "@/lib/db";

export interface WordPressConfig {
  siteUrl: string;
  username: string;
  appPassword: string;
}

/**
 * Convert Markdown to WordPress-compatible HTML.
 *
 * Uses `marked` for robust, spec-compliant parsing instead of the previous
 * regex-based converter which broke on nested formatting, code blocks with
 * special characters, and complex lists.
 */
export function markdownToWordPressHtml(markdown: string): string {
  // marked returns a Promise in async mode; synchronous call returns a string.
  const html = marked.parse(markdown, { async: false }) as string;
  return html.trim();
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
