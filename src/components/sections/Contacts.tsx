"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { MapPin, Phone, Mail, Clock, Send, CheckCircle2 } from "lucide-react";
import Section from "@/components/ui/Section";
import { useLanguage } from "@/components/providers/LanguageProvider";

export default function Contacts() {
  const { t } = useLanguage();
  const [sent, setSent] = useState(false);
  const [form, setForm] = useState({ name: "", email: "", message: "" });

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name || !form.email || !form.message) return;
    setSent(true);
    setForm({ name: "", email: "", message: "" });
    setTimeout(() => setSent(false), 4000);
  };

  const tiles = [
    { icon: MapPin, titleKey: "contacts.address", value: "ул. Школьная, 37 · Ташкент" },
    { icon: Phone, titleKey: "contacts.phone", value: "+998 (00) 000-00-00" },
    { icon: Mail, titleKey: "contacts.email", value: "info@school-37.com" },
    { icon: Clock, titleKey: "contacts.hours", valueKey: "contacts.hours.value" },
  ];

  return (
    <Section id="contacts" eyebrow={t("contacts.eyebrow")} title={t("contacts.title")}>
      <div className="grid gap-6 lg:grid-cols-12">
        {/* Info + map */}
        <div className="lg:col-span-6 space-y-5">
          <div className="grid sm:grid-cols-2 gap-4">
            {tiles.map((tile, i) => (
              <motion.div
                key={tile.titleKey}
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, amount: 0.2 }}
                transition={{ duration: 0.5, delay: i * 0.06 }}
                className="rounded-2xl glass-strong p-5 shadow-soft"
              >
                <span className="grid h-10 w-10 place-items-center rounded-xl bg-brand-50 dark:bg-brand-900/30 text-brand-600 dark:text-brand-400">
                  <tile.icon className="h-4 w-4" />
                </span>
                <div className="mt-3 text-xs text-slate-500">{t(tile.titleKey)}</div>
                <div className="mt-0.5 text-sm font-semibold">
                  {tile.valueKey ? t(tile.valueKey) : tile.value}
                </div>
              </motion.div>
            ))}
          </div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.2 }}
            transition={{ duration: 0.6 }}
            className="overflow-hidden rounded-3xl shadow-soft border border-slate-200 dark:border-slate-800"
          >
            <iframe
              title="School №37 location"
              src="https://www.openstreetmap.org/export/embed.html?bbox=69.20%2C41.28%2C69.32%2C41.34&layer=mapnik&marker=41.31%2C69.26"
              className="w-full aspect-[16/10]"
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
            />
          </motion.div>
        </div>

        {/* Form */}
        <div className="lg:col-span-6">
          <motion.form
            onSubmit={submit}
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.2 }}
            transition={{ duration: 0.6 }}
            className="rounded-3xl glass-strong p-6 sm:p-8 shadow-soft space-y-4"
          >
            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1.5">
                {t("contacts.form.name")}
              </label>
              <input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                required
                className="w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-white/70 dark:bg-slate-900/60 px-4 py-3 text-sm focus:border-brand-500 focus:ring-2 focus:ring-brand-200 dark:focus:ring-brand-900/30 outline-none transition"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1.5">
                {t("contacts.form.email")}
              </label>
              <input
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                required
                className="w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-white/70 dark:bg-slate-900/60 px-4 py-3 text-sm focus:border-brand-500 focus:ring-2 focus:ring-brand-200 dark:focus:ring-brand-900/30 outline-none transition"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1.5">
                {t("contacts.form.message")}
              </label>
              <textarea
                rows={5}
                value={form.message}
                onChange={(e) => setForm({ ...form, message: e.target.value })}
                required
                className="w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-white/70 dark:bg-slate-900/60 px-4 py-3 text-sm focus:border-brand-500 focus:ring-2 focus:ring-brand-200 dark:focus:ring-brand-900/30 outline-none transition resize-none"
              />
            </div>
            <button
              type="submit"
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-brand-600 px-5 py-3 text-sm font-semibold text-white shadow-glass hover:bg-brand-700 transition-colors w-full sm:w-auto"
            >
              {t("contacts.form.send")}
              <Send className="h-4 w-4" />
            </button>

            {sent && (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex items-center gap-2 rounded-xl border border-emerald-300 dark:border-emerald-900 bg-emerald-50 dark:bg-emerald-900/20 px-4 py-3 text-sm text-emerald-800 dark:text-emerald-300"
              >
                <CheckCircle2 className="h-4 w-4" />
                {t("contacts.form.success")}
              </motion.div>
            )}
          </motion.form>
        </div>
      </div>
    </Section>
  );
}
