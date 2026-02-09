import { useState, useEffect, useCallback, useMemo } from "react";

// ============================================================
// CONFIG
// ============================================================
const API = "https://finance-tracker-api-wz6y.onrender.com/api";

// ============================================================
// HELPERS
// ============================================================
const fmt = (n) => {
  const num = parseFloat(n) || 0;
  const abs = Math.abs(num);
  if (abs >= 10000000) return `${(num / 10000000).toFixed(2)} Cr`;
  if (abs >= 100000) return `${(num / 100000).toFixed(2)} L`;
  if (abs >= 1000) return `${(num / 1000).toFixed(1)} K`;
  return num.toLocaleString("en-IN", { maximumFractionDigits: 0 });
};

const fmtFull = (n) =>
  parseFloat(n || 0).toLocaleString("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  });

const fmtDate = (d) => {
  if (!d) return "";
  return new Date(d).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "2-digit" });
};

const fmtDateInput = (d) => {
  if (!d) return new Date().toISOString().split("T")[0];
  return new Date(d).toISOString().split("T")[0];
};

// Financial Year helpers (Apr-Mar)
const getCurrentFY = () => {
  const now = new Date();
  return now.getMonth() < 3 ? now.getFullYear() - 1 : now.getFullYear();
};

const getFYRange = (fy) => ({
  start: `${fy}-04-01`,
  end: `${fy + 1}-03-31`,
});

const getFYLabel = (fy) => `FY ${fy}-${(fy + 1).toString().slice(2)}`;

const MONTHS = ["Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec", "Jan", "Feb", "Mar"];
const getMonthRange = (fy, monthIdx) => {
  const year = monthIdx < 9 ? fy : fy + 1;
  const month = ((monthIdx + 3) % 12) + 1;
  const start = `${year}-${String(month).padStart(2, "0")}-01`;
  const nextMonth = month === 12 ? 1 : month + 1;
  const nextYear = month === 12 ? year + 1 : year;
  const end = `${nextYear}-${String(nextMonth).padStart(2, "0")}-01`;
  return { start, end };
};

const typeColors = { Asset: "#10b981", Liability: "#ef4444", Income: "#3b82f6", Expense: "#f59e0b", Equity: "#8b5cf6" };
const typeIcons = { Asset: "↗", Liability: "↙", Income: "＋", Expense: "－", Equity: "◎" };

// ============================================================
// API LAYER
// ============================================================
const api = {
  token: null,
  async call(method, path, body, isFormData) {
    const headers = {};
    if (!isFormData) headers["Content-Type"] = "application/json";
    if (this.token) headers["Authorization"] = `Bearer ${this.token}`;
    try {
      const res = await fetch(`${API}${path}`, { method, headers, body: isFormData ? body : body ? JSON.stringify(body) : undefined });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
      return data;
    } catch (err) {
      if (err.message?.includes("Failed to fetch")) throw new Error("Server waking up (~30s). Please retry.");
      throw err;
    }
  },
  login: (e, p) => api.call("POST", "/auth/login", { email: e, password: p }),
  register: (n, e, p) => api.call("POST", "/auth/register", { name: n, email: e, password: p }),
  me: () => api.call("GET", "/auth/me"),
  getAccounts: () => api.call("GET", "/accounts"),
  createAccount: (d) => api.call("POST", "/accounts", d),
  updateAccount: (id, d) => api.call("PUT", `/accounts/${id}`, d),
  deleteAccount: (id) => api.call("DELETE", `/accounts/${id}`),
  getTransactions: (p = "") => api.call("GET", `/transactions?${p}`),
  createTransaction: (d) => api.call("POST", "/transactions", d),
  updateTransaction: (id, d) => api.call("PUT", `/transactions/${id}`, d),
  deleteTransaction: (id) => api.call("DELETE", `/transactions/${id}`),
  getDashboard: () => api.call("GET", "/dashboard"),
  getFIRE: (p = "") => api.call("GET", `/analytics/fire?${p}`),
  getTaxSummary: (fy) => api.call("GET", `/analytics/tax-summary${fy ? `?financial_year=${fy}` : ""}`),
  importCSV: (formData) => {
    const headers = {};
    if (api.token) headers["Authorization"] = `Bearer ${api.token}`;
    return fetch(`${API}/transactions/import-csv`, { method: "POST", headers, body: formData }).then(r => r.json());
  },
};

// ============================================================
// ICONS (inline SVG)
// ============================================================
const I = {
  tx: <svg width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24"><path d="M7 10l5-6 5 6M7 14l5 6 5-6" strokeLinecap="round" strokeLinejoin="round"/></svg>,
  acc: <svg width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 10h18"/></svg>,
  dash: <svg width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>,
  rep: <svg width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24"><path d="M3 20h18M6 16V10M10 16V4M14 16V8M18 16V12" strokeLinecap="round"/></svg>,
  plus: <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.2" viewBox="0 0 24 24"><path d="M12 5v14M5 12h14" strokeLinecap="round"/></svg>,
  close: <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M18 6L6 18M6 6l12 12" strokeLinecap="round"/></svg>,
  search: <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><circle cx="11" cy="11" r="7"/><path d="M21 21l-4-4" strokeLinecap="round"/></svg>,
  trash: <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M3 6h18M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6" strokeLinecap="round"/></svg>,
  edit: <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" strokeLinecap="round" strokeLinejoin="round"/></svg>,
  logout: <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4M16 17l5-5-5-5M21 12H9" strokeLinecap="round" strokeLinejoin="round"/></svg>,
  filter: <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M22 3H2l8 9.46V19l4 2v-8.54L22 3z" strokeLinecap="round" strokeLinejoin="round"/></svg>,
  upload: <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M17 8l-5-5-5 5M12 3v12" strokeLinecap="round" strokeLinejoin="round"/></svg>,
  chev: <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M6 9l6 6 6-6" strokeLinecap="round" strokeLinejoin="round"/></svg>,
  chevR: <svg width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M9 18l6-6-6-6" strokeLinecap="round" strokeLinejoin="round"/></svg>,
  folder: <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24"><path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z"/></svg>,
};

// ============================================================
// THEME
// ============================================================
const T = {
  bg: "#f8f8f8", card: "#fff", border: "#e5e5e5", text: "#171717", textSec: "#737373", textTer: "#a3a3a3",
  accent: "#171717", accentLight: "#f5f5f5", success: "#10b981", danger: "#ef4444", warn: "#f59e0b", info: "#3b82f6",
  radius: "12px", radiusSm: "8px",
  font: "'DM Sans', -apple-system, sans-serif", mono: "'JetBrains Mono', 'SF Mono', monospace",
};

// ============================================================
// REUSABLE COMPONENTS
// ============================================================
const Spin = ({ s = 20 }) => <div style={{ width: s, height: s, border: `2px solid ${T.border}`, borderTopColor: T.accent, borderRadius: "50%", animation: "spin .6s linear infinite", display: "inline-block" }} />;

function Toast({ message, type, onClose }) {
  useEffect(() => { const t = setTimeout(onClose, 3500); return () => clearTimeout(t); }, [onClose]);
  const c = { success: T.success, error: T.danger, info: T.accent };
  return <div style={{ position: "fixed", top: 12, left: "50%", transform: "translateX(-50%)", background: c[type] || T.accent, color: "#fff", padding: "10px 20px", borderRadius: T.radiusSm, fontSize: 13, fontFamily: T.font, zIndex: 9999, animation: "slideDown .3s ease", maxWidth: "90vw" }}>{message}</div>;
}

const Empty = ({ icon, title, sub, action }) => (
  <div style={{ textAlign: "center", padding: "40px 20px", color: T.textSec }}>
    <div style={{ fontSize: 36, marginBottom: 8, opacity: 0.3 }}>{icon || "📭"}</div>
    <div style={{ fontSize: 14, fontWeight: 500, color: T.text, marginBottom: 4 }}>{title}</div>
    <div style={{ fontSize: 12, marginBottom: 14 }}>{sub}</div>
    {action}
  </div>
);

