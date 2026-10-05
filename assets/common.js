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
     - `kode` jadi teks kode
     - URL otomatis jadi link
     - baris kosong memisahkan paragraf */
  function inline(text) {
    let out = esc(text);
    out = out.replace(/`([^`]+)`/g, '<code>$1</code>');
    out = out.replace(/(^|[\s(])(https?:\/\/[^\s<)]+)/g, (m, pre, url) => {
      const clean = url.replace(/[.,;:]+$/, "");
      const tail = url.slice(clean.length);
      return `${pre}<a href="${clean}" target="_blank" rel="noopener">${clean}</a>${tail}`;
    });
    return out;
  }

  function renderContent(src) {
    const lines = String(src || "").replace(/\r/g, "").split("\n");
    const html = [];
    let list = null, para = [];
    const flushPara = () => { if (para.length) { html.push("<p>" + para.map(inline).join("<br>") + "</p>"); para = []; } };
    const flushList = () => { if (list) { html.push(`<${list.type}>` + list.items.map((i) => "<li>" + inline(i) + "</li>").join("") + `</${list.type}>`); list = null; } };
    for (const raw of lines) {
      const line = raw.trimEnd();
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

  function brand() {
    document.querySelectorAll("[data-site-name]").forEach((el) => (el.textContent = cfg.SITE_NAME || "Pusat Solusi IT"));
    document.querySelectorAll("[data-site-tagline]").forEach((el) => (el.textContent = cfg.SITE_TAGLINE || ""));
  }

  window.KB = { sb, cfg, configured, KINDS, esc, safeUrl, kbCode, date, ago, views, renderContent, copy, lsGet, lsSet, brand };
})();
