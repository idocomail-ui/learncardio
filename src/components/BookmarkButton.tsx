"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";

interface Props {
  itemType: "figure" | "recommendation" | "question";
  itemId: string;
}

export default function BookmarkButton({ itemType, itemId }: Props) {
  const [bookmarked, setBookmarked] = useState(false);
  const [loading, setLoading] = useState(false);
  const supabase = createClient();

  useEffect(() => {
    async function check() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase
        .from("bookmarks")
        .select("id")
        .eq("user_id", user.id)
        .eq("item_type", itemType)
        .eq("item_id", itemId)
        .maybeSingle();
      setBookmarked(!!data);
    }
    check();
  }, [itemId, itemType]);

  async function toggle() {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    if (bookmarked) {
      await supabase
        .from("bookmarks")
        .delete()
        .eq("user_id", user.id)
        .eq("item_type", itemType)
        .eq("item_id", itemId);
      setBookmarked(false);
    } else {
      await supabase.from("bookmarks").upsert({
        user_id: user.id,
        item_type: itemType,
        item_id: itemId,
      });
      setBookmarked(true);
    }
    setLoading(false);
  }

  return (
    <button
      onClick={toggle}
      disabled={loading}
      className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors disabled:opacity-50"
      aria-label={bookmarked ? "Remove bookmark" : "Bookmark"}
    >
      <svg
        className={`w-4 h-4 transition-colors ${
          bookmarked
            ? "text-blue-600 dark:text-blue-400 fill-current"
            : "text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
        }`}
        fill={bookmarked ? "currentColor" : "none"}
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z"
        />
      </svg>
    </button>
  );
}
