/* Friendly Fridge — vanilla JS + localStorage */

const STORAGE_KEY = "friendly_fridge_items_v1";

const CATEGORIES = [
  { key: "vegetables", label: "Légumes", icon: "🥦", theme: "green" },
  { key: "fruits", label: "Fruits", icon: "🍑", theme: "orange" },
  { key: "proteins", label: "Protéines", icon: "🥩", theme: "red" },
  { key: "sides", label: "Accompagnements", icon: "🍞", theme: "yellow" },
];

function uid() {
  return Math.random().toString(16).slice(2) + Date.now().toString(16);
}

function loadItems() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveItems(items) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
}

function dateToISO(d) {
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function daysUntil(isoDate) {
  // Normalize to midnight to avoid timezone surprises
  const today = new Date();
  const t0 = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const [y, m, d] = isoDate.split("-").map(Number);
  const target = new Date(y, m - 1, d);
  const ms = target.getTime() - t0.getTime();
  return Math.round(ms / (1000 * 60 * 60 * 24));
}

function statusForExpiry(isoDate) {
  const d = daysUntil(isoDate);
  if (d <= 1) return { kind: "red", text: d < 0 ? "expiré" : "expire bientôt" };
  if (d <= 5) return { kind: "yellow", text: "moins de 5 jours" };
  return { kind: "ok", text: `${d} jours` };
}

function prettyDate(isoDate) {
  const [y, m, d] = isoDate.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  return dt.toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric" });
}

function computeCategoryBadge(items, catKey) {
  // If any item is red => red; else if any yellow => yellow; else transparent.
  const catItems = items.filter((x) => x.category === catKey);
  let hasRed = false;
  let hasYellow = false;
  for (const it of catItems) {
    const st = statusForExpiry(it.expiry);
    if (st.kind === "red") hasRed = true;
    else if (st.kind === "yellow") hasYellow = true;
  }
  if (hasRed) return "red";
  if (hasYellow) return "yellow";
  return "none";
}

/* UI */
const binsGrid = document.getElementById("binsGrid");
const openAddBtn = document.getElementById("openAddBtn");

const binModal = document.getElementById("binModal");
const closeBinModal = document.getElementById("closeBinModal");
const binModalCloseBtn = document.getElementById("binModalCloseBtn");
const binModalAddBtn = document.getElementById("binModalAddBtn");
const binModalTitle = document.getElementById("binModalTitle");
const binModalSubtitle = document.getElementById("binModalSubtitle");
const binList = document.getElementById("binList");
const binEmpty = document.getElementById("binEmpty");

const addModal = document.getElementById("addModal");
const closeAddModal = document.getElementById("closeAddModal");
const addCancelBtn = document.getElementById("addCancelBtn");
const addForm = document.getElementById("addForm");
const fCategory = document.getElementById("fCategory");
const fName = document.getElementById("fName");
const fQty = document.getElementById("fQty");
const fExpiry = document.getElementById("fExpiry");

let state = {
  items: loadItems(),
  activeCategory: null,
};

function openModal(el) {
  el.classList.add("open");
  el.setAttribute("aria-hidden", "false");
}

function closeModal(el) {
  el.classList.remove("open");
  el.setAttribute("aria-hidden", "true");
}

function renderBins() {
  binsGrid.innerHTML = "";

  for (const cat of CATEGORIES) {
    const count = state.items.filter((x) => x.category === cat.key).length;
    const badge = computeCategoryBadge(state.items, cat.key);

    const bin = document.createElement("div");
    bin.className = `bin ${cat.theme}`;
    bin.setAttribute("role", "button");
    bin.setAttribute("tabindex", "0");
    bin.dataset.category = cat.key;

    const badgeEl = document.createElement("div");
    badgeEl.className = "binBadge";
    if (badge === "red") badgeEl.style.background = "var(--red)";
    else if (badge === "yellow") badgeEl.style.background = "var(--yellow)";
    else badgeEl.style.background = "transparent";

    const icon = document.createElement("div");
    icon.className = "binIcon";
    icon.textContent = cat.icon;

    const name = document.createElement("div");
    name.className = "binName";
    name.textContent = cat.label;

    const cnt = document.createElement("div");
    cnt.className = "binCount";
    cnt.textContent = `${count} article${count > 1 ? "s" : ""}`;

    bin.appendChild(badgeEl);
    bin.appendChild(icon);
    bin.appendChild(name);
    bin.appendChild(cnt);

    bin.addEventListener("click", () => openCategory(cat.key));
    bin.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") openCategory(cat.key);
    });

    binsGrid.appendChild(bin);
  }
}

