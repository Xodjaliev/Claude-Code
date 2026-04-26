"use client";

import { motion } from "framer-motion";
import { Mail } from "lucide-react";
import Section from "@/components/ui/Section";
import { useLanguage } from "@/components/providers/LanguageProvider";

type Teacher = {
  name: string;
  subject: string;
  bio: string;
  image: string;
};

const teachers: Teacher[] = [
  {
    name: "Алина Каримова",
    subject: "Математика",
    bio: "Призёр республиканских олимпиад, 12 лет опыта.",
    image: "https://i.pravatar.cc/400?img=47",
  },
  {
    name: "Дилшод Усманов",
    subject: "IT и программирование",
    bio: "Ex-Google, наставник детских хакатонов.",
    image: "https://i.pravatar.cc/400?img=11",
  },
  {
    name: "Sarah Johnson",
    subject: "English (native)",
    bio: "Cambridge CELTA, специалист по IELTS.",
    image: "https://i.pravatar.cc/400?img=32",
  },
  {
    name: "Малика Рахимова",
    subject: "Биология",
    bio: "К.б.н., автор школьного учебника.",
    image: "https://i.pravatar.cc/400?img=45",
  },
  {
    name: "Иван Петров",
    subject: "Физика",
    bio: "Тренер сборной по физике, выпускник МФТИ.",
    image: "https://i.pravatar.cc/400?img=12",
  },
  {
    name: "Зарина Юсупова",
    subject: "Литература",
    bio: "Влюбляет в чтение даже самых занятых.",
    image: "https://i.pravatar.cc/400?img=49",
  },
  {
    name: "Бекзод Алиев",
    subject: "История",
    bio: "PhD, методолог исторического мышления.",
    image: "https://i.pravatar.cc/400?img=15",
  },
  {
    name: "Елена Иванова",
    subject: "Химия",
    bio: "Готовит призёров олимпиад уже 9 лет.",
    image: "https://i.pravatar.cc/400?img=48",
  },
];

export default function Teachers() {
  const { t } = useLanguage();

  return (
    <Section
      id="teachers"
      eyebrow={t("teachers.eyebrow")}
      title={t("teachers.title")}
      description={t("teachers.desc")}
    >
      <div className="grid gap-5 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
        {teachers.map((teacher, i) => (
          <motion.article
            key={teacher.name}
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.1 }}
            transition={{ duration: 0.5, delay: (i % 4) * 0.07 }}
            className="group relative overflow-hidden rounded-3xl glass-strong shadow-soft hover:shadow-glass transition-all hover:-translate-y-1"
          >
            <div className="relative aspect-[3/4] overflow-hidden">
              <img
                src={teacher.image}
                alt={teacher.name}
                className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-105"
                loading="lazy"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-slate-900/80 via-slate-900/20 to-transparent" />
              <div className="absolute bottom-3 left-3">
                <span className="inline-flex items-center rounded-full bg-white/90 dark:bg-slate-900/80 px-2.5 py-1 text-xs font-semibold text-brand-700 dark:text-brand-300 backdrop-blur">
                  {teacher.subject}
                </span>
              </div>
            </div>
            <div className="p-5">
              <h3 className="font-display text-lg font-semibold tracking-tight">
                {teacher.name}
              </h3>
              <p className="mt-1.5 text-sm text-slate-600 dark:text-slate-400 line-clamp-2">
                {teacher.bio}
              </p>
              <button className="mt-3 inline-flex items-center gap-1.5 text-xs font-semibold text-brand-600 dark:text-brand-400 hover:underline">
                <Mail className="h-3.5 w-3.5" />
                Связаться
              </button>
            </div>
          </motion.article>
        ))}
      </div>
    </Section>
  );
}
