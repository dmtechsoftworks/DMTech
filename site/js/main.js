(function () {
  function sitePrefix() {
    // works from /, /projects.html, /privacy/, /privacy/morph-launcher/
    const path = location.pathname.replace(/\\/g, "/").replace(/\/index\.html$/i, "").replace(/\/$/, "");
    if (!path.includes("/privacy")) return "";
    const after = path.split("/privacy")[1] || "";
    const depth = after.split("/").filter(Boolean).length; // "" => 0, "/morph-launcher" => 1
    return "../".repeat(depth + 1);
  }

  function projectsBase() {
    return sitePrefix() + "data/projects.json";
  }

  function iconSrc(rel) {
    return sitePrefix() + rel;
  }

  function linkHref(rel) {
    if (!rel) return null;
    if (/^https?:/i.test(rel)) return rel;
    return sitePrefix() + rel;
  }

  function renderProjects(list, mount) {
    if (!mount) return;
    const lang = window.DMTechI18n ? window.DMTechI18n.getLang() : "en";
    const t = window.DMTechI18n ? window.DMTechI18n.t : (k) => k;

    if (!list.length) {
      mount.innerHTML = `<p class="muted">${t("projects.empty")}</p>`;
      return;
    }

    mount.innerHTML = list
      .map((p) => {
        const tagline = (p.tagline && (p.tagline[lang] || p.tagline.en)) || "";
        const desc = (p.description && (p.description[lang] || p.description.en)) || "";
        const aka = p.aka
          ? `<span class="project-aka">${t("projects.aka")} ${escapeHtml(p.aka)}</span>`
          : "";

        const links = [];
        if (p.links && p.links.privacy) {
          links.push(
            `<a class="text-link" href="${escapeAttr(linkHref(p.links.privacy))}">${t("projects.privacy")}</a>`
          );
        }
        if (p.links && p.links.play) {
          links.push(
            `<a class="text-link" href="${escapeAttr(p.links.play)}" rel="noopener noreferrer" target="_blank">${t("projects.play")}</a>`
          );
        }
        if (p.links && p.links.github) {
          links.push(
            `<a class="text-link" href="${escapeAttr(p.links.github)}" rel="noopener noreferrer" target="_blank">${t("projects.github")}</a>`
          );
        }

        return `
<article class="project" data-id="${escapeAttr(p.id)}">
  <div class="project-icon-wrap" aria-hidden="true">
    <img class="project-icon" src="${escapeAttr(iconSrc(p.icon))}" alt="" width="72" height="72" loading="lazy" />
  </div>
  <div class="project-body">
    <header class="project-head">
      <h3 class="project-name">${escapeHtml(p.name)}</h3>
      ${aka}
    </header>
    <p class="project-tagline">${escapeHtml(tagline)}</p>
    <p class="project-desc">${escapeHtml(desc)}</p>
    ${links.length ? `<div class="project-links">${links.join("")}</div>` : ""}
  </div>
</article>`;
      })
      .join("");
  }

  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function escapeAttr(s) {
    return escapeHtml(s).replace(/'/g, "&#39;");
  }

  let cached = null;

  async function loadProjects() {
    const mounts = document.querySelectorAll("[data-projects]");
    if (!mounts.length) return;
    try {
      if (!cached) {
        const res = await fetch(projectsBase());
        if (!res.ok) throw new Error("HTTP " + res.status);
        cached = await res.json();
      }
      mounts.forEach((m) => renderProjects(cached, m));
    } catch (err) {
      mounts.forEach((m) => {
        m.innerHTML = `<p class="muted">Failed to load projects.</p>`;
      });
      console.error(err);
    }
  }

  function setupNav() {
    const toggle = document.querySelector("[data-nav-toggle]");
    const panel = document.querySelector("[data-nav-panel]");
    if (!toggle || !panel) return;

    const setOpen = (open) => {
      document.body.classList.toggle("nav-open", open);
      toggle.setAttribute("aria-expanded", open ? "true" : "false");
      if (window.DMTechI18n) {
        toggle.setAttribute(
          "aria-label",
          window.DMTechI18n.t(open ? "nav.close" : "nav.open")
        );
      }
    };

    toggle.addEventListener("click", () => {
      setOpen(!document.body.classList.contains("nav-open"));
    });

    panel.querySelectorAll("a").forEach((a) => {
      a.addEventListener("click", () => setOpen(false));
    });

    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") setOpen(false);
    });
  }

  function setupReveal() {
    const els = document.querySelectorAll(".reveal");
    if (!els.length) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      els.forEach((el) => el.classList.add("is-in"));
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-in");
            io.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.12, rootMargin: "0px 0px -8% 0px" }
    );
    els.forEach((el) => io.observe(el));
  }

  document.addEventListener("DOMContentLoaded", () => {
    setupNav();
    setupReveal();
    loadProjects();
  });

  document.addEventListener("dmtech:lang", () => {
    if (cached) {
      document.querySelectorAll("[data-projects]").forEach((m) => renderProjects(cached, m));
    }
  });
})();
