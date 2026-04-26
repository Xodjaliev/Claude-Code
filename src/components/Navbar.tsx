"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { Menu, X, Moon, Sun, Globe, GraduationCap } from "lucide-react";
import { useTheme } from "@/components/providers/ThemeProvider";
import { useLanguage } from "@/components/providers/LanguageProvider";
import { Locale, locales, localeLabels } from "@/lib/translations";

const navItems = [
  { href: "#home", key: "nav.home" },
  { href: "#about", key: "nav.about" },
  { href: "#education", key: "nav.education" },
  { href: "#news", key: "nav.news" },
  { href: "#teachers", key: "nav.teachers" },
  { href: "#students", key: "nav.students" },
  { href: "#parents", key: "nav.parents" },
  { href: "#contacts", key: "nav.contacts" },
];

export default function Navbar() {
  const { theme, toggle } = useTheme();
  const { locale, setLocale, t } = useLanguage();
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [langOpen, setLangOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        scrolled ? "py-2" : "py-4"
      }`}
    >
      <div
        className={`mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 transition-all duration-300 ${
          scrolled ? "" : ""
        }`}
      >
        <div
          className={`flex items-center justify-between rounded-2xl px-4 py-2.5 transition-all ${
            scrolled
              ? "glass-strong shadow-soft"
              : "bg-transparent"
          }`}
        >
          {/* Logo */}
          <Link
            href="#home"
            className="flex items-center gap-2 group"
            aria-label="School 37 — Home"
          >
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br from-brand-600 to-brand-400 text-white shadow-glass">
              <GraduationCap className="h-5 w-5" />
            </span>
            <span className="font-display text-base font-semibold tracking-tight">
              School <span className="text-brand-600 dark:text-brand-400">№37</span>
            </span>
          </Link>

          {/* Desktop nav */}
          <nav className="hidden lg:flex items-center gap-1">
            {navItems.map((item) => (
              <a
                key={item.href}
                href={item.href}
                className="px-3 py-2 text-sm font-medium text-slate-700 dark:text-slate-300 hover:text-brand-600 dark:hover:text-brand-400 transition-colors"
              >
                {t(item.key)}
              </a>
            ))}
          </nav>

          {/* Actions */}
          <div className="flex items-center gap-1.5">
            {/* Language */}
            <div className="relative">
              <button
                onClick={() => setLangOpen((v) => !v)}
                className="flex items-center gap-1 rounded-xl px-2.5 py-2 text-sm font-medium hover:bg-slate-200/60 dark:hover:bg-slate-800/60 transition-colors"
                aria-label="Change language"
                aria-expanded={langOpen}
              >
                <Globe className="h-4 w-4" />
                <span className="hidden sm:inline">{localeLabels[locale]}</span>
              </button>
              <AnimatePresence>
                {langOpen && (
                  <motion.div
                    initial={{ opacity: 0, y: -6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -6 }}
                    transition={{ duration: 0.15 }}
                    className="absolute right-0 mt-2 w-32 overflow-hidden rounded-xl glass-strong shadow-soft p-1"
                    role="menu"
                  >
                    {locales.map((l: Locale) => (
                      <button
                        key={l}
                        onClick={() => {
                          setLocale(l);
                          setLangOpen(false);
                        }}
                        className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors ${
                          l === locale
                            ? "bg-brand-600 text-white"
                            : "hover:bg-slate-200/60 dark:hover:bg-slate-800/60"
                        }`}
                      >
                        {localeLabels[l]}
                      </button>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Theme */}
            <button
              onClick={toggle}
              className="rounded-xl p-2 hover:bg-slate-200/60 dark:hover:bg-slate-800/60 transition-colors"
              aria-label="Toggle theme"
            >
              {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </button>

            {/* Apply CTA */}
            <a
              href="#contacts"
              className="hidden md:inline-flex items-center gap-1.5 rounded-xl bg-brand-600 px-3.5 py-2 text-sm font-semibold text-white shadow-glass hover:bg-brand-700 transition-colors"
            >
              {t("nav.apply")}
            </a>

            {/* Mobile toggle */}
            <button
              onClick={() => setOpen((v) => !v)}
              className="lg:hidden rounded-xl p-2 hover:bg-slate-200/60 dark:hover:bg-slate-800/60 transition-colors"
              aria-label="Toggle menu"
              aria-expanded={open}
            >
              {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          </div>
        </div>

        {/* Mobile menu */}
        <AnimatePresence>
          {open && (
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.2 }}
              className="lg:hidden mt-2 rounded-2xl glass-strong shadow-soft overflow-hidden"
            >
              <nav className="flex flex-col p-2">
                {navItems.map((item) => (
                  <a
                    key={item.href}
                    href={item.href}
                    onClick={() => setOpen(false)}
                    className="px-3 py-3 rounded-xl text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-200/60 dark:hover:bg-slate-800/60 transition-colors"
                  >
                    {t(item.key)}
                  </a>
                ))}
                <a
                  href="#contacts"
                  onClick={() => setOpen(false)}
                  className="m-2 inline-flex items-center justify-center gap-1.5 rounded-xl bg-brand-600 px-3.5 py-2.5 text-sm font-semibold text-white shadow-glass hover:bg-brand-700 transition-colors"
                >
                  {t("nav.apply")}
                </a>
              </nav>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </header>
  );
}
