export type Locale = "ru" | "uz" | "en";

export const locales: Locale[] = ["ru", "uz", "en"];

export const localeLabels: Record<Locale, string> = {
  ru: "RU",
  uz: "UZ",
  en: "EN",
};

type Dict = Record<string, string>;

export const translations: Record<Locale, Dict> = {
  ru: {
    "nav.home": "Главная",
    "nav.about": "О школе",
    "nav.education": "Образование",
    "nav.news": "Новости",
    "nav.teachers": "Учителя",
    "nav.students": "Ученикам",
    "nav.parents": "Родителям",
    "nav.contacts": "Контакты",
    "nav.admin": "Админ",
    "nav.apply": "Поступить",

    "hero.eyebrow": "Школа №37 — образование нового поколения",
    "hero.title": "Добро пожаловать в School №37",
    "hero.subtitle":
      "Качественное образование, современные технологии и забота о каждом ученике. Мы готовим лидеров будущего.",
    "hero.cta.apply": "Поступить",
    "hero.cta.more": "Подробнее",
    "hero.stat.students": "Учеников",
    "hero.stat.teachers": "Учителей",
    "hero.stat.years": "Лет опыта",
    "hero.stat.awards": "Наград",

    "about.eyebrow": "О школе",
    "about.title": "Современное образование с человеческим лицом",
    "about.desc":
      "Уже более 50 лет School №37 формирует поколения мыслителей, изобретателей и лидеров. Мы сочетаем академическую строгость с креативностью и заботой о каждом ребёнке.",
    "about.history.title": "Наша история",
    "about.history.desc":
      "Основанная в 1972 году, школа выросла из небольшого учебного заведения в одно из самых уважаемых образовательных учреждений региона.",
    "about.mission.title": "Миссия",
    "about.mission.desc":
      "Воспитывать любознательных, ответственных и уверенных в себе людей, готовых менять мир к лучшему.",
    "about.values.title": "Ценности",
    "about.values.desc":
      "Уважение, любознательность, ответственность, инновации и сотрудничество — пять опор нашей культуры.",
    "about.achievements.title": "Достижения",
    "about.achievements.desc":
      "Победы в олимпиадах, гранты на обучение в лучших вузах, престижные сертификаты — наша обычная практика.",
    "about.gallery.title": "Фотогалерея",

    "edu.eyebrow": "Образование",
    "edu.title": "Программы, которые открывают возможности",
    "edu.desc":
      "Сильная академическая база, авторские программы и направления, востребованные в XXI веке.",
    "edu.programs.title": "Учебные программы",
    "edu.programs.primary": "Начальная школа",
    "edu.programs.primary.desc":
      "Развиваем любопытство и базовые навыки в безопасной, тёплой среде.",
    "edu.programs.middle": "Средняя школа",
    "edu.programs.middle.desc":
      "Глубокое изучение предметов, проектная работа и мягкие навыки.",
    "edu.programs.high": "Старшая школа",
    "edu.programs.high.desc":
      "Подготовка к поступлению в ведущие университеты мира.",
    "edu.subjects.title": "Предметы",
    "edu.clubs.title": "Кружки и секции",
    "edu.focus.it": "IT и программирование",
    "edu.focus.it.desc": "Python, Web, AI/ML, робототехника и геймдев.",
    "edu.focus.en": "Английский язык",
    "edu.focus.en.desc": "IELTS, Cambridge, разговорные клубы с носителями.",
    "edu.focus.sport": "Спорт",
    "edu.focus.sport.desc": "Футбол, баскетбол, шахматы, плавание и теннис.",

    "news.eyebrow": "Новости",
    "news.title": "Что у нас происходит",
    "news.filters.all": "Все",
    "news.filters.events": "События",
    "news.filters.olympics": "Олимпиады",
    "news.filters.life": "Школьная жизнь",
    "news.filters.announcements": "Объявления",
    "news.readmore": "Читать",
    "news.empty": "Скоро здесь появятся новости.",

    "teachers.eyebrow": "Команда",
    "teachers.title": "Наши учителя",
    "teachers.desc":
      "Талантливые наставники, которые вдохновляют учеников каждый день.",

    "students.eyebrow": "Ученикам",
    "students.title": "Всё, что нужно для учёбы",
    "students.schedule": "Расписание",
    "students.homework": "Домашние задания",
    "students.resources": "Полезные ресурсы",
    "students.schedule.desc": "Удобное расписание уроков по классам.",
    "students.homework.desc": "Задания и сроки сдачи в одном месте.",
    "students.resources.desc": "Библиотека, видеоуроки и тренажёры.",

    "parents.eyebrow": "Родителям",
    "parents.title": "Поступление и поддержка",
    "parents.admission": "Поступление",
    "parents.docs": "Документы",
    "parents.faq": "Частые вопросы",
    "parents.faq.q1": "Как поступить в School №37?",
    "parents.faq.a1":
      "Заполните форму на сайте, мы свяжемся с вами и пригласим на собеседование.",
    "parents.faq.q2": "Какие документы нужны?",
    "parents.faq.a2":
      "Свидетельство о рождении, медицинская карта, фото и заявление родителей.",
    "parents.faq.q3": "Есть ли вступительный экзамен?",
    "parents.faq.a3":
      "Для 5–11 классов проводится диагностика по математике и языкам.",
    "parents.faq.q4": "Каков размер класса?",
    "parents.faq.a4":
      "В среднем 18–22 ученика — у учителей есть время для каждого.",

    "contacts.eyebrow": "Контакты",
    "contacts.title": "Свяжитесь с нами",
    "contacts.address": "Адрес",
    "contacts.phone": "Телефон",
    "contacts.email": "Email",
    "contacts.hours": "Часы работы",
    "contacts.hours.value": "Пн–Сб: 8:00 — 18:00",
    "contacts.form.name": "Ваше имя",
    "contacts.form.email": "Email",
    "contacts.form.message": "Сообщение",
    "contacts.form.send": "Отправить",
    "contacts.form.success": "Спасибо! Мы свяжемся с вами в ближайшее время.",

    "footer.tagline": "School №37 — образование, которое меняет жизнь.",
    "footer.rights": "Все права защищены.",
    "footer.links": "Ссылки",
    "footer.contact": "Контакты",
    "footer.social": "Соцсети",

    "admin.title": "Панель администратора",
    "admin.subtitle": "Добавляйте и редактируйте новости школы.",
    "admin.login": "Войти",
    "admin.password": "Пароль",
    "admin.logout": "Выйти",
    "admin.add": "Добавить новость",
    "admin.field.title": "Заголовок",
    "admin.field.category": "Категория",
    "admin.field.summary": "Краткое описание",
    "admin.field.image": "URL изображения",
    "admin.field.date": "Дата",
    "admin.save": "Сохранить",
    "admin.delete": "Удалить",
    "admin.cancel": "Отмена",
    "admin.list": "Список новостей",
    "admin.invalid": "Неверный пароль",
  },

  uz: {
    "nav.home": "Bosh sahifa",
    "nav.about": "Maktab haqida",
    "nav.education": "Ta'lim",
    "nav.news": "Yangiliklar",
    "nav.teachers": "O'qituvchilar",
    "nav.students": "O'quvchilarga",
    "nav.parents": "Ota-onalarga",
    "nav.contacts": "Aloqa",
    "nav.admin": "Admin",
    "nav.apply": "Topshirish",

    "hero.eyebrow": "37-maktab — yangi avlod ta'limi",
    "hero.title": "School №37 ga xush kelibsiz",
    "hero.subtitle":
      "Sifatli ta'lim, zamonaviy texnologiyalar va har bir o'quvchiga e'tibor. Biz kelajak yetakchilarini tarbiyalaymiz.",
    "hero.cta.apply": "Topshirish",
    "hero.cta.more": "Batafsil",
    "hero.stat.students": "O'quvchi",
    "hero.stat.teachers": "O'qituvchi",
    "hero.stat.years": "Yillik tajriba",
    "hero.stat.awards": "Mukofot",

    "about.eyebrow": "Maktab haqida",
    "about.title": "Inson qiyofasiga ega zamonaviy ta'lim",
    "about.desc":
      "50 yildan ortiq vaqt davomida School №37 mutafakkir, ixtirochi va yetakchilarni tarbiyalab keladi. Biz ilmiy qat'iylikni ijodkorlik bilan birlashtiramiz.",
    "about.history.title": "Tariximiz",
    "about.history.desc":
      "1972-yilda asos solingan maktab kichik o'quv muassasasidan mintaqaning eng obro'li maktablaridan biriga aylandi.",
    "about.mission.title": "Missiyamiz",
    "about.mission.desc":
      "Qiziquvchan, mas'uliyatli va ishonchli, dunyoni yaxshilashga tayyor odamlarni tarbiyalash.",
    "about.values.title": "Qadriyatlar",
    "about.values.desc":
      "Hurmat, qiziquvchanlik, mas'uliyat, innovatsiya va hamkorlik — madaniyatimizning besh ustuni.",
    "about.achievements.title": "Yutuqlar",
    "about.achievements.desc":
      "Olimpiadalardagi g'alabalar, eng yaxshi universitetlarga grantlar — bu biz uchun odatiy hol.",
    "about.gallery.title": "Foto galereya",

    "edu.eyebrow": "Ta'lim",
    "edu.title": "Imkoniyatlar ochadigan dasturlar",
    "edu.desc":
      "Mustahkam akademik baza, mualliflik dasturlari va XXI asr uchun zarur yo'nalishlar.",
    "edu.programs.title": "O'quv dasturlari",
    "edu.programs.primary": "Boshlang'ich sinflar",
    "edu.programs.primary.desc":
      "Bolalarning qiziqishini va asosiy ko'nikmalarni xavfsiz muhitda rivojlantiramiz.",
    "edu.programs.middle": "O'rta sinflar",
    "edu.programs.middle.desc":
      "Fanlarni chuqur o'rganish, loyiha ishi va yumshoq ko'nikmalar.",
    "edu.programs.high": "Yuqori sinflar",
    "edu.programs.high.desc":
      "Dunyoning yetakchi universitetlariga tayyorgarlik.",
    "edu.subjects.title": "Fanlar",
    "edu.clubs.title": "To'garaklar va seksiyalar",
    "edu.focus.it": "IT va dasturlash",
    "edu.focus.it.desc": "Python, Web, AI/ML, robototexnika va geymdev.",
    "edu.focus.en": "Ingliz tili",
    "edu.focus.en.desc": "IELTS, Cambridge, native speaker bilan klublar.",
    "edu.focus.sport": "Sport",
    "edu.focus.sport.desc": "Futbol, basketbol, shaxmat, suzish va tennis.",

    "news.eyebrow": "Yangiliklar",
    "news.title": "Bizda qanday voqealar bo'lyapti",
    "news.filters.all": "Hammasi",
    "news.filters.events": "Tadbirlar",
    "news.filters.olympics": "Olimpiadalar",
    "news.filters.life": "Maktab hayoti",
    "news.filters.announcements": "E'lonlar",
    "news.readmore": "O'qish",
    "news.empty": "Tez orada yangiliklar paydo bo'ladi.",

    "teachers.eyebrow": "Jamoa",
    "teachers.title": "Bizning o'qituvchilar",
    "teachers.desc":
      "Har kuni o'quvchilarni ilhomlantiruvchi iste'dodli ustozlar.",

    "students.eyebrow": "O'quvchilarga",
    "students.title": "O'qish uchun kerakli hamma narsa",
    "students.schedule": "Dars jadvali",
    "students.homework": "Uy vazifalari",
    "students.resources": "Foydali resurslar",
    "students.schedule.desc": "Sinflar bo'yicha qulay dars jadvali.",
    "students.homework.desc": "Vazifalar va muddatlar bir joyda.",
    "students.resources.desc": "Kutubxona, videodarslar va trenajyorlar.",

    "parents.eyebrow": "Ota-onalarga",
    "parents.title": "Topshirish va qo'llab-quvvatlash",
    "parents.admission": "Qabul",
    "parents.docs": "Hujjatlar",
    "parents.faq": "Tez-tez beriladigan savollar",
    "parents.faq.q1": "School №37 ga qanday topshiriladi?",
    "parents.faq.a1":
      "Saytdagi shaklni to'ldiring, biz siz bilan bog'lanib, suhbatga taklif qilamiz.",
    "parents.faq.q2": "Qanday hujjatlar kerak?",
    "parents.faq.a2":
      "Tug'ilganlik haqida guvohnoma, tibbiy karta, rasm va ariza.",
    "parents.faq.q3": "Kirish imtihoni bormi?",
    "parents.faq.a3":
      "5–11-sinflar uchun matematika va tildan diagnostika o'tkaziladi.",
    "parents.faq.q4": "Sinflar qanchalik to'la?",
    "parents.faq.a4":
      "O'rtacha 18–22 o'quvchi — har kim e'tiborga olinadi.",

    "contacts.eyebrow": "Aloqa",
    "contacts.title": "Biz bilan bog'laning",
    "contacts.address": "Manzil",
    "contacts.phone": "Telefon",
    "contacts.email": "Email",
    "contacts.hours": "Ish vaqti",
    "contacts.hours.value": "Du–Sha: 8:00 — 18:00",
    "contacts.form.name": "Ismingiz",
    "contacts.form.email": "Email",
    "contacts.form.message": "Xabar",
    "contacts.form.send": "Yuborish",
    "contacts.form.success": "Rahmat! Biz tez orada bog'lanamiz.",

    "footer.tagline": "School №37 — hayotni o'zgartiruvchi ta'lim.",
    "footer.rights": "Barcha huquqlar himoyalangan.",
    "footer.links": "Havolalar",
    "footer.contact": "Aloqa",
    "footer.social": "Ijtimoiy tarmoqlar",

    "admin.title": "Administrator paneli",
    "admin.subtitle": "Maktab yangiliklarini qo'shing va tahrirlang.",
    "admin.login": "Kirish",
    "admin.password": "Parol",
    "admin.logout": "Chiqish",
    "admin.add": "Yangilik qo'shish",
    "admin.field.title": "Sarlavha",
    "admin.field.category": "Kategoriya",
    "admin.field.summary": "Qisqacha",
    "admin.field.image": "Rasm URL",
    "admin.field.date": "Sana",
    "admin.save": "Saqlash",
    "admin.delete": "O'chirish",
    "admin.cancel": "Bekor qilish",
    "admin.list": "Yangiliklar ro'yxati",
    "admin.invalid": "Parol noto'g'ri",
  },

  en: {
    "nav.home": "Home",
    "nav.about": "About",
    "nav.education": "Education",
    "nav.news": "News",
    "nav.teachers": "Teachers",
    "nav.students": "Students",
    "nav.parents": "Parents",
    "nav.contacts": "Contact",
    "nav.admin": "Admin",
    "nav.apply": "Apply",

    "hero.eyebrow": "School №37 — next-generation education",
    "hero.title": "Welcome to School №37",
    "hero.subtitle":
      "Quality education, modern technology, and care for every student. We're shaping the leaders of tomorrow.",
    "hero.cta.apply": "Apply now",
    "hero.cta.more": "Learn more",
    "hero.stat.students": "Students",
    "hero.stat.teachers": "Teachers",
    "hero.stat.years": "Years of excellence",
    "hero.stat.awards": "Awards",

    "about.eyebrow": "About",
    "about.title": "Modern education with a human touch",
    "about.desc":
      "For more than 50 years School №37 has shaped generations of thinkers, makers, and leaders. We blend academic rigor with creativity and care.",
    "about.history.title": "Our history",
    "about.history.desc":
      "Founded in 1972, our school has grown from a small institution into one of the region's most respected.",
    "about.mission.title": "Mission",
    "about.mission.desc":
      "To raise curious, responsible, and confident people ready to change the world for the better.",
    "about.values.title": "Values",
    "about.values.desc":
      "Respect, curiosity, responsibility, innovation, and collaboration — the five pillars of our culture.",
    "about.achievements.title": "Achievements",
    "about.achievements.desc":
      "Olympiad medals, grants to top universities, prestigious certificates — our daily routine.",
    "about.gallery.title": "Gallery",

    "edu.eyebrow": "Education",
    "edu.title": "Programs that open doors",
    "edu.desc":
      "A strong academic core, signature programs, and tracks built for the 21st century.",
    "edu.programs.title": "Programs",
    "edu.programs.primary": "Primary",
    "edu.programs.primary.desc":
      "We grow curiosity and core skills in a safe, warm environment.",
    "edu.programs.middle": "Middle school",
    "edu.programs.middle.desc":
      "Deep subject study, project work, and human skills.",
    "edu.programs.high": "High school",
    "edu.programs.high.desc":
      "Preparing students for the world's leading universities.",
    "edu.subjects.title": "Subjects",
    "edu.clubs.title": "Clubs and activities",
    "edu.focus.it": "IT & coding",
    "edu.focus.it.desc": "Python, web, AI/ML, robotics, and game dev.",
    "edu.focus.en": "English",
    "edu.focus.en.desc": "IELTS, Cambridge, conversation clubs with natives.",
    "edu.focus.sport": "Sport",
    "edu.focus.sport.desc": "Football, basketball, chess, swimming, tennis.",

    "news.eyebrow": "News",
    "news.title": "What's happening",
    "news.filters.all": "All",
    "news.filters.events": "Events",
    "news.filters.olympics": "Olympiads",
    "news.filters.life": "School life",
    "news.filters.announcements": "Announcements",
    "news.readmore": "Read",
    "news.empty": "News coming soon.",

    "teachers.eyebrow": "Team",
    "teachers.title": "Our teachers",
    "teachers.desc":
      "Talented mentors who inspire students every single day.",

    "students.eyebrow": "Students",
    "students.title": "Everything you need for school",
    "students.schedule": "Schedule",
    "students.homework": "Homework",
    "students.resources": "Resources",
    "students.schedule.desc": "Class-by-class timetable made simple.",
    "students.homework.desc": "Assignments and deadlines, all in one place.",
    "students.resources.desc": "Library, video lessons, and practice tools.",

    "parents.eyebrow": "Parents",
    "parents.title": "Admissions and support",
    "parents.admission": "Admissions",
    "parents.docs": "Documents",
    "parents.faq": "FAQ",
    "parents.faq.q1": "How do I apply to School №37?",
    "parents.faq.a1":
      "Fill out the form on the website — we'll contact you and invite for an interview.",
    "parents.faq.q2": "Which documents are required?",
    "parents.faq.a2":
      "Birth certificate, medical card, photo, and parental application form.",
    "parents.faq.q3": "Is there an entrance exam?",
    "parents.faq.a3":
      "For grades 5–11 we run a placement test in math and languages.",
    "parents.faq.q4": "How big are the classes?",
    "parents.faq.a4":
      "On average 18–22 students — teachers have time for everyone.",

    "contacts.eyebrow": "Contact",
    "contacts.title": "Get in touch",
    "contacts.address": "Address",
    "contacts.phone": "Phone",
    "contacts.email": "Email",
    "contacts.hours": "Hours",
    "contacts.hours.value": "Mon–Sat: 8:00 — 18:00",
    "contacts.form.name": "Your name",
    "contacts.form.email": "Email",
    "contacts.form.message": "Message",
    "contacts.form.send": "Send",
    "contacts.form.success": "Thanks! We'll get back to you shortly.",

    "footer.tagline": "School №37 — education that changes lives.",
    "footer.rights": "All rights reserved.",
    "footer.links": "Links",
    "footer.contact": "Contact",
    "footer.social": "Social",

    "admin.title": "Admin panel",
    "admin.subtitle": "Add and edit school news.",
    "admin.login": "Sign in",
    "admin.password": "Password",
    "admin.logout": "Sign out",
    "admin.add": "Add news",
    "admin.field.title": "Title",
    "admin.field.category": "Category",
    "admin.field.summary": "Summary",
    "admin.field.image": "Image URL",
    "admin.field.date": "Date",
    "admin.save": "Save",
    "admin.delete": "Delete",
    "admin.cancel": "Cancel",
    "admin.list": "News list",
    "admin.invalid": "Wrong password",
  },
};

export function t(locale: Locale, key: string): string {
  return translations[locale]?.[key] ?? translations.en[key] ?? key;
}