const Btn = ({ children, onClick, v = "primary", s = "md", disabled, loading, style: st, ...p }) => {
  const base = { fontFamily: T.font, fontWeight: 500, border: "none", cursor: disabled ? "not-allowed" : "pointer", display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 5, transition: "all .15s", opacity: disabled ? 0.5 : 1, borderRadius: T.radiusSm };
  const sz = { sm: { padding: "5px 10px", fontSize: 12 }, md: { padding: "9px 16px", fontSize: 13 }, lg: { padding: "12px 22px", fontSize: 14 } };
  const vr = { primary: { background: T.accent, color: "#fff" }, secondary: { background: T.accentLight, color: T.text }, ghost: { background: "transparent", color: T.textSec }, danger: { background: "#fef2f2", color: T.danger } };
  return <button onClick={onClick} disabled={disabled || loading} style={{ ...base, ...sz[s], ...vr[v], ...st }} {...p}>{loading ? <Spin s={14} /> : null}{children}</button>;
};

const Inp = ({ label, error, style: st, ...p }) => (
  <div style={{ marginBottom: 12 }}>
    {label && <label style={{ display: "block", fontSize: 11, fontWeight: 500, color: T.textSec, marginBottom: 3, fontFamily: T.font }}>{label}</label>}
    <input style={{ width: "100%", padding: "9px 11px", border: `1.5px solid ${error ? T.danger : T.border}`, borderRadius: T.radiusSm, fontSize: 13, fontFamily: T.font, background: "#fff", color: T.text, outline: "none", boxSizing: "border-box", ...st }} {...p} />
    {error && <div style={{ fontSize: 10, color: T.danger, marginTop: 2 }}>{error}</div>}
  </div>
);

const Sel = ({ label, options, style: st, ...p }) => (
  <div style={{ marginBottom: 12 }}>
    {label && <label style={{ display: "block", fontSize: 11, fontWeight: 500, color: T.textSec, marginBottom: 3, fontFamily: T.font }}>{label}</label>}
    <select style={{ width: "100%", padding: "9px 11px", border: `1.5px solid ${T.border}`, borderRadius: T.radiusSm, fontSize: 13, fontFamily: T.font, background: "#fff", color: T.text, outline: "none", boxSizing: "border-box", appearance: "none", backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%23737373' stroke-width='2'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E")`, backgroundRepeat: "no-repeat", backgroundPosition: "right 10px center", ...st }} {...p}>
      {options.map(o => typeof o === "string" ? <option key={o} value={o}>{o}</option> : <option key={o.value} value={o.value} disabled={o.disabled}>{o.label}</option>)}
    </select>
  </div>
);

function Modal({ open, onClose, title, children }) {
  if (!open) return null;
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.3)", backdropFilter: "blur(2px)", zIndex: 1000, display: "flex", alignItems: "flex-end", justifyContent: "center", animation: "fadeIn .2s" }} onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{ background: T.card, borderRadius: "18px 18px 0 0", width: "100%", maxWidth: 480, maxHeight: "88vh", overflow: "auto", animation: "slideUp .3s", padding: "18px 18px 30px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <h3 style={{ fontSize: 16, fontWeight: 600, margin: 0, fontFamily: T.font }}>{title}</h3>
          <button onClick={onClose} style={{ background: T.accentLight, border: "none", borderRadius: 8, padding: 5, cursor: "pointer", display: "flex" }}>{I.close}</button>
        </div>
        {children}
      </div>
    </div>
  );
}

const Card = ({ children, style: st, onClick }) => (
  <div onClick={onClick} style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: T.radius, padding: 14, cursor: onClick ? "pointer" : "default", ...st }}>{children}</div>
);

const Pill = ({ children, color = T.textSec, bg }) => (
  <span style={{ fontSize: 10, fontWeight: 500, padding: "2px 7px", borderRadius: 20, background: bg || `${color}18`, color, fontFamily: T.font, whiteSpace: "nowrap" }}>{children}</span>
);

// FY Selector
const FYSelector = ({ fy, setFy, month, setMonth }) => (
  <div style={{ display: "flex", gap: 6, marginBottom: 14, flexWrap: "wrap", alignItems: "center" }}>
    <select value={fy} onChange={e => { setFy(parseInt(e.target.value)); if (setMonth) setMonth(null); }} style={{ padding: "6px 28px 6px 10px", borderRadius: 20, border: `1.5px solid ${T.border}`, fontSize: 12, fontWeight: 500, fontFamily: T.font, background: T.accent, color: "#fff", appearance: "none", backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='10' viewBox='0 0 24 24' fill='none' stroke='white' stroke-width='2'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E")`, backgroundRepeat: "no-repeat", backgroundPosition: "right 8px center", cursor: "pointer" }}>
      {[2025, 2024, 2023, 2022, 2021, 2020].map(y => <option key={y} value={y}>{getFYLabel(y)}</option>)}
    </select>
    {setMonth && (
      <div style={{ display: "flex", gap: 3, overflowX: "auto", flex: 1 }}>
        <button onClick={() => setMonth(null)} style={{ padding: "4px 8px", borderRadius: 14, border: "none", fontSize: 10, fontWeight: 500, cursor: "pointer", fontFamily: T.font, background: month === null ? T.accent : T.accentLight, color: month === null ? "#fff" : T.textSec, whiteSpace: "nowrap" }}>All</button>
        {MONTHS.map((m, i) => (
          <button key={m} onClick={() => setMonth(i)} style={{ padding: "4px 8px", borderRadius: 14, border: "none", fontSize: 10, fontWeight: 500, cursor: "pointer", fontFamily: T.font, background: month === i ? T.accent : T.accentLight, color: month === i ? "#fff" : T.textSec, whiteSpace: "nowrap" }}>{m}</button>
        ))}
      </div>
    )}
  </div>
);

// ============================================================
// AUTH SCREEN
// ============================================================
function AuthScreen({ onLogin }) {
  const [isLogin, setIsLogin] = useState(true);
  const [form, setForm] = useState({ name: "", email: "", password: "" });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const submit = async () => {
    setError(""); setLoading(true);
    try {
      const data = isLogin ? await api.login(form.email, form.password) : await api.register(form.name, form.email, form.password);
      api.token = data.token; localStorage.setItem("ft_token", data.token); onLogin(data.user, data.token);
    } catch (e) { setError(e.message); }
    setLoading(false);
  };
  return (
    <div style={{ minHeight: "100vh", background: T.bg, display: "flex", alignItems: "center", justifyContent: "center", padding: 20, fontFamily: T.font }}>
      <div style={{ width: "100%", maxWidth: 360 }}>
        <div style={{ textAlign: "center", marginBottom: 32 }}>
          <div style={{ fontSize: 30, fontWeight: 700, letterSpacing: "-0.03em" }}>₹ tracker</div>
          <div style={{ fontSize: 13, color: T.textSec, marginTop: 4 }}>Personal finance companion</div>
        </div>
        <Card style={{ padding: 22 }}>
          <div style={{ display: "flex", marginBottom: 18, background: T.accentLight, borderRadius: T.radiusSm, padding: 3 }}>
            {["Login", "Register"].map(t => <button key={t} onClick={() => { setIsLogin(t === "Login"); setError(""); }} style={{ flex: 1, padding: "7px 0", border: "none", borderRadius: 6, fontSize: 12, fontWeight: 500, cursor: "pointer", fontFamily: T.font, background: (t === "Login") === isLogin ? "#fff" : "transparent", color: (t === "Login") === isLogin ? T.text : T.textSec, boxShadow: (t === "Login") === isLogin ? "0 1px 3px rgba(0,0,0,0.08)" : "none" }}>{t}</button>)}
          </div>
          {!isLogin && <Inp label="Name" placeholder="Your name" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />}
          <Inp label="Email" type="email" placeholder="you@example.com" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} />
          <Inp label="Password" type="password" placeholder="Min 8 characters" value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} onKeyDown={e => e.key === "Enter" && submit()} />
          {error && <div style={{ fontSize: 12, color: T.danger, marginBottom: 10, padding: "7px 10px", background: "#fef2f2", borderRadius: 6 }}>{error}</div>}
          <Btn onClick={submit} loading={loading} style={{ width: "100%", marginTop: 4 }} s="lg">{isLogin ? "Sign In" : "Create Account"}</Btn>
        </Card>
        <div style={{ textAlign: "center", fontSize: 11, color: T.textTer, marginTop: 14 }}>Free tier: first request may take ~30s</div>
      </div>
    </div>
  );
}

