import { createPiSseHandler } from "@pi-web/next";

import { getPiRegistry } from "@/lib/pi-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const handler = createPiSseHandler({
  registry: getPiRegistry(),
  warmOnConnect: true,
});

export async function GET(request: Request): Promise<Response> {
  return await handler(request);
}
