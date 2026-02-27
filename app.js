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
  const res = await fetch("https://TON-WORKER-URL.workers.dev", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      inventory: selectedItems,
      preferences
    })
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.error || "Recipe API failed");
  }
  return await res.json();
}

wireModalBasics();
renderBins();