function renderCategoryModal(catKey) {
  const cat = CATEGORIES.find((c) => c.key === catKey);
  const items = state.items
    .filter((x) => x.category === catKey)
    .slice()
    // sort: soonest expiry first
    .sort((a, b) => a.expiry.localeCompare(b.expiry));

  binModalTitle.textContent = cat ? cat.label : "Contenu";
  binModalSubtitle.textContent = items.length
    ? `${items.length} ingrédient${items.length > 1 ? "s" : ""}`
    : `Aucun ingrédient`;

  binList.innerHTML = "";
  if (!items.length) {
    binEmpty.hidden = false;
    return;
  }
  binEmpty.hidden = true;

  for (const it of items) {
    const st = statusForExpiry(it.expiry);

    const row = document.createElement("div");
    row.className = "item";

    const main = document.createElement("div");
    main.className = "itemMain";

    const n = document.createElement("div");
    n.className = "itemName";
    n.textContent = it.name;

    const meta = document.createElement("div");
    meta.className = "itemMeta";
    meta.textContent = `${it.qty} • valide jusqu’au ${prettyDate(it.expiry)}`;

    main.appendChild(n);
    main.appendChild(meta);

    const right = document.createElement("div");
    right.className = "itemRight";

    const pill = document.createElement("div");
    pill.className = `pill ${st.kind}`;
    pill.textContent = st.text;

    const trash = document.createElement("button");
    trash.className = "trashBtn";
    trash.setAttribute("aria-label", "Supprimer");
    trash.textContent = "🗑️";
    trash.addEventListener("click", () => deleteItem(it.id));

    right.appendChild(pill);
    right.appendChild(trash);

    row.appendChild(main);
    row.appendChild(right);

    binList.appendChild(row);
  }
}

function openCategory(catKey) {
  state.activeCategory = catKey;
  renderCategoryModal(catKey);
  openModal(binModal);
}

function openAdd(categoryPref = null) {
  // default expiry: today
  fExpiry.value = dateToISO(new Date());
  fName.value = "";
  fQty.value = "";
  if (categoryPref) fCategory.value = categoryPref;
  openModal(addModal);
  setTimeout(() => fName.focus(), 0);
}

function addItem({ category, name, qty, expiry }) {
  const item = {
    id: uid(),
    category,
    name: name.trim(),
    qty: qty.trim(),
    expiry,
    createdAt: Date.now(),
  };
  state.items = [item, ...state.items];
  saveItems(state.items);
  renderBins();
  if (state.activeCategory) renderCategoryModal(state.activeCategory);
}

function deleteItem(id) {
  state.items = state.items.filter((x) => x.id !== id);
  saveItems(state.items);
  renderBins();
  if (state.activeCategory) renderCategoryModal(state.activeCategory);
}

function wireModalBasics() {
  // close on overlay click
  binModal.addEventListener("click", (e) => {
    if (e.target === binModal) closeModal(binModal);
  });
  addModal.addEventListener("click", (e) => {
    if (e.target === addModal) closeModal(addModal);
  });

  // close buttons
  closeBinModal.addEventListener("click", () => closeModal(binModal));
  binModalCloseBtn.addEventListener("click", () => closeModal(binModal));
  closeAddModal.addEventListener("click", () => closeModal(addModal));
  addCancelBtn.addEventListener("click", () => closeModal(addModal));

  // bin modal "add here"
  binModalAddBtn.addEventListener("click", () => {
    closeModal(binModal);
    openAdd(state.activeCategory);
  });

  // escape closes
  document.addEventListener("keydown", (e) => {
    if (e.key !== "Escape") return;
    if (binModal.classList.contains("open")) closeModal(binModal);
    if (addModal.classList.contains("open")) closeModal(addModal);
  });
}

/* Init */
openAddBtn.addEventListener("click", () => openAdd());

addForm.addEventListener("submit", (e) => {
  e.preventDefault();

  const category = fCategory.value;
  const name = fName.value;
  const qty = fQty.value;
  const expiry = fExpiry.value;

  // basic validation
  if (!category || !name.trim() || !qty.trim() || !expiry) return;

  addItem({ category, name, qty, expiry });
  closeModal(addModal);

  // If user was browsing a category, keep flow tight:
  if (state.activeCategory) {
    renderCategoryModal(state.activeCategory);
    openModal(binModal);
  }
});