// ============================================================
// TRANSACTIONS TAB
// ============================================================
function TransactionsTab({ accounts, toast }) {
  const [txns, setTxns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState("");
  const [filterAcc, setFilterAcc] = useState("");
  const [fy, setFy] = useState(getCurrentFY());
  const [month, setMonth] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [editTx, setEditTx] = useState(null);
  const [showFilters, setShowFilters] = useState(false);

  const fetchTxns = useCallback(async () => {
    setLoading(true);
    try {
      let params = `page=${page}&limit=30&sort_by=date&sort_order=DESC`;
      if (search) params += `&search=${encodeURIComponent(search)}`;
      if (filterAcc) params += `&account_id=${filterAcc}`;
      if (month !== null) {
        const { start, end } = getMonthRange(fy, month);
        params += `&start_date=${start}&end_date=${end}`;
      } else {
        const { start, end } = getFYRange(fy);
        params += `&start_date=${start}&end_date=${end}`;
      }
      const data = await api.getTransactions(params);
      setTxns(data.transactions || []);
      setTotal(data.pagination?.total || 0);
    } catch (e) { toast(e.message, "error"); }
    setLoading(false);
  }, [page, search, filterAcc, fy, month, toast]);

  useEffect(() => { fetchTxns(); }, [fetchTxns]);
  useEffect(() => { setPage(1); }, [fy, month, filterAcc, search]);

  const handleDelete = async (id) => {
    if (!confirm("Delete this transaction?")) return;
    try { await api.deleteTransaction(id); toast("Deleted", "success"); fetchTxns(); } catch (e) { toast(e.message, "error"); }
  };

  const periodTotals = useMemo(() => {
    let inc = 0, exp = 0;
    txns.forEach(tx => {
      if (tx.credit_account_type === "Income") inc += parseFloat(tx.amount);
      if (tx.debit_account_type === "Expense") exp += parseFloat(tx.amount);
    });
    return { income: inc, expense: exp };
  }, [txns]);

  // Group transactions by date for display
  const groupedByDate = useMemo(() => {
    const groups = {};
    txns.forEach(tx => {
      const key = tx.date?.split("T")[0] || "unknown";
      if (!groups[key]) groups[key] = { date: key, txns: [], total: 0 };
      groups[key].txns.push(tx);
    });
    return Object.values(groups);
  }, [txns]);

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700, letterSpacing: "-0.02em" }}>Transactions</h2>
          <span style={{ fontSize: 12, color: T.textSec }}>{total.toLocaleString()} in {month !== null ? MONTHS[month] : getFYLabel(fy)}</span>
        </div>
        <div style={{ display: "flex", gap: 6 }}>
          <Btn v="secondary" s="sm" onClick={() => setShowImport(true)}>{I.upload} Import</Btn>
          <Btn s="sm" onClick={() => { setEditTx(null); setShowModal(true); }}>{I.plus} Add</Btn>
        </div>
      </div>

      <FYSelector fy={fy} setFy={setFy} month={month} setMonth={setMonth} />

      {/* Period Summary Cards */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginBottom: 12 }}>
        {[
          { l: "Income", v: periodTotals.income, c: T.success, prefix: "+" },
          { l: "Expense", v: periodTotals.expense, c: T.danger, prefix: "−" },
          { l: "Net", v: periodTotals.income - periodTotals.expense, c: periodTotals.income - periodTotals.expense >= 0 ? T.success : T.danger },
        ].map(x => (
          <Card key={x.l} style={{ padding: "8px 10px", textAlign: "center" }}>
            <div style={{ fontSize: 9, color: T.textSec, textTransform: "uppercase", letterSpacing: "0.05em" }}>{x.l}</div>
            <div style={{ fontSize: 14, fontWeight: 700, fontFamily: T.mono, color: x.c }}>{x.prefix || ""}₹{fmt(Math.abs(x.v))}</div>
          </Card>
        ))}
      </div>

      {/* Search + Filter */}
      <div style={{ display: "flex", gap: 6, marginBottom: 12 }}>
        <div style={{ flex: 1, position: "relative" }}>
          <div style={{ position: "absolute", left: 9, top: "50%", transform: "translateY(-50%)", color: T.textTer }}>{I.search}</div>
          <input placeholder="Search..." value={search} onChange={e => setSearch(e.target.value)} style={{ width: "100%", padding: "8px 10px 8px 30px", border: `1.5px solid ${T.border}`, borderRadius: T.radiusSm, fontSize: 13, fontFamily: T.font, background: "#fff", outline: "none", boxSizing: "border-box" }} />
        </div>
        <button onClick={() => setShowFilters(!showFilters)} style={{ padding: "8px 10px", border: `1.5px solid ${filterAcc ? T.accent : T.border}`, borderRadius: T.radiusSm, background: filterAcc ? T.accentLight : "#fff", cursor: "pointer", display: "flex", alignItems: "center", color: T.textSec }}>{I.filter}</button>
      </div>

      {showFilters && (
        <Card style={{ marginBottom: 12, padding: 10 }}>
          <Sel label="Filter by account" value={filterAcc} onChange={e => setFilterAcc(e.target.value)} options={[{ value: "", label: "All accounts" }, ...accounts.map(a => ({ value: a.account_id, label: `${a.account_name} (${a.account_type})` }))]} />
          {filterAcc && <Btn v="ghost" s="sm" onClick={() => setFilterAcc("")}>Clear filter</Btn>}
        </Card>
      )}

      {/* Transaction List - grouped by date */}
      {loading ? <div style={{ textAlign: "center", padding: 40 }}><Spin s={24} /></div>
        : txns.length === 0 ? <Empty icon="💸" title="No transactions" sub="Try a different period or add one" action={<Btn s="sm" onClick={() => { setEditTx(null); setShowModal(true); }}>{I.plus} Add</Btn>} />
        : <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
            {groupedByDate.map(group => (
              <div key={group.date}>
                {/* Date header */}
                <div style={{ fontSize: 11, fontWeight: 600, color: T.textTer, padding: "8px 4px 4px", position: "sticky", top: 44, background: T.bg, zIndex: 5 }}>
                  {new Date(group.date).toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short", year: "numeric" })}
                </div>
                {group.txns.map(tx => {
                  const isExp = tx.debit_account_type === "Expense";
                  const isInc = tx.credit_account_type === "Income";
                  const isTransfer = !isExp && !isInc;
                  const amtColor = isExp ? T.danger : isInc ? T.success : T.info;
                  const sign = isExp ? "−" : isInc ? "+" : "↔";
                  return (
                    <Card key={tx.transaction_id} style={{ padding: "10px 12px", marginBottom: 2 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 3 }}>
                            <span style={{ width: 7, height: 7, borderRadius: "50%", background: amtColor, flexShrink: 0, opacity: 0.8 }} />
                            <span style={{ fontSize: 13, fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                              {tx.description || tx.category || "Transaction"}
                            </span>
                          </div>
                          <div style={{ fontSize: 11, color: T.textSec, marginLeft: 13, marginBottom: 2 }}>
                            <span style={{ color: typeColors[tx.credit_account_type] || T.textSec }}>{tx.credit_account_name}</span>
                            <span style={{ margin: "0 4px", color: T.textTer }}>→</span>
                            <span style={{ color: typeColors[tx.debit_account_type] || T.textSec }}>{tx.debit_account_name}</span>
                          </div>
                          <div style={{ display: "flex", gap: 4, marginLeft: 13, alignItems: "center", flexWrap: "wrap" }}>
                            {tx.category && tx.category !== "Uncategorized" && <Pill>{tx.category}</Pill>}
                            {tx.tax_category && <Pill color={T.info}>§{tx.tax_category}</Pill>}
                            {isTransfer && <Pill color={T.info}>Transfer</Pill>}
                          </div>
                        </div>
                        <div style={{ textAlign: "right", flexShrink: 0 }}>
                          <div style={{ fontSize: 14, fontWeight: 600, fontFamily: T.mono, color: amtColor, letterSpacing: "-0.02em" }}>
                            {sign} ₹{fmt(tx.amount)}
                          </div>
                          <div style={{ display: "flex", gap: 3, marginTop: 4, justifyContent: "flex-end" }}>
                            <button onClick={() => { setEditTx(tx); setShowModal(true); }} style={{ background: T.accentLight, border: "none", borderRadius: 4, padding: 3, cursor: "pointer", display: "flex" }}>{I.edit}</button>
                            <button onClick={() => handleDelete(tx.transaction_id)} style={{ background: "#fef2f2", border: "none", borderRadius: 4, padding: 3, cursor: "pointer", display: "flex", color: T.danger }}>{I.trash}</button>
                          </div>
                        </div>
                      </div>
                    </Card>
                  );
                })}
              </div>
            ))}
          </div>
      }

      {/* Pagination */}
      {total > 30 && (
        <div style={{ display: "flex", justifyContent: "center", gap: 10, marginTop: 14, alignItems: "center" }}>
          <Btn v="secondary" s="sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>← Prev</Btn>
          <span style={{ fontSize: 12, color: T.textSec }}>Page {page}/{Math.ceil(total / 30)}</span>
          <Btn v="secondary" s="sm" disabled={page >= Math.ceil(total / 30)} onClick={() => setPage(page + 1)}>Next →</Btn>
        </div>
      )}

      <TransactionModal open={showModal} onClose={() => { setShowModal(false); setEditTx(null); }} accounts={accounts} editTx={editTx} onSave={() => { setShowModal(false); setEditTx(null); fetchTxns(); }} toast={toast} />
      <ImportModal open={showImport} onClose={() => setShowImport(false)} onSuccess={() => { setShowImport(false); fetchTxns(); }} toast={toast} />
    </div>
  );
}

// ============================================================
// TRANSACTION MODAL
// ============================================================
function TransactionModal({ open, onClose, accounts, editTx, onSave, toast }) {
  const [form, setForm] = useState({ date: fmtDateInput(), amount: "", description: "", narration: "", debit_account_id: "", credit_account_id: "", category: "Uncategorized", tax_category: "" });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (editTx) setForm({ date: fmtDateInput(editTx.date), amount: editTx.amount, description: editTx.description || "", narration: editTx.narration || "", debit_account_id: editTx.debit_account_id, credit_account_id: editTx.credit_account_id, category: editTx.category || "Uncategorized", tax_category: editTx.tax_category || "" });
    else setForm({ date: fmtDateInput(), amount: "", description: "", narration: "", debit_account_id: "", credit_account_id: "", category: "Uncategorized", tax_category: "" });
  }, [editTx, open]);

  const save = async () => {
    if (!form.amount || !form.debit_account_id || !form.credit_account_id) { toast("Fill: Amount, From, To", "error"); return; }
    setSaving(true);
    try {
      const p = { ...form, amount: parseFloat(form.amount) };
      if (editTx) { await api.updateTransaction(editTx.transaction_id, p); toast("Updated", "success"); }
      else { await api.createTransaction(p); toast("Added", "success"); }
      onSave();
    } catch (e) { toast(e.message, "error"); }
    setSaving(false);
  };

  const presets = [
    { label: "🛒 Expense", dt: "Expense", ct: "Asset" },
    { label: "💰 Income", dt: "Asset", ct: "Income" },
    { label: "🔄 Transfer", dt: "Asset", ct: "Asset" },
    { label: "💳 EMI", dt: "Liability", ct: "Asset" },
  ];

  // Group accounts by type for dropdown
  const grouped = {};
  accounts.forEach(a => { if (!grouped[a.account_type]) grouped[a.account_type] = []; grouped[a.account_type].push(a); });
  const accOpts = [{ value: "", label: "Select account" }, ...Object.entries(grouped).flatMap(([type, accs]) => [
    { value: `__${type}`, label: `── ${type} ──`, disabled: true },
    ...accs.sort((a, b) => a.account_name.localeCompare(b.account_name)).map(a => ({ value: a.account_id, label: `  ${a.account_name}` }))
  ])];

  const categories = ["Uncategorized", "Groceries", "Food", "Dining Out", "Rent", "EMI Payment", "Electricity", "Water", "Gas", "Internet", "Mobile", "Fuel", "Transport", "Medical", "Insurance", "Shopping", "Entertainment", "Travel", "Education", "Subscription", "Salary", "Interest", "Dividend", "Capital Gains", "Gift", "Tax Paid", "Donation", "Household", "Maintenance", "Bank Charges", "Transfer", "Miscellaneous"];
  const taxCats = ["", "80C", "80D", "80E", "80G", "80TTA", "80CCD", "24(b)", "10(14)", "HRA", "LTA"];

  return (
    <Modal open={open} onClose={onClose} title={editTx ? "Edit Transaction" : "New Transaction"}>
      {!editTx && <div style={{ display: "flex", gap: 5, marginBottom: 14, flexWrap: "wrap" }}>
        {presets.map(p => <Btn key={p.label} v="secondary" s="sm" onClick={() => { const d = accounts.find(a => a.account_type === p.dt); const c = accounts.find(a => a.account_type === p.ct); setForm({ ...form, debit_account_id: d?.account_id || "", credit_account_id: c?.account_id || "" }); }}>{p.label}</Btn>)}
      </div>}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0 10px" }}>
        <Inp label="Date *" type="date" value={form.date} onChange={e => setForm({ ...form, date: e.target.value })} />
        <Inp label="Amount (₹) *" type="number" placeholder="0" value={form.amount} onChange={e => setForm({ ...form, amount: e.target.value })} />
      </div>
      <Sel label="From Account (Credit — source) *" value={form.credit_account_id} onChange={e => setForm({ ...form, credit_account_id: e.target.value })} options={accOpts} />
      <Sel label="To Account (Debit — destination) *" value={form.debit_account_id} onChange={e => setForm({ ...form, debit_account_id: e.target.value })} options={accOpts} />
      <Inp label="Description" placeholder="What was this for?" value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} />
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0 10px" }}>
        <Sel label="Category" value={form.category} onChange={e => setForm({ ...form, category: e.target.value })} options={categories} />
        <Sel label="Tax Section" value={form.tax_category} onChange={e => setForm({ ...form, tax_category: e.target.value })} options={taxCats.map(t => ({ value: t, label: t || "None" }))} />
      </div>
      <div style={{ display: "flex", gap: 8, marginTop: 6 }}>
        <Btn v="secondary" onClick={onClose} style={{ flex: 1 }}>Cancel</Btn>
        <Btn onClick={save} loading={saving} style={{ flex: 2 }}>{editTx ? "Update" : "Add Transaction"}</Btn>
      </div>
    </Modal>
  );
}

