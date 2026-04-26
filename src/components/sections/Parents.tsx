"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { GraduationCap, FileText, HelpCircle, ChevronDown, CheckCircle2 } from "lucide-react";
import Section from "@/components/ui/Section";
import { useLanguage } from "@/components/providers/LanguageProvider";

export default function Parents() {
  const { t } = useLanguage();
  const [openIdx, setOpenIdx] = useState<number | null>(0);

  const faq = [
    { q: "parents.faq.q1", a: "parents.faq.a1" },
    { q: "parents.faq.q2", a: "parents.faq.a2" },
    { q: "parents.faq.q3", a: "parents.faq.a3" },
    { q: "parents.faq.q4", a: "parents.faq.a4" },
  ];

  const documents = [
    "Свидетельство о рождении",
    "Медицинская карта",
    "Фото 3×4 (2 шт.)",
    "Заявление от родителя",
    "Копия паспорта родителя",
  ];

  const steps = [
    { n: "01", title: "Заявка онлайн", desc: "Оставьте заявку на сайте за 2 минуты." },
    { n: "02", title: "Собеседование", desc: "Знакомство, диагностика и тур по школе." },
    { n: "03", title: "Зачисление", desc: "Договор и добро пожаловать в School №37." },
  ];

  return (
    <Section id="parents" eyebrow={t("parents.eyebrow")} title={t("parents.title")}>
      <div className="grid gap-6 lg:grid-cols-12">
        {/* Admission steps */}
        <div className="lg:col-span-7 space-y-6">
          <div className="rounded-3xl glass-strong p-6 sm:p-8 shadow-soft">
            <div className="flex items-center gap-3 mb-5">
              <span className="grid h-10 w-10 place-items-center rounded-xl bg-gradient-to-br from-brand-500 to-brand-700 text-white">
                <GraduationCap className="h-5 w-5" />
              </span>
              <h3 className="font-display text-xl font-semibold tracking-tight">
                {t("parents.admission")}
              </h3>
            </div>

            <ol className="grid gap-3 sm:grid-cols-3">
              {steps.map((s, i) => (
                <motion.li
                  key={s.n}
                  initial={{ opacity: 0, y: 16 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, amount: 0.2 }}
                  transition={{ duration: 0.5, delay: i * 0.08 }}
                  className="rounded-2xl border border-slate-200 dark:border-slate-800 p-4"
                >
                  <span className="font-mono text-xs text-brand-600 dark:text-brand-400">{s.n}</span>
                  <h4 className="mt-2 font-semibold">{s.title}</h4>
                  <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">{s.desc}</p>
                </motion.li>
              ))}
            </ol>
          </div>

          <div className="rounded-3xl glass-strong p-6 sm:p-8 shadow-soft">
            <div className="flex items-center gap-3 mb-5">
              <span className="grid h-10 w-10 place-items-center rounded-xl bg-gradient-to-br from-accent-400 to-accent-600 text-white">
                <FileText className="h-5 w-5" />
              </span>
              <h3 className="font-display text-xl font-semibold tracking-tight">
                {t("parents.docs")}
              </h3>
            </div>
            <ul className="grid sm:grid-cols-2 gap-y-2 gap-x-6 text-sm">
              {documents.map((d) => (
                <li key={d} className="flex items-start gap-2 text-slate-700 dark:text-slate-300">
                  <CheckCircle2 className="h-4 w-4 mt-0.5 text-emerald-500 shrink-0" />
                  {d}
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* FAQ */}
        <div className="lg:col-span-5">
          <div className="rounded-3xl glass-strong p-6 sm:p-8 shadow-soft">
            <div className="flex items-center gap-3 mb-5">
              <span className="grid h-10 w-10 place-items-center rounded-xl bg-gradient-to-br from-emerald-500 to-emerald-700 text-white">
                <HelpCircle className="h-5 w-5" />
              </span>
              <h3 className="font-display text-xl font-semibold tracking-tight">
                {t("parents.faq")}
              </h3>
            </div>
            <ul className="divide-y divide-slate-200/60 dark:divide-slate-800/60">
              {faq.map((item, i) => {
                const open = openIdx === i;
                return (
                  <li key={item.q}>
                    <button
                      onClick={() => setOpenIdx(open ? null : i)}
                      className="w-full flex items-center justify-between gap-3 py-4 text-left"
                      aria-expanded={open}
                    >
                      <span className="font-medium">{t(item.q)}</span>
                      <ChevronDown
                        className={`h-4 w-4 shrink-0 transition-transform ${open ? "rotate-180" : ""}`}
                      />
                    </button>
                    <AnimatePresence initial={false}>
                      {open && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: "auto", opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.25 }}
                          className="overflow-hidden"
                        >
                          <p className="pb-4 text-sm text-slate-600 dark:text-slate-400">
                            {t(item.a)}
                          </p>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </li>
                );
              })}
            </ul>
          </div>
        </div>
      </div>
    </Section>
  );
}
