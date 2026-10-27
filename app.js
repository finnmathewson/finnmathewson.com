// Scroll motion for Finn's media kit: smooth scrolling, reveals, and the self-drawing cliff line.
// (The route map is parked in src/web-tools/parked/ for a later version.)
(() => {
  const calm = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
  const ease = t => 1 - Math.pow(1 - t, 3);

  // things rise in as they enter the screen
  const io = new IntersectionObserver(entries => entries.forEach(e => {
    if (e.isIntersecting) { e.target.classList.add("in"); io.unobserve(e.target); }
  }), { threshold: .15, rootMargin: "0px 0px -6% 0px" });
  document.querySelectorAll("[data-reveal]").forEach(el => calm ? el.classList.add("in") : io.observe(el));

  // the waterfall photo stays put behind the whole side quests section
  const quests = document.querySelector(".quests");
  new IntersectionObserver(([e]) => quests.classList.toggle("on", e.isIntersecting), { threshold: 0 }).observe(quests);

  // cover: one short sticky stretch; the line finishes in about one scroll of the screen
  const hero = document.querySelector(".hero");
  function drawHero() {
    const r = hero.getBoundingClientRect();
    const p = calm ? 1 : clamp(-r.top / Math.max(1, r.height - innerHeight));
    hero.style.setProperty("--p", p.toFixed(4));
    // wide screens crop the photo, so slide it up first, then draw the line while it's all in view
    const wide = innerWidth / innerHeight > .8;
    // wide screens: the photo glides down at one steady speed the whole time; the line draws while it moves
    const smooth = t => t * t * (3 - 2 * t);
    // (the first ~23% of the line sits below the frame on wide screens, so the visible drawing starts where it enters)
    hero.style.setProperty("--line", (wide ? .23 + .77 * smooth(clamp((p - .4) / .5)) : ease(clamp(p / .8))).toFixed(4));
    hero.style.setProperty("--lift", p.toFixed(4));
    if (wide) hero.style.setProperty("--pan", p.toFixed(4)); // photo + name slide up together, steady, no stop (computers only)
    hero.classList.toggle("found", p > .6);
    hero.classList.toggle("roles-in", p > (wide ? .48 : .12)); // roles slide in as the line nears the peak
  }

  // intro drift (Pinterest "Nature." feel): each photo floats up at its own speed while it comes up the screen,
  // then freezes in its resting spot (same layout as the PDF) and scrolls away normally.
  // Uses the CSS `translate` property so it stacks with the reveal.
  // each piece belongs to a "page" group; the whole group finishes moving once that page is on screen
  const groupOf = el => el.closest(".meadow, .about-grid, .trips, .next") || el;
  const drifters = [...document.querySelectorAll("[data-speed]")].map(el => ({ el, speed: +el.dataset.speed, group: groupOf(el) }));
  // inner drift skips photos with tracking boxes (hike, snow) so the boxes stay on target
  const inner = [...document.querySelectorAll(".card.tetons img, .window img")];
  const restLine = () => innerHeight * .2; // a page's top reaching this line = everything on it is in place
  // on computers each page fills the screen, so pieces finish exactly when their page lands in view
  const fitOn = () => document.documentElement.classList.contains("fit-on");
  const before = group => {
    const page = fitOn() && group.closest("[data-page]");
    return page ? Math.max(0, page.getBoundingClientRect().top)
                : Math.max(0, group.getBoundingClientRect().top - restLine()); // 0 once settled
  };
  function drift() {
    if (calm) return;
    const k = innerWidth < 760 ? .5 : 1;
    for (const d of drifters) {
      d.el.style.translate = `0 ${(before(d.group) * d.speed * k).toFixed(1)}px`;
    }
    for (const img of inner) {
      img.style.translate = `0 ${(before(groupOf(img)) * -.08).toFixed(1)}px`;
    }
  }

  // truck boxes on page 2: each starts at a corner and traces itself closed as you scroll in, then stays
  const meadow = document.querySelector(".meadow");
  const truckBoxes = [...meadow.querySelectorAll(".track.draw")].map(el => {
    const len = el.getTotalLength();
    el.style.strokeDasharray = len; el.style.strokeDashoffset = len;
    return { el, len };
  });
  function traceTrucks() {
    const r = meadow.getBoundingClientRect();
    // starts when the band's top is 30% up the screen, done when its top is near the top of the screen
    const p = calm ? 1 : clamp((innerHeight * .7 - r.top) / (innerHeight * .65));
    truckBoxes.forEach((b, i) => {
      const t = clamp((p - i * .12) / .64); // small stagger, left truck first
      b.el.style.strokeDashoffset = (b.len * (1 - t)).toFixed(2);
    });
  }

  // view bonus: bars build up from the bottom, left to right like an escalator, as you scroll to them
  const bonus = document.querySelector(".bonus"), bars = [...bonus.querySelectorAll(".chart div")];
  function buildBars() {
    const r = bonus.getBoundingClientRect();
    const p = calm ? 1 : clamp((innerHeight * .9 - r.top) / (innerHeight * .6));
    bars.forEach((bar, i) => {
      const t = ease(clamp((p - i * .1) / .5));
      bar.style.height = `calc(var(--h) * 80% * ${t.toFixed(3)})`;
      bar.style.opacity = t > 0 ? 1 : 0;
    });
  }

  // locked rates: the code unscrambles them in the browser (same settings as src/web-tools/lock-rates.js).
  // Nothing is remembered: every visit asks for the code again.
  const form = document.querySelector(".unlock"), rateBox = document.querySelector(".ratelist"), bonusBox = document.querySelector(".bonus");
  const fromB64 = t => Uint8Array.from(atob(t), c => c.charCodeAt(0));
  async function openRates(code) {
    const L = window.RATES_LOCKED, enc = new TextEncoder();
    const base = await crypto.subtle.importKey("raw", enc.encode(code.trim().toLowerCase()), "PBKDF2", false, ["deriveKey"]);
    const key = await crypto.subtle.deriveKey({ name: "PBKDF2", salt: fromB64(L.salt), iterations: L.iter, hash: "SHA-256" }, base, { name: "AES-GCM", length: 256 }, false, ["decrypt"]);
    return JSON.parse(new TextDecoder().decode(await crypto.subtle.decrypt({ name: "AES-GCM", iv: fromB64(L.iv) }, key, fromB64(L.data))));
  }
  form.addEventListener("submit", async e => {
    e.preventDefault();
    const btn = form.querySelector("button"), msg = form.querySelector(".code-msg"), code = form.code.value;
    if (!code.trim()) return;
    btn.disabled = true; btn.textContent = "Checking…"; msg.textContent = "";
    try {
      const r = await openRates(code);
      rateBox.querySelectorAll("dd").forEach((dd, i) => { dd.innerHTML = r.rates[i]; });
      rateBox.querySelector(".terms").textContent = r.terms;
      bonusBox.querySelectorAll(".chart b").forEach((b, i) => { b.textContent = r.bonus[i]; });
      bonusBox.querySelector(".lock-note").remove();
      form.remove();
      [rateBox, bonusBox].forEach(el => el.classList.replace("locked", "just-unlocked"));
    } catch {
      msg.textContent = "That's not it. DM me for the code.";
      form.classList.remove("shake"); void form.offsetWidth; form.classList.add("shake");
      btn.disabled = false; btn.textContent = "Unlock";
    }
  });

  const onScroll = () => { drawHero(); drift(); traceTrucks(); buildBars(); };

  // one page per screen on computers: each page's content is laid out wider, then scaled down evenly
  // until the whole page fits the window (like zooming the browser out). Phones scroll normally.
  const pages = [...document.querySelectorAll("[data-page]")];
  function fitPages() {
    const on = innerWidth >= 900 && innerWidth / innerHeight > 1.15;
    document.documentElement.classList.toggle("fit-on", on);
    for (const page of pages) {
      const fit = page.querySelector(".fit");
      if (!on) { page.style.height = ""; fit.style.cssText = ""; continue; }
      const W = page.clientWidth, H = innerHeight, MIN = .85; // never shrink below 85%, so small text stays readable
      let k = 1;
      for (let i = 0; i < 6; i++) { fit.style.width = W / k + "px"; k = Math.max(MIN, Math.min(1, H / fit.offsetHeight)); }
      fit.style.width = W / k + "px";
      const h = fit.offsetHeight * k;
      page.style.height = Math.max(H, h) + "px"; // a page can run a little taller than the screen
      fit.style.transform = `scale(${k})`;
      fit.style.top = Math.max(0, (H - h) / 2) + "px";
    }
  }
  fitPages();
  document.fonts && document.fonts.ready.then(fitPages);
  addEventListener("load", fitPages);
  addEventListener("resize", fitPages);

  // smooth, even scrolling (same feel from top to bottom); native scroll if motion is reduced
  if (!calm && window.Lenis) {
    const lenis = window.lenis = new Lenis({ lerp: .09, wheelMultiplier: 1, smoothWheel: true });
    lenis.on("scroll", onScroll);
    const raf = t => { lenis.raf(t); requestAnimationFrame(raf); };
    requestAnimationFrame(raf);
  } else {
    addEventListener("scroll", () => requestAnimationFrame(onScroll), { passive: true });
  }
  addEventListener("resize", onScroll);
  onScroll();
})();
