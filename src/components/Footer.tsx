"use client";

import Link from "next/link";
import { GraduationCap, Mail, Phone, MapPin, Instagram, Facebook, Youtube, Send } from "lucide-react";
import { useLanguage } from "@/components/providers/LanguageProvider";

export default function Footer() {
  const { t } = useLanguage();

  const links = [
    { href: "#about", key: "nav.about" },
    { href: "#education", key: "nav.education" },
    { href: "#news", key: "nav.news" },
    { href: "#teachers", key: "nav.teachers" },
    { href: "#students", key: "nav.students" },
    { href: "#parents", key: "nav.parents" },
    { href: "#contacts", key: "nav.contacts" },
    { href: "/admin", key: "nav.admin" },
  ];

  return (
    <footer className="relative mt-20 border-t border-slate-200/70 dark:border-slate-800/70">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-14 grid gap-10 md:grid-cols-12">
        <div className="md:col-span-5">
          <Link href="#home" className="inline-flex items-center gap-2">
            <span className="grid h-10 w-10 place-items-center rounded-xl bg-gradient-to-br from-brand-600 to-brand-400 text-white shadow-glass">
              <GraduationCap className="h-5 w-5" />
            </span>
            <span className="font-display text-lg font-semibold tracking-tight">
              School <span className="text-brand-600 dark:text-brand-400">№37</span>
            </span>
          </Link>
          <p className="mt-4 text-sm text-slate-600 dark:text-slate-400 max-w-md">
            {t("footer.tagline")}
          </p>

          <div className="mt-6 flex items-center gap-2">
            {[
              { icon: Instagram, label: "Instagram", href: "#" },
              { icon: Facebook, label: "Facebook", href: "#" },
              { icon: Youtube, label: "YouTube", href: "#" },
              { icon: Send, label: "Telegram", href: "#" },
            ].map(({ icon: Icon, label, href }) => (
              <a
                key={label}
                href={href}
                aria-label={label}
                className="grid h-9 w-9 place-items-center rounded-xl border border-slate-200 dark:border-slate-800 hover:border-brand-500 hover:text-brand-600 dark:hover:text-brand-400 transition-colors"
              >
                <Icon className="h-4 w-4" />
              </a>
            ))}
          </div>
        </div>

        <div className="md:col-span-3">
          <h4 className="text-sm font-semibold mb-4">{t("footer.links")}</h4>
          <ul className="space-y-2 text-sm">
            {links.map((l) => (
              <li key={l.href}>
                <a
                  href={l.href}
                  className="text-slate-600 dark:text-slate-400 hover:text-brand-600 dark:hover:text-brand-400 transition-colors"
                >
                  {t(l.key)}
                </a>
              </li>
            ))}
          </ul>
        </div>

        <div className="md:col-span-4">
          <h4 className="text-sm font-semibold mb-4">{t("footer.contact")}</h4>
          <ul className="space-y-3 text-sm text-slate-600 dark:text-slate-400">
            <li className="flex gap-2">
              <MapPin className="h-4 w-4 mt-0.5 shrink-0 text-brand-600 dark:text-brand-400" />
              <span>ул. Школьная, 37 · Ташкент</span>
            </li>
            <li className="flex gap-2">
              <Phone className="h-4 w-4 mt-0.5 shrink-0 text-brand-600 dark:text-brand-400" />
              <a href="tel:+998000000000" className="hover:underline">+998 (00) 000-00-00</a>
            </li>
            <li className="flex gap-2">
              <Mail className="h-4 w-4 mt-0.5 shrink-0 text-brand-600 dark:text-brand-400" />
              <a href="mailto:info@school-37.com" className="hover:underline">info@school-37.com</a>
            </li>
          </ul>
        </div>
      </div>

      <div className="border-t border-slate-200/70 dark:border-slate-800/70">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-5 flex flex-col md:flex-row items-center justify-between gap-3 text-xs text-slate-500 dark:text-slate-500">
          <span>© {new Date().getFullYear()} School №37. {t("footer.rights")}</span>
          <span>Designed with care · Next.js · Tailwind · Framer Motion</span>
        </div>
      </div>
    </footer>
  );
}
