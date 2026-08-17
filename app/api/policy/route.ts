import { NextResponse } from "next/server";
import { getPolicy, savePolicy } from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({ policy: await getPolicy() });
}

export async function PUT(request: Request) {
  try {
    const body = (await request.json()) as { content?: unknown };
    if (typeof body.content !== "string" || body.content.trim().length === 0) {
      return NextResponse.json(
        { error: "Policy content must be a non-empty string." },
        { status: 400 },
      );
    }
    if (body.content.length > 4000) {
      return NextResponse.json(
        { error: "Policy content is too long." },
        { status: 400 },
      );
    }
    const policy = await savePolicy(body.content.trim());
    return NextResponse.json({ policy });
  } catch {
    return NextResponse.json(
      { error: "Invalid request body." },
      { status: 400 },
    );
  }
}
