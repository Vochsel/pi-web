import { createPiAbortHandler } from "@pi-web/next";

import { getPiRegistry } from "@/lib/pi-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const handler = createPiAbortHandler({
  registry: getPiRegistry(),
});

export async function POST(request: Request): Promise<Response> {
  return await handler(request);
}
