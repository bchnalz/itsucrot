/* Fungsi bersama untuk halaman publik dan admin */
(function () {
  const cfg = window.APP_CONFIG || {};
  const configured =
    cfg.SUPABASE_URL && !cfg.SUPABASE_URL.includes("XXXX") &&
    cfg.SUPABASE_ANON_KEY && !cfg.SUPABASE_ANON_KEY.startsWith("ISI_");

  const sb = configured && window.supabase
    ? window.supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_ANON_KEY)
    : null;

  const KINDS = {
    solusi:  { label: "Solusi",  tag: "SOL" },
    software:{ label: "Software", tag: "SW"  },
    panduan: { label: "Panduan", tag: "PDN" },
  };

  function esc(s) {
    return String(s ?? "").replace(/[&<>"']/g, (c) => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
    }[c]));
  }

  function safeUrl(u) {
    try {
      const url = new URL(String(u).trim());
      return ["http:", "https:", "ftp:"].includes(url.protocol) ? url.href : null;
    } catch { return null; }
  }

  function kbCode(n) { return "KB-" + String(n ?? 0).padStart(4, "0"); }

  const fmtDate = new Intl.DateTimeFormat("id-ID", { day: "numeric", month: "short", year: "numeric" });
  function date(d) { return d ? fmtDate.format(new Date(d)) : ""; }

  function ago(d) {
    if (!d) return "";
    const s = (Date.now() - new Date(d).getTime()) / 1000;
    if (s < 60) return "baru saja";
    if (s < 3600) return Math.floor(s / 60) + " menit lalu";
    if (s < 86400) return Math.floor(s / 3600) + " jam lalu";
    if (s < 86400 * 7) return Math.floor(s / 86400) + " hari lalu";
    return date(d);
  }

  function views(n) {
    n = n || 0;
    return n >= 1000 ? (n / 1000).toFixed(n >= 10000 ? 0 : 1).replace(".", ",") + " rb" : String(n);
  }

  /* Format isi sederhana:
     - baris "1. ..." jadi daftar bernomor, "- ..." jadi daftar poin
     - `kode` jadi teks kode yang bisa diketuk untuk disalin
     - blok di antara baris ``` jadi kotak kode dengan tombol Salin
     - URL otomatis jadi link
     - baris kosong memisahkan paragraf */
  function inline(text) {
    // Pisahkan bagian kode dulu supaya URL di dalam kode tidak diubah jadi link
    return String(text).split(/(`[^`]+`)/g).map((part) => {
      if (/^`[^`]+`$/.test(part)) {
        return `<code class="tap-copy" role="button" tabindex="0" title="Ketuk untuk menyalin">${esc(part.slice(1, -1))}</code>`;
      }
      return esc(part).replace(/(^|[\s(])(https?:\/\/[^\s<)]+)/g, (m, pre, url) => {
        const clean = url.replace(/[.,;:]+$/, "");
        const tail = url.slice(clean.length);
        return `${pre}<a href="${clean}" target="_blank" rel="noopener">${clean}</a>${tail}`;
      });
    }).join("");
  }

  /* Kotak kode dengan tombol Salin. Dipakai untuk blok ``` di isi dan kolom "Perintah / kode". */
  function codeBlock(code, label) {
    const c = String(code ?? "").replace(/\r/g, "").replace(/^\n+|\s+$/g, "");
    return `<figure class="codebox">
      <figcaption>
        <span class="codebox-label">${label ? esc(label) : "Kode"}</span>
        <button class="copy-btn" type="button" data-copy-code>Salin</button>
      </figcaption>
      <pre><code>${esc(c)}</code></pre>
    </figure>`;
  }

  function renderContent(src) {
    const lines = String(src || "").replace(/\r/g, "").split("\n");
    const html = [];
    let list = null, para = [], fence = null;
    const flushPara = () => { if (para.length) { html.push("<p>" + para.map(inline).join("<br>") + "</p>"); para = []; } };
    const flushList = () => { if (list) { html.push(`<${list.type}>` + list.items.map((i) => "<li>" + inline(i) + "</li>").join("") + `</${list.type}>`); list = null; } };
    for (const raw of lines) {
      const line = raw.trimEnd();
      const fenceMatch = line.match(/^\s*```\s*(.*)$/);
      if (fence) {
        if (fenceMatch && !fenceMatch[1]) { html.push(codeBlock(fence.lines.join("\n"), fence.label)); fence = null; }
        else fence.lines.push(raw);
        continue;
      }
      if (fenceMatch) { flushPara(); flushList(); fence = { label: fenceMatch[1].trim(), lines: [] }; continue; }
      const ol = line.match(/^\s*\d+[.)]\s+(.*)$/);
      const ul = line.match(/^\s*[-*•]\s+(.*)$/);
      if (ol || ul) {
        flushPara();
        const type = ol ? "ol" : "ul";
        if (!list || list.type !== type) { flushList(); list = { type, items: [] }; }
        list.items.push((ol || ul)[1]);
      } else if (!line.trim()) {
        flushPara(); flushList();
      } else {
        flushList(); para.push(line);
      }
    }
    if (fence) html.push(codeBlock(fence.lines.join("\n"), fence.label)); // ``` lupa ditutup
    flushPara(); flushList();
    return html.join("");
  }

  async function copy(text, btn) {
    let ok = false;
    try { await navigator.clipboard.writeText(text); ok = true; }
    catch {
      const ta = document.createElement("textarea");
      ta.value = text; ta.style.position = "fixed"; ta.style.opacity = "0";
      document.body.appendChild(ta); ta.select();
      try { ok = document.execCommand("copy"); } catch { ok = false; }
      ta.remove();
    }
    if (btn) {
      const old = btn.textContent;
      btn.textContent = ok ? "Tersalin" : "Gagal salin";
      btn.classList.toggle("is-done", ok);
      setTimeout(() => { btn.textContent = old; btn.classList.remove("is-done"); }, 1500);
    }
    return ok;
  }

  function lsGet(k, d) { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch { return d; } }
  function lsSet(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* abaikan */ } }

  /* Hitung tayangan: satu kali per postingan per perangkat setiap 6 jam,
     supaya peringkat tidak naik hanya karena halaman dimuat ulang. */
  async function countView(id) {
    if (!sb || !id) return null;
    const seen = lsGet("kb:seen", {});
    const now = Date.now();
    for (const k in seen) if (now - seen[k] > 6 * 3600e3) delete seen[k];
    if (seen[id]) { lsSet("kb:seen", seen); return null; }
    seen[id] = now; lsSet("kb:seen", seen);
    const { data, error } = await sb.rpc("increment_view", { p_id: id });
    return error ? null : data;
  }
  window.KB_countView = countView;

  // Salin dengan sekali ketuk: tombol "Salin" di kotak kode dan teks `kode` di dalam isi
  function toast(text) {
    let t = document.getElementById("kbToast");
    if (!t) { t = document.createElement("div"); t.id = "kbToast"; t.className = "toast"; t.setAttribute("role", "status"); document.body.appendChild(t); }
    t.textContent = text; t.classList.add("show");
    clearTimeout(toast.h); toast.h = setTimeout(() => t.classList.remove("show"), 1600);
  }
  async function handleCopy(e) {
    const btn = e.target.closest("[data-copy-code]");
    if (btn) {
      const code = btn.closest(".codebox").querySelector("pre code").textContent;
      if (await copy(code, btn)) toast("Kode tersalin");
      return;
    }
    const tap = e.target.closest("code.tap-copy");
    if (tap && (e.type === "click" || e.key === "Enter" || e.key === " ")) {
      if (e.type === "keydown") e.preventDefault();
      if (await copy(tap.textContent)) {
        tap.classList.add("is-done"); setTimeout(() => tap.classList.remove("is-done"), 1200);
        toast("Tersalin: " + (tap.textContent.length > 40 ? tap.textContent.slice(0, 40) + "…" : tap.textContent));
      }
    }
  }
  document.addEventListener("click", handleCopy);
  document.addEventListener("keydown", (e) => { if (e.target.matches && e.target.matches("code.tap-copy")) handleCopy(e); });

  function brand() {
    document.querySelectorAll("[data-site-name]").forEach((el) => (el.textContent = cfg.SITE_NAME || "Pusat Solusi IT"));
    document.querySelectorAll("[data-site-tagline]").forEach((el) => (el.textContent = cfg.SITE_TAGLINE || ""));
  }

  window.KB = { sb, cfg, configured, KINDS, esc, safeUrl, kbCode, date, ago, views, renderContent, codeBlock, copy, lsGet, lsSet, brand };
})();
