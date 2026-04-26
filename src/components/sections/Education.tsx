"use client";

import { motion } from "framer-motion";
import {
  Code2,
  Languages,
  Trophy,
  Calculator,
  FlaskConical,
  Globe2,
  Music,
  Palette,
  BookOpen,
  Atom,
  Microscope,
  Cpu,
} from "lucide-react";
import Section from "@/components/ui/Section";
import { useLanguage } from "@/components/providers/LanguageProvider";

export default function Education() {
  const { t } = useLanguage();

  const programs = [
    { titleKey: "edu.programs.primary", descKey: "edu.programs.primary.desc", grade: "1–4", color: "from-sky-400 to-blue-600" },
    { titleKey: "edu.programs.middle", descKey: "edu.programs.middle.desc", grade: "5–9", color: "from-indigo-400 to-violet-600" },
    { titleKey: "edu.programs.high", descKey: "edu.programs.high.desc", grade: "10–11", color: "from-fuchsia-400 to-purple-600" },
  ];

  const subjects = [
    { icon: Calculator, label: "Math" },
    { icon: FlaskConical, label: "Chemistry" },
    { icon: Atom, label: "Physics" },
    { icon: Microscope, label: "Biology" },
    { icon: Globe2, label: "Geography" },
    { icon: BookOpen, label: "Literature" },
    { icon: Languages, label: "Languages" },
    { icon: Cpu, label: "Computer Sci." },
    { icon: Music, label: "Music" },
    { icon: Palette, label: "Art" },
  ];

  const focus = [
    { icon: Code2, titleKey: "edu.focus.it", descKey: "edu.focus.it.desc", tags: ["Python", "AI/ML", "Web", "Robotics"], color: "from-brand-600 to-brand-400" },
    { icon: Languages, titleKey: "edu.focus.en", descKey: "edu.focus.en.desc", tags: ["IELTS", "Cambridge", "Speaking"], color: "from-emerald-500 to-teal-400" },
    { icon: Trophy, titleKey: "edu.focus.sport", descKey: "edu.focus.sport.desc", tags: ["Football", "Chess", "Swimming"], color: "from-accent-500 to-accent-400" },
  ];

  return (
    <Section
      id="education"
      eyebrow={t("edu.eyebrow")}
      title={t("edu.title")}
      description={t("edu.desc")}
    >
      {/* Programs */}
      <div className="grid gap-5 md:grid-cols-3">
        {programs.map((p, i) => (
          <motion.div
            key={p.titleKey}
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.2 }}
            transition={{ duration: 0.6, ease: "easeOut", delay: i * 0.08 }}
            className="relative overflow-hidden rounded-3xl glass-strong p-6 shadow-soft hover:shadow-glass transition-all hover:-translate-y-1"
          >
            <div className={`absolute -top-10 -right-10 h-40 w-40 rounded-full bg-gradient-to-br ${p.color} opacity-20 blur-3xl`} />
            <div className="flex items-center justify-between">
              <span className={`inline-flex items-center rounded-full bg-gradient-to-r ${p.color} px-3 py-1 text-xs font-semibold text-white`}>
                {p.grade}
              </span>
              <BookOpen className="h-5 w-5 text-brand-600 dark:text-brand-400" />
            </div>
            <h3 className="mt-5 font-display text-xl font-semibold tracking-tight">
              {t(p.titleKey)}
            </h3>
            <p className="mt-2 text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
              {t(p.descKey)}
            </p>
          </motion.div>
        ))}
      </div>

      {/* Subjects marquee */}
      <div className="mt-16">
        <h3 className="font-display text-xl font-semibold tracking-tight text-center mb-6">
          {t("edu.subjects.title")}
        </h3>
        <div className="flex flex-wrap justify-center gap-2.5">
          {subjects.map((s, i) => (
            <motion.div
              key={s.label}
              initial={{ opacity: 0, y: 10 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.1 }}
              transition={{ duration: 0.4, delay: i * 0.04 }}
              className="inline-flex items-center gap-2 rounded-full border border-slate-200 dark:border-slate-800 glass px-4 py-2 text-sm hover:border-brand-500 transition-colors"
            >
              <s.icon className="h-4 w-4 text-brand-600 dark:text-brand-400" />
              {s.label}
            </motion.div>
          ))}
        </div>
      </div>

      {/* Focus tracks */}
      <div className="mt-16">
        <h3 className="font-display text-xl font-semibold tracking-tight text-center mb-8">
          {t("edu.clubs.title")}
        </h3>
        <div className="grid gap-5 md:grid-cols-3">
          {focus.map((f, i) => (
            <motion.div
              key={f.titleKey}
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.2 }}
              transition={{ duration: 0.6, delay: i * 0.08 }}
              className="group relative overflow-hidden rounded-3xl bg-gradient-to-br p-[1px]"
              style={{ background: "linear-gradient(135deg, rgba(31,78,245,0.4), rgba(255,158,27,0.3))" }}
            >
              <div className="relative h-full rounded-3xl bg-white dark:bg-slate-900 p-6">
                <span className={`grid h-12 w-12 place-items-center rounded-2xl bg-gradient-to-br ${f.color} text-white shadow-glass`}>
                  <f.icon className="h-5 w-5" />
                </span>
                <h4 className="mt-4 font-display text-lg font-semibold tracking-tight">
                  {t(f.titleKey)}
                </h4>
                <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
                  {t(f.descKey)}
                </p>
                <div className="mt-4 flex flex-wrap gap-1.5">
                  {f.tags.map((tag) => (
                    <span
                      key={tag}
                      className="rounded-full bg-slate-100 dark:bg-slate-800 px-2.5 py-1 text-xs font-medium text-slate-700 dark:text-slate-300"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </Section>
  );
}
