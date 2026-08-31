(function () {
  const STORAGE_KEY = "dmtech-lang";

  const dict = {
    en: {
      "nav.about": "About",
      "nav.projects": "Projects",
      "nav.privacy": "Privacy",
      "nav.contact": "Contact",
      "nav.open": "Open menu",
      "nav.close": "Close menu",
      "hero.headline": "Android tools that stay on your side.",
      "hero.sub": "Indie softworks. Local-first where it matters. Shipping Vectr and Morph Launcher.",
      "hero.ctaProjects": "See projects",
      "hero.ctaContact": "Contact",
      "about.eyebrow": "About",
      "about.title": "Small shop. Sharp focus.",
      "about.body": "DMTech Softworks is an Android-focused indie studio. We ship tools that respect the device - local storage, your API keys, your folders. No fluff cloud for things that belong on the phone.",
      "about.body2": "In the shop now: Vectr (mobile IDE + optional AI agent) and Morph Launcher (local-first home screen).",
      "projects.eyebrow": "Projects",
      "projects.title": "What we ship",
      "projects.empty": "Nothing listed yet.",
      "projects.privacy": "Privacy",
      "projects.play": "Google Play",
      "projects.github": "GitHub",
      "projects.aka": "also",
      "contact.eyebrow": "Contact",
      "contact.title": "Ping the shop",
      "contact.body": "Telegram or email. No ticket bots.",
      "contact.telegram": "Telegram",
      "contact.email": "Email",
      "footer.tag": "Android indie softworks",
      "footer.privacy": "Privacy",
      "footer.privacyVectr": "Privacy (Vectr)",
      "footer.privacyMorph": "Privacy (Morph)",
      "footer.privacyHub": "All privacy policies",
      "footer.home": "Home",
      "privacy.back": "Back home",
      "privacy.title": "Privacy Policy - Vectr",
      "privacy.updated": "Last updated: July 29, 2026",
      "privacy.note": "Public policy for Vectr on Google Play. Processing follows the laws of the Republic of Kazakhstan.",
      "privacy.morph.title": "Privacy Policy - Morph Launcher",
      "privacy.morph.updated": "Last updated: August 31, 2026",
      "privacy.morph.note": "Public policy for Morph Launcher on Google Play. Processing follows the laws of the Republic of Kazakhstan.",
      "privacy.alsoMorph": "Also: Morph Launcher privacy",
      "privacy.alsoVectr": "Also: Vectr privacy",
      "lang.label": "Language"
    },
    ru: {
      "nav.about": "О студии",
      "nav.projects": "Проекты",
      "nav.privacy": "Privacy",
      "nav.contact": "Контакты",
      "nav.open": "Открыть меню",
      "nav.close": "Закрыть меню",
      "hero.headline": "Android-инструменты на твоей стороне.",
      "hero.sub": "Инди-softworks. Local-first там, где это важно. В продакшене — Vectr и Morph Launcher.",
      "hero.ctaProjects": "К проектам",
      "hero.ctaContact": "Связаться",
      "about.eyebrow": "О студии",
      "about.title": "Маленькая лавка. Жёсткий фокус.",
      "about.body": "DMTech Softworks - инди-мастерская под Android. Делаем инструменты, которые уважают устройство: локальное хранение, твои API-ключи, твои папки. Без лишнего облака там, где всё должно жить на телефоне.",
      "about.body2": "Сейчас в лавке: Vectr (мобильная IDE + опциональный ИИ-агент) и Morph Launcher (local-first домашний экран).",
      "projects.eyebrow": "Проекты",
      "projects.title": "Что выпускаем",
      "projects.empty": "Пока пусто.",
      "projects.privacy": "Privacy",
      "projects.play": "Google Play",
      "projects.github": "GitHub",
      "projects.aka": "aka",
      "contact.eyebrow": "Контакты",
      "contact.title": "Напиши в лавку",
      "contact.body": "Telegram или почта. Без ботов-тикетов.",
      "contact.telegram": "Telegram",
      "contact.email": "Email",
      "footer.tag": "Android indie softworks",
      "footer.privacy": "Privacy",
      "footer.privacyVectr": "Privacy (Vectr)",
      "footer.privacyMorph": "Privacy (Morph)",
      "footer.privacyHub": "Все политики",
      "footer.home": "На главную",
      "privacy.back": "На главную",
      "privacy.title": "Политика конфиденциальности - Vectr",
      "privacy.updated": "Обновлено: 29 июля 2026",
      "privacy.note": "Публичная политика Vectr для Google Play. Обработка - по законодательству Республики Казахстан.",
      "privacy.morph.title": "Политика конфиденциальности - Morph Launcher",
      "privacy.morph.updated": "Обновлено: 31 августа 2026",
      "privacy.morph.note": "Публичная политика Morph Launcher для Google Play. Обработка - по законодательству Республики Казахстан.",
      "privacy.alsoMorph": "Также: privacy Morph Launcher",
      "privacy.alsoVectr": "Также: privacy Vectr",
      "lang.label": "Язык"
    }
  };

  function detectLang() {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === "en" || saved === "ru") return saved;
    const nav = (navigator.language || "en").toLowerCase();
    return nav.startsWith("ru") ? "ru" : "en";
  }

  let lang = detectLang();

  function t(key) {
    return (dict[lang] && dict[lang][key]) || dict.en[key] || key;
  }

  function apply() {
    document.documentElement.lang = lang;
    document.documentElement.dataset.lang = lang;

    document.querySelectorAll("[data-i18n]").forEach((el) => {
      const key = el.getAttribute("data-i18n");
      if (key) el.textContent = t(key);
    });

    document.querySelectorAll("[data-i18n-aria]").forEach((el) => {
      const key = el.getAttribute("data-i18n-aria");
      if (!key) return;
      // nav toggle: reflect open/closed state
      if (el.hasAttribute("data-nav-toggle")) {
        const open = el.getAttribute("aria-expanded") === "true";
        el.setAttribute("aria-label", t(open ? "nav.close" : "nav.open"));
        return;
      }
      el.setAttribute("aria-label", t(key));
    });

    document.querySelectorAll("[data-lang-panel]").forEach((el) => {
      const panel = el.getAttribute("data-lang-panel");
      el.hidden = panel !== lang;
    });

    document.querySelectorAll("[data-lang-btn]").forEach((btn) => {
      const active = btn.getAttribute("data-lang-btn") === lang;
      btn.setAttribute("aria-pressed", active ? "true" : "false");
      btn.classList.toggle("is-active", active);
    });

    document.dispatchEvent(new CustomEvent("dmtech:lang", { detail: { lang } }));
  }

  function setLang(next) {
    if (next !== "en" && next !== "ru") return;
    lang = next;
    localStorage.setItem(STORAGE_KEY, lang);
    apply();
  }

  function bind() {
    document.querySelectorAll("[data-lang-btn]").forEach((btn) => {
      btn.addEventListener("click", () => setLang(btn.getAttribute("data-lang-btn")));
    });
  }

  window.DMTechI18n = { t, setLang, getLang: () => lang, apply, dict };

  document.addEventListener("DOMContentLoaded", () => {
    bind();
    apply();
  });
})();
