# School №37 — официальный сайт

Современный, адаптивный сайт для общеобразовательной школы, построенный на Next.js 14, Tailwind CSS и Framer Motion. Дизайн в духе лучших EdTech платформ: минимализм, glassmorphism, плавные анимации, тёмная тема и поддержка трёх языков.

[Образец оригинального сайта школы](https://school-37.com/)

## Особенности

- **Hero-секция** с градиентным заголовком, статистикой и плавающими карточками.
- **О школе** — история, миссия, ценности, достижения и фотогалерея.
- **Образование** — программы (1–4, 5–9, 10–11), предметы, IT/английский/спорт.
- **Новости и события** — карточки, фильтр по категориям, синхронизация с админкой.
- **Учителя** — карточки команды.
- **Ученикам** — расписание, домашние задания, ресурсы.
- **Родителям** — этапы поступления, документы, FAQ.
- **Контакты** — карта (OpenStreetMap), форма обратной связи, реквизиты.
- **Админ-панель** (`/admin`) — добавление, редактирование и удаление новостей.
- **Многоязычность**: RU / UZ / EN.
- **Тёмная тема** с автоопределением и сохранением выбора.
- **SEO**: metadata API, sitemap, robots.txt, OpenGraph.
- **Адаптивность**: mobile-first, glassmorphism, плавные scroll-анимации.

## Стек

- [Next.js 14](https://nextjs.org/) (App Router) + TypeScript
- [Tailwind CSS](https://tailwindcss.com/)
- [Framer Motion](https://www.framer.com/motion/)
- [Lucide Icons](https://lucide.dev/)
- Шрифты: Inter + Poppins (через `next/font`)

## Запуск

```bash
npm install
npm run dev
# открой http://localhost:3000
```

Сборка для продакшена:

```bash
npm run build
npm run start
```

## Админка

Открой [/admin](http://localhost:3000/admin). Демо-пароль: `school37`.

> Новости хранятся в `localStorage` браузера — это специально для демо. В продакшене подключите БД (Postgres / Supabase / Sanity и т.д.) и реальную аутентификацию.

## Структура

```
src/
├── app/
│   ├── layout.tsx            # ThemeProvider + LanguageProvider
│   ├── page.tsx              # Главная — все секции
│   ├── admin/page.tsx        # Админ-панель
│   ├── sitemap.ts / robots.ts
│   └── globals.css
├── components/
│   ├── Navbar.tsx · Footer.tsx
│   ├── providers/            # Theme + Language
│   ├── sections/             # Hero, About, Education, News, Teachers, Students, Parents, Contacts
│   └── ui/                   # Section, Reveal
└── lib/
    ├── translations.ts       # RU / UZ / EN
    └── news.ts               # Хранение новостей
```

## Цвета

- Brand: `#1f4ef5` (тёмно-синий)
- Акцент: `#ff9e1b` (тёплый оранжевый)
- Светлый/тёмный режим переключаются через `<html class="dark">`.

## Дальнейшее развитие

- Подключить БД и API роуты для новостей и заявок.
- Добавить систему ролей (учитель / ученик / родитель / админ).
- Личный кабинет для учеников (электронный дневник).
- Полноценную CMS для редактирования контента всех секций.
