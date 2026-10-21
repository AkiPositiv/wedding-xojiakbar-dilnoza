(() => {
  "use strict";

  const C = window.WEDDING;
  const $ = (s, root = document) => root.querySelector(s);
  const $$ = (s, root = document) => [...root.querySelectorAll(s)];
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const NS = "http://www.w3.org/2000/svg";

  const wait = (ms) => new Promise((resolve) => setTimeout(resolve, reduceMotion ? Math.min(ms, 30) : ms));
  const clamp = (v, min = -1, max = 1) => Math.max(min, Math.min(max, v));
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
    LANGS.forEach((code) => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "lang__btn";
      b.dataset.lang = code;
      b.lang = window.I18N[code].htmlLang;
      b.textContent = window.I18N[code].label;
      b.addEventListener("click", () => setLang(code));
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
        cell.classList.add("is-wedding");
        cell.setAttribute("aria-label", t("weddingDay", { day: d }));
        cell.insertAdjacentHTML(
          "beforeend",
          `<svg class="calendar__heart" viewBox="0 0 40 40" aria-hidden="true"><path pathLength="1" d="M20 33 C 8 25, 3 18, 5 11 C 7 5, 15 4, 20 11 C 25 4, 33 5, 35 11 C 37 18, 32 25, 20 33 C 19 32.4, 18.5 31.6, 19 30.5"/></svg>`
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

  /* ---------- Ветки золотыми чернилами ---------- */

  function svgEl(tag, attrs) {
    const node = document.createElementNS(NS, tag);
    for (const key in attrs) node.setAttribute(key, attrs[key]);
    return node;
  }

  // Рисует ветку вдоль кривой f(t), t ∈ [0, 1]; листья появляются по мере роста стебля.
  function growBranch(svg, f, { leaves = 10, size = 20, delay = 0, duration = 1.6, berries = [] } = {}) {
    const pts = [];
    for (let i = 0; i <= 48; i++) pts.push(f(i / 48));
    const d = "M" + pts.map(([x, y]) => `${x.toFixed(1)} ${y.toFixed(1)}`).join(" L");
    const stem = svgEl("path", { d, class: "stem", pathLength: 1 });
    stem.style.setProperty("--delay", `${delay}s`);
    stem.style.setProperty("--dur", `${duration}s`);
    svg.append(stem);

    for (let i = 0; i < leaves; i++) {
      const t = 0.06 + (i / (leaves - 1)) * 0.9;
      const [x, y] = f(t);
      const [x2, y2] = f(Math.min(1, t + 0.01));
      let tx = x2 - x;
      let ty = y2 - y;
      const len = Math.hypot(tx, ty) || 1;
      tx /= len;
      ty /= len;

      const angle = (i % 2 ? 1 : -1) * 0.8;
      const dx = tx * Math.cos(angle) - ty * Math.sin(angle);
      const dy = tx * Math.sin(angle) + ty * Math.cos(angle);
      const L = size * (1 - t * 0.45);
      const w = L * 0.34;
      const tipX = x + dx * L;
      const tipY = y + dy * L;
      const mx = x + dx * L * 0.5;
      const my = y + dy * L * 0.5;
      const nx = -dy;
      const ny = dx;
      const leaf = svgEl("path", {
        class: "leaf",
        pathLength: 1,
        d: `M${x.toFixed(1)} ${y.toFixed(1)} Q${(mx + nx * w).toFixed(1)} ${(my + ny * w).toFixed(1)} ${tipX.toFixed(1)} ${tipY.toFixed(1)} Q${(mx - nx * w).toFixed(1)} ${(my - ny * w).toFixed(1)} ${x.toFixed(1)} ${y.toFixed(1)}`,
      });
      leaf.style.setProperty("--delay", `${(delay + t * duration * 0.9).toFixed(2)}s`);
      leaf.style.setProperty("--dur", "0.6s");
      svg.append(leaf);
    }

    berries.forEach(([t, ox, oy, r]) => {
      const [x, y] = f(t);
      const berry = svgEl("circle", { class: "berry", cx: x + ox, cy: y + oy, r });
      berry.style.setProperty("--delay", `${(delay + duration + 0.2).toFixed(2)}s`);
      svg.append(berry);
    });
  }

  function buildWreath() {
    const svg = svgEl("svg", { viewBox: "0 0 400 400" });
    const cx = 200;
    const cy = 205;
    const r = 172;
    const rad = (deg) => (deg * Math.PI) / 180;
    const arc = (from, to) => (t) => {
      const a = rad(from + (to - from) * t);
      return [cx + r * Math.cos(a), cy + r * Math.sin(a)];
    };
    growBranch(svg, arc(118, 247), { leaves: 16, size: 26, delay: 0.4, duration: 2.4, berries: [[0.35, 8, 4, 2.6], [0.62, -6, 7, 2.2]] });
    growBranch(svg, arc(62, -67), { leaves: 16, size: 26, delay: 0.6, duration: 2.4, berries: [[0.4, -8, 4, 2.6], [0.68, 7, 6, 2.2]] });
    $("#wreath").append(svg);
  }

  function buildSprigs() {
    $$(".sprig").forEach((node, n) => {
      const svg = svgEl("svg", { viewBox: "0 0 240 44" });
      const flip = n % 2 ? -1 : 1;
      growBranch(svg, (t) => [20 + t * 200, 24 - flip * Math.sin(t * Math.PI) * 7], {
        leaves: 9,
        size: 19,
        duration: 1.4,
        berries: [[0.97, 4, 0, 2.2]],
      });
      node.append(svg);
    });
  }

  /* ---------- Появление при прокрутке ---------- */

  function observeReveals() {
    const targets = $$(".reveal, .sprig, .timeline, .calendar");
    if (!("IntersectionObserver" in window)) {
      targets.forEach(show);
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          show(entry.target);
          io.unobserve(entry.target);
        });
      },
      { threshold: 0.2, rootMargin: "0px 0px -8% 0px" }
    );
    targets.forEach((t) => io.observe(t));

    function show(el) {
      el.classList.add(el.classList.contains("ink") ? "is-drawn" : "is-visible");
    }
  }

  /* ---------- День переходит в вечер вместе с программой ---------- */

  const PALETTES = {
    day: { paper: "#EEF0E8", line: "#C6CDBD", ink: "#1E3B2F", soft: "#4E6656" },
    golden: { paper: "#F1E6D3", line: "#D8CAAE", ink: "#2B3526", soft: "#5E5A44" },
    sunset: { paper: "#EACFC3", line: "#D2AFA3", ink: "#3A2329", soft: "#6A4A4D" },
    night: { paper: "#1D2833", line: "#3A4855", ink: "#F0EADC", soft: "#B4AFA3" },
  };

  function phaseOf(time) {
    const [h, m = 0] = time.split(":").map(Number);
    const hours = h + m / 60;
    if (hours >= 22) return "night";
    if (hours >= 20) return "sunset";
    if (hours >= 17) return "golden";
    return "day";
  }

  const hexToRgb = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
  const mixHex = (a, b, t) => {
    const A = hexToRgb(a);
    const B = hexToRgb(b);
    return `rgb(${A.map((v, i) => Math.round(v + (B[i] - v) * t)).join(", ")})`;
  };
  const smooth = (t) => t * t * (3 - 2 * t);

  function setupEvening() {
    const section = $("#schedule");
    const items = $$(".timeline__item");
    const after = $("#place .section__title");
    const root = document.documentElement;
    const meta = $('meta[name="theme-color"]');
    const sparkItem = items.find((_, i) => C.schedule[i].sparkles);
    let queued = false;
    let lastPaper = "";

    function update() {
      queued = false;
      const vh = window.innerHeight;
      const anchor = vh * 0.55;

      const stops = [{ y: section.getBoundingClientRect().top, p: PALETTES.day }];
      items.forEach((item, i) => {
        const r = item.getBoundingClientRect();
        stops.push({ y: r.top + r.height / 2, p: PALETTES[phaseOf(C.schedule[i].time)] });
      });
      stops.push({ y: after.getBoundingClientRect().top, p: PALETTES.day });

      let a = PALETTES.day;
      let b = PALETTES.day;
      let t = 0;
      for (let i = 0; i < stops.length - 1; i++) {
        if (anchor >= stops[i].y && anchor < stops[i + 1].y) {
          a = stops[i].p;
          b = stops[i + 1].p;
          t = smooth((anchor - stops[i].y) / (stops[i + 1].y - stops[i].y));
          break;
        }
      }

      const paper = mixHex(a.paper, b.paper, t);
      if (paper !== lastPaper) {
        lastPaper = paper;
        root.style.setProperty("--paper", paper);
        root.style.setProperty("--line", mixHex(a.line, b.line, t));
        // Цвет текста переключается скачком (с плавным переходом в CSS),
        // чтобы в середине не получился серый текст на сером фоне.
        const ink = t < 0.5 ? a : b;
        root.style.setProperty("--ink", ink.ink);
        root.style.setProperty("--ink-soft", ink.soft);
        meta?.setAttribute("content", paper);
      }

      if (sparkItem) {
        const time = $(".timeline__time", sparkItem).getBoundingClientRect();
        const lit = time.top < vh * 0.85 && time.bottom > vh * 0.15 && (a === PALETTES.night || b === PALETTES.night);
        const rem = parseFloat(getComputedStyle(root).fontSize);
        sparks.set(lit ? [{ x: time.right + rem * 0.9, y: time.top + time.height / 2 }] : []);
      }
    }

    const request = () => {
      if (!queued) {
        queued = true;
        requestAnimationFrame(update);
      }
    };
    window.addEventListener("scroll", request, { passive: true });
    window.addEventListener("resize", request);
    request();
  }

  /* ---------- Бенгальские огни ---------- */

  const sparks = (() => {
    const canvas = $("#sparks");
    const ctx = canvas.getContext("2d");
    let emitters = [];
    let parts = [];
    let running = false;
    let w = 0;
    let h = 0;

    function resize() {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      w = window.innerWidth;
      h = window.innerHeight;
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    function frame() {
      ctx.clearRect(0, 0, w, h);
      ctx.globalCompositeOperation = "lighter";
      ctx.lineCap = "round";

      emitters.forEach((e) => {
        for (let k = 0; k < 5; k++) {
          const angle = Math.random() * Math.PI * 2;
          const speed = 1 + Math.random() * 3.8;
          parts.push({ x: e.x, y: e.y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed, life: 1, decay: 0.025 + Math.random() * 0.04 });
        }
        const glow = ctx.createRadialGradient(e.x, e.y, 0, e.x, e.y, 14);
        glow.addColorStop(0, "rgba(255, 236, 190, .95)");
        glow.addColorStop(1, "rgba(255, 200, 120, 0)");
        ctx.fillStyle = glow;
        ctx.beginPath();
        ctx.arc(e.x, e.y, 14, 0, Math.PI * 2);
        ctx.fill();
      });

      parts = parts.filter((p) => p.life > 0);
      for (const p of parts) {
        p.vy += 0.07;
        p.vx *= 0.96;
        p.vy *= 0.96;
        p.x += p.vx;
        p.y += p.vy;
        p.life -= p.decay;
        ctx.strokeStyle = `rgba(255, ${200 + ((p.life * 55) | 0)}, 150, ${Math.max(0, p.life)})`;
        ctx.lineWidth = 1.3;
        ctx.beginPath();
        ctx.moveTo(p.x, p.y);
        ctx.lineTo(p.x - p.vx * 2.2, p.y - p.vy * 2.2);
        ctx.stroke();
      }

      if (emitters.length || parts.length) {
        requestAnimationFrame(frame);
      } else {
        running = false;
        ctx.clearRect(0, 0, w, h);
      }
    }

    resize();
    window.addEventListener("resize", resize);

    return {
      set(list) {
        if (reduceMotion) return;
        emitters = list;
        if (!running && list.length) {
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
      // Кнопку показываем, только когда файл действительно загрузился.
      this.audio.addEventListener("loadedmetadata", () => (this.btn.hidden = false));
      this.audio.addEventListener("error", () => {
        this.btn.hidden = true;
        this.audio = null;
      });
      this.btn.addEventListener("click", () => (this.audio && !this.audio.paused ? this.pause(true) : this.play()));

      // Ставим на паузу, когда вкладка скрыта, и возвращаем звук при возврате.
      document.addEventListener("visibilitychange", () => {
        if (!this.audio) return;
        if (document.hidden) this.audio.pause();
        else if (this.wanted) this.play();
      });
    },

    play() {
      if (!this.audio) return;
      this.wanted = true;
      this.audio.volume = 0;
      this.audio
        .play()
        .then(() => {
          this.btn.hidden = false;
          this.setState(true);
          this.fade(C.musicVolume ?? 0.6, 2000);
        })
        .catch(() => this.setState(false));
    },

    pause(byUser) {
      if (!this.audio) return;
      if (byUser) this.wanted = false;
      this.audio.pause();
      this.setState(false);
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
      return Boolean(this.audio && !this.audio.paused);
    },

    setState(playing) {
      this.btn.classList.toggle("is-playing", playing);
      this.btn.setAttribute("aria-pressed", String(playing));
      this.btn.setAttribute("aria-label", t(playing ? "musicOff" : "musicOn"));
    },
  };

  /* ---------- Лепестки ---------- */

  // Возвращает { burst(x, y) } — выброс лепестков из точки (после отправки анкеты).
  function startPetals() {
    if (reduceMotion) return { burst() {} };
    const canvas = $("#petals");
    const ctx = canvas.getContext("2d");
    const colors = ["#D9B2AA", "#E6C8C0", "#C9D3BF", "#E9DCC9"];
    const count = window.innerWidth < 600 ? 12 : 20;
    let w = 0;
    let h = 0;

    function resize() {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      w = window.innerWidth;
      h = window.innerHeight;
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
    resize();
    window.addEventListener("resize", resize);

    // Порыв ветра: при быстрой прокрутке лепестки подхватывает потоком.
    let gust = 0;
    let lastScroll = window.scrollY;
    window.addEventListener(
      "scroll",
      () => {
        const y = window.scrollY;
        gust = clamp(gust + (y - lastScroll) * 0.04, -10, 10);
        lastScroll = y;
      },
      { passive: true }
    );

    const spawn = (initial) => ({
      x: Math.random() * w,
      y: initial ? Math.random() * -h : -20,
      size: 6 + Math.random() * 7,
      speed: 0.35 + Math.random() * 0.55,
      drift: Math.random() * Math.PI * 2,
      spin: (Math.random() - 0.5) * 0.03,
      angle: Math.random() * Math.PI,
      flip: Math.random() * Math.PI,
      color: colors[Math.floor(Math.random() * colors.length)],
    });
    const petals = Array.from({ length: count }, () => spawn(true));
    let flying = [];

    function draw(p, alpha) {
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.angle);
      ctx.scale(1, 0.45 + Math.abs(Math.sin(p.flip)) * 0.55);
      ctx.globalAlpha = alpha;
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.moveTo(0, -p.size);
      ctx.quadraticCurveTo(p.size * 0.9, -p.size * 0.2, 0, p.size);
      ctx.quadraticCurveTo(-p.size * 0.9, -p.size * 0.2, 0, -p.size);
      ctx.fill();
      ctx.restore();
    }

    let last = performance.now();
    function frame(now) {
      const dt = Math.min(3, (now - last) / 16.7);
      last = now;
      gust *= Math.pow(0.92, dt);
      ctx.clearRect(0, 0, w, h);

      petals.forEach((p, i) => {
        p.drift += 0.012 * dt;
        p.flip += (0.04 + Math.abs(gust) * 0.01) * dt;
        p.angle += (p.spin + gust * 0.004) * dt;
        p.y += (p.speed - gust * p.speed * 0.9) * dt;
        p.x += (Math.sin(p.drift) * 0.5 + gust * 0.3 * Math.sin(p.drift * 3)) * dt;
        if (p.y > h + 20) petals[i] = spawn(false);
        else if (p.y < -40) p.y = h + 10;
        draw(p, 0.7);
      });

      flying = flying.filter((p) => p.life > 0 && p.y < h + 30);
      flying.forEach((p) => {
        p.vx *= Math.pow(0.97, dt);
        p.vy = p.vy * Math.pow(0.97, dt) + 0.06 * dt;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.flip += 0.08 * dt;
        p.angle += p.spin * dt;
        p.life -= 0.006 * dt;
        draw(p, 0.85 * Math.min(1, p.life * 2));
      });

      requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);

    return {
      burst(x, y) {
        for (let i = 0; i < 26; i++) {
          const angle = -Math.PI / 2 + (Math.random() - 0.5) * Math.PI * 1.4;
          const speed = 2.5 + Math.random() * 5;
          flying.push({
            ...spawn(false),
            x,
            y,
            vx: Math.cos(angle) * speed,
            vy: Math.sin(angle) * speed,
            spin: (Math.random() - 0.5) * 0.2,
            life: 1,
          });
        }
      },
    };
  }

  let petals = { burst() {} };

  /* ---------- Конверт ---------- */

  // Конверт слегка поворачивается вслед за курсором или наклоном телефона.
  function setupTilt(env) {
    if (reduceMotion) return () => {};
    let tx = 0;
    let ty = 0;
    let cx = 0;
    let cy = 0;
    let lastInput = 0;
    let active = true;

    const onPointer = (e) => {
      tx = (e.clientX / window.innerWidth - 0.5) * 2;
      ty = (e.clientY / window.innerHeight - 0.5) * 2;
      lastInput = performance.now();
    };
    const onOrient = (e) => {
      if (e.gamma == null) return;
      tx = clamp(e.gamma / 25);
      ty = clamp((e.beta - 45) / 25);
      lastInput = performance.now();
    };
    window.addEventListener("pointermove", onPointer);
    window.addEventListener("deviceorientation", onOrient);

    (function loop(now) {
      if (!active) return;
      if (now - lastInput > 2500) {
        // без касаний конверт едва заметно покачивается
        tx = Math.sin(now / 1600) * 0.35;
        ty = Math.cos(now / 2100) * 0.25;
      }
      cx += (tx - cx) * 0.06;
      cy += (ty - cy) * 0.06;
      env.style.setProperty("--ry", `${(cx * 9).toFixed(2)}deg`);
      env.style.setProperty("--rx", `${(-cy * 7).toFixed(2)}deg`);
      env.style.setProperty("--sx", `${(50 - cx * 45).toFixed(1)}%`);
      requestAnimationFrame(loop);
    })(performance.now());

    return () => {
      active = false;
      window.removeEventListener("pointermove", onPointer);
      window.removeEventListener("deviceorientation", onOrient);
      env.style.setProperty("--rx", "0deg");
      env.style.setProperty("--ry", "0deg");
    };
  }

  function setupIntro() {
    const intro = $("#intro");
    const envelope = $("#envelope");
    const letter = $(".env-letter");
    const stopTilt = setupTilt(envelope);
    let opened = false;

    // Письмо растягивается так, чтобы закрыть весь экран: оно и станет страницей.
    function unfold() {
      const r = letter.getBoundingClientRect();
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      const scale = Math.max(vw / r.width, vh / r.height) * 1.06;
      const dx = vw / 2 - (r.left + r.width / 2);
      const dy = vh / 2 - (r.top + r.height / 2);
      intro.classList.add("is-unfolding");
      letter.style.transform = `translate(${dx}px, ${dy}px) translateY(-48%) scale(${scale})`;
    }

    async function open() {
      if (opened) return;
      opened = true;
      stopTilt();
      music.play();
      vibrate([12, 40, 18]);
      intro.classList.add("is-opening");

      if (!reduceMotion) {
        await wait(1850);
        unfold();
        await wait(1150);
      }

      intro.classList.add("is-gone");
      document.body.classList.remove("is-locked");
      $("#hero").classList.add("is-in");
      $("#wreath").classList.add("is-drawn");
      petals = startPetals();
      setTimeout(() => intro.remove(), 600);
    }

    $("#seal").addEventListener("click", open);
    envelope.addEventListener("click", open);
  }

  /* ---------- Анкета ---------- */

  function setupRsvp() {
    const stage = $("#rsvpStage");
    const form = $("#rsvpForm");
    const extra = $("#formExtra");
    const status = $("#rsvpStatus");
    const submit = $("#rsvpSubmit");
    const nameError = $("#nameError");
    const mail = $("#mail");
    const thanks = $("#thanks");

    form.addEventListener("change", (e) => {
      if (e.target.name === "attend") extra.hidden = e.target.value !== "Приду";
    });

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
        guest: attending ? data.get("guest").trim() : "",
        drinks: attending ? data.getAll("drinks").join(", ") : "",
        food: attending ? data.get("food").trim() : "",
        comment: data.get("comment").trim(),
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

      await playSent({ text: attending ? "thanksYes" : "thanksNo", note: demo ? "demoNote" : "" });
    });

    async function playSent({ text, note }) {
      const stageRect = stage.getBoundingClientRect();
      const btnRect = submit.getBoundingClientRect();
      stage.style.height = `${stageRect.height}px`;

      // анкета складывается туда, где была кнопка
      form.classList.add("is-folding");
      await wait(500);
      form.hidden = true;

      mail.style.top = `${btnRect.top - stageRect.top + btnRect.height / 2}px`;
      mail.hidden = false;
      void mail.offsetWidth;
      mail.classList.add("is-shown");
      await wait(450);
      mail.classList.add("is-closed");
      await wait(520);
      mail.classList.add("is-sealed");
      vibrate(20);
      await wait(550);

      const m = mail.getBoundingClientRect();
      petals.burst(m.left + m.width / 2, m.top + m.height / 2);
      mail.classList.add("is-flying");
      await wait(1000);
      mail.hidden = true;

      // ключи словаря, а не готовый текст: при смене языка благодарность тоже переведётся
      const thanksText = $("#thanksText");
      const thanksNote = $("#thanksNote");
      thanksText.dataset.i18n = text;
      thanksText.textContent = t(text);
      if (note) {
        thanksNote.dataset.i18n = note;
        thanksNote.textContent = t(note);
      }
      thanks.hidden = false;
      const from = stage.offsetHeight;
      stage.style.height = "auto";
      const to = stage.offsetHeight;
      stage.style.height = `${from}px`;
      void stage.offsetWidth;
      stage.style.height = `${to}px`;
      thanks.classList.add("is-visible");
      await wait(750);
      stage.style.height = "";
      thanks.scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth", block: "center" });
    }
  }

  /* ---------- Запуск ---------- */

  buildLangSwitch();
  buildStatic();
  render();
  buildWreath();
  buildSprigs();
  startCountdown();
  observeReveals();
  setupEvening();
  music.init();
  setupIntro();
  setupRsvp();
})();
