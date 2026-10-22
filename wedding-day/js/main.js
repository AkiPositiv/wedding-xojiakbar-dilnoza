(() => {
  "use strict";

  const C = window.WEDDING;
  const X = window.Textiles;
  const GL = window.Weave;
  const $ = (s, root = document) => root.querySelector(s);
  const $$ = (s, root = document) => [...root.querySelectorAll(s)];
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const NS = "http://www.w3.org/2000/svg";

  const wait = (ms) => new Promise((resolve) => setTimeout(resolve, reduceMotion ? Math.min(ms, 30) : ms));
  const clamp = (v, min = 0, max = 1) => Math.max(min, Math.min(max, v));
  const ease = (k) => (k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2);
  const vibrate = (pattern) => {
    try {
      navigator.vibrate?.(pattern);
    } catch {
      /* вибрация недоступна */
    }
  };

  const weddingDate = new Date(C.date);

  /* ---------- Язык ---------- */

  const LANGS = Object.keys(window.I18N);
  let lang = pickLang();
  let L = window.I18N[lang];

  function pickLang() {
    const fromUrl = new URLSearchParams(location.search).get("lang");
    if (LANGS.includes(fromUrl)) return fromUrl;
    try {
      const saved = localStorage.getItem("lang");
      if (LANGS.includes(saved)) return saved;
    } catch {
      /* хранилище недоступно */
    }
    const browser = (navigator.language || "").slice(0, 2).toLowerCase();
    if (LANGS.includes(browser)) return browser;
    return C.defaultLang || "ru";
  }

  // Значение из config: строка как есть или { ru, uz, kk } на текущем языке.
  const tr = (value) => (value && typeof value === "object" ? value[lang] ?? value.ru : value);

  // Строка из словаря с подстановками {name}.
  const t = (key, vars = {}) => (L[key] ?? window.I18N.ru[key] ?? "").replace(/\{(\w+)\}/g, (_, k) => vars[k] ?? "");

  /* ---------- Даты ---------- */

  const dateParts = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", { timeZone: C.timeZone, year: "numeric", month: "numeric", day: "numeric", hour: "numeric", minute: "numeric", hourCycle: "h23" })
      .formatToParts(weddingDate)
      .filter((p) => p.type !== "literal")
      .map((p) => [p.type, Number(p.value)])
  );
  const weekdayIndex = (new Date(Date.UTC(dateParts.year, dateParts.month - 1, dateParts.day)).getUTCDay() + 6) % 7;

  function capitalize(s) {
    return s.charAt(0).toUpperCase() + s.slice(1);
  }

  // Всё, что подставляется в тексты, — на текущем языке.
  function vars() {
    const { day, month, year, hour, minute } = dateParts;
    const weekday = L.weekdays[weekdayIndex];
    return {
      groom: tr(C.groom),
      bride: tr(C.bride),
      initials: tr(C.initials),
      city: tr(C.city),
      date: L.formatDate(day, month, year, L),
      dateLong: L.formatDate(day, month, year, L),
      weekday,
      Weekday: capitalize(weekday),
      time: `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`,
      monthYear: L.formatMonth(month, year, L),
      deadline: tr(C.rsvpDeadline),
      "venue.name": tr(C.venue.name),
      "venue.address": tr(C.venue.address),
    };
  }

  /* ---------- Подстановка текстов ---------- */

  const guestName = new URLSearchParams(location.search).get("g");

  function render() {
    const v = vars();
    document.documentElement.lang = L.htmlLang;
    document.title = t("docTitle", v);

    $$("[data-i18n]").forEach((node) => (node.textContent = t(node.dataset.i18n, v)));
    $$("[data-i18n-aria]").forEach((node) => node.setAttribute("aria-label", t(node.dataset.i18nAria, v)));
    $$("[data-i18n-placeholder]").forEach((node) => (node.placeholder = t(node.dataset.i18nPlaceholder, v)));
    $$("[data-bind]").forEach((node) => (node.textContent = v[node.dataset.bind] ?? ""));

    $("#greeting").textContent = guestName ? t("greetingGuest", { guest: guestName }) : t("greeting");

    $$(".timeline__item").forEach((li, i) => {
      $(".timeline__title", li).textContent = tr(C.schedule[i].title);
      $(".timeline__text", li).textContent = tr(C.schedule[i].text);
    });

    renderContacts();
    buildCalendar();
    $("#addToCalendar").href = googleCalendarUrl(v);
    $$(".lang__btn").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.lang === lang)));
    music.setState(music.isPlaying());
    countdownTick?.();
    steppeTone?.();
  }

  function setLang(next) {
    if (next === lang || !LANGS.includes(next)) return;
    lang = next;
    L = window.I18N[lang];
    try {
      localStorage.setItem("lang", lang);
    } catch {
      /* хранилище недоступно */
    }
    render();
  }

  function buildLangSwitch() {
    const nav = $("#lang");
    ["uz", "kk", "ru"].forEach((code) => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "lang__btn";
      b.dataset.lang = code;
      b.lang = window.I18N[code].htmlLang;
      b.textContent = window.I18N[code].label;
      b.addEventListener("click", (e) => {
        e.stopPropagation(); // не открывать занавес, когда выбирают язык
        setLang(code);
      });
      nav.append(b);
    });
  }

  /* ---------- Постоянные блоки ---------- */

  function buildStatic() {
    if (guestName) $("#rsvpForm").elements.name.value = guestName;
    $("#mapLink").href = C.venue.mapUrl;

    const timeline = $("#timeline");
    C.schedule.forEach((item, i) => {
      const li = document.createElement("li");
      li.className = "timeline__item";
      li.style.setProperty("--delay", `${0.3 + i * 0.35}s`);
      li.innerHTML = `<span class="timeline__time"></span><span class="timeline__title"></span><span class="timeline__text"></span>`;
      $(".timeline__time", li).textContent = item.time;
      timeline.append(li);
    });
  }

  function renderContacts() {
    const contacts = $("#contactList");
    contacts.replaceChildren();
    C.contacts.forEach((c) => {
      const li = document.createElement("li");
      li.innerHTML = `<p class="contact__name"></p><p class="contact__role"></p><div class="contact__links"></div>`;
      $(".contact__name", li).textContent = tr(c.name);
      $(".contact__role", li).textContent = tr(c.role);
      const links = $(".contact__links", li);
      if (c.phone) links.append(link(`tel:${c.phone.replace(/[^\d+]/g, "")}`, c.phone));
      if (c.telegram) links.append(link(`https://t.me/${c.telegram}`, "Telegram"));
      contacts.append(li);
    });
  }

  function link(href, text) {
    const a = document.createElement("a");
    a.href = href;
    a.textContent = text;
    if (href.startsWith("http")) {
      a.target = "_blank";
      a.rel = "noopener";
    }
    return a;
  }

  /* ---------- Календарь ---------- */

  function buildCalendar() {
    const grid = $("#calendarGrid");
    const { year, month, day } = dateParts;
    const firstDow = (new Date(Date.UTC(year, month - 1, 1)).getUTCDay() + 6) % 7;
    const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
    grid.replaceChildren();

    L.weekdaysShort.forEach((d) => {
      const cell = document.createElement("span");
      cell.className = "calendar__dow";
      cell.textContent = d;
      grid.append(cell);
    });

    for (let i = 0; i < firstDow; i++) grid.append(document.createElement("span"));

    for (let d = 1; d <= daysInMonth; d++) {
      const cell = document.createElement("span");
      cell.className = "calendar__day";
      const dow = (firstDow + d - 1) % 7;
      if (dow > 4) cell.classList.add("is-weekend");
      cell.textContent = d;
      if (d === day) {
        // день свадьбы обводится восьмиконечной звездой, как на изразцах
        cell.classList.add("is-wedding");
        cell.setAttribute("aria-label", t("weddingDay", { day: d }));
        cell.insertAdjacentHTML(
          "afterbegin",
          `<svg class="calendar__mark" viewBox="-20 -20 40 40" aria-hidden="true"><path pathLength="1" d="${X.khatamD(0, 0, 18)}"/></svg>`
        );
      }
      grid.append(cell);
    }
  }

  /* ---------- Обратный отсчёт ---------- */

  // Русские окончания: 1 день, 2 дня, 5 дней. В узбекском и казахском форма одна.
  function plural(n, forms) {
    if (forms.length === 1) return forms[0];
    const n10 = n % 10;
    const n100 = n % 100;
    if (n10 === 1 && n100 !== 11) return forms[0];
    if (n10 >= 2 && n10 <= 4 && (n100 < 12 || n100 > 14)) return forms[1];
    return forms[2];
  }

  // Каждая цифра живёт в своей ячейке: старая уезжает вверх, новая приезжает снизу.
  function makeRoller(node) {
    let first = true;
    return (text) => {
      const slots = node.children;
      while (slots.length < text.length) {
        const slot = document.createElement("span");
        slot.className = "digit";
        node.prepend(slot);
      }
      while (slots.length > text.length) node.firstElementChild.remove();

      [...slots].forEach((slot, i) => {
        const ch = text[i];
        if (slot.dataset.v === ch) return;
        slot.dataset.v = ch;
        const old = slot.lastElementChild;
        const next = document.createElement("span");
        next.className = "digit__v";
        next.textContent = ch;
        if (old && !first && !document.hidden) {
          next.classList.add("is-in");
          old.classList.add("is-out");
          old.addEventListener("animationend", () => old.remove(), { once: true });
        } else if (old) {
          old.remove();
        }
        slot.append(next);
      });
      first = false;
    };
  }

  let countdownTick = null;

  function startCountdown() {
    const box = $("#countdown");
    const rollers = Object.fromEntries($$("[data-unit]", box).map((n) => [n.dataset.unit, makeRoller(n)]));
    const labels = Object.fromEntries($$("[data-unit-label]", box).map((n) => [n.dataset.unitLabel, n]));

    countdownTick = function tick() {
      const diff = weddingDate - Date.now();
      if (diff <= 0) {
        box.classList.add("is-done");
        $("#countdownLabel").textContent = t("countdownDone");
        return false;
      }
      const total = Math.floor(diff / 1000);
      const values = {
        d: Math.floor(total / 86400),
        h: Math.floor((total % 86400) / 3600),
        m: Math.floor((total % 3600) / 60),
        s: total % 60,
      };
      for (const unit in values) {
        rollers[unit](String(values[unit]).padStart(unit === "d" ? 1 : 2, "0"));
        labels[unit].textContent = plural(values[unit], L.units[unit]);
      }
      return true;
    };

    if (countdownTick()) {
      const timer = setInterval(() => {
        if (!countdownTick()) clearInterval(timer);
      }, 1000);
    }
  }

  /* ---------- Добавить в Google Календарь ---------- */

  function googleCalendarUrl(v) {
    const toUtc = (d) => d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
    const end = new Date(weddingDate.getTime() + C.durationHours * 3600 * 1000);
    const pageUrl = location.protocol.startsWith("http") ? location.origin + location.pathname : "";
    const params = new URLSearchParams({
      action: "TEMPLATE",
      text: tr(C.eventTitle),
      dates: `${toUtc(weddingDate)}/${toUtc(end)}`,
      details: [t("calendarDetails"), pageUrl].filter(Boolean).join("\n"),
      location: `${v["venue.name"]}, ${v["venue.address"]}`,
      ctz: C.timeZone,
    });
    return `https://calendar.google.com/calendar/render?${params}`;
  }

  /* ---------- Орнаменты (SVG) ---------- */

  function svgEl(tag, attrs = {}) {
    const node = document.createElementNS(NS, tag);
    for (const key in attrs) node.setAttribute(key, attrs[key]);
    return node;
  }

  // Линия, которая прорисовывается золотом с задержкой.
  function stroke(parent, d, { transform, delay = 0, dur, cls = "stroke" } = {}) {
    const p = svgEl("path", { d, class: cls, pathLength: 1 });
    if (transform) p.setAttribute("transform", transform);
    p.style.setProperty("--delay", `${delay}s`);
    if (dur) p.style.setProperty("--dur", `${dur}s`);
    parent.append(p);
    return p;
  }

  // Портал-арка на бархате с двойной золотой каймой и рогами в углах.
  function buildArches() {
    $$(".arch").forEach((node) => {
      const h = Number(node.dataset.height) || 440;
      node.style.setProperty("--h", h);
      const svg = svgEl("svg", { viewBox: `0 0 300 ${h}`, class: "arch__frame", "aria-hidden": "true" });
      const shape = (i) =>
        `M${i} ${h - i} V${150 + i * 0.4} Q${i} ${62 + i * 0.9} 150 ${4 + i * 1.4} Q${300 - i} ${62 + i * 0.9} ${300 - i} ${150 + i * 0.4} V${h - i} Z`;
      svg.append(svgEl("path", { d: shape(0), fill: "url(#velvet)" }));
      stroke(svg, shape(9), { delay: 0.1, dur: 2.4 });
      stroke(svg, shape(15), { delay: 0.5, dur: 2.4 }).style.setProperty("--sw", "0.8");
      stroke(svg, X.HORNS, { transform: `translate(134 36) scale(.8)`, delay: 1.6 });
      stroke(svg, X.HORNS, { transform: `translate(26 ${h - 60}) scale(.8)`, delay: 1.9 });
      stroke(svg, X.HORNS, { transform: `translate(242 ${h - 60}) scale(.8)`, delay: 1.9 });
      node.prepend(svg);
    });
  }

  // Разделитель: бархатный медальон с рогами в центре, рога наружу по бокам,
  // по золоту пробегает блик.
  function buildOrnamentDividers() {
    $$(".divider--ornament").forEach((node, n) => {
      const id = `shimmer${n}`;
      const svg = svgEl("svg", { viewBox: "0 0 320 64" });
      svg.innerHTML =
        `<defs><linearGradient id="${id}" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="320" y2="0">` +
        `<stop offset="0" stop-color="#B8862F"/><stop offset=".45" stop-color="#D4A647"/>` +
        `<stop offset=".5" stop-color="#FFF1C2"/><stop offset=".55" stop-color="#D4A647"/><stop offset="1" stop-color="#B8862F"/>` +
        `<animateTransform attributeName="gradientTransform" type="translate" from="-320 0" to="320 0" dur="5s" repeatCount="indefinite"/>` +
        `</linearGradient></defs>`;
      svg.style.setProperty("--stroke", `url(#${id})`);
      svg.style.setProperty("--sw", "1.6");
      stroke(svg, "M24 32 H92 M228 32 H296", { delay: 0, dur: 1.2 });
      stroke(svg, "M10 32 l7 -6 l7 6 l-7 6 z M296 32 l7 -6 l7 6 l-7 6 z", { delay: 0.9, dur: 0.6 });
      stroke(svg, X.HORNS, { transform: "translate(92 48) rotate(-90) scale(.8)", delay: 0.5 });
      stroke(svg, X.HORNS, { transform: "translate(228 16) rotate(90) scale(.8)", delay: 0.5 });
      svg.append(svgEl("circle", { cx: 160, cy: 32, r: 22, class: "medal" }));
      stroke(svg, X.HORNS, { transform: "translate(146 18) scale(.7)", delay: 0.8 });
      node.append(svg);
    });
  }

  // Кайма кошмы: цепочка рогов-аппликаций сверху и снизу.
  function buildFeltBorders() {
    $$(".felt-border").forEach((node) => {
      const top = node.classList.contains("felt-border--top");
      const svg = svgEl("svg", { viewBox: "0 0 480 48", preserveAspectRatio: "xMidYMid slice" });
      svg.style.setProperty("--stroke", "#F3DFC1");
      svg.style.setProperty("--sw", "1.8");
      stroke(svg, top ? "M0 46 H480" : "M0 2 H480", { dur: 1.6 });
      for (let i = 0; i < 12; i++) {
        const x = i * 40;
        const tf = top ? `translate(${x + 40} 44) rotate(180)` : `translate(${x} 4)`;
        stroke(svg, X.HORNS, { transform: tf, delay: 0.3 + Math.abs(i - 5.5) * 0.12, dur: 1 });
      }
      node.append(svg);
    });
  }

  // Сюзане: розетка, которая «вышивается» стежками.
  function buildSuzani() {
    const host = $("#suzani");
    const svg = svgEl("svg", { viewBox: "-110 -110 220 220" });
    const mask = svgEl("mask", { id: "suzaniMask", maskUnits: "userSpaceOnUse", x: -110, y: -110, width: 220, height: 220 });
    const defs = svgEl("defs");
    defs.append(mask);
    const art = svgEl("g", { mask: "url(#suzaniMask)" });
    svg.append(defs, art);

    const RED = "#B3263A";
    const INDIGO = "#2B3A67";
    const GREEN = "#3E7D4E";
    const SAFFRON = "#E0A43A";
    const pt = (r, a) => `${(Math.cos(a) * r).toFixed(1)} ${(Math.sin(a) * r).toFixed(1)}`;
    const leaf = (r1, r2, a, w) => `M${pt(r1, a)} Q${pt((r1 + r2) / 2, a + w)} ${pt(r2, a)} Q${pt((r1 + r2) / 2, a - w)} ${pt(r1, a)} Z`;

    function add(tag, attrs, color, fill, delay) {
      art.append(svgEl(tag, { ...attrs, class: "stitch", stroke: color, fill: fill || "none", "fill-opacity": fill ? 0.85 : 0 }));
      const m = svgEl(tag, { ...attrs, class: "stitch-mask", pathLength: 1 });
      m.style.setProperty("--delay", `${delay}s`);
      mask.append(m);
    }

    add("circle", { cx: 0, cy: 0, r: 100 }, RED, null, 0);
    add("circle", { cx: 0, cy: 0, r: 95 }, INDIGO, null, 0.2);
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      add("path", { d: leaf(56, 91, a, 0.24) }, "#7A1424", RED, 0.4 + i * 0.07);
      add("circle", { cx: Math.cos(a + Math.PI / 12) * 84, cy: Math.sin(a + Math.PI / 12) * 84, r: 5 }, INDIGO, INDIGO, 0.9 + i * 0.05);
    }
    add("circle", { cx: 0, cy: 0, r: 52 }, GREEN, null, 1.2);
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2 + Math.PI / 8;
      add("path", { d: leaf(22, 47, a, 0.32) }, "#2C5E39", GREEN, 1.4 + i * 0.08);
    }
    add("circle", { cx: 0, cy: 0, r: 18 }, "#7A1424", RED, 2);
    add("circle", { cx: 0, cy: 0, r: 8 }, "#9A6A12", SAFFRON, 2.3);
    host.append(svg);
  }

  /* ---------- Появление при прокрутке ---------- */

  function observeReveals() {
    const targets = $$(".reveal, .ink, .timeline, .calendar").filter((el) => el.id !== "heroArch");
    const show = (el) => el.classList.add(el.classList.contains("ink") ? "is-drawn" : "is-visible");
    if (!("IntersectionObserver" in window)) {
      targets.forEach(show);
      return;
    }
    const io = new IntersectionObserver(
      (entries) =>
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          show(entry.target);
          io.unobserve(entry.target);
        }),
      { threshold: 0.15, rootMargin: "0px 0px -6% 0px" }
    );
    targets.forEach((el) => io.observe(el));
  }

  /* ---------- Вечер над степью ---------- */

  let steppeTone = null;

  function setupSteppe() {
    const sec = $("#schedule");
    const sun = $("#sun");
    const moon = $("#moon");
    const stars = $("#stars");

    for (let i = 0; i < 46; i++) {
      const s = document.createElement("i");
      s.style.left = `${(Math.random() * 100).toFixed(1)}%`;
      s.style.top = `${(Math.random() * 78).toFixed(1)}%`;
      s.style.setProperty("--s", `${(1 + Math.random() * 1.8).toFixed(1)}px`);
      s.style.setProperty("--t", `${(2 + Math.random() * 3).toFixed(1)}s`);
      s.style.setProperty("--d", `${(-Math.random() * 4).toFixed(1)}s`);
      stars.append(s);
    }

    // Светлый текст там, где фон уже ночной.
    steppeTone = () => {
      const top = sec.getBoundingClientRect().top;
      const h = sec.offsetHeight || 1;
      $$(".timeline__item", sec).forEach((li) => {
        const y = (li.getBoundingClientRect().top - top + li.offsetHeight / 2) / h;
        li.classList.toggle("is-night", y > 0.47);
      });
    };

    let queued = false;
    function update() {
      queued = false;
      const r = sec.getBoundingClientRect();
      const vh = window.innerHeight;
      const p = clamp((vh - r.top) / (r.height + vh));
      sun.style.transform = `translateY(${(p * r.height * 0.42).toFixed(0)}px)`;
      sun.style.opacity = String(1 - clamp((p - 0.35) / 0.3));
      moon.style.opacity = String(clamp((p - 0.45) / 0.25));
      moon.style.transform = `translateY(${((1 - p) * 40).toFixed(0)}px)`;
      stars.style.opacity = String(clamp((p - 0.3) / 0.35));
    }
    const request = () => {
      if (!queued) {
        queued = true;
        requestAnimationFrame(update);
      }
    };
    window.addEventListener("scroll", request, { passive: true });
    window.addEventListener("resize", () => {
      request();
      steppeTone();
    });
    document.fonts?.ready.then(steppeTone);
    steppeTone();
    request();
  }

  /* ---------- Атласные ленты-разделители ---------- */

  function setupRibbons(tex) {
    const H = 30;
    const A = 6;
    const items = $$(".divider--ribbon").map((node) => {
      const cv = document.createElement("canvas");
      node.append(cv);
      return { node, cv, ctx: cv.getContext("2d"), visible: false, w: 0, h: 0 };
    });

    function size(it) {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      it.w = it.node.clientWidth || window.innerWidth;
      it.h = H + A * 2 + 8;
      it.cv.width = Math.round(it.w * dpr);
      it.cv.height = Math.round(it.h * dpr);
      it.cv.style.height = `${it.h}px`;
      it.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      draw(it, performance.now() / 1000);
    }

    // Лента нарезана на узкие полоски, каждая смещена по синусоиде — волна бежит слева направо.
    function draw(it, time) {
      const { ctx, w, h } = it;
      const scale = H / 256;
      const step = 2;
      ctx.clearRect(0, 0, w, h);
      for (let x = 0; x < w; x += step) {
        const ph = x * 0.022 - time * 1.4;
        const y = h / 2 - H / 2 + Math.sin(ph) * A;
        const slope = Math.cos(ph);
        const sx = ((x + time * 14) / scale) % 512;
        ctx.drawImage(tex, sx, 0, step / scale, 256, x, y, step + 0.6, H);
        ctx.fillStyle = slope > 0 ? `rgba(255,248,230,${(slope * 0.16).toFixed(3)})` : `rgba(0,0,0,${(-slope * 0.28).toFixed(3)})`;
        ctx.fillRect(x, y, step + 0.6, H);
        ctx.fillStyle = "#D4A647";
        ctx.fillRect(x, y - 2, step + 0.6, 2);
        ctx.fillRect(x, y + H, step + 0.6, 2);
      }
    }

    let running = false;
    function frame(now) {
      const time = now / 1000;
      let any = false;
      items.forEach((it) => {
        if (!it.visible) return;
        draw(it, time);
        any = true;
      });
      if (any && !reduceMotion) requestAnimationFrame(frame);
      else running = false;
    }

    items.forEach(size);
    window.addEventListener("resize", () => items.forEach(size));
    const io = new IntersectionObserver(
      (entries) =>
        entries.forEach((e) => {
          const it = items.find((i) => i.node === e.target);
          it.visible = e.isIntersecting;
          if (it.visible && !running && !reduceMotion) {
            running = true;
            requestAnimationFrame(frame);
          }
        }),
      { rootMargin: "80px 0px" }
    );
    items.forEach((it) => io.observe(it.node));
  }

  /* ---------- Атлас первого экрана ---------- */

  function setupAtlas(tile) {
    const cv = $("#atlas");
    const fabric = GL.fabric(cv, tile, { tileCss: 150, still: reduceMotion });
    if (!fabric) {
      cv.classList.add("hero__atlas--css");
      return { setActive() {} };
    }
    let wanted = false;
    let onScreen = true;
    new IntersectionObserver(([e]) => {
      onScreen = e.isIntersecting;
      fabric.setActive(wanted && onScreen);
    }).observe($("#hero"));
    document.addEventListener("visibilitychange", () => fabric.setActive(wanted && onScreen && !document.hidden));
    return {
      setActive(on) {
        wanted = on;
        fabric.setActive(wanted && onScreen);
      },
    };
  }

  /* ---------- Шашу: монеты и сладости, которыми осыпают молодых ---------- */

  const shashu = (() => {
    const cv = $("#shashu");
    const ctx = cv.getContext("2d");
    const CANDY = ["#D6336C", "#1FA4A8", "#F2B630", "#3B5BDB", "#2F9E44"];
    let w = 0;
    let h = 0;
    let parts = [];
    let running = false;

    function resize() {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      w = window.innerWidth;
      h = window.innerHeight;
      cv.width = Math.round(w * dpr);
      cv.height = Math.round(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    function spawn(n, spread) {
      for (let i = 0; i < n; i++) {
        const r = Math.random();
        parts.push({
          kind: r < 0.5 ? "coin" : r < 0.82 ? "candy" : "flake",
          x: Math.random() * w,
          y: -20 - Math.random() * h * spread,
          vx: (Math.random() - 0.5) * 1.4,
          vy: 1 + Math.random() * 2,
          rot: Math.random() * 6.28,
          vr: (Math.random() - 0.5) * 0.12,
          flip: Math.random() * 6.28,
          vf: 0.08 + Math.random() * 0.12,
          size: 6 + Math.random() * 5,
          color: CANDY[(Math.random() * CANDY.length) | 0],
          sway: Math.random() * 6.28,
        });
      }
    }

    function coin(p) {
      const s = p.size;
      const fx = Math.cos(p.flip);
      ctx.scale(Math.max(0.12, Math.abs(fx)), 1);
      const g = ctx.createRadialGradient(-s * 0.3, -s * 0.3, 0, 0, 0, s);
      g.addColorStop(0, "#FFF1B8");
      g.addColorStop(0.5, fx > 0 ? "#E8B53A" : "#C9922A");
      g.addColorStop(1, "#9A6A12");
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(0, 0, s, 0, 6.283);
      ctx.fill();
      ctx.strokeStyle = "rgba(255,240,190,.7)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(0, 0, s * 0.68, 0, 6.283);
      ctx.stroke();
    }

    function candy(p) {
      const s = p.size;
      ctx.scale(1, 0.6 + Math.abs(Math.cos(p.flip)) * 0.4);
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.ellipse(0, 0, s * 0.95, s * 0.62, 0, 0, 6.283);
      ctx.fill();
      for (const dir of [-1, 1]) {
        ctx.beginPath();
        ctx.moveTo(dir * s * 0.8, 0);
        ctx.lineTo(dir * s * 1.6, -s * 0.6);
        ctx.lineTo(dir * s * 1.6, s * 0.6);
        ctx.closePath();
        ctx.fill();
      }
      ctx.fillStyle = "rgba(255,255,255,.55)";
      ctx.fillRect(-s * 0.2, -s * 0.62, s * 0.4, s * 1.24);
    }

    function flake(p) {
      ctx.scale(1, Math.cos(p.flip));
      ctx.fillStyle = "#E9C46A";
      ctx.fillRect(-p.size * 0.35, -p.size * 0.2, p.size * 0.7, p.size * 0.4);
    }

    // Скорости заданы «на кадр при 60 fps»; dt пересчитывает их в реальное время,
    // чтобы на медленном телефоне дождь не растягивался.
    let last = 0;
    function frame(now) {
      const dt = last ? Math.min(4, (now - last) / 16.7) : 1;
      last = now;
      ctx.clearRect(0, 0, w, h);
      parts = parts.filter((p) => p.y < h + 40);
      for (const p of parts) {
        p.vy = Math.min(p.vy + 0.06 * dt, p.kind === "flake" ? 2.2 : 5.5);
        p.sway += 0.03 * dt;
        p.x += (p.vx + Math.sin(p.sway) * 0.4) * dt;
        p.y += p.vy * dt;
        p.rot += p.vr * dt;
        p.flip += p.vf * dt;
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot);
        if (p.kind === "coin") coin(p);
        else if (p.kind === "candy") candy(p);
        else flake(p);
        ctx.restore();
      }
      if (parts.length) requestAnimationFrame(frame);
      else {
        running = false;
        last = 0;
        ctx.clearRect(0, 0, w, h);
      }
    }

    resize();
    window.addEventListener("resize", resize);

    return {
      rain(n = 70, spread = 0.6) {
        if (reduceMotion) return;
        spawn(n, spread);
        if (!running) {
          running = true;
          requestAnimationFrame(frame);
        }
      },
    };
  })();

  /* ---------- Музыка ---------- */

  const music = {
    audio: null,
    btn: $("#music"),
    wanted: false,

    init() {
      if (!C.music) return;
      this.audio = new Audio(encodeURI(C.music));
      this.audio.loop = true;
      this.audio.preload = "auto";
      // Подстраховка бесконечного повтора для браузеров, где loop иногда не срабатывает.
      this.audio.addEventListener("ended", () => {
        if (!this.wanted) return;
        this.audio.currentTime = 0;
        this.audio.play().catch(() => {});
      });
      this.audio.addEventListener("error", () => {
        this.btn.hidden = true;
        this.audio = null;
      });
      this.btn.hidden = false;
      this.btn.addEventListener("click", (e) => {
        e.stopPropagation();
        if (this.wanted) this.pause();
        else this.play();
      });

      // Браузеры не дают включать звук без действия гостя. Поэтому пробуем сразу,
      // а если не вышло — включаем при первом же касании, нажатии клавиши или клике.
      this.wanted = true;
      this.setState(true);
      this.tryPlay();
      const unlock = (e) => {
        if (e.target.closest?.("#music")) return;
        if (this.wanted && this.audio?.paused) this.tryPlay();
      };
      ["pointerdown", "touchend", "keydown", "click"].forEach((type) =>
        document.addEventListener(type, unlock, { capture: true, passive: true })
      );

      // Ставим на паузу, когда вкладка скрыта, и возвращаем звук при возврате.
      document.addEventListener("visibilitychange", () => {
        if (!this.audio) return;
        if (document.hidden) this.audio.pause();
        else if (this.wanted) this.tryPlay();
      });
    },

    tryPlay() {
      const audio = this.audio;
      if (!audio || !audio.paused) return;
      audio.volume = 0;
      audio
        .play()
        .then(() => this.fade(C.musicVolume ?? 0.6, 2000))
        .catch(() => {
          /* ждём следующего касания */
        });
    },

    play() {
      this.wanted = true;
      this.setState(true);
      this.tryPlay();
    },

    pause() {
      this.wanted = false;
      this.setState(false);
      this.audio?.pause();
    },

    fade(target, ms) {
      const audio = this.audio;
      const start = audio.volume;
      const t0 = performance.now();
      const step = (now) => {
        const k = Math.min(1, (now - t0) / ms);
        audio.volume = start + (target - start) * k;
        if (k < 1 && !audio.paused) requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
    },

    isPlaying() {
      return this.wanted;
    },

    // Значок показывает намерение гостя: пока трек догружается, он уже «включён».
    setState(on) {
      this.btn.classList.toggle("is-playing", on);
      this.btn.setAttribute("aria-pressed", String(on));
      this.btn.setAttribute("aria-label", t(on ? "musicOff" : "musicOn"));
    },
  };

  /* ---------- Занавес ---------- */

  function setupCurtains(atlas) {
    const stage = $("#stage");
    const glCanvas = $("#curtains");
    const fallback = $("#curtainFallback");
    const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    const tw = Math.min(1024, Math.round((window.innerWidth / 2) * dpr));
    const th = Math.min(2048, Math.round(window.innerHeight * dpr));
    const left = X.uzCurtain(tw, th);
    const right = X.kzCurtain(tw, th);

    const drape = GL.curtains(glCanvas, left, right, { still: reduceMotion });
    if (!drape) {
      glCanvas.hidden = true;
      fallback.hidden = false;
      $(".fb--l", fallback).style.backgroundImage = `url(${left.toDataURL()})`;
      $(".fb--r", fallback).style.backgroundImage = `url(${right.toDataURL()})`;
    }

    let opened = false;
    async function open() {
      if (opened) return;
      opened = true;
      vibrate([12, 40, 18]);
      stage.classList.add("is-opening");
      atlas.setActive(true);

      const dur = reduceMotion ? 300 : 2800;
      setTimeout(() => shashu.rain(80), dur * 0.2);
      setTimeout(() => {
        $("#hero").classList.add("is-in");
        $("#heroArch").classList.add("is-drawn");
      }, dur * 0.35);

      if (drape) {
        const t0 = performance.now();
        await new Promise((resolve) => {
          const step = (now) => {
            const k = clamp((now - t0) / dur);
            drape.setOpen(ease(k));
            if (k < 1) requestAnimationFrame(step);
            else resolve();
          };
          requestAnimationFrame(step);
        });
      } else {
        fallback.classList.add("is-open");
        await wait(1800);
      }

      stage.classList.add("is-gone");
      document.body.classList.remove("is-locked");
      setTimeout(() => {
        drape?.destroy();
        stage.remove();
      }, 800);
    }

    stage.addEventListener("click", open);
  }

  /* ---------- Анкета ---------- */

  function setupRsvp() {
    const form = $("#rsvpForm");
    const status = $("#rsvpStatus");
    const submit = $("#rsvpSubmit");
    const nameError = $("#nameError");
    const thanks = $("#thanks");

    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      const name = form.elements.name.value.trim();
      nameError.hidden = Boolean(name);
      if (!name) {
        form.elements.name.focus();
        return;
      }

      const data = new FormData(form);
      const attending = data.get("attend") === "Приду";
      const payload = new URLSearchParams({
        name,
        attend: data.get("attend"),
        side: data.get("side") || "",
        relation: data.get("relation") || "",
        wishes: data.get("wishes").trim(),
        lang,
      });

      const demo = !C.rsvpEndpoint;
      if (demo) {
        console.info("RSVP (демо):", Object.fromEntries(payload));
      } else {
        submit.disabled = true;
        submit.textContent = t("sending");
        status.textContent = "";
        try {
          // Apps Script не отдаёт CORS-заголовки, поэтому no-cors: ответ не читаем.
          await fetch(C.rsvpEndpoint, { method: "POST", mode: "no-cors", body: payload });
        } catch {
          status.textContent = t("sendError");
          submit.disabled = false;
          submit.textContent = t("submit");
          return;
        }
      }

      form.classList.add("is-leaving");
      await wait(500);
      form.hidden = true;
      // ключи словаря, а не готовый текст: при смене языка благодарность тоже переведётся
      const thanksText = $("#thanksText");
      const thanksNote = $("#thanksNote");
      thanksText.dataset.i18n = attending ? "thanksYes" : "thanksNo";
      thanksText.textContent = t(thanksText.dataset.i18n);
      if (demo) {
        thanksNote.dataset.i18n = "demoNote";
        thanksNote.textContent = t("demoNote");
      }
      thanks.hidden = false;
      void thanks.offsetWidth;
      thanks.classList.add("is-visible");
      thanks.scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth", block: "center" });
      if (attending) shashu.rain(70, 0.4);
    });
  }

  /* ---------- Запуск ---------- */

  const tile = X.atlasTile();
  const rootStyle = document.documentElement.style;
  rootStyle.setProperty("--atlas", `url(${tile.toDataURL()})`);
  rootStyle.setProperty("--ganch", X.ganchPattern());
  rootStyle.setProperty("--tiles", X.tilePattern());

  buildLangSwitch();
  buildStatic();
  buildArches();
  buildOrnamentDividers();
  buildFeltBorders();
  buildSuzani();
  setupSteppe();
  render();
  startCountdown();
  observeReveals();
  setupRibbons(X.ribbonTexture(tile));
  const atlas = setupAtlas(tile);
  music.init();
  setupCurtains(atlas);
  setupRsvp();
})();
