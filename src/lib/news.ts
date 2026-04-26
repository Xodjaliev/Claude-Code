export type NewsCategory = "events" | "olympics" | "life" | "announcements";

export type NewsItem = {
  id: string;
  title: string;
  summary: string;
  category: NewsCategory;
  image: string;
  date: string; // ISO
};

export const STORAGE_KEY = "school37-news";

export const defaultNews: NewsItem[] = [
  {
    id: "n-1",
    title: "Школьники победили на международной олимпиаде по математике",
    summary:
      "Команда 10-х классов привезла две золотые и три серебряные медали с международной олимпиады в Стамбуле.",
    category: "olympics",
    image:
      "https://images.unsplash.com/photo-1546410531-bb4caa6b424d?auto=format&fit=crop&w=1200&q=80",
    date: "2026-04-12",
  },
  {
    id: "n-2",
    title: "Открылась новая лаборатория робототехники",
    summary:
      "В корпусе B запущена современная STEM-лаборатория с 3D-принтерами, наборами LEGO Mindstorms и роборукой.",
    category: "life",
    image:
      "https://images.unsplash.com/photo-1581091226825-a6a2a5aee158?auto=format&fit=crop&w=1200&q=80",
    date: "2026-03-28",
  },
  {
    id: "n-3",
    title: "День открытых дверей — 18 мая",
    summary:
      "Приглашаем будущих учеников и родителей познакомиться с программой и встретиться с учителями.",
    category: "events",
    image:
      "https://images.unsplash.com/photo-1523580494863-6f3031224c94?auto=format&fit=crop&w=1200&q=80",
    date: "2026-05-18",
  },
  {
    id: "n-4",
    title: "Регистрация на летние IT-курсы открыта",
    summary:
      "Python, веб-разработка и AI/ML — три трека для учеников 6–11 классов. Регистрация до 1 июня.",
    category: "announcements",
    image:
      "https://images.unsplash.com/photo-1517694712202-14dd9538aa97?auto=format&fit=crop&w=1200&q=80",
    date: "2026-04-05",
  },
  {
    id: "n-5",
    title: "Школьный театр сыграл «Маленького принца»",
    summary:
      "Премьера спектакля собрала аплодисменты — родители, ученики и учителя были тронуты до слёз.",
    category: "life",
    image:
      "https://images.unsplash.com/photo-1503095396549-807759245b35?auto=format&fit=crop&w=1200&q=80",
    date: "2026-03-15",
  },
  {
    id: "n-6",
    title: "Победа на городском турнире по шахматам",
    summary:
      "Сборная School №37 заняла первое место в командном зачёте городского турнира.",
    category: "olympics",
    image:
      "https://images.unsplash.com/photo-1528819622765-d6bcf132f793?auto=format&fit=crop&w=1200&q=80",
    date: "2026-02-22",
  },
];

export function readNews(): NewsItem[] {
  if (typeof window === "undefined") return defaultNews;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultNews;
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return defaultNews;
    return parsed as NewsItem[];
  } catch {
    return defaultNews;
  }
}

export function writeNews(items: NewsItem[]) {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
}
