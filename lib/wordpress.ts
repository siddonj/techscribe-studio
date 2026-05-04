import { marked } from "marked";
import { getWordPressSettings } from "@/lib/db";
import { lookup } from "node:dns/promises";
import { isIP } from "node:net";

export interface WordPressConfig {
  siteUrl: string;
  username: string;
  appPassword: string;
}

const BLOCKED_HOST_SUFFIXES = [".local", ".localdomain", ".internal", ".home.arpa"];

function isPrivateIpv4(ip: string): boolean {
  const octets = ip.split(".").map((part) => Number(part));
  if (octets.length !== 4 || octets.some((part) => Number.isNaN(part))) {
    return true;
  }
  const [a, b] = octets;
  return (
    a === 10 ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    a === 127 ||
    (a === 169 && b === 254) ||
    a === 0
  );
}

function isBlockedIpv6(ip: string): boolean {
  const normalized = ip.toLowerCase();
  return (
    normalized === "::1" ||
    normalized.startsWith("fc") ||
    normalized.startsWith("fd") ||
    normalized.startsWith("fe80:") ||
    normalized.startsWith("::ffff:127.") ||
    normalized.startsWith("::ffff:10.") ||
    normalized.startsWith("::ffff:192.168.") ||
    /^::ffff:172\.(1[6-9]|2\d|3[0-1])\./.test(normalized)
  );
}

function isBlockedIpAddress(ip: string): boolean {
  const family = isIP(ip);
  if (family === 4) return isPrivateIpv4(ip);
  if (family === 6) return isBlockedIpv6(ip);
  return true;
}

function validateWordPressHostname(hostname: string) {
  const lower = hostname.toLowerCase();
  if (
    lower === "localhost" ||
    lower.endsWith(".localhost") ||
    BLOCKED_HOST_SUFFIXES.some((suffix) => lower.endsWith(suffix))
  ) {
    throw new Error("WordPress site URL must be a public hostname");
  }
}

export function normalizeAndValidateWordPressSiteUrl(rawUrl: string): string {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl.trim());
  } catch {
    throw new Error("WordPress site URL is invalid");
  }

  if (parsed.protocol !== "https:") {
    throw new Error("WordPress site URL must use HTTPS");
  }
  if (!parsed.hostname) {
    throw new Error("WordPress site URL must include a hostname");
  }
  if (parsed.username || parsed.password) {
    throw new Error("WordPress site URL must not include credentials");
  }

  validateWordPressHostname(parsed.hostname);
  if (isIP(parsed.hostname) && isBlockedIpAddress(parsed.hostname)) {
    throw new Error("WordPress site URL cannot target private or loopback IPs");
  }

  parsed.hash = "";
  parsed.search = "";
  parsed.pathname = parsed.pathname.replace(/\/$/, "");
  return parsed.toString().replace(/\/$/, "");
}

export async function assertWordPressSiteUrlSafe(siteUrl: string): Promise<void> {
  const parsed = new URL(siteUrl);
  if (isIP(parsed.hostname)) {
    return;
  }

  const records = await lookup(parsed.hostname, { all: true, verbatim: true });
  if (!records.length) {
    throw new Error("WordPress site URL could not be resolved");
  }

  if (records.some((record) => isBlockedIpAddress(record.address))) {
    throw new Error("WordPress site URL resolves to a private or loopback IP");
  }
}

/**
 * Convert Markdown to WordPress-compatible HTML.
 *
 * Uses `marked` for robust, spec-compliant parsing instead of the previous
 * regex-based converter which broke on nested formatting, code blocks with
 * special characters, and complex lists.
 */
export function markdownToWordPressHtml(markdown: string): string {
  const html = marked.parse(markdown, { async: false }) as string;
  return html.trim();
}

export function resolveWordPressConfig(overrides?: Partial<WordPressConfig>) {
  const savedSettings = getWordPressSettings();

  const rawSiteUrl = overrides?.siteUrl || savedSettings?.site_url || process.env.WORDPRESS_SITE_URL?.replace(/\/$/, "");
  const username = overrides?.username || savedSettings?.username || process.env.WORDPRESS_USERNAME;
  const appPassword = overrides?.appPassword || savedSettings?.app_password || process.env.WORDPRESS_APP_PASSWORD;

  if (!rawSiteUrl || !username || !appPassword) {
    throw new Error("Missing WordPress configuration");
  }
  const siteUrl = normalizeAndValidateWordPressSiteUrl(rawSiteUrl);

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
  await assertWordPressSiteUrlSafe(config.siteUrl);
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
