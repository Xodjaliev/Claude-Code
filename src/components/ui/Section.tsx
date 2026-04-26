"use client";

import { motion } from "framer-motion";
import { ReactNode } from "react";

type Props = {
  id?: string;
  eyebrow?: string;
  title?: string;
  description?: string;
  children: ReactNode;
  className?: string;
  align?: "left" | "center";
};

export default function Section({
  id,
  eyebrow,
  title,
  description,
  children,
  className = "",
  align = "center",
}: Props) {
  return (
    <section
      id={id}
      className={`relative scroll-mt-28 py-20 sm:py-28 ${className}`}
    >
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {(eyebrow || title || description) && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.3 }}
            transition={{ duration: 0.6, ease: "easeOut" }}
            className={`mb-12 sm:mb-16 max-w-3xl ${
              align === "center" ? "mx-auto text-center" : "text-left"
            }`}
          >
            {eyebrow && (
              <span className="inline-flex items-center gap-2 rounded-full border border-brand-200 dark:border-brand-900/50 bg-brand-50 dark:bg-brand-900/20 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-brand-700 dark:text-brand-300">
                <span className="h-1.5 w-1.5 rounded-full bg-brand-500" />
                {eyebrow}
              </span>
            )}
            {title && (
              <h2 className="mt-4 font-display text-3xl sm:text-4xl md:text-5xl font-bold tracking-tight text-balance">
                {title}
              </h2>
            )}
            {description && (
              <p className="mt-4 text-base sm:text-lg text-slate-600 dark:text-slate-400 text-balance">
                {description}
              </p>
            )}
          </motion.div>
        )}
        {children}
      </div>
    </section>
  );
}
