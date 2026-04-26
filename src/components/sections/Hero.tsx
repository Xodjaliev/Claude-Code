"use client";

import { motion } from "framer-motion";
import { ArrowRight, PlayCircle, Users, BookOpen, Trophy, Sparkles } from "lucide-react";
import { useLanguage } from "@/components/providers/LanguageProvider";

export default function Hero() {
  const { t } = useLanguage();

  const stats = [
    { icon: Users, value: "1 200+", labelKey: "hero.stat.students" },
    { icon: BookOpen, value: "85", labelKey: "hero.stat.teachers" },
    { icon: Sparkles, value: "52", labelKey: "hero.stat.years" },
    { icon: Trophy, value: "120+", labelKey: "hero.stat.awards" },
  ];

  return (
    <section
      id="home"
      className="relative overflow-hidden pt-32 pb-20 sm:pt-40 sm:pb-28"
    >
      {/* Background layers */}
      <div className="absolute inset-0 -z-10">
        <div className="absolute inset-0 bg-hero-radial" />
        <div className="absolute inset-0 grid-bg mask-fade-b opacity-60" />
        <div className="absolute -top-32 -right-32 h-96 w-96 rounded-full bg-brand-300/30 blur-3xl dark:bg-brand-600/20" />
        <div className="absolute -bottom-32 -left-32 h-96 w-96 rounded-full bg-accent-400/20 blur-3xl dark:bg-accent-500/10" />
      </div>

      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="grid gap-12 lg:grid-cols-12 lg:gap-8 items-center">
          {/* Text */}
          <div className="lg:col-span-7">
            <motion.span
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
              className="inline-flex items-center gap-2 rounded-full border border-brand-200/70 dark:border-brand-900/50 glass px-3 py-1 text-xs font-semibold uppercase tracking-wider text-brand-700 dark:text-brand-300"
            >
              <span className="h-1.5 w-1.5 rounded-full bg-brand-500 animate-pulse" />
              {t("hero.eyebrow")}
            </motion.span>

            <motion.h1
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, delay: 0.05 }}
              className="mt-5 font-display text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-bold tracking-tight text-balance"
            >
              {(() => {
                const full = t("hero.title");
                const marker = "School №37";
                const idx = full.indexOf(marker);
                if (idx === -1) return full;
                const before = full.slice(0, idx);
                const after = full.slice(idx + marker.length);
                return (
                  <>
                    {before}
                    <span className="gradient-text">{marker}</span>
                    {after}
                  </>
                );
              })()}
            </motion.h1>

            <motion.p
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, delay: 0.15 }}
              className="mt-6 max-w-2xl text-base sm:text-lg text-slate-600 dark:text-slate-300 text-balance"
            >
              {t("hero.subtitle")}
            </motion.p>

            <motion.div
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, delay: 0.25 }}
              className="mt-8 flex flex-col sm:flex-row gap-3"
            >
              <a
                href="#contacts"
                className="group inline-flex items-center justify-center gap-2 rounded-2xl bg-brand-600 px-6 py-3.5 text-sm font-semibold text-white shadow-glass hover:bg-brand-700 transition-all hover:-translate-y-0.5"
              >
                {t("hero.cta.apply")}
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
              </a>
              <a
                href="#about"
                className="inline-flex items-center justify-center gap-2 rounded-2xl glass-strong border border-slate-200 dark:border-slate-800 px-6 py-3.5 text-sm font-semibold hover:border-brand-500 transition-colors"
              >
                <PlayCircle className="h-4 w-4 text-brand-600 dark:text-brand-400" />
                {t("hero.cta.more")}
              </a>
            </motion.div>

            {/* Stats */}
            <motion.div
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, delay: 0.4 }}
              className="mt-12 grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4 max-w-2xl"
            >
              {stats.map((s) => (
                <div
                  key={s.labelKey}
                  className="rounded-2xl glass p-4 shadow-soft hover:shadow-glass transition-shadow"
                >
                  <s.icon className="h-5 w-5 text-brand-600 dark:text-brand-400" />
                  <div className="mt-2 font-display text-2xl font-bold tracking-tight">
                    {s.value}
                  </div>
                  <div className="text-xs text-slate-600 dark:text-slate-400">
                    {t(s.labelKey)}
                  </div>
                </div>
              ))}
            </motion.div>
          </div>

          {/* Visual */}
          <div className="lg:col-span-5">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.8, delay: 0.2 }}
              className="relative"
            >
              <div className="relative aspect-[4/5] sm:aspect-[5/6] rounded-[2rem] overflow-hidden shadow-glass border border-white/40 dark:border-slate-800">
                <img
                  src="https://images.unsplash.com/photo-1523240795612-9a054b0db644?auto=format&fit=crop&w=1400&q=80"
                  alt="Students in a modern classroom"
                  className="h-full w-full object-cover"
                  loading="eager"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-brand-900/60 via-brand-900/10 to-transparent" />

                {/* Floating cards */}
                <motion.div
                  animate={{ y: [0, -10, 0] }}
                  transition={{ repeat: Infinity, duration: 6, ease: "easeInOut" }}
                  className="absolute top-6 left-6 rounded-2xl glass-strong shadow-soft p-3 flex items-center gap-3"
                >
                  <span className="grid h-9 w-9 place-items-center rounded-xl bg-accent-500 text-white">
                    <Trophy className="h-4 w-4" />
                  </span>
                  <div>
                    <div className="text-xs text-slate-600 dark:text-slate-400">Olympiad</div>
                    <div className="text-sm font-semibold">Gold · 2025</div>
                  </div>
                </motion.div>

                <motion.div
                  animate={{ y: [0, 10, 0] }}
                  transition={{ repeat: Infinity, duration: 7, ease: "easeInOut" }}
                  className="absolute bottom-6 right-6 rounded-2xl glass-strong shadow-soft p-3 flex items-center gap-3"
                >
                  <span className="grid h-9 w-9 place-items-center rounded-xl bg-brand-600 text-white">
                    <Users className="h-4 w-4" />
                  </span>
                  <div>
                    <div className="text-xs text-slate-600 dark:text-slate-400">Class size</div>
                    <div className="text-sm font-semibold">≈ 20 students</div>
                  </div>
                </motion.div>
              </div>

              {/* Decorative blob */}
              <div className="absolute -z-10 -inset-8 rounded-[3rem] bg-gradient-to-tr from-brand-500/20 via-accent-400/20 to-brand-300/10 blur-2xl" />
            </motion.div>
          </div>
        </div>
      </div>
    </section>
  );
}