async function generateRecipesFromInventory(selectedItems, preferences) {
  const ingredientList = selectedItems.map(it => `${it.name} (${it.qty})`).join(", ");

  const prompt = `Tu es un chef cuisinier passionné. Génère ${preferences.count || 2} recette(s) avec ces ingrédients du frigo :

**Ingrédients disponibles :** ${ingredientList}
**Appareils :** ${preferences.appliances?.join(", ") || "four, plaques"}
**Durée max :** ${preferences.time || 30} minutes
**Difficulté :** ${preferences.difficulty || "facile"}
**Régime :** ${preferences.diet || "aucun"}

Pour chaque recette :

## 🍽️ [Nom de la recette]
**⏱ Temps :** X min | **👨‍🍳 Difficulté :** ${preferences.difficulty || "facile"} | **🍴 Portions :** X pers.

**📝 Ingrédients :**
- [ingrédient + quantité]

**👨‍🍳 Préparation :**
1. [étape]

**💡 Astuce du chef :** [conseil]

---

Utilise sel, poivre, huile et eau si besoin.`;

  const res = await fetch("./netlify/functions/claude-proxy", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      messages: [{ role: "user", content: prompt }]
    })
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.error || "Erreur génération recettes");
  }
  const data = await res.json();
  return { text: data.content?.[0]?.text || "Aucune recette générée." };
}

/* ── RECIPE MODAL ─────────────────────────────────────── */
function buildRecipeModal() {
  if (document.getElementById("recipeModal")) return;

  document.head.insertAdjacentHTML("beforeend", `<style>
    #recipeModal{position:fixed;inset:0;background:rgba(0,0,0,.45);display:flex;align-items:center;justify-content:center;z-index:1000;opacity:0;pointer-events:none;transition:opacity .25s}
    #recipeModal.open{opacity:1;pointer-events:all}
    #recipeModalBox{background:#fff;border-radius:20px;padding:32px;width:min(680px,95vw);max-height:88vh;overflow-y:auto;position:relative;transform:translateY(20px);transition:transform .25s}
    #recipeModal.open #recipeModalBox{transform:translateY(0)}
    #recipeModalBox h2{font-size:1.3rem;margin-bottom:4px}
    #recipeModalBox p.sub{font-size:.82rem;color:#888;margin-bottom:20px}
    .rPrefRow{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:16px}
    .rPrefRow select{padding:9px 12px;border:1.5px solid #eee;border-radius:10px;font-family:inherit;font-size:.85rem;width:100%}
    .rAppliances{display:flex;flex-wrap:wrap;gap:8px;margin-bottom:20px}
    .rAppliance{padding:7px 14px;border:1.5px solid #eee;border-radius:20px;font-size:.78rem;cursor:pointer;background:#fafaf8;transition:all .15s}
    .rAppliance.on{border-color:#2D6A4F;background:#D8F3DC;color:#2D6A4F;font-weight:600}
    #recipeGenBtn{width:100%;padding:14px;background:linear-gradient(135deg,#2D6A4F,#52B788);color:#fff;border:none;border-radius:12px;font-size:1rem;font-weight:700;cursor:pointer;margin-bottom:16px}
    #recipeGenBtn:disabled{opacity:.55;cursor:not-allowed}
    #recipeOutput{font-size:.92rem;line-height:1.8}
    #recipeOutput h2{color:#2D6A4F;font-size:1.2rem;margin:20px 0 4px}
    #recipeOutput strong{color:#2D6A4F}
    #recipeOutput ul{padding-left:20px;margin:6px 0}
    #recipeOutput li{margin-bottom:3px}
    #recipeOutput hr{border:none;border-top:2px dashed #eee;margin:20px 0}
    .rCloseBtn{position:absolute;top:16px;right:18px;background:none;border:none;font-size:1.4rem;cursor:pointer;color:#aaa}
    .rLoader{text-align:center;padding:30px;color:#888;font-style:italic}
    .rDots{display:flex;gap:8px;justify-content:center;margin-bottom:12px}
    .rDots span{width:9px;height:9px;border-radius:50%;background:#52B788;animation:rBounce 1.2s infinite ease-in-out}
    .rDots span:nth-child(2){animation-delay:.2s}.rDots span:nth-child(3){animation-delay:.4s}
    @keyframes rBounce{0%,80%,100%{transform:translateY(0);opacity:.4}40%{transform:translateY(-10px);opacity:1}}
  </style>`);

  document.body.insertAdjacentHTML("beforeend", `
    <div id="recipeModal" aria-hidden="true">
      <div id="recipeModalBox">
        <button class="rCloseBtn" id="closeRecipeModal">✕</button>
        <h2>✨ Générer des recettes</h2>
        <p class="sub">Basé sur les <strong id="rItemCount">0</strong> ingrédients de ton frigo</p>
        <div class="rPrefRow">
          <div>
            <label style="font-size:.78rem;font-weight:600;color:#888;display:block;margin-bottom:5px">Durée max</label>
            <select id="rTime"><option value="15">15 min</option><option value="30" selected>30 min</option><option value="45">45 min</option><option value="60">1 heure</option></select>
          </div>
          <div>
            <label style="font-size:.78rem;font-weight:600;color:#888;display:block;margin-bottom:5px">Difficulté</label>
            <select id="rDiff"><option value="facile" selected>Facile</option><option value="moyen">Intermédiaire</option><option value="difficile">Avancé</option></select>
          </div>
          <div>
            <label style="font-size:.78rem;font-weight:600;color:#888;display:block;margin-bottom:5px">Nb de recettes</label>
            <select id="rCount"><option value="1">1</option><option value="2" selected>2</option><option value="3">3</option></select>
          </div>
          <div>
            <label style="font-size:.78rem;font-weight:600;color:#888;display:block;margin-bottom:5px">Régime</label>
            <select id="rDiet"><option value="aucun">Aucun</option><option value="végétarien">Végétarien</option><option value="vegan">Vegan</option><option value="sans-gluten">Sans gluten</option></select>
          </div>
        </div>
        <label style="font-size:.78rem;font-weight:600;color:#888;display:block;margin-bottom:8px">Appareils disponibles</label>
        <div class="rAppliances">
          <span class="rAppliance on" data-id="four">🔥 Four</span>
          <span class="rAppliance on" data-id="plaques">🍳 Plaques</span>
          <span class="rAppliance" data-id="micro-ondes">📡 Micro-ondes</span>
          <span class="rAppliance" data-id="air-fryer">💨 Air Fryer</span>
          <span class="rAppliance" data-id="mixeur">🌀 Mixeur</span>
          <span class="rAppliance" data-id="vapeur">♨️ Vapeur</span>
        </div>
        <button id="recipeGenBtn">🍽️ Générer mes recettes</button>
        <div id="recipeOutput"></div>
      </div>
    </div>
  `);

  document.querySelectorAll(".rAppliance").forEach(el =>
    el.addEventListener("click", () => el.classList.toggle("on"))
  );
  document.getElementById("closeRecipeModal").addEventListener("click", () =>
    document.getElementById("recipeModal").classList.remove("open")
  );
  document.getElementById("recipeModal").addEventListener("click", (e) => {
    if (e.target === document.getElementById("recipeModal"))
      document.getElementById("recipeModal").classList.remove("open");
  });
  document.getElementById("recipeGenBtn").addEventListener("click", async () => {
    if (!state.items.length) { alert("Ton frigo est vide !"); return; }
    const preferences = {
      time:       document.getElementById("rTime").value,
      difficulty: document.getElementById("rDiff").value,
      count:      document.getElementById("rCount").value,
      diet:       document.getElementById("rDiet").value,
      appliances: [...document.querySelectorAll(".rAppliance.on")].map(e => e.dataset.id),
    };
    const btn = document.getElementById("recipeGenBtn");
    const output = document.getElementById("recipeOutput");
    btn.disabled = true;
    output.innerHTML = `<div class="rLoader"><div class="rDots"><span></span><span></span><span></span></div>L'IA cuisine vos recettes…</div>`;
    try {
      const result = await generateRecipesFromInventory(state.items, preferences);
      output.innerHTML = renderRecipeMarkdown(result.text);
    } catch (err) {
      output.innerHTML = `<p style="color:#E76F51">⚠️ ${err.message}</p>`;
    } finally {
      btn.disabled = false;
    }
  });
}

