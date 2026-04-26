"use client";

import { motion } from "framer-motion";
import { History, Target, Heart, Trophy } from "lucide-react";
import Section from "@/components/ui/Section";
import { useLanguage } from "@/components/providers/LanguageProvider";

const galleryImages = [
  "https://images.unsplash.com/photo-1580582932707-520aed937b7b?auto=format&fit=crop&w=900&q=80",
  "https://images.unsplash.com/photo-1503676260728-1c00da094a0b?auto=format&fit=crop&w=900&q=80",
  "https://images.unsplash.com/photo-1571260899304-425eee4c7efc?auto=format&fit=crop&w=900&q=80",
  "https://images.unsplash.com/photo-1581726707445-75cbe4efc586?auto=format&fit=crop&w=900&q=80",
  "https://images.unsplash.com/photo-1509062522246-3755977927d7?auto=format&fit=crop&w=900&q=80",
  "https://images.unsplash.com/photo-1427504494785-3a9ca7044f45?auto=format&fit=crop&w=900&q=80",
];

export default function About() {
  const { t } = useLanguage();

  const cards = [
    { icon: History, titleKey: "about.history.title", descKey: "about.history.desc", color: "from-brand-500 to-brand-700" },
    { icon: Target, titleKey: "about.mission.title", descKey: "about.mission.desc", color: "from-accent-400 to-accent-600" },
    { icon: Heart, titleKey: "about.values.title", descKey: "about.values.desc", color: "from-pink-400 to-rose-600" },
    { icon: Trophy, titleKey: "about.achievements.title", descKey: "about.achievements.desc", color: "from-emerald-400 to-emerald-600" },
  ];

  return (
    <Section
      id="about"
      eyebrow={t("about.eyebrow")}
      title={t("about.title")}
      description={t("about.desc")}
    >
      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map((card, i) => (
          <motion.article
            key={card.titleKey}
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.2 }}
            transition={{ duration: 0.6, ease: "easeOut", delay: i * 0.08 }}
            className="group relative rounded-3xl glass p-6 shadow-soft hover:shadow-glass transition-all hover:-translate-y-1"
          >
            <span
              className={`grid h-12 w-12 place-items-center rounded-2xl bg-gradient-to-br ${card.color} text-white shadow-glass`}
            >
              <card.icon className="h-5 w-5" />
            </span>
            <h3 className="mt-5 font-display text-lg font-semibold tracking-tight">
              {t(card.titleKey)}
            </h3>
            <p className="mt-2 text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
              {t(card.descKey)}
            </p>
            <div className="absolute inset-x-6 bottom-0 h-px bg-gradient-to-r from-transparent via-brand-500/50 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
          </motion.article>
        ))}
      </div>

      {/* Gallery */}
      <div className="mt-20">
        <motion.h3
          initial={{ opacity: 0, y: 14 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="font-display text-2xl sm:text-3xl font-semibold tracking-tight text-center mb-8"
        >
          {t("about.gallery.title")}
        </motion.h3>

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 sm:gap-4">
          {galleryImages.map((src, i) => (
            <motion.div
              key={src}
              initial={{ opacity: 0, scale: 0.96 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true, amount: 0.2 }}
              transition={{ duration: 0.5, delay: i * 0.05 }}
              className={`group relative overflow-hidden rounded-2xl shadow-soft ${
                i === 0 ? "sm:col-span-2 sm:row-span-2 aspect-square sm:aspect-auto" : "aspect-[4/3]"
              }`}
            >
              <img
                src={src}
                alt={`School moment ${i + 1}`}
                className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-110"
                loading="lazy"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-slate-900/40 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
            </motion.div>
          ))}
        </div>
      </div>
    </Section>
  );
}
