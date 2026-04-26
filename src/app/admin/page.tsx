"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, GraduationCap, Lock, LogOut, Plus, Pencil, Trash2, Save, X } from "lucide-react";
import { useLanguage } from "@/components/providers/LanguageProvider";
import {
  NewsCategory,
  NewsItem,
  STORAGE_KEY,
  defaultNews,
  readNews,
  writeNews,
} from "@/lib/news";

// Demo password — in production this should be replaced with proper auth.
const ADMIN_PASSWORD = "school37";
const SESSION_KEY = "school37-admin-session";

const categories: NewsCategory[] = ["events", "olympics", "life", "announcements"];

function emptyDraft(): NewsItem {
  return {
    id: "",
    title: "",
    summary: "",
    category: "events",
    image: "",
    date: new Date().toISOString().slice(0, 10),
  };
}

export default function AdminPage() {
  const { t, locale } = useLanguage();
  const [authed, setAuthed] = useState(false);
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [items, setItems] = useState<NewsItem[]>([]);
  const [draft, setDraft] = useState<NewsItem | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    setAuthed(sessionStorage.getItem(SESSION_KEY) === "1");
    setItems(readNews());
  }, []);

  const sorted = useMemo(
    () => [...items].sort((a, b) => (a.date < b.date ? 1 : -1)),
    [items],
  );

  const login = (e: React.FormEvent) => {
    e.preventDefault();
    if (password === ADMIN_PASSWORD) {
      sessionStorage.setItem(SESSION_KEY, "1");
      setAuthed(true);
      setError("");
    } else {
      setError(t("admin.invalid"));
    }
  };

  const logout = () => {
    sessionStorage.removeItem(SESSION_KEY);
    setAuthed(false);
    setPassword("");
  };

  const startCreate = () => setDraft(emptyDraft());
  const startEdit = (item: NewsItem) => setDraft({ ...item });
  const cancel = () => setDraft(null);

  const save = (e: React.FormEvent) => {
    e.preventDefault();
    if (!draft) return;
    if (!draft.title.trim() || !draft.summary.trim()) return;

    const finalItem: NewsItem = {
      ...draft,
      id: draft.id || `n-${Date.now()}`,
      image:
        draft.image ||
        "https://images.unsplash.com/photo-1503676260728-1c00da094a0b?auto=format&fit=crop&w=1200&q=80",
    };

    setItems((prev) => {
      const exists = prev.some((p) => p.id === finalItem.id);
      const next = exists
        ? prev.map((p) => (p.id === finalItem.id ? finalItem : p))
        : [finalItem, ...prev];
      writeNews(next);
      return next;
    });
    setDraft(null);
  };

  const remove = (id: string) => {
    if (!confirm("Удалить новость?")) return;
    setItems((prev) => {
      const next = prev.filter((p) => p.id !== id);
      writeNews(next);
      return next;
    });
  };

  const reset = () => {
    if (!confirm("Сбросить к исходным новостям?")) return;
    writeNews(defaultNews);
    setItems(defaultNews);
  };

  const fmtDate = (iso: string) => {
    try {
      return new Date(iso).toLocaleDateString(locale === "ru" ? "ru-RU" : locale === "uz" ? "uz-UZ" : "en-US", {
        day: "numeric",
        month: "short",
        year: "numeric",
      });
    } catch {
      return iso;
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
      <header className="border-b border-slate-200 dark:border-slate-800 bg-white/80 dark:bg-slate-950/80 backdrop-blur-md sticky top-0 z-10">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2 text-sm font-medium hover:text-brand-600">
            <ArrowLeft className="h-4 w-4" />
            <span className="grid h-8 w-8 place-items-center rounded-lg bg-gradient-to-br from-brand-600 to-brand-400 text-white">
              <GraduationCap className="h-4 w-4" />
            </span>
            School №37
          </Link>
          {authed && (
            <button
              onClick={logout}
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 dark:border-slate-800 px-3 py-1.5 text-sm font-medium hover:border-brand-500"
            >
              <LogOut className="h-4 w-4" />
              {t("admin.logout")}
            </button>
          )}
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 py-10">
        {!authed ? (
          <div className="max-w-md mx-auto mt-12">
            <div className="rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-8 shadow-soft">
              <div className="grid h-12 w-12 place-items-center rounded-2xl bg-brand-50 dark:bg-brand-900/30 text-brand-600 dark:text-brand-400">
                <Lock className="h-5 w-5" />
              </div>
              <h1 className="mt-4 font-display text-2xl font-bold tracking-tight">
                {t("admin.title")}
              </h1>
              <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
                {t("admin.subtitle")}
              </p>
              <form onSubmit={login} className="mt-6 space-y-4">
                <div>
                  <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1.5">
                    {t("admin.password")}
                  </label>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 px-4 py-3 text-sm focus:border-brand-500 focus:ring-2 focus:ring-brand-200 dark:focus:ring-brand-900/30 outline-none"
                    placeholder="••••••••"
                  />
                </div>
                {error && <p className="text-xs text-rose-600">{error}</p>}
                <button
                  type="submit"
                  className="w-full rounded-xl bg-brand-600 px-4 py-3 text-sm font-semibold text-white hover:bg-brand-700 transition-colors"
                >
                  {t("admin.login")}
                </button>
                <p className="text-xs text-slate-500 text-center">
                  Demo password: <code className="font-mono">school37</code>
                </p>
              </form>
            </div>
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div>
                <h1 className="font-display text-2xl sm:text-3xl font-bold tracking-tight">
                  {t("admin.title")}
                </h1>
                <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
                  {t("admin.subtitle")}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={reset}
                  className="rounded-xl border border-slate-200 dark:border-slate-800 px-3.5 py-2 text-sm font-medium hover:border-brand-500"
                >
                  Reset
                </button>
                <button
                  onClick={startCreate}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-brand-600 px-3.5 py-2 text-sm font-semibold text-white shadow-glass hover:bg-brand-700"
                >
                  <Plus className="h-4 w-4" />
                  {t("admin.add")}
                </button>
              </div>
            </div>

            <h2 className="mt-10 mb-4 font-display text-lg font-semibold">
              {t("admin.list")}
            </h2>

            <div className="grid gap-3">
              {sorted.map((n) => (
                <motion.div
                  key={n.id}
                  layout
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex items-center gap-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-3"
                >
                  <img
                    src={n.image}
                    alt=""
                    className="h-16 w-24 rounded-xl object-cover shrink-0"
                    loading="lazy"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="rounded-full bg-brand-50 dark:bg-brand-900/30 text-brand-700 dark:text-brand-300 px-2 py-0.5 text-xs font-medium capitalize">
                        {n.category}
                      </span>
                      <span className="text-xs text-slate-500">{fmtDate(n.date)}</span>
                    </div>
                    <h3 className="mt-1 font-medium truncate">{n.title}</h3>
                    <p className="text-xs text-slate-500 truncate">{n.summary}</p>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      onClick={() => startEdit(n)}
                      className="grid h-9 w-9 place-items-center rounded-xl border border-slate-200 dark:border-slate-800 hover:border-brand-500 hover:text-brand-600"
                      aria-label="Edit"
                    >
                      <Pencil className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => remove(n.id)}
                      className="grid h-9 w-9 place-items-center rounded-xl border border-slate-200 dark:border-slate-800 hover:border-rose-500 hover:text-rose-600"
                      aria-label="Delete"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </motion.div>
              ))}
              {sorted.length === 0 && (
                <p className="text-sm text-slate-500 text-center py-10">
                  {t("news.empty")}
                </p>
              )}
            </div>
          </>
        )}
      </main>

      {/* Editor modal */}
      <AnimatePresence>
        {draft && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4"
            onClick={cancel}
          >
            <motion.form
              initial={{ scale: 0.96, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.96, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              onSubmit={save}
              className="w-full max-w-2xl rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-glass p-6 sm:p-8"
            >
              <div className="flex items-center justify-between mb-5">
                <h3 className="font-display text-xl font-semibold">
                  {draft.id ? "Edit news" : t("admin.add")}
                </h3>
                <button
                  type="button"
                  onClick={cancel}
                  className="grid h-9 w-9 place-items-center rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="grid gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1.5">
                    {t("admin.field.title")}
                  </label>
                  <input
                    value={draft.title}
                    onChange={(e) => setDraft({ ...draft, title: e.target.value })}
                    required
                    className="w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 px-4 py-2.5 text-sm focus:border-brand-500 outline-none"
                  />
                </div>

                <div className="grid sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1.5">
                      {t("admin.field.category")}
                    </label>
                    <select
                      value={draft.category}
                      onChange={(e) => setDraft({ ...draft, category: e.target.value as NewsCategory })}
                      className="w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 px-4 py-2.5 text-sm focus:border-brand-500 outline-none"
                    >
                      {categories.map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1.5">
                      {t("admin.field.date")}
                    </label>
                    <input
                      type="date"
                      value={draft.date}
                      onChange={(e) => setDraft({ ...draft, date: e.target.value })}
                      className="w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 px-4 py-2.5 text-sm focus:border-brand-500 outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1.5">
                    {t("admin.field.image")}
                  </label>
                  <input
                    value={draft.image}
                    onChange={(e) => setDraft({ ...draft, image: e.target.value })}
                    placeholder="https://..."
                    className="w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 px-4 py-2.5 text-sm focus:border-brand-500 outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1.5">
                    {t("admin.field.summary")}
                  </label>
                  <textarea
                    value={draft.summary}
                    rows={4}
                    onChange={(e) => setDraft({ ...draft, summary: e.target.value })}
                    required
                    className="w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 px-4 py-2.5 text-sm focus:border-brand-500 outline-none resize-none"
                  />
                </div>
              </div>

              <div className="mt-6 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={cancel}
                  className="rounded-xl border border-slate-200 dark:border-slate-800 px-4 py-2 text-sm font-medium hover:border-brand-500"
                >
                  {t("admin.cancel")}
                </button>
                <button
                  type="submit"
                  className="inline-flex items-center gap-1.5 rounded-xl bg-brand-600 px-4 py-2 text-sm font-semibold text-white shadow-glass hover:bg-brand-700"
                >
                  <Save className="h-4 w-4" />
                  {t("admin.save")}
                </button>
              </div>
            </motion.form>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
