// Alias for /api/health — used by infrastructure probes (Traefik, k8s, etc.)
export { GET } from "@/app/api/health/route";
export const dynamic = "force-dynamic";
