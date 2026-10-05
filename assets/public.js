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

  const ICON_EYE = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/></svg>';
  const ICON_OUT = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"/></svg>';

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
