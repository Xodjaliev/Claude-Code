"use client";

import { motion } from "framer-motion";
import { CalendarDays, ClipboardList, Library, ArrowUpRight } from "lucide-react";
import Section from "@/components/ui/Section";
import { useLanguage } from "@/components/providers/LanguageProvider";

const schedule = [
  { time: "08:00", subject: "Математика", room: "204" },
  { time: "08:55", subject: "Английский", room: "112" },
  { time: "09:50", subject: "Физика", room: "301" },
  { time: "10:45", subject: "История", room: "210" },
  { time: "11:40", subject: "IT / Python", room: "Lab-1" },
  { time: "12:35", subject: "Литература", room: "118" },
];

export default function Students() {
  const { t } = useLanguage();

  const tiles = [
    {
      icon: CalendarDays,
      titleKey: "students.schedule",
      descKey: "students.schedule.desc",
      color: "from-brand-500 to-brand-700",
    },
    {
      icon: ClipboardList,
      titleKey: "students.homework",
      descKey: "students.homework.desc",
      color: "from-accent-400 to-accent-600",
    },
    {
      icon: Library,
      titleKey: "students.resources",
      descKey: "students.resources.desc",
      color: "from-emerald-500 to-emerald-700",
    },
  ];

  return (
    <Section id="students" eyebrow={t("students.eyebrow")} title={t("students.title")}>
      <div className="grid gap-6 lg:grid-cols-12">
        <div className="lg:col-span-7">
          <div className="grid gap-5 sm:grid-cols-3">
            {tiles.map((tile, i) => (
              <motion.button
                key={tile.titleKey}
                initial={{ opacity: 0, y: 24 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, amount: 0.2 }}
                transition={{ duration: 0.5, delay: i * 0.07 }}
                className="group relative overflow-hidden rounded-3xl glass-strong p-5 text-left shadow-soft hover:shadow-glass transition-all hover:-translate-y-1"
              >
                <span className={`grid h-12 w-12 place-items-center rounded-2xl bg-gradient-to-br ${tile.color} text-white shadow-glass`}>
                  <tile.icon className="h-5 w-5" />
                </span>
                <h3 className="mt-4 font-display text-lg font-semibold tracking-tight">
                  {t(tile.titleKey)}
                </h3>
                <p className="mt-1.5 text-sm text-slate-600 dark:text-slate-400">
                  {t(tile.descKey)}
                </p>
                <ArrowUpRight className="absolute top-5 right-5 h-4 w-4 text-slate-400 group-hover:text-brand-500 group-hover:rotate-12 transition-all" />
              </motion.button>
            ))}
          </div>

          {/* Today's schedule */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.2 }}
            transition={{ duration: 0.6 }}
            className="mt-6 rounded-3xl glass-strong p-6 shadow-soft"
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-display text-lg font-semibold tracking-tight">
                {t("students.schedule")}
              </h3>
              <span className="text-xs text-slate-500">8А · {new Date().toLocaleDateString()}</span>
            </div>
            <ul className="divide-y divide-slate-200/60 dark:divide-slate-800/60">
              {schedule.map((row, i) => (
                <li key={i} className="flex items-center gap-4 py-3 text-sm">
                  <span className="w-14 font-mono text-slate-500">{row.time}</span>
                  <span className="flex-1 font-medium">{row.subject}</span>
                  <span className="rounded-full bg-slate-100 dark:bg-slate-800 px-2.5 py-0.5 text-xs">
                    {row.room}
                  </span>
                </li>
              ))}
            </ul>
          </motion.div>
        </div>

        <div className="lg:col-span-5">
          <motion.div
            initial={{ opacity: 0, scale: 0.97 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true, amount: 0.2 }}
            transition={{ duration: 0.6 }}
            className="relative aspect-[4/5] overflow-hidden rounded-3xl shadow-glass"
          >
            <img
              src="https://images.unsplash.com/photo-1456513080510-7bf3a84b82f8?auto=format&fit=crop&w=1200&q=80"
              alt="Student studying"
              className="h-full w-full object-cover"
              loading="lazy"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-brand-900/80 via-brand-900/20 to-transparent" />
            <div className="absolute bottom-0 left-0 right-0 p-6 text-white">
              <h4 className="font-display text-xl font-semibold">
                Учись где удобно
              </h4>
              <p className="mt-2 text-sm text-white/80 max-w-sm">
                Личный кабинет, расписание, задания и материалы — всегда с тобой.
              </p>
            </div>
          </motion.div>
        </div>
      </div>
    </Section>
  );
}