// ============================================================
// CSV IMPORT MODAL
// ============================================================
function ImportModal({ open, onClose, onSuccess, toast }) {
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);

  const handleUpload = async () => {
    if (!file) { toast("Select a CSV file", "error"); return; }
    setLoading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const data = await api.importCSV(fd);
      setResult(data);
      if (data.imported > 0) toast(`Imported ${data.imported} transactions!`, "success");
      else toast(data.error || "No transactions imported", "error");
    } catch (e) { toast(e.message, "error"); }
    setLoading(false);
  };

  return (
    <Modal open={open} onClose={() => { onClose(); setFile(null); setResult(null); }} title="Import CSV">
      <div style={{ fontSize: 12, color: T.textSec, marginBottom: 14, lineHeight: 1.6 }}>
        Upload a CSV file. Columns should include: <strong>Date, Amount, Description, Debit Account, Credit Account, Category</strong>.
        Account names must match your existing accounts.
      </div>
      <div style={{ border: `2px dashed ${T.border}`, borderRadius: T.radius, padding: 24, textAlign: "center", marginBottom: 14, background: T.accentLight }}>
        <div style={{ marginBottom: 8, color: T.textSec }}>{I.upload}</div>
        <input type="file" accept=".csv" onChange={e => setFile(e.target.files[0])} style={{ fontSize: 13, fontFamily: T.font }} />
        {file && <div style={{ marginTop: 6, fontSize: 12, color: T.success }}>✓ {file.name}</div>}
      </div>
      {result && (
        <Card style={{ marginBottom: 14, padding: 12, fontSize: 12 }}>
          {result.imported > 0 && <div style={{ color: T.success, fontWeight: 600 }}>✅ Imported: {result.imported}</div>}
          {result.skipped > 0 && <div style={{ color: T.warn }}>⏭ Skipped: {result.skipped}</div>}
          {result.errors?.length > 0 && <div style={{ color: T.danger, marginTop: 4 }}>{result.errors.slice(0, 3).join(", ")}</div>}
        </Card>
      )}
      <div style={{ display: "flex", gap: 8 }}>
        <Btn v="secondary" onClick={() => { onClose(); setFile(null); setResult(null); }} style={{ flex: 1 }}>Cancel</Btn>
        <Btn onClick={result?.imported > 0 ? () => { onSuccess(); setFile(null); setResult(null); } : handleUpload} loading={loading} style={{ flex: 2 }}>
          {result?.imported > 0 ? "Done" : "Upload & Import"}
        </Btn>
      </div>
    </Modal>
  );
}

