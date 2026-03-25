"use client";

import Link from "next/link";
import { type User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import ProgressSidebar from "@/components/ProgressSidebar";

export default function AppShell({
  children,
  user,
}: {
  children: React.ReactNode;
  user: User;
}) {
  const router = useRouter();

  async function signOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
  }

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 dark:bg-slate-950">
      {/* Top bar */}
      <header className="flex items-center justify-between px-4 py-3 border-b bg-white dark:bg-slate-900 sticky top-0 z-20">
        <Link href="/dashboard" className="flex items-center gap-2">
          <div className="w-7 h-7 bg-blue-600 rounded-lg flex items-center justify-center">
            <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 24 24">
              <path d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
            </svg>
          </div>
          <span className="font-semibold text-slate-900 dark:text-slate-100">LearnCardio</span>
        </Link>
        <button
          onClick={signOut}
          className="text-sm text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 transition-colors"
        >
          Sign out
        </button>
      </header>

      {/* Body: sidebar + main */}
      <div className="flex flex-1">
        <ProgressSidebar />
        <main className="flex-1 min-w-0">{children}</main>
      </div>
    </div>
  );
}
