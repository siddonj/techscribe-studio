/** @type {import('next').NextConfig} */

/**
 * Content Security Policy (CSP)
 *
 * Applied to every route via the securityHeaders array below.
 *
 * Directive rationale:
 *   default-src 'self'        — Deny all resource types not explicitly listed;
 *                               fall back to same-origin only.
 *   script-src  'self'        — Allow scripts only from the same origin (Next.js
 *                               bundles served from /_next/static/). Inline scripts
 *                               and eval() are blocked.
 *   style-src   'self'        — Same-origin stylesheets plus Google Fonts CSS API.
 *                'unsafe-inline' — Required for Tailwind-generated inline styles.
 *                https://fonts.googleapis.com — Google Fonts stylesheet requests.
 *   font-src    'self'        — Self-hosted fonts.
 *                https://fonts.gstatic.com — Google Fonts binary files.
 *                data: — Inline base64 fonts referenced in global CSS.
 *   img-src     'self'        — Same-origin images (favicons, public/ assets).
 *                data:          — Inline base64 images used by the UI.
 *                https:         — External HTTPS images in AI-generated markdown
 *                               content (e.g., Unsplash placeholder URLs).
 *   connect-src 'self'        — XHR/fetch to the app's own API routes.
 *                https:         — Allows the browser to reach HTTPS endpoints that
 *                               may be embedded in generated content or loaded by
 *                               third-party scripts. Tighten to specific origins
 *                               if the set of external endpoints becomes well-known.
 *   frame-ancestors 'self'    — Prevents clickjacking; only same-origin frames
 *                               allowed (mirrors X-Frame-Options: SAMEORIGIN).
 *   base-uri    'self'        — Blocks <base> tag injection attacks.
 *   form-action 'self'        — Forms may only submit to the same origin.
 *   object-src  'none'        — Disallow Flash and other plugin content entirely.
 *   upgrade-insecure-requests — Instructs the browser to rewrite HTTP sub-resource
 *                               requests to HTTPS automatically.
 *
 * To update this policy:
 *   1. Edit the array below and redeploy.
 *   2. Test with browser DevTools (Console → CSP violations) or a report-uri endpoint.
 *   3. Update docs/operations.md § Security Headers to reflect any changes.
 */
const contentSecurityPolicy = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' https://fonts.gstatic.com data:",
  "img-src 'self' data: https:",
  "connect-src 'self' https:",
  "frame-ancestors 'self'",
  "base-uri 'self'",
  "form-action 'self'",
  "object-src 'none'",
  "upgrade-insecure-requests",
].join("; ");

/**
 * Security response headers applied to every route (source: "/(.*)")
 *
 * X-DNS-Prefetch-Control on          — Enable DNS prefetching for performance.
 * Strict-Transport-Security          — Enforce HTTPS for 2 years, include subdomains,
 *                                      and opt into the HSTS preload list.
 * X-Frame-Options SAMEORIGIN         — Legacy clickjacking protection (also covered
 *                                      by CSP frame-ancestors above).
 * X-Content-Type-Options nosniff     — Prevent MIME-type sniffing.
 * Referrer-Policy                    — Send origin+path only to same-origin; only
 *                                      origin to cross-origin HTTPS destinations.
 * Permissions-Policy                 — Disable access to camera, microphone, and
 *                                      geolocation APIs for this origin.
 * Content-Security-Policy            — See contentSecurityPolicy above.
 *
 * See docs/operations.md § Security Headers for the full reference and guidance
 * on reviewing or extending this policy.
 */
const securityHeaders = [
  { key: "X-DNS-Prefetch-Control", value: "on" },
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains; preload",
  },
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=()",
  },
  { key: "Content-Security-Policy", value: contentSecurityPolicy },
];

const nextConfig = {
  reactStrictMode: true,
  serverExternalPackages: ["better-sqlite3"],
  output: "standalone",
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: securityHeaders,
      },
    ];
  },
};

export default nextConfig;