// ============================================================
// ACCOUNTS TAB (with hierarchy tree)
// ============================================================
function AccountsTab({ accounts, refreshAccounts, toast }) {
  const [showModal, setShowModal] = useState(false);
  const [editAcc, setEditAcc] = useState(null);
  const [filter, setFilter] = useState("All");
  const [collapsed, setCollapsed] = useState({});

  const toggle = (key) => setCollapsed(p => ({ ...p, [key]: !p[key] }));
  const types = ["All", "Asset", "Liability", "Income", "Expense"];
  const filtered = filter === "All" ? accounts : accounts.filter(a => a.account_type === filter);

  // Build tree hierarchy from GnuCash path stored in description
  const hierarchy = useMemo(() => {
    const tree = {};
    filtered.forEach(a => {
      const path = a.description || "";
      const parts = path.split(":");
      const type = a.account_type;
      if (!tree[type]) tree[type] = { total: 0, groups: {} };

      const group = parts.length >= 2 ? parts[1].trim() : (a.sub_type || "Other");
      if (!tree[type].groups[group]) tree[type].groups[group] = { total: 0, accounts: [] };

      const bal = parseFloat(a.calculated_balance || a.current_balance || 0);
      tree[type].total += bal;
      tree[type].groups[group].total += bal;
      tree[type].groups[group].accounts.push({ ...a, balance: bal });
    });

    // Sort accounts by absolute balance descending
    Object.values(tree).forEach(t => Object.values(t.groups).forEach(g => g.accounts.sort((a, b) => Math.abs(b.balance) - Math.abs(a.balance))));
    return tree;
  }, [filtered]);

  const netWorth = (hierarchy.Asset?.total || 0) - Math.abs(hierarchy.Liability?.total || 0);

  const handleDelete = async (id) => {
    if (!confirm("Delete account? Only works if no transactions linked.")) return;
    try { await api.deleteAccount(id); toast("Deleted", "success"); refreshAccounts(); } catch (e) { toast(e.message, "error"); }
  };

  // Format balance display — liabilities/income show as positive
  const fmtBal = (bal, type) => {
    if (type === "Liability" || type === "Income") return fmtFull(Math.abs(bal));
    return fmtFull(bal);
  };

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700, letterSpacing: "-0.02em" }}>Accounts</h2>
          <span style={{ fontSize: 12, color: T.textSec }}>{accounts.length} accounts</span>
        </div>
        <Btn s="sm" onClick={() => { setEditAcc(null); setShowModal(true); }}>{I.plus} Add</Btn>
      </div>

      {/* Net Worth Banner */}
      <Card style={{ marginBottom: 14, background: "linear-gradient(135deg, #171717, #333)", color: "#fff", border: "none", padding: 18 }}>
        <div style={{ fontSize: 11, opacity: 0.6 }}>NET WORTH</div>
        <div style={{ fontSize: 28, fontWeight: 700, fontFamily: T.mono, letterSpacing: "-0.02em" }}>{fmtFull(netWorth)}</div>
        <div style={{ display: "flex", gap: 14, marginTop: 8, fontSize: 11, opacity: 0.8 }}>
          <span>Assets: <strong style={{ fontFamily: T.mono, color: "#34d399" }}>{fmtFull(hierarchy.Asset?.total || 0)}</strong></span>
          <span>Liabilities: <strong style={{ fontFamily: T.mono, color: "#fca5a5" }}>{fmtFull(Math.abs(hierarchy.Liability?.total || 0))}</strong></span>
        </div>
      </Card>

      {/* Type Filter Pills */}
      <div style={{ display: "flex", gap: 5, marginBottom: 14, overflowX: "auto" }}>
        {types.map(t => (
          <button key={t} onClick={() => setFilter(t)} style={{ padding: "5px 12px", borderRadius: 20, border: "none", fontSize: 11, fontWeight: 500, cursor: "pointer", fontFamily: T.font, whiteSpace: "nowrap", background: filter === t ? T.accent : T.accentLight, color: filter === t ? "#fff" : T.textSec }}>
            {t}{t !== "All" && ` (${accounts.filter(a => a.account_type === t).length})`}
          </button>
        ))}
      </div>

      {/* Account Tree */}
      {Object.entries(hierarchy).map(([type, { total, groups }]) => (
        <div key={type} style={{ marginBottom: 16 }}>
          {/* Type Header */}
          <div onClick={() => toggle(type)} style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6, cursor: "pointer", padding: "6px 8px", background: `${typeColors[type]}10`, borderRadius: T.radiusSm }}>
            <span style={{ transform: collapsed[type] ? "rotate(-90deg)" : "rotate(0)", transition: "transform .2s", display: "flex", color: typeColors[type] }}>{I.chev}</span>
            <span style={{ fontSize: 14, color: typeColors[type], fontWeight: 600 }}>{typeIcons[type]}</span>
            <span style={{ fontSize: 13, fontWeight: 700, color: T.text, flex: 1 }}>{type}</span>
            <span style={{ fontSize: 13, fontFamily: T.mono, color: typeColors[type], fontWeight: 700 }}>
              {fmtBal(total, type)}
            </span>
          </div>

          {!collapsed[type] && Object.entries(groups).sort((a, b) => Math.abs(b[1].total) - Math.abs(a[1].total)).map(([group, { total: gTotal, accounts: accs }]) => (
            <div key={group} style={{ marginBottom: 4, marginLeft: 10 }}>
              {/* Group Header */}
              <div onClick={() => toggle(`${type}-${group}`)} style={{ display: "flex", alignItems: "center", gap: 5, cursor: "pointer", padding: "5px 8px", borderRadius: 6, background: collapsed[`${type}-${group}`] ? "transparent" : T.accentLight }}>
                <span style={{ transform: collapsed[`${type}-${group}`] ? "rotate(-90deg)" : "rotate(0)", transition: "transform .2s", display: "flex", color: T.textSec }}>{I.chevR}</span>
                <span style={{ color: T.textSec, display: "flex" }}>{I.folder}</span>
                <span style={{ fontSize: 12, fontWeight: 600, color: T.textSec, flex: 1 }}>{group}</span>
                <span style={{ fontSize: 12, fontFamily: T.mono, fontWeight: 500, color: T.text }}>{fmtBal(gTotal, type)}</span>
                <Pill>{accs.length}</Pill>
              </div>

              {/* Individual Accounts */}
              {!collapsed[`${type}-${group}`] && accs.map(a => (
                <div key={a.account_id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "5px 10px 5px 38px", borderLeft: `2px solid ${T.accentLight}`, marginLeft: 10 }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <span style={{ fontSize: 12, fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", display: "block" }}>{a.account_name}</span>
                    {a.sub_type && a.sub_type !== "Other" && <span style={{ fontSize: 9, color: T.textTer }}>{a.sub_type}</span>}
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <span style={{ fontSize: 12, fontWeight: 600, fontFamily: T.mono, color: a.balance < 0 && type !== "Liability" && type !== "Income" ? T.danger : T.text }}>
                      {fmtBal(a.balance, type)}
                    </span>
                    <button onClick={() => { setEditAcc(a); setShowModal(true); }} style={{ background: "none", border: "none", cursor: "pointer", padding: 2, color: T.textTer, display: "flex", opacity: 0.5 }}>{I.edit}</button>
                  </div>
                </div>
              ))}
            </div>
          ))}
        </div>
      ))}

      {filtered.length === 0 && <Empty icon="🏦" title="No accounts" sub="Add an account to get started" />}

      <AccountModal open={showModal} onClose={() => { setShowModal(false); setEditAcc(null); }} editAcc={editAcc} onSave={() => { setShowModal(false); setEditAcc(null); refreshAccounts(); }} toast={toast} />
    </div>
  );
}

