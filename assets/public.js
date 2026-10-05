/* Halaman depan: pencarian, populer, terbaru */
(function () {
  const { sb, configured, KINDS, esc, safeUrl, kbCode, ago, views, lsGet, lsSet, brand } = window.KB;
  brand();

  const $ = (s) => document.querySelector(s);
  const qInput = $("#q"), clearBtn = $("#clearBtn"), kbdHint = $("#kbdHint");
  const catSel = $("#cat");
  const home = $("#home"), results = $("#results"), resList = $("#resList"), resTitle = $("#resTitle");

  const COLS = "id, code, title, kind, category, tags, summary, links, views, created_at, updated_at";
  const params = new URLSearchParams(location.search);
  const state = {
    q: params.get("q") || "",
    kind: params.get("jenis") || "",
    cat: params.get("kategori") || "",
    sort: params.get("urut") || "relevan",
  };

  const ICON_EYE = '<svg class="oct" viewBox="0 0 16 16" aria-hidden="true"><path d="M8 2c1.98 0 3.63.95 4.86 2.05 1.22 1.09 2.06 2.37 2.48 3.08a1.66 1.66 0 0 1 0 1.74c-.42.71-1.26 1.99-2.48 3.08C11.63 13.05 9.98 14 8 14s-3.63-.95-4.86-2.05C1.92 10.86 1.08 9.58.66 8.87a1.66 1.66 0 0 1 0-1.74c.42-.71 1.26-1.99 2.48-3.08C4.37 2.95 6.02 2 8 2ZM1.95 7.9a.16.16 0 0 0 0 .2c.38.64 1.13 1.78 2.19 2.73C5.2 11.79 6.5 12.5 8 12.5s2.8-.71 3.86-1.67c1.06-.95 1.81-2.09 2.19-2.73a.16.16 0 0 0 0-.2c-.38-.64-1.13-1.78-2.19-2.73C10.8 4.21 9.5 3.5 8 3.5s-2.8.71-3.86 1.67C3.08 6.12 2.33 7.26 1.95 7.9ZM8 10a2 2 0 1 1-.01-4.01A2 2 0 0 1 8 10Z"/></svg>';
  const ICON_OUT = '<svg class="oct" viewBox="0 0 16 16" aria-hidden="true"><path d="M3.75 2h3.5a.75.75 0 0 1 0 1.5h-3.5a.25.25 0 0 0-.25.25v8.5c0 .14.11.25.25.25h8.5a.25.25 0 0 0 .25-.25v-3.5a.75.75 0 0 1 1.5 0v3.5A1.75 1.75 0 0 1 12.25 14h-8.5A1.75 1.75 0 0 1 2 12.25v-8.5C2 2.78 2.78 2 3.75 2Zm6.85-.13 3.53.01c.2 0 .37.16.37.37v3.53a.25.25 0 0 1-.43.17L12.81 4.7 8.78 8.72a.75.75 0 0 1-1.06-1.06l4.03-4.03-1.25-1.25a.25.25 0 0 1 .1-.51Z"/></svg>';

  if (!configured || !sb) {
    $("#setupNotice").hidden = false;
    ["#popular", "#latest"].forEach((s) => ($(s).innerHTML = '<li class="empty">Menunggu pengaturan database.</li>'));
    return;
  }

  /* ---------- Render ---------- */
  function highlight(text, terms) {
    let out = esc(text);
    if (!terms.length) return out;
    const re = new RegExp("(" + terms.map((t) => esc(t).replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|") + ")", "gi");
    return out.replace(re, "<mark>$1</mark>");
  }

  function card(p, opts = {}) {
    const terms = opts.terms || [];
    const k = KINDS[p.kind] || KINDS.solusi;
    const links = (Array.isArray(p.links) ? p.links : [])
      .map((l) => ({ label: l.label || l.url, url: safeUrl(l.url) }))
      .filter((l) => l.url)
      .slice(0, 3);
    const rank = opts.rank ? `<span class="rank">#${opts.rank}</span>` : "";
    const when = opts.showDate === "created" ? ago(p.created_at) : ago(p.updated_at || p.created_at);
    return `<li class="card">
      <div class="card-meta">
        ${rank}<span class="kind kind-${esc(p.kind)}">${k.label}</span>
        <span>${esc(p.category)}</span>
        <span class="code">${kbCode(p.code)}</span>
      </div>
      <h3 class="card-title"><a href="/post?id=${encodeURIComponent(p.id)}">${highlight(p.title, terms)}</a></h3>
      ${p.summary ? `<p class="card-sum">${highlight(p.summary, terms)}</p>` : ""}
      ${links.length ? `<div class="quick">${links.map((l) =>
        `<a href="${esc(l.url)}" target="_blank" rel="noopener" data-id="${esc(p.id)}" title="${esc(l.url)}">${ICON_OUT}<span>${esc(l.label)}</span></a>`).join("")}</div>` : ""}
      <div class="card-meta">
        <span class="views" title="Dilihat">${ICON_EYE}${views(p.views)} kali dilihat</span>
        <span>·</span><span>${when}</span>
      </div>
    </li>`;
  }

  function fill(el, rows, opts, emptyHtml) {
    el.innerHTML = rows && rows.length
      ? rows.map((p, i) => card(p, { ...opts, rank: opts.ranked ? i + 1 : 0 })).join("")
      : `<li class="empty">${emptyHtml}</li>`;
  }

  function errorBox(el, err) {
    console.error(err);
    el.innerHTML = `<li class="empty"><strong>Data tidak bisa dimuat.</strong>Periksa koneksi internet lalu muat ulang halaman.</li>`;
  }

  /* ---------- Data ---------- */
  function filtered(query) {
    if (state.kind) query = query.eq("kind", state.kind);
    if (state.cat) query = query.eq("category", state.cat);
    return query;
  }

  const filterKey = () => `kb:home:${state.kind}|${state.cat}`;

  async function loadHome() {
    const cached = lsGet(filterKey(), null);
    const emptyMsg = state.kind || state.cat
      ? "Belum ada postingan untuk filter ini."
      : "<strong>Belum ada postingan.</strong>Admin bisa menambahkan lewat halaman Masuk admin.";
    if (cached) {
      fill($("#popular"), cached.pop, { ranked: true }, emptyMsg);
      fill($("#latest"), cached.lat, { showDate: "created" }, emptyMsg);
    }
    try {
      const [pop, lat] = await Promise.all([
        filtered(sb.from("posts").select(COLS)).order("views", { ascending: false }).order("created_at", { ascending: false }).limit(8),
        filtered(sb.from("posts").select(COLS)).order("created_at", { ascending: false }).limit(8),
      ]);
      if (pop.error) throw pop.error;
      if (lat.error) throw lat.error;
      fill($("#popular"), pop.data, { ranked: true }, emptyMsg);
      fill($("#latest"), lat.data, { showDate: "created" }, emptyMsg);
      lsSet(filterKey(), { pop: pop.data, lat: lat.data });
    } catch (e) {
      if (!cached) { errorBox($("#popular"), e); errorBox($("#latest"), e); }
    }
  }

  let searchSeq = 0;
  async function runSearch() {
    const seq = ++searchSeq;
    const terms = state.q.toLowerCase().split(/\s+/).filter(Boolean);
    resTitle.textContent = "Mencari…";
    const { data, error } = await sb.rpc("search_posts", {
      q: state.q,
      p_kind: state.kind || null,
      p_category: state.cat || null,
      p_sort: state.sort,
      p_limit: 40,
    });
    if (seq !== searchSeq) return; // ada pencarian yang lebih baru
    if (error) { resTitle.textContent = "Hasil"; return errorBox(resList, error); }
    resTitle.textContent = data.length ? `${data.length}${data.length >= 40 ? "+" : ""} hasil untuk “${state.q}”` : `Tidak ada hasil untuk “${state.q}”`;
    fill(resList, data, { terms }, "<strong>Tidak ditemukan.</strong>Coba kata lain yang lebih umum, misalnya merek atau nama aplikasinya saja, atau hapus filter jenis dan kategori.");
  }

  async function loadCategories() {
    const { data, error } = await sb.rpc("list_categories");
    if (error) return;
    catSel.innerHTML = '<option value="">Semua kategori</option>' +
      data.map((c) => `<option value="${esc(c.category)}">${esc(c.category)} (${c.total})</option>`).join("");
    if (state.cat && !data.some((c) => c.category === state.cat)) {
      catSel.insertAdjacentHTML("beforeend", `<option value="${esc(state.cat)}">${esc(state.cat)}</option>`);
    }
    catSel.value = state.cat;
  }

  /* ---------- Kontrol ---------- */
  function syncUrl() {
    const p = new URLSearchParams();
    if (state.q) p.set("q", state.q);
    if (state.kind) p.set("jenis", state.kind);
    if (state.cat) p.set("kategori", state.cat);
    if (state.q && state.sort !== "relevan") p.set("urut", state.sort);
    const s = p.toString();
    history.replaceState(null, "", s ? "?" + s : location.pathname);
  }

  function setPressed(attr, value) {
    document.querySelectorAll(`[data-${attr}]`).forEach((b) => b.setAttribute("aria-pressed", String(b.dataset[attr] === value)));
  }

  function refresh() {
    syncUrl();
    const searching = state.q.trim().length > 0;
    home.hidden = searching;
    results.hidden = !searching;
    clearBtn.hidden = !state.q;
    kbdHint.hidden = !!state.q;
    if (searching) runSearch(); else loadHome();
  }

  let t;
  qInput.addEventListener("input", () => {
    clearTimeout(t);
    t = setTimeout(() => { state.q = qInput.value.trim(); refresh(); }, 250);
  });
  $("#searchForm").addEventListener("submit", (e) => {
    e.preventDefault(); clearTimeout(t);
    state.q = qInput.value.trim(); refresh(); qInput.blur();
  });
  clearBtn.addEventListener("click", () => { qInput.value = ""; state.q = ""; refresh(); qInput.focus(); });

  document.querySelectorAll("[data-kind]").forEach((b) => b.addEventListener("click", () => {
    state.kind = b.dataset.kind; setPressed("kind", state.kind); refresh();
  }));
  document.querySelectorAll("[data-sort]").forEach((b) => b.addEventListener("click", () => {
    state.sort = b.dataset.sort; setPressed("sort", state.sort); refresh();
  }));
  catSel.addEventListener("change", () => { state.cat = catSel.value; refresh(); });

  document.addEventListener("keydown", (e) => {
    if (e.key === "/" && document.activeElement !== qInput && !/input|textarea|select/i.test(document.activeElement.tagName)) {
      e.preventDefault(); qInput.focus();
    }
  });

  // Link cepat dibuka langsung dari daftar: tetap dihitung sebagai tayangan
  document.addEventListener("click", (e) => {
    const a = e.target.closest(".quick a[data-id]");
    if (a) window.KB_countView && window.KB_countView(a.dataset.id);
  });

  /* ---------- Mulai ---------- */
  qInput.value = state.q;
  setPressed("kind", state.kind);
  setPressed("sort", state.sort);
  loadCategories();
  refresh();
})();