function renderRecipeMarkdown(text) {
  return text
    .replace(/^## (.+)$/gm, "<h2>$1</h2>")
    .replace(/^### (.+)$/gm, "<h3>$1</h3>")
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/^---$/gm, "<hr/>")
    .replace(/^\d+\. (.+)$/gm, "<li>$1</li>")
    .replace(/^- (.+)$/gm, "<li>$1</li>")
    .replace(/(<li>[\s\S]*?<\/li>)/g, "<ul>$1</ul>")
    .replace(/\n{2,}/g, "<br/><br/>");
}

function openRecipeModal() {
  buildRecipeModal();
  document.getElementById("rItemCount").textContent = state.items.length;
  document.getElementById("recipeOutput").innerHTML = "";
  document.getElementById("recipeModal").classList.add("open");
  document.getElementById("recipeModal").setAttribute("aria-hidden", "false");
}

wireModalBasics();
renderBins();

// Bouton IA — on l'ajoute après le rendu initial
const recipeBtn = document.createElement("button");
recipeBtn.id = "openRecipeBtn";
recipeBtn.textContent = "✨ Générer des recettes";
recipeBtn.style.cssText = "display:block;margin:24px auto 0;padding:14px 32px;background:linear-gradient(135deg,#2D6A4F,#52B788);color:#fff;border:none;border-radius:14px;font-size:1rem;font-weight:700;cursor:pointer;letter-spacing:.3px;box-shadow:0 4px 16px rgba(45,106,79,.25)";
recipeBtn.addEventListener("click", openRecipeModal);
document.getElementById("binsGrid").insertAdjacentElement("afterend", recipeBtn);