// ============================================================
// ACCOUNT MODAL
// ============================================================
function AccountModal({ open, onClose, editAcc, onSave, toast }) {
  const [form, setForm] = useState({ account_name: "", account_type: "Asset", sub_type: "", description: "", opening_balance: 0 });
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    if (editAcc) setForm({ account_name: editAcc.account_name, account_type: editAcc.account_type, sub_type: editAcc.sub_type || "", description: editAcc.description || "", opening_balance: 0 });
    else setForm({ account_name: "", account_type: "Asset", sub_type: "", description: "", opening_balance: 0 });
  }, [editAcc, open]);

  const subTypes = {
    Asset: ["Bank Account", "Cash", "Wallet", "Fixed Deposit", "Mutual Fund", "Stocks", "Gold", "Crypto", "Retirement", "Property", "Vehicle", "Loan Given", "Receivable", "Tax Credit", "Alternative", "Other"],
    Liability: ["Home Loan", "Loan", "Credit Card", "Tax", "Other"],
    Income: ["Employment", "Interest", "Dividend", "Capital Gains", "Passive", "Other"],
    Expense: ["Food", "Housing", "Utilities", "Transport", "Health", "Shopping", "Entertainment", "Travel", "Education", "Subscription", "Insurance", "Maintenance", "Donation", "Tax", "Other"],
    Equity: ["Capital", "Other"]
  };

  const save = async () => {
    if (!form.account_name) { toast("Name required", "error"); return; }
    setSaving(true);
    try {
      if (editAcc) { await api.updateAccount(editAcc.account_id, form); toast("Updated", "success"); }
      else { await api.createAccount(form); toast("Created", "success"); }
      onSave();
    } catch (e) { toast(e.message, "error"); }
    setSaving(false);
  };

  return (
    <Modal open={open} onClose={onClose} title={editAcc ? "Edit Account" : "New Account"}>
      <Inp label="Account Name *" placeholder="e.g. SBI Savings" value={form.account_name} onChange={e => setForm({ ...form, account_name: e.target.value })} />
      {!editAcc && <Sel label="Type *" value={form.account_type} onChange={e => setForm({ ...form, account_type: e.target.value, sub_type: "" })} options={["Asset", "Liability", "Income", "Expense", "Equity"]} />}
      <Sel label="Sub Type" value={form.sub_type} onChange={e => setForm({ ...form, sub_type: e.target.value })} options={["", ...(subTypes[form.account_type] || [])].map(s => ({ value: s, label: s || "Select" }))} />
      <Inp label="Description (GnuCash path)" placeholder="Optional" value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} />
      {!editAcc && <Inp label="Opening Balance" type="number" placeholder="0" value={form.opening_balance} onChange={e => setForm({ ...form, opening_balance: parseFloat(e.target.value) || 0 })} />}
      <div style={{ display: "flex", gap: 8, marginTop: 6 }}>
        <Btn v="secondary" onClick={onClose} style={{ flex: 1 }}>Cancel</Btn>
        <Btn onClick={save} loading={saving} style={{ flex: 2 }}>{editAcc ? "Update" : "Create"}</Btn>
      </div>
    </Modal>
  );
}

