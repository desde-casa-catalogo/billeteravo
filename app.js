import { firebaseConfig } from "./firebase-config.js";
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getAuth, onAuthStateChanged, signInWithEmailAndPassword,
  createUserWithEmailAndPassword, signOut
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import {
  getFirestore, collection, addDoc, deleteDoc, doc,
  onSnapshot, query, orderBy, serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

const CATEGORIES = {
  expense: ["Comida", "Transporte", "Vivienda", "Servicios", "Salud", "Ocio", "Otro"],
  income: ["Sueldo", "Venta", "Freelance", "Regalo", "Otro"]
};

let currentType = "expense";
let unsubscribeTx = null;
let allTx = [];

/* ---------- Auth UI ---------- */
const loginScreen = document.getElementById("login-screen");
const appScreen = document.getElementById("app-screen");
const authForm = document.getElementById("auth-form");
const authError = document.getElementById("auth-error");
const authSubmit = document.getElementById("auth-submit");
const authToggleBtn = document.getElementById("auth-toggle-btn");
const authToggleText = document.getElementById("auth-toggle-text");

let mode = "login"; // or "signup"

authToggleBtn.addEventListener("click", () => {
  mode = mode === "login" ? "signup" : "login";
  authSubmit.textContent = mode === "login" ? "Entrar" : "Crear cuenta";
  authToggleText.textContent = mode === "login" ? "¿Primera vez acá?" : "¿Ya tenés cuenta?";
  authToggleBtn.textContent = mode === "login" ? "Crear cuenta" : "Entrar";
  authError.textContent = "";
});

authForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  authError.textContent = "";
  const email = document.getElementById("email").value.trim();
  const password = document.getElementById("password").value;
  try {
    if (mode === "login") {
      await signInWithEmailAndPassword(auth, email, password);
    } else {
      await createUserWithEmailAndPassword(auth, email, password);
    }
  } catch (err) {
    authError.textContent = translateAuthError(err.code);
  }
});

document.getElementById("logout-btn").addEventListener("click", () => signOut(auth));

function translateAuthError(code) {
  const map = {
    "auth/invalid-email": "Correo inválido.",
    "auth/user-not-found": "No existe una cuenta con ese correo.",
    "auth/wrong-password": "Contraseña incorrecta.",
    "auth/invalid-credential": "Correo o contraseña incorrectos.",
    "auth/email-already-in-use": "Ya existe una cuenta con ese correo.",
    "auth/weak-password": "La contraseña debe tener al menos 6 caracteres."
  };
  return map[code] || "Ocurrió un error. Probá de nuevo.";
}

onAuthStateChanged(auth, (user) => {
  if (user) {
    loginScreen.classList.add("hidden");
    appScreen.classList.remove("hidden");
    startListening(user.uid);
  } else {
    appScreen.classList.add("hidden");
    loginScreen.classList.remove("hidden");
    if (unsubscribeTx) unsubscribeTx();
    allTx = [];
  }
});

/* ---------- Transaction form ---------- */
const typeButtons = document.querySelectorAll(".type-toggle button");
const categorySelect = document.getElementById("tx-category");
const txForm = document.getElementById("tx-form");
const dateInput = document.getElementById("tx-date");

dateInput.value = new Date().toISOString().slice(0, 10);
populateCategories();

typeButtons.forEach((btn) => {
  btn.addEventListener("click", () => {
    typeButtons.forEach((b) => b.classList.remove("active"));
    btn.classList.add("active");
    currentType = btn.dataset.type;
    populateCategories();
  });
});

function populateCategories() {
  categorySelect.innerHTML = CATEGORIES[currentType]
    .map((c) => `<option value="${c}">${c}</option>`)
    .join("");
}

txForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const user = auth.currentUser;
  if (!user) return;

  const amount = parseFloat(document.getElementById("tx-amount").value);
  const date = document.getElementById("tx-date").value;
  const category = categorySelect.value;
  const note = document.getElementById("tx-note").value.trim();

  if (!amount || amount <= 0) return;

  await addDoc(collection(db, "users", user.uid, "transactions"), {
    type: currentType,
    amount,
    date,
    category,
    note,
    createdAt: serverTimestamp()
  });

  txForm.reset();
  dateInput.value = new Date().toISOString().slice(0, 10);
  document.getElementById("tx-amount").focus();
});

/* ---------- Firestore listener ---------- */
function startListening(uid) {
  const q = query(collection(db, "users", uid, "transactions"), orderBy("date", "desc"));
  unsubscribeTx = onSnapshot(q, (snapshot) => {
    allTx = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
    populateMonthFilter();
    render();
  });
}

/* ---------- Filters ---------- */
const filterType = document.getElementById("filter-type");
const filterMonth = document.getElementById("filter-month");
filterType.addEventListener("change", render);
filterMonth.addEventListener("change", render);

function populateMonthFilter() {
  const months = [...new Set(allTx.map((t) => t.date.slice(0, 7)))].sort().reverse();
  const current = filterMonth.value;
  filterMonth.innerHTML =
    `<option value="all">Todos los meses</option>` +
    months.map((m) => `<option value="${m}">${formatMonth(m)}</option>`).join("");
  if (months.includes(current)) filterMonth.value = current;
}

function formatMonth(m) {
  const [y, mo] = m.split("-");
  const d = new Date(Number(y), Number(mo) - 1, 1);
  return d.toLocaleDateString("es-ES", { month: "long", year: "numeric" });
}

/* ---------- Render ---------- */
const ledgerList = document.getElementById("ledger-list");
const balanceAmount = document.getElementById("balance-amount");
const totalIncomeEl = document.getElementById("total-income");
const totalExpenseEl = document.getElementById("total-expense");

function money(n) {
  return "$" + n.toLocaleString("es-ES", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function render() {
  let filtered = allTx;
  if (filterType.value !== "all") filtered = filtered.filter((t) => t.type === filterType.value);
  if (filterMonth.value !== "all") filtered = filtered.filter((t) => t.date.slice(0, 7) === filterMonth.value);

  const income = allTx.filter((t) => t.type === "income").reduce((s, t) => s + t.amount, 0);
  const expense = allTx.filter((t) => t.type === "expense").reduce((s, t) => s + t.amount, 0);
  balanceAmount.textContent = money(income - expense);
  totalIncomeEl.textContent = money(income);
  totalExpenseEl.textContent = money(expense);

  if (filtered.length === 0) {
    ledgerList.innerHTML = `<div class="empty-state">No hay movimientos para este filtro.</div>`;
    return;
  }

  ledgerList.innerHTML = filtered
    .map((t) => {
      const sign = t.type === "income" ? "+" : "−";
      const dateFmt = new Date(t.date + "T00:00:00").toLocaleDateString("es-ES", {
        day: "2-digit", month: "short"
      });
      return `
        <div class="tx-row" data-id="${t.id}">
          <div class="tx-info">
            <div class="tx-cat">${escapeHtml(t.category)}</div>
            <div class="tx-meta">${dateFmt}${t.note ? " · " + escapeHtml(t.note) : ""}</div>
          </div>
          <div class="tx-right">
            <div class="tx-amount ${t.type}">${sign} ${money(t.amount)}</div>
            <button class="tx-delete" data-id="${t.id}" aria-label="Eliminar">×</button>
          </div>
        </div>`;
    })
    .join("");
}

ledgerList.addEventListener("click", async (e) => {
  const btn = e.target.closest(".tx-delete");
  if (!btn) return;
  const user = auth.currentUser;
  if (!user) return;
  await deleteDoc(doc(db, "users", user.uid, "transactions", btn.dataset.id));
});

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}
