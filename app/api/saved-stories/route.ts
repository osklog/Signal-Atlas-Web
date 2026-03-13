import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";

import { setStorySaved } from "@/lib/repository";

export async function POST(request: Request) {
  const payload = (await request.json()) as {
    storyId?: unknown;
    shouldSave?: unknown;
  };

  if (
    typeof payload.storyId !== "string" ||
    typeof payload.shouldSave !== "boolean"
  ) {
    return NextResponse.json(
      { error: "Invalid save payload." },
      { status: 400 },
    );
  }

  await setStorySaved(payload.storyId, payload.shouldSave);

  revalidatePath("/");
  revalidatePath("/overlooked");
  revalidatePath("/saved");
  revalidatePath(`/story/${payload.storyId}`);

  return NextResponse.json({ ok: true });
}