// ============================================================
// DASHBOARD TAB
// ============================================================
function DashboardTab({ user, accounts, toast }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => { (async () => { try { setData(await api.getDashboard()); } catch (e) { toast(e.message, "error"); } setLoading(false); })(); }, [toast]);

  const totals = useMemo(() => {
    const t = {};
    accounts.forEach(a => { if (!t[a.account_type]) t[a.account_type] = 0; t[a.account_type] += parseFloat(a.calculated_balance || a.current_balance || 0); });
    return t;
  }, [accounts]);

  const netWorth = (totals.Asset || 0) - Math.abs(totals.Liability || 0);

  // Asset allocation breakdown
  const assetBreakdown = useMemo(() => {
    const groups = {};
    accounts.filter(a => a.account_type === "Asset").forEach(a => {
      const key = a.sub_type || "Other";
      if (!groups[key]) groups[key] = 0;
      groups[key] += parseFloat(a.calculated_balance || a.current_balance || 0);
    });
    return Object.entries(groups).filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1]);
  }, [accounts]);

  // Liability breakdown
  const liabBreakdown = useMemo(() => {
    const groups = {};
    accounts.filter(a => a.account_type === "Liability").forEach(a => {
      const key = a.sub_type || "Other";
      if (!groups[key]) groups[key] = 0;
      groups[key] += Math.abs(parseFloat(a.calculated_balance || a.current_balance || 0));
    });
    return Object.entries(groups).filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1]);
  }, [accounts]);

  const totalAssets = assetBreakdown.reduce((s, [, v]) => s + v, 0);
  const totalLiab = liabBreakdown.reduce((s, [, v]) => s + v, 0);
  const assetColors = ["#10b981", "#3b82f6", "#8b5cf6", "#f59e0b", "#06b6d4", "#ec4899", "#14b8a6", "#6366f1", "#f97316", "#84cc16", "#e11d48", "#0ea5e9"];

  if (loading) return <div style={{ textAlign: "center", padding: 60 }}><Spin s={28} /></div>;
  if (!data) return <Empty icon="📊" title="Could not load" sub="Please retry" />;

  const monthly = (data.monthly_summary || []).reverse().slice(-12);
  const maxBar = Math.max(...monthly.flatMap(m => [parseFloat(m.income), parseFloat(m.expenses)]), 1);

  return (
    <div>
      <div style={{ marginBottom: 16 }}>
        <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700, letterSpacing: "-0.02em" }}>Dashboard</h2>
        <span style={{ fontSize: 12, color: T.textSec }}>Welcome{user?.name ? `, ${user.name.split(" ")[0]}` : ""}</span>
      </div>

      {/* Net Worth Hero */}
      <Card style={{ marginBottom: 12, background: "linear-gradient(135deg, #171717, #333)", color: "#fff", border: "none", padding: 18 }}>
        <div style={{ fontSize: 11, opacity: 0.6 }}>NET WORTH</div>
        <div style={{ fontSize: 30, fontWeight: 700, fontFamily: T.mono, letterSpacing: "-0.02em" }}>{fmtFull(netWorth)}</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginTop: 12 }}>
          {[
            { l: "Assets", v: totals.Asset || 0, c: "#34d399" },
            { l: "Liabilities", v: Math.abs(totals.Liability || 0), c: "#fca5a5" },
            { l: "Transactions", v: data.transaction_count, c: "#93c5fd", isCount: true }
          ].map(x => (
            <div key={x.l} style={{ background: "rgba(255,255,255,0.08)", borderRadius: 8, padding: "8px 10px" }}>
              <div style={{ fontSize: 9, opacity: 0.5, textTransform: "uppercase", letterSpacing: "0.04em" }}>{x.l}</div>
              <div style={{ fontSize: 14, fontWeight: 600, fontFamily: T.mono, color: x.c }}>{x.isCount ? x.v?.toLocaleString() : `₹${fmt(x.v)}`}</div>
            </div>
          ))}
        </div>
      </Card>

      {/* Monthly Income vs Expense Chart */}
      {monthly.length > 0 && (
        <Card style={{ marginBottom: 12, padding: 14 }}>
          <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 12 }}>Monthly Trend</div>
          <div style={{ display: "flex", gap: 2, alignItems: "flex-end", height: 110 }}>
            {monthly.map(m => {
              const inc = parseFloat(m.income);
              const exp = parseFloat(m.expenses);
              const net = inc - exp;
              return (
                <div key={m.month} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 1 }}>
                  <div style={{ fontSize: 7, fontFamily: T.mono, color: net >= 0 ? T.success : T.danger, fontWeight: 600, whiteSpace: "nowrap" }}>
                    {net >= 0 ? "+" : ""}{fmt(net)}
                  </div>
                  <div style={{ display: "flex", gap: 1, alignItems: "flex-end", height: 75, width: "100%" }}>
                    <div title={`Income: ₹${fmt(inc)}`} style={{ flex: 1, background: `linear-gradient(180deg, ${T.success}60, ${T.success}20)`, borderRadius: "3px 3px 0 0", height: `${Math.max((inc / maxBar) * 100, 2)}%` }} />
                    <div title={`Expense: ₹${fmt(exp)}`} style={{ flex: 1, background: `linear-gradient(180deg, ${T.danger}60, ${T.danger}20)`, borderRadius: "3px 3px 0 0", height: `${Math.max((exp / maxBar) * 100, 2)}%` }} />
                  </div>
                  <div style={{ fontSize: 8, color: T.textTer, whiteSpace: "nowrap" }}>{m.month?.slice(5)}</div>
                </div>
              );
            })}
          </div>
          <div style={{ display: "flex", gap: 14, marginTop: 8, justifyContent: "center" }}>
            <span style={{ fontSize: 10, display: "flex", alignItems: "center", gap: 3 }}><span style={{ width: 8, height: 4, borderRadius: 1, background: T.success, opacity: 0.6, display: "inline-block" }} /> Income</span>
            <span style={{ fontSize: 10, display: "flex", alignItems: "center", gap: 3 }}><span style={{ width: 8, height: 4, borderRadius: 1, background: T.danger, opacity: 0.6, display: "inline-block" }} /> Expense</span>
          </div>
        </Card>
      )}

      {/* Asset Allocation */}
      {assetBreakdown.length > 0 && (
        <Card style={{ marginBottom: 12, padding: 14 }}>
          <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 10 }}>Asset Allocation</div>
          {/* Stacked bar */}
          <div style={{ display: "flex", height: 16, borderRadius: 8, overflow: "hidden", marginBottom: 10 }}>
            {assetBreakdown.map(([cat, val], i) => (
              <div key={cat} style={{ width: `${(val / totalAssets) * 100}%`, background: assetColors[i % assetColors.length], minWidth: 2 }} title={`${cat}: ${fmtFull(val)}`} />
            ))}
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "3px 8px" }}>
            {assetBreakdown.map(([cat, val], i) => (
              <div key={cat} style={{ display: "flex", alignItems: "center", gap: 4, padding: "2px 0" }}>
                <span style={{ width: 8, height: 8, borderRadius: 2, background: assetColors[i % assetColors.length], display: "inline-block", flexShrink: 0 }} />
                <span style={{ fontSize: 10, color: T.textSec, flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{cat}</span>
                <span style={{ fontSize: 10, fontFamily: T.mono, color: T.text, fontWeight: 500, whiteSpace: "nowrap" }}>₹{fmt(val)}</span>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Liability Breakdown */}
      {liabBreakdown.length > 0 && (
        <Card style={{ marginBottom: 12, padding: 14 }}>
          <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 10 }}>Liability Breakdown</div>
          {liabBreakdown.map(([cat, val], i) => {
            const pct = totalLiab > 0 ? (val / totalLiab) * 100 : 0;
            return (
              <div key={cat} style={{ marginBottom: 8 }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 2 }}>
                  <span style={{ fontSize: 12, color: T.text }}>{cat}</span>
                  <span style={{ fontSize: 12, fontFamily: T.mono, color: T.danger }}>₹{fmt(val)}</span>
                </div>
                <div style={{ height: 4, background: T.accentLight, borderRadius: 2 }}>
                  <div style={{ height: "100%", background: `${T.danger}60`, borderRadius: 2, width: `${pct}%` }} />
                </div>
              </div>
            );
          })}
        </Card>
      )}

      {/* Top Spending */}
      {(data.top_categories || []).length > 0 && (
        <Card style={{ marginBottom: 12, padding: 14 }}>
          <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 10 }}>Top Spending (This Month)</div>
          {data.top_categories.slice(0, 8).map((c, i) => {
            const max = parseFloat(data.top_categories[0].total);
            return (
              <div key={c.category} style={{ marginBottom: 8 }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 2 }}>
                  <span style={{ fontSize: 12 }}>{c.category}</span>
                  <span style={{ fontSize: 12, fontFamily: T.mono, color: T.textSec }}>₹{fmt(c.total)}</span>
                </div>
                <div style={{ height: 3, background: T.accentLight, borderRadius: 2 }}>
                  <div style={{ height: "100%", background: T.accent, borderRadius: 2, width: `${(parseFloat(c.total) / max) * 100}%`, opacity: 1 - i * 0.06 }} />
                </div>
              </div>
            );
          })}
        </Card>
      )}

      {/* Recent Transactions */}
      {(data.recent_transactions || []).length > 0 && (
        <Card style={{ padding: 14 }}>
          <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 10 }}>Recent Transactions</div>
          {data.recent_transactions.slice(0, 6).map(tx => {
            const isExp = tx.debit_account_type === "Expense";
            const isInc = tx.credit_account_type === "Income";
            return (
              <div key={tx.transaction_id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "6px 0", borderBottom: `1px solid ${T.accentLight}` }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 12, fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{tx.description || tx.category || "—"}</div>
                  <div style={{ fontSize: 10, color: T.textTer }}>{fmtDate(tx.date)} · {tx.debit_account_name || tx.credit_account_name}</div>
                </div>
                <span style={{ fontSize: 13, fontWeight: 600, fontFamily: T.mono, color: isExp ? T.danger : isInc ? T.success : T.text, flexShrink: 0 }}>
                  {isExp ? "−" : isInc ? "+" : ""}₹{fmt(tx.amount)}
                </span>
              </div>
            );
          })}
        </Card>
      )}
    </div>
  );
}

