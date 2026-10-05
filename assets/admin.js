/* Panel admin: login, daftar, tambah/edit/hapus postingan */
(function () {
  const { sb, configured, KINDS, esc, kbCode, date, views, copy, brand } = window.KB;
  brand();
  const $ = (s) => document.querySelector(s);
  const views_ = { login: $("#loginView"), notAdmin: $("#notAdminView"), list: $("#listView"), edit: $("#editView") };
  function show(name) {
    Object.entries(views_).forEach(([k, el]) => (el.hidden = k !== name));
    window.scrollTo(0, 0);
  }

  if (!configured || !sb) { $("#setupNotice").hidden = false; return; }

  let posts = [];
  let editing = null; // null = baru, objek = sedang diedit

  /* ---------- Sesi ---------- */
  async function route() {
    const { data: { session } } = await sb.auth.getSession();
    $("#logoutBtn").hidden = !session;
    if (!session) return show("login");
    const { data: isAdmin } = await sb.rpc("is_admin");
    if (!isAdmin) {
      $("#grantSql").textContent = `insert into public.admins (user_id) values ('${session.user.id}');`;
      return show("notAdmin");
    }
    show("list");
    loadList();
  }

  $("#loginForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const msg = $("#loginMsg"), btn = $("#loginBtn");
    msg.hidden = true; btn.disabled = true; btn.textContent = "Memeriksa…";
    const { error } = await sb.auth.signInWithPassword({ email: $("#email").value.trim(), password: $("#password").value });
    btn.disabled = false; btn.textContent = "Masuk";
    if (error) {
      msg.textContent = /invalid/i.test(error.message)
        ? "Email atau password salah. Periksa lalu coba lagi."
        : "Gagal masuk: " + error.message;
      msg.hidden = false;
      return;
    }
    $("#password").value = "";
    route();
  });

  $("#logoutBtn").addEventListener("click", async () => { await sb.auth.signOut(); route(); });
  $("#copyGrant").addEventListener("click", (e) => copy($("#grantSql").textContent, e.currentTarget));

  /* ---------- Daftar ---------- */
  async function loadList() {
    const { data, error } = await sb.from("posts")
      .select("id, code, title, kind, category, tags, summary, content, links, views, published, created_at, updated_at")
      .order("created_at", { ascending: false });
    if (error) {
      $("#rows").innerHTML = `<tr><td colspan="7">Gagal memuat: ${esc(error.message)}</td></tr>`;
      return;
    }
    posts = data;
    renderRows();
    const cats = [...new Set(posts.map((p) => p.category).concat(["Printer", "Jaringan", "Email & Akun", "Software", "Hardware", "Remote"]))].sort();
    $("#catList").innerHTML = cats.map((c) => `<option value="${esc(c)}">`).join("");
  }

  function renderRows() {
    const f = $("#filter").value.trim().toLowerCase();
    const rows = posts.filter((p) => !f ||
      (p.title + " " + p.category + " " + (p.tags || []).join(" ") + " " + kbCode(p.code)).toLowerCase().includes(f));
    $("#rows").innerHTML = rows.length ? rows.map((p) => `<tr>
        <td class="code">${kbCode(p.code)}</td>
        <td style="min-width:220px"><a href="/post?id=${p.id}" target="_blank" rel="noopener">${esc(p.title)}</a>${p.published ? "" : '<span class="draft">DRAF</span>'}</td>
        <td><span class="kind kind-${esc(p.kind)}">${(KINDS[p.kind] || KINDS.solusi).label}</span></td>
        <td>${esc(p.category)}</td>
        <td class="num">${views(p.views)}</td>
        <td style="white-space:nowrap">${date(p.updated_at)}</td>
        <td class="actions"><button class="btn-mini" type="button" data-edit="${p.id}">Edit</button></td>
      </tr>`).join("")
      : `<tr><td colspan="7">${posts.length ? "Tidak ada yang cocok dengan saringan." : "Belum ada postingan. Klik <b>+ Postingan baru</b> untuk mulai."}</td></tr>`;
  }

  $("#filter").addEventListener("input", renderRows);
  $("#rows").addEventListener("click", (e) => {
    const b = e.target.closest("[data-edit]");
    if (b) openEditor(posts.find((p) => p.id === b.dataset.edit));
  });
  $("#newBtn").addEventListener("click", () => openEditor(null));

  function flash(text) {
    const m = $("#listMsg");
    m.textContent = text; m.hidden = false;
    clearTimeout(flash.t); flash.t = setTimeout(() => (m.hidden = true), 4000);
  }

  /* ---------- Editor ---------- */
  function linkRow(l = { label: "", url: "" }) {
    const row = document.createElement("div");
    row.className = "link-edit";
    row.innerHTML = `
      <input class="input input-label" placeholder="Nama tombol, mis. Driver HP" value="${esc(l.label)}" aria-label="Nama link">
      <input class="input input-url" type="url" inputmode="url" placeholder="https://…" value="${esc(l.url)}" aria-label="Alamat link">
      <button class="btn btn-ghost" type="button" aria-label="Hapus link">✕</button>`;
    row.querySelector("button").addEventListener("click", () => row.remove());
    return row;
  }

  function openEditor(p) {
    editing = p;
    $("#editTitle").textContent = p ? `Edit ${kbCode(p.code)}` : "Postingan baru";
    $("#f_title").value = p?.title || "";
    $("#f_kind").value = p?.kind || "solusi";
    $("#f_category").value = p?.category || "";
    $("#f_summary").value = p?.summary || "";
    $("#f_content").value = p?.content || "";
    $("#f_tags").value = (p?.tags || []).join(", ");
    $("#f_published").checked = p ? p.published : true;
    const le = $("#linksEditor"); le.innerHTML = "";
    const links = p?.links?.length ? p.links : [{ label: "", url: "" }];
    links.forEach((l) => le.appendChild(linkRow(l)));
    $("#editMsg").hidden = true;
    renderDelete(false);
    show("edit");
    $("#f_title").focus();
  }

  function renderDelete(confirming) {
    const z = $("#deleteZone");
    if (!editing) { z.innerHTML = ""; return; }
    z.innerHTML = confirming
      ? `<span class="confirm-row">Hapus permanen? <button class="btn btn-danger" type="button" id="delYes">Ya, hapus</button><button class="btn" type="button" id="delNo">Tidak</button></span>`
      : `<button class="btn btn-danger" type="button" id="delBtn">Hapus</button>`;
    if (confirming) {
      $("#delYes").addEventListener("click", doDelete);
      $("#delNo").addEventListener("click", () => renderDelete(false));
    } else {
      $("#delBtn").addEventListener("click", () => renderDelete(true));
    }
  }

  async function doDelete() {
    const { error } = await sb.from("posts").delete().eq("id", editing.id);
    if (error) return showErr("Gagal menghapus: " + error.message);
    flash(`${kbCode(editing.code)} dihapus.`);
    show("list"); loadList();
  }

  $("#addLink").addEventListener("click", () => {
    const r = linkRow(); $("#linksEditor").appendChild(r); r.querySelector("input").focus();
  });
  const back = () => { show("list"); };
  $("#cancelBtn").addEventListener("click", back);
  $("#cancelBtn2").addEventListener("click", back);

  function showErr(t) { const m = $("#editMsg"); m.textContent = t; m.hidden = false; m.scrollIntoView({ block: "center" }); }

  $("#editForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const title = $("#f_title").value.trim();
    const category = $("#f_category").value.trim();
    if (title.length < 3) return showErr("Judul minimal 3 karakter.");
    if (!category) return showErr("Isi kategori, misalnya Printer atau Jaringan.");

    const links = [];
    for (const row of $("#linksEditor").querySelectorAll(".link-edit")) {
      const label = row.querySelector(".input-label").value.trim();
      let url = row.querySelector(".input-url").value.trim();
      if (!label && !url) continue;
      if (url && !/^[a-z]+:\/\//i.test(url)) url = "https://" + url;
      if (!window.KB.safeUrl(url)) return showErr(`Alamat link "${url || label}" tidak valid. Contoh yang benar: https://contoh.com/unduh`);
      links.push({ label: label || url, url });
    }

    const payload = {
      title, category,
      kind: $("#f_kind").value,
      summary: $("#f_summary").value.trim() || null,
      content: $("#f_content").value.trim() || null,
      tags: [...new Set($("#f_tags").value.split(",").map((t) => t.trim().toLowerCase()).filter(Boolean))],
      links,
      published: $("#f_published").checked,
    };

    const btn = $("#saveBtn");
    btn.disabled = true; btn.textContent = "Menyimpan…";
    const res = editing
      ? await sb.from("posts").update(payload).eq("id", editing.id).select("code").single()
      : await sb.from("posts").insert(payload).select("code").single();
    btn.disabled = false; btn.textContent = "Simpan";
    if (res.error) return showErr("Gagal menyimpan: " + res.error.message);
    flash(`${kbCode(res.data.code)} ${editing ? "diperbarui" : "ditambahkan"}${payload.published ? "" : " sebagai draf"}.`);
    show("list"); loadList();
  });

  sb.auth.onAuthStateChange((evt) => { if (evt === "SIGNED_OUT") route(); });
  route();
})();
