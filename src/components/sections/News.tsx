"use client";

import { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowUpRight, Calendar } from "lucide-react";
import Section from "@/components/ui/Section";
import { useLanguage } from "@/components/providers/LanguageProvider";
import { NewsCategory, NewsItem, readNews, STORAGE_KEY } from "@/lib/news";

const filters: { key: NewsCategory | "all"; labelKey: string }[] = [
  { key: "all", labelKey: "news.filters.all" },
  { key: "events", labelKey: "news.filters.events" },
  { key: "olympics", labelKey: "news.filters.olympics" },
  { key: "life", labelKey: "news.filters.life" },
  { key: "announcements", labelKey: "news.filters.announcements" },
];

const categoryStyles: Record<NewsCategory, string> = {
  events: "bg-brand-100 text-brand-700 dark:bg-brand-900/40 dark:text-brand-300",
  olympics: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300",
  life: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300",
  announcements: "bg-rose-100 text-rose-800 dark:bg-rose-900/30 dark:text-rose-300",
};

export default function News() {
  const { t, locale } = useLanguage();
  const [items, setItems] = useState<NewsItem[]>([]);
  const [active, setActive] = useState<NewsCategory | "all">("all");

  useEffect(() => {
    setItems(readNews());
    const onStorage = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY) setItems(readNews());
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const filtered = useMemo(() => {
    const list = active === "all" ? items : items.filter((n) => n.category === active);
    return [...list].sort((a, b) => (a.date < b.date ? 1 : -1));
  }, [items, active]);

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
    <Section id="news" eyebrow={t("news.eyebrow")} title={t("news.title")}>
      <div className="flex flex-wrap justify-center gap-2 mb-10">
        {filters.map((f) => (
          <button
            key={f.key}
            onClick={() => setActive(f.key)}
            className={`rounded-full px-4 py-2 text-sm font-medium transition-all ${
              active === f.key
                ? "bg-brand-600 text-white shadow-glass"
                : "glass border border-slate-200 dark:border-slate-800 hover:border-brand-500"
            }`}
          >
            {t(f.labelKey)}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <p className="text-center text-slate-500">{t("news.empty")}</p>
      ) : (
        <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
          <AnimatePresence mode="popLayout">
            {filtered.map((n, i) => (
              <motion.article
                key={n.id}
                layout
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.4, delay: (i % 6) * 0.05 }}
                className="group relative flex flex-col overflow-hidden rounded-3xl glass-strong shadow-soft hover:shadow-glass transition-all hover:-translate-y-1"
              >
                <div className="relative aspect-[16/10] overflow-hidden">
                  <img
                    src={n.image}
                    alt={n.title}
                    className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-105"
                    loading="lazy"
                  />
                  <span
                    className={`absolute top-3 left-3 rounded-full px-2.5 py-1 text-xs font-semibold capitalize ${categoryStyles[n.category]}`}
                  >
                    {t(`news.filters.${n.category}`)}
                  </span>
                </div>
                <div className="flex flex-1 flex-col p-5">
                  <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                    <Calendar className="h-3.5 w-3.5" />
                    {fmtDate(n.date)}
                  </div>
                  <h3 className="mt-3 font-display text-lg font-semibold tracking-tight line-clamp-2">
                    {n.title}
                  </h3>
                  <p className="mt-2 text-sm text-slate-600 dark:text-slate-400 line-clamp-3 flex-1">
                    {n.summary}
                  </p>
                  <button className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-brand-600 dark:text-brand-400 hover:gap-2 transition-all w-fit">
                    {t("news.readmore")}
                    <ArrowUpRight className="h-4 w-4" />
                  </button>
                </div>
              </motion.article>
            ))}
          </AnimatePresence>
        </div>
      )}
    </Section>
  );
}
