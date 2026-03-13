"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { cn } from "@/lib/utils";

interface SaveStoryButtonProps {
  storyId: string;
  initialSaved: boolean;
}

export function SaveStoryButton({
  storyId,
  initialSaved,
}: SaveStoryButtonProps) {
  const router = useRouter();
  const [saved, setSaved] = useState(initialSaved);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    setSaved(initialSaved);
  }, [initialSaved]);

  const toggleSaved = () => {
    const nextSaved = !saved;
    setSaved(nextSaved);

    startTransition(async () => {
      const response = await fetch("/api/saved-stories", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          storyId,
          shouldSave: nextSaved,
        }),
      });

      if (!response.ok) {
        setSaved(!nextSaved);
        return;
      }

      router.refresh();
    });
  };

  return (
    <button
      type="button"
      onClick={toggleSaved}
      disabled={isPending}
      aria-pressed={saved}
      className={cn("save-button", saved && "save-button-active")}
    >
      {isPending ? "Updating" : saved ? "Saved" : "Save"}
    </button>
  );
}