// ============================================================
// REPORTS TAB (FIRE + Tax)
// ============================================================
function ReportsTab({ toast }) {
  const [fire, setFire] = useState(null);
  const [tax, setTax] = useState(null);
  const [loading, setLoading] = useState(true);
  const [active, setActive] = useState("fire");
  const [fy, setFy] = useState(getCurrentFY());

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const [f, t] = await Promise.all([
          api.getFIRE("current_age=30&target_age=45").catch(() => null),
          api.getTaxSummary(fy).catch(() => null)
        ]);
        setFire(f); setTax(t);
      } catch (e) { toast(e.message, "error"); }
      setLoading(false);
    })();
  }, [toast, fy]);

  if (loading) return <div style={{ textAlign: "center", padding: 60 }}><Spin s={28} /></div>;

  return (
    <div>
      <h2 style={{ margin: "0 0 12px", fontSize: 20, fontWeight: 700, letterSpacing: "-0.02em" }}>Reports</h2>
      <div style={{ display: "flex", gap: 5, marginBottom: 16 }}>
        {[{ id: "fire", label: "🔥 FIRE" }, { id: "tax", label: "📋 Tax Summary" }].map(r => (
          <button key={r.id} onClick={() => setActive(r.id)} style={{ padding: "6px 14px", borderRadius: 20, border: "none", fontSize: 12, fontWeight: 500, cursor: "pointer", fontFamily: T.font, background: active === r.id ? T.accent : T.accentLight, color: active === r.id ? "#fff" : T.textSec }}>{r.label}</button>
        ))}
      </div>

      {active === "fire" && fire && (
        <div>
          <Card style={{ marginBottom: 12, padding: 20, textAlign: "center" }}>
            <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 14 }}>FIRE Progress</div>
            <div style={{ position: "relative", width: 140, height: 140, margin: "0 auto" }}>
              <svg width="140" height="140" viewBox="0 0 140 140">
                <circle cx="70" cy="70" r="60" stroke={T.accentLight} strokeWidth="9" fill="none" />
                <circle cx="70" cy="70" r="60" stroke={T.success} strokeWidth="9" fill="none"
                  strokeDasharray={`${2 * Math.PI * 60}`}
                  strokeDashoffset={`${2 * Math.PI * 60 * (1 - Math.min(fire.progress_percentage || 0, 100) / 100)}`}
                  strokeLinecap="round" transform="rotate(-90 70 70)" style={{ transition: "stroke-dashoffset 1s" }} />
              </svg>
              <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center" }}>
                <div style={{ fontSize: 24, fontWeight: 700, fontFamily: T.mono }}>{Math.min(fire.progress_percentage || 0, 100).toFixed(1)}%</div>
                <div style={{ fontSize: 10, color: T.textSec }}>of FIRE goal</div>
              </div>
            </div>
          </Card>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 12 }}>
            {[
              { l: "FIRE Number", v: `₹${fmt(fire.fire_number)}`, c: T.warn },
              { l: "Net Worth", v: `₹${fmt(fire.current_net_worth)}`, c: T.success },
              { l: "Monthly Savings", v: `₹${fmt(fire.monthly_savings)}`, c: T.info },
              { l: "Savings Rate", v: `${fire.savings_rate || 0}%`, c: (fire.savings_rate || 0) >= 50 ? T.success : T.warn },
              { l: "Years to FIRE", v: fire.years_to_fire || "∞", c: T.accent },
              { l: "FIRE Age", v: fire.fire_age || "—", c: T.accent }
            ].map(s => (
              <Card key={s.l} style={{ padding: 10 }}>
                <div style={{ fontSize: 9, color: T.textSec, textTransform: "uppercase", letterSpacing: "0.04em" }}>{s.l}</div>
                <div style={{ fontSize: 16, fontWeight: 700, fontFamily: T.mono, color: s.c }}>{s.v}</div>
              </Card>
            ))}
          </div>
        </div>
      )}

      {active === "fire" && !fire && <Empty icon="🔥" title="FIRE data unavailable" sub="Dashboard needs income & expense data" />}

      {active === "tax" && (
        <div>
          <FYSelector fy={fy} setFy={(y) => { setFy(y); setLoading(true); api.getTaxSummary(y).then(t => { setTax(t); setLoading(false); }).catch(() => setLoading(false)); }} />
          <Card style={{ padding: 14 }}>
            <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 4 }}>Tax Summary</div>
            <div style={{ fontSize: 11, color: T.textSec, marginBottom: 14 }}>{getFYLabel(fy)}</div>
            {tax?.tax_categories && Object.keys(tax.tax_categories).length > 0 ? (
              Object.entries(tax.tax_categories).map(([section, info]) => (
                <div key={section} style={{ marginBottom: 14 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                    <Pill color={T.info}>Section {section}</Pill>
                    <span style={{ fontSize: 13, fontWeight: 600, fontFamily: T.mono }}>{fmtFull(info.total)}</span>
                  </div>
                  {info.items?.map((item, i) => (
                    <div key={i} style={{ display: "flex", justifyContent: "space-between", padding: "3px 0 3px 10px", fontSize: 12 }}>
                      <span style={{ color: T.textSec }}>{item.category}</span>
                      <span style={{ fontFamily: T.mono }}>{fmtFull(item.total_amount)}</span>
                    </div>
                  ))}
                </div>
              ))
            ) : <Empty icon="📋" title="No tax data" sub="Tag transactions with tax sections to see summary" />}
          </Card>
        </div>
      )}
    </div>
  );
}

// ============================================================
// MAIN APP
// ============================================================
export default function App() {
  const [user, setUser] = useState(null);
  const [accounts, setAccounts] = useState([]);
  const [tab, setTab] = useState("transactions");
  const [toastMsg, setToastMsg] = useState(null);
  const [init, setInit] = useState(true);

  const toast = useCallback((msg, type = "info") => setToastMsg({ message: msg, type, key: Date.now() }), []);
  const refreshAccounts = useCallback(async () => { try { const a = await api.getAccounts(); setAccounts(a); } catch {} }, []);

  useEffect(() => {
    (async () => {
      const token = localStorage.getItem("ft_token");
      if (token) {
        api.token = token;
        try { const u = await api.me(); setUser(u); setAccounts(await api.getAccounts()); } catch { localStorage.removeItem("ft_token"); api.token = null; }
      }
      setInit(false);
    })();
  }, []);

  const handleLogin = async (u, token) => { setUser(u); api.token = token; try { setAccounts(await api.getAccounts()); } catch {} };
  const handleLogout = () => { localStorage.removeItem("ft_token"); api.token = null; setUser(null); setAccounts([]); setTab("transactions"); };

  if (init) return <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: T.bg, fontFamily: T.font }}><Spin s={28} /></div>;
  if (!user) return <AuthScreen onLogin={handleLogin} />;

  const tabs = [
    { id: "transactions", label: "Txns", icon: I.tx },
    { id: "accounts", label: "Accounts", icon: I.acc },
    { id: "dashboard", label: "Home", icon: I.dash },
    { id: "reports", label: "Reports", icon: I.rep },
  ];

  return (
    <div style={{ minHeight: "100vh", background: T.bg, fontFamily: T.font, color: T.text }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;600;700&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { margin: 0; -webkit-font-smoothing: antialiased; }
        input:focus, select:focus { border-color: ${T.accent} !important; }
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes slideUp { from { transform: translateY(100%); } to { transform: translateY(0); } }
        @keyframes slideDown { from { transform: translateY(-20px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
        ::-webkit-scrollbar { width: 3px; height: 3px; }
        ::-webkit-scrollbar-thumb { background: #d4d4d4; border-radius: 2px; }
        select option:disabled { color: #999; font-weight: 600; }
      `}</style>

      {toastMsg && <Toast {...toastMsg} onClose={() => setToastMsg(null)} />}

      {/* Top Bar */}
      <div style={{ position: "sticky", top: 0, zIndex: 100, background: "rgba(248,248,248,0.85)", backdropFilter: "blur(12px)", borderBottom: `1px solid ${T.border}` }}>
        <div style={{ maxWidth: 480, margin: "0 auto", padding: "8px 16px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ fontSize: 17, fontWeight: 700, letterSpacing: "-0.03em" }}>₹ tracker</div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 11, color: T.textTer }}>{user.name?.split(" ")[0]}</span>
            <button onClick={handleLogout} style={{ display: "flex", alignItems: "center", background: "none", border: "none", cursor: "pointer", color: T.textSec, padding: 4 }}>{I.logout}</button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div style={{ maxWidth: 480, margin: "0 auto", padding: "14px 16px 100px" }}>
        {tab === "transactions" && <TransactionsTab accounts={accounts} toast={toast} />}
        {tab === "accounts" && <AccountsTab accounts={accounts} refreshAccounts={refreshAccounts} toast={toast} />}
        {tab === "dashboard" && <DashboardTab user={user} accounts={accounts} toast={toast} />}
        {tab === "reports" && <ReportsTab toast={toast} />}
      </div>

      {/* Bottom Nav */}
      <div style={{ position: "fixed", bottom: 0, left: 0, right: 0, background: "rgba(255,255,255,0.92)", backdropFilter: "blur(12px)", borderTop: `1px solid ${T.border}`, zIndex: 100 }}>
        <div style={{ maxWidth: 480, margin: "0 auto", display: "flex" }}>
          {tabs.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)} style={{ flex: 1, padding: "7px 0 max(7px, env(safe-area-inset-bottom))", border: "none", background: "none", cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", gap: 1, color: tab === t.id ? T.accent : T.textTer, transition: "color .15s", fontFamily: T.font }}>
              {t.icon}
              <span style={{ fontSize: 9, fontWeight: tab === t.id ? 600 : 400 }}>{t.label}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
