import { useState, useEffect, useCallback, useRef } from "react";

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
  if (abs >= 10000000) return `${(num / 10000000).toFixed(2)}Cr`;
  if (abs >= 100000) return `${(num / 100000).toFixed(2)}L`;
  if (abs >= 1000) return `${(num / 1000).toFixed(1)}K`;
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
  const dt = new Date(d);
  return dt.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "2-digit" });
};

const fmtDateInput = (d) => {
  if (!d) return new Date().toISOString().split("T")[0];
  return new Date(d).toISOString().split("T")[0];
};

const typeColors = {
  Asset: "#10b981",
  Liability: "#ef4444",
  Income: "#3b82f6",
  Expense: "#f59e0b",
  Equity: "#8b5cf6",
};

const typeIcons = {
  Asset: "↗",
  Liability: "↙",
  Income: "＋",
  Expense: "－",
  Equity: "◎",
};

// ============================================================
// API LAYER
// ============================================================
const api = {
  token: null,
  async call(method, path, body) {
    const headers = { "Content-Type": "application/json" };
    if (this.token) headers["Authorization"] = `Bearer ${this.token}`;
    try {
      const res = await fetch(`${API}${path}`, {
        method,
        headers,
        body: body ? JSON.stringify(body) : undefined,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
      return data;
    } catch (err) {
      if (err.message?.includes("Failed to fetch")) {
        throw new Error("Server is waking up — free tier takes ~30s. Please retry.");
      }
      throw err;
    }
  },
  login: (email, password) => api.call("POST", "/auth/login", { email, password }),
  register: (name, email, password) => api.call("POST", "/auth/register", { name, email, password }),
  me: () => api.call("GET", "/auth/me"),
  getAccounts: () => api.call("GET", "/accounts"),
  createAccount: (d) => api.call("POST", "/accounts", d),
  updateAccount: (id, d) => api.call("PUT", `/accounts/${id}`, d),
  deleteAccount: (id) => api.call("DELETE", `/accounts/${id}`),
  getTransactions: (params = "") => api.call("GET", `/transactions?${params}`),
  createTransaction: (d) => api.call("POST", "/transactions", d),
  updateTransaction: (id, d) => api.call("PUT", `/transactions/${id}`, d),
  deleteTransaction: (id) => api.call("DELETE", `/transactions/${id}`),
  getDashboard: () => api.call("GET", "/dashboard"),
  getFIRE: (params = "") => api.call("GET", `/analytics/fire?${params}`),
  getTaxSummary: (fy) => api.call("GET", `/analytics/tax-summary${fy ? `?financial_year=${fy}` : ""}`),
  getCategories: () => api.call("GET", "/categories"),
};

// ============================================================
// ICONS (inline SVGs)
// ============================================================
const Icons = {
  transactions: (
    <svg width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
      <path d="M7 10l5-6 5 6M7 14l5 6 5-6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  accounts: (
    <svg width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="M3 10h18" />
    </svg>
  ),
  dashboard: (
    <svg width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
      <rect x="3" y="3" width="7" height="7" rx="1" />
      <rect x="14" y="3" width="7" height="7" rx="1" />
      <rect x="3" y="14" width="7" height="7" rx="1" />
      <rect x="14" y="14" width="7" height="7" rx="1" />
    </svg>
  ),
  reports: (
    <svg width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
      <path d="M3 20h18M6 16V10M10 16V4M14 16V8M18 16V12" strokeLinecap="round" />
    </svg>
  ),
  plus: (
    <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
      <path d="M12 5v14M5 12h14" strokeLinecap="round" />
    </svg>
  ),
  close: (
    <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
      <path d="M18 6L6 18M6 6l12 12" strokeLinecap="round" />
    </svg>
  ),
  search: (
    <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
      <circle cx="11" cy="11" r="7" />
      <path d="M21 21l-4-4" strokeLinecap="round" />
    </svg>
  ),
  chevron: (
    <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
      <path d="M9 18l6-6-6-6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  trash: (
    <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
      <path d="M3 6h18M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6" strokeLinecap="round" />
    </svg>
  ),
  edit: (
    <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
      <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" />
      <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  logout: (
    <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
      <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4M16 17l5-5-5-5M21 12H9" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  filter: (
    <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
      <path d="M22 3H2l8 9.46V19l4 2v-8.54L22 3z" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  fire: (
    <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
      <path d="M12 22c4.97 0 9-3.58 9-8 0-4-2.5-6-4-7.5-.76-.76-1-2.5-1-2.5s-1.5 1-2.5 3c-.56 1.12-2.5-.5-2.5-.5S9 8.5 9 12c0 1.5-.5 3-2 4-1 .67-1 2 0 3s3 3 5 3z" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
};

// ============================================================
// STYLES
// ============================================================
const theme = {
  bg: "#fafafa",
  card: "#ffffff",
  border: "#e8e8e8",
  text: "#1a1a1a",
  textSec: "#737373",
  textTer: "#a3a3a3",
  accent: "#171717",
  accentLight: "#f5f5f5",
  success: "#10b981",
  danger: "#ef4444",
  warning: "#f59e0b",
  info: "#3b82f6",
  radius: "12px",
  radiusSm: "8px",
  shadow: "0 1px 3px rgba(0,0,0,0.04), 0 1px 2px rgba(0,0,0,0.06)",
  shadowMd: "0 4px 12px rgba(0,0,0,0.08)",
  font: "'DM Sans', -apple-system, BlinkMacSystemFont, sans-serif",
  fontMono: "'JetBrains Mono', 'SF Mono', monospace",
};

// ============================================================
// REUSABLE COMPONENTS
// ============================================================

function Spinner({ size = 20 }) {
  return (
    <div
      style={{
        width: size,
        height: size,
        border: `2px solid ${theme.border}`,
        borderTopColor: theme.accent,
        borderRadius: "50%",
        animation: "spin 0.6s linear infinite",
        display: "inline-block",
      }}
    />
  );
}

function Toast({ message, type = "info", onClose }) {
  useEffect(() => {
    const t = setTimeout(onClose, 3500);
    return () => clearTimeout(t);
  }, [onClose]);
  const colors = { success: theme.success, error: theme.danger, info: theme.accent };
  return (
    <div
      style={{
        position: "fixed",
        top: 16,
        left: "50%",
        transform: "translateX(-50%)",
        background: colors[type] || theme.accent,
        color: "#fff",
        padding: "10px 20px",
        borderRadius: theme.radiusSm,
        fontSize: 14,
        fontFamily: theme.font,
        zIndex: 9999,
        boxShadow: theme.shadowMd,
        maxWidth: "90vw",
        animation: "slideDown 0.3s ease",
      }}
    >
      {message}
    </div>
  );
}

function EmptyState({ icon, title, sub, action }) {
  return (
    <div style={{ textAlign: "center", padding: "48px 24px", color: theme.textSec }}>
      <div style={{ fontSize: 40, marginBottom: 12, opacity: 0.3 }}>{icon || "📭"}</div>
      <div style={{ fontSize: 15, fontWeight: 500, color: theme.text, marginBottom: 4 }}>{title}</div>
      <div style={{ fontSize: 13, marginBottom: 16 }}>{sub}</div>
      {action}
    </div>
  );
}

function Btn({ children, onClick, variant = "primary", size = "md", disabled, loading, style: s, ...props }) {
  const base = {
    fontFamily: theme.font,
    fontWeight: 500,
    border: "none",
    cursor: disabled ? "not-allowed" : "pointer",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    transition: "all 0.15s",
    opacity: disabled ? 0.5 : 1,
    borderRadius: theme.radiusSm,
  };
  const sizes = {
    sm: { padding: "6px 12px", fontSize: 12 },
    md: { padding: "10px 18px", fontSize: 14 },
    lg: { padding: "14px 24px", fontSize: 15 },
  };
  const variants = {
    primary: { background: theme.accent, color: "#fff" },
    secondary: { background: theme.accentLight, color: theme.text },
    ghost: { background: "transparent", color: theme.textSec },
    danger: { background: "#fef2f2", color: theme.danger },
  };
  return (
    <button onClick={onClick} disabled={disabled || loading} style={{ ...base, ...sizes[size], ...variants[variant], ...s }} {...props}>
      {loading ? <Spinner size={14} /> : null}
      {children}
    </button>
  );
}

function Input({ label, error, style: s, ...props }) {
  return (
    <div style={{ marginBottom: 14 }}>
      {label && <label style={{ display: "block", fontSize: 12, fontWeight: 500, color: theme.textSec, marginBottom: 4, fontFamily: theme.font }}>{label}</label>}
      <input
        style={{
          width: "100%",
          padding: "10px 12px",
          border: `1.5px solid ${error ? theme.danger : theme.border}`,
          borderRadius: theme.radiusSm,
          fontSize: 14,
          fontFamily: theme.font,
          background: "#fff",
          color: theme.text,
          outline: "none",
          transition: "border-color 0.15s",
          boxSizing: "border-box",
          ...s,
        }}
        {...props}
      />
      {error && <div style={{ fontSize: 11, color: theme.danger, marginTop: 2 }}>{error}</div>}
    </div>
  );
}

function Select({ label, options, style: s, ...props }) {
  return (
    <div style={{ marginBottom: 14 }}>
      {label && <label style={{ display: "block", fontSize: 12, fontWeight: 500, color: theme.textSec, marginBottom: 4, fontFamily: theme.font }}>{label}</label>}
      <select
        style={{
          width: "100%",
          padding: "10px 12px",
          border: `1.5px solid ${theme.border}`,
          borderRadius: theme.radiusSm,
          fontSize: 14,
          fontFamily: theme.font,
          background: "#fff",
          color: theme.text,
          outline: "none",
          boxSizing: "border-box",
          appearance: "none",
          backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%23737373' stroke-width='2'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E")`,
          backgroundRepeat: "no-repeat",
          backgroundPosition: "right 12px center",
          ...s,
        }}
        {...props}
      >
        {options.map((o) =>
          typeof o === "string" ? (
            <option key={o} value={o}>{o}</option>
          ) : (
            <option key={o.value} value={o.value}>{o.label}</option>
          )
        )}
      </select>
    </div>
  );
}

function Modal({ open, onClose, title, children }) {
  if (!open) return null;
  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.3)",
        backdropFilter: "blur(2px)",
        zIndex: 1000,
        display: "flex",
        alignItems: "flex-end",
        justifyContent: "center",
        animation: "fadeIn 0.2s ease",
      }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        style={{
          background: theme.card,
          borderRadius: "20px 20px 0 0",
          width: "100%",
          maxWidth: 480,
          maxHeight: "88vh",
          overflow: "auto",
          animation: "slideUp 0.3s ease",
          padding: "20px 20px 32px",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
          <h3 style={{ fontSize: 17, fontWeight: 600, margin: 0, fontFamily: theme.font }}>{title}</h3>
          <button onClick={onClose} style={{ background: theme.accentLight, border: "none", borderRadius: 8, padding: 6, cursor: "pointer", display: "flex" }}>
            {Icons.close}
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

function Card({ children, style: s, onClick }) {
  return (
    <div
      onClick={onClick}
      style={{
        background: theme.card,
        border: `1px solid ${theme.border}`,
        borderRadius: theme.radius,
        padding: 16,
        cursor: onClick ? "pointer" : "default",
        transition: "box-shadow 0.15s",
        ...s,
      }}
    >
      {children}
    </div>
  );
}

function Pill({ children, color = theme.textSec, bg }) {
  return (
    <span
      style={{
        fontSize: 11,
        fontWeight: 500,
        padding: "2px 8px",
        borderRadius: 20,
        background: bg || `${color}15`,
        color: color,
        fontFamily: theme.font,
        whiteSpace: "nowrap",
      }}
    >
      {children}
    </span>
  );
}

// ============================================================
// LOGIN / REGISTER SCREEN
// ============================================================
function AuthScreen({ onLogin }) {
  const [isLogin, setIsLogin] = useState(true);
  const [form, setForm] = useState({ name: "", email: "", password: "" });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async () => {
    setError("");
    setLoading(true);
    try {
      let data;
      if (isLogin) {
        data = await api.login(form.email, form.password);
      } else {
        if (!form.name) { setError("Name is required"); setLoading(false); return; }
        data = await api.register(form.name, form.email, form.password);
      }
      api.token = data.token;
      localStorage.setItem("ft_token", data.token);
      onLogin(data.user, data.token);
    } catch (err) {
      setError(err.message);
    }
    setLoading(false);
  };

  return (
    <div style={{ minHeight: "100vh", background: theme.bg, display: "flex", alignItems: "center", justifyContent: "center", padding: 20, fontFamily: theme.font }}>
      <div style={{ width: "100%", maxWidth: 380 }}>
        <div style={{ textAlign: "center", marginBottom: 36 }}>
          <div style={{ fontSize: 32, fontWeight: 700, letterSpacing: "-0.03em", color: theme.text }}>₹ tracker</div>
          <div style={{ fontSize: 14, color: theme.textSec, marginTop: 4 }}>Your personal finance companion</div>
        </div>
        <Card style={{ padding: 24 }}>
          <div style={{ display: "flex", marginBottom: 20, background: theme.accentLight, borderRadius: theme.radiusSm, padding: 3 }}>
            {["Login", "Register"].map((t) => (
              <button
                key={t}
                onClick={() => { setIsLogin(t === "Login"); setError(""); }}
                style={{
                  flex: 1,
                  padding: "8px 0",
                  border: "none",
                  borderRadius: 6,
                  fontSize: 13,
                  fontWeight: 500,
                  cursor: "pointer",
                  fontFamily: theme.font,
                  background: (t === "Login") === isLogin ? "#fff" : "transparent",
                  color: (t === "Login") === isLogin ? theme.text : theme.textSec,
                  boxShadow: (t === "Login") === isLogin ? "0 1px 3px rgba(0,0,0,0.08)" : "none",
                }}
              >
                {t}
              </button>
            ))}
          </div>
          {!isLogin && <Input label="Name" placeholder="Your name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />}
          <Input label="Email" type="email" placeholder="you@example.com" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          <Input label="Password" type="password" placeholder="Min 8 characters" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} onKeyDown={(e) => e.key === "Enter" && handleSubmit()} />
          {error && <div style={{ fontSize: 13, color: theme.danger, marginBottom: 12, padding: "8px 12px", background: "#fef2f2", borderRadius: 6 }}>{error}</div>}
          <Btn onClick={handleSubmit} loading={loading} style={{ width: "100%", marginTop: 4 }} size="lg">
            {isLogin ? "Sign In" : "Create Account"}
          </Btn>
        </Card>
        <div style={{ textAlign: "center", fontSize: 12, color: theme.textTer, marginTop: 16 }}>
          Free tier server may take ~30s to wake up on first request
        </div>
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
  const [showModal, setShowModal] = useState(false);
  const [editTx, setEditTx] = useState(null);
  const [showFilters, setShowFilters] = useState(false);

  const fetchTxns = useCallback(async () => {
    setLoading(true);
    try {
      let params = `page=${page}&limit=30`;
      if (search) params += `&search=${encodeURIComponent(search)}`;
      if (filterAcc) params += `&account_id=${filterAcc}`;
      const data = await api.getTransactions(params);
      setTxns(data.transactions || []);
      setTotal(data.pagination?.total || 0);
    } catch (err) {
      toast(err.message, "error");
    }
    setLoading(false);
  }, [page, search, filterAcc, toast]);

  useEffect(() => { fetchTxns(); }, [fetchTxns]);

  const handleDelete = async (id) => {
    if (!confirm("Delete this transaction?")) return;
    try {
      await api.deleteTransaction(id);
      toast("Transaction deleted", "success");
      fetchTxns();
    } catch (err) {
      toast(err.message, "error");
    }
  };

  const openEdit = (tx) => { setEditTx(tx); setShowModal(true); };
  const openNew = () => { setEditTx(null); setShowModal(true); };

  return (
    <div>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 22, fontWeight: 700, letterSpacing: "-0.02em" }}>Transactions</h2>
          <span style={{ fontSize: 13, color: theme.textSec }}>{total} total</span>
        </div>
        <Btn onClick={openNew}>{Icons.plus} Add</Btn>
      </div>

      {/* Search & Filter Bar */}
      <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
        <div style={{ flex: 1, position: "relative" }}>
          <div style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: theme.textTer }}>{Icons.search}</div>
          <input
            placeholder="Search transactions..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            style={{
              width: "100%",
              padding: "10px 12px 10px 34px",
              border: `1.5px solid ${theme.border}`,
              borderRadius: theme.radiusSm,
              fontSize: 14,
              fontFamily: theme.font,
              background: "#fff",
              outline: "none",
              boxSizing: "border-box",
            }}
          />
        </div>
        <button
          onClick={() => setShowFilters(!showFilters)}
          style={{
            padding: "10px 12px",
            border: `1.5px solid ${filterAcc ? theme.accent : theme.border}`,
            borderRadius: theme.radiusSm,
            background: filterAcc ? theme.accentLight : "#fff",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            color: theme.textSec,
          }}
        >
          {Icons.filter}
        </button>
      </div>

      {/* Filter Dropdown */}
      {showFilters && (
        <Card style={{ marginBottom: 16, padding: 12 }}>
          <Select
            label="Filter by account"
            value={filterAcc}
            onChange={(e) => { setFilterAcc(e.target.value); setPage(1); }}
            options={[{ value: "", label: "All accounts" }, ...accounts.map((a) => ({ value: a.account_id, label: `${a.account_name} (${a.account_type})` }))]}
          />
          {filterAcc && <Btn variant="ghost" size="sm" onClick={() => { setFilterAcc(""); setPage(1); }}>Clear filter</Btn>}
        </Card>
      )}

      {/* Transaction List */}
      {loading ? (
        <div style={{ textAlign: "center", padding: 40 }}><Spinner size={28} /></div>
      ) : txns.length === 0 ? (
        <EmptyState
          icon="💸"
          title="No transactions yet"
          sub="Add your first transaction to start tracking"
          action={<Btn onClick={openNew}>{Icons.plus} Add Transaction</Btn>}
        />
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {txns.map((tx) => {
            const isExpense = tx.debit_account_type === "Expense";
            const isIncome = tx.credit_account_type === "Income";
            return (
              <Card key={tx.transaction_id} style={{ padding: "12px 14px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 14, fontWeight: 500, color: theme.text, marginBottom: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {tx.description || tx.narration || tx.category || "Transaction"}
                    </div>
                    <div style={{ fontSize: 12, color: theme.textSec, marginBottom: 4 }}>
                      {tx.debit_account_name} → {tx.credit_account_name}
                    </div>
                    <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
                      <span style={{ fontSize: 11, color: theme.textTer }}>{fmtDate(tx.date)}</span>
                      {tx.category && tx.category !== "Uncategorized" && <Pill>{tx.category}</Pill>}
                    </div>
                  </div>
                  <div style={{ textAlign: "right", marginLeft: 12, flexShrink: 0 }}>
                    <div style={{ fontSize: 15, fontWeight: 600, fontFamily: theme.fontMono, color: isExpense ? theme.danger : isIncome ? theme.success : theme.text }}>
                      {isExpense ? "−" : isIncome ? "+" : ""}₹{fmt(tx.amount)}
                    </div>
                    <div style={{ display: "flex", gap: 4, marginTop: 6, justifyContent: "flex-end" }}>
                      <button onClick={() => openEdit(tx)} style={{ background: theme.accentLight, border: "none", borderRadius: 5, padding: 4, cursor: "pointer", display: "flex" }}>{Icons.edit}</button>
                      <button onClick={() => handleDelete(tx.transaction_id)} style={{ background: "#fef2f2", border: "none", borderRadius: 5, padding: 4, cursor: "pointer", display: "flex", color: theme.danger }}>{Icons.trash}</button>
                    </div>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* Pagination */}
      {total > 30 && (
        <div style={{ display: "flex", justifyContent: "center", gap: 12, marginTop: 16, alignItems: "center" }}>
          <Btn variant="secondary" size="sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>← Prev</Btn>
          <span style={{ fontSize: 13, color: theme.textSec }}>Page {page} of {Math.ceil(total / 30)}</span>
          <Btn variant="secondary" size="sm" disabled={page >= Math.ceil(total / 30)} onClick={() => setPage(page + 1)}>Next →</Btn>
        </div>
      )}

      {/* Add/Edit Modal */}
      <TransactionModal
        open={showModal}
        onClose={() => { setShowModal(false); setEditTx(null); }}
        accounts={accounts}
        editTx={editTx}
        onSave={() => { setShowModal(false); setEditTx(null); fetchTxns(); }}
        toast={toast}
      />
    </div>
  );
}

function TransactionModal({ open, onClose, accounts, editTx, onSave, toast }) {
  const [form, setForm] = useState({
    date: fmtDateInput(),
    amount: "",
    description: "",
    narration: "",
    debit_account_id: "",
    credit_account_id: "",
    category: "Uncategorized",
    tax_category: "",
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (editTx) {
      setForm({
        date: fmtDateInput(editTx.date),
        amount: editTx.amount,
        description: editTx.description || "",
        narration: editTx.narration || "",
        debit_account_id: editTx.debit_account_id,
        credit_account_id: editTx.credit_account_id,
        category: editTx.category || "Uncategorized",
        tax_category: editTx.tax_category || "",
      });
    } else {
      setForm({ date: fmtDateInput(), amount: "", description: "", narration: "", debit_account_id: "", credit_account_id: "", category: "Uncategorized", tax_category: "" });
    }
  }, [editTx, open]);

  const handleSave = async () => {
    if (!form.amount || !form.debit_account_id || !form.credit_account_id) {
      toast("Fill required fields: Amount, From, To", "error");
      return;
    }
    setSaving(true);
    try {
      const payload = { ...form, amount: parseFloat(form.amount) };
      if (editTx) {
        await api.updateTransaction(editTx.transaction_id, payload);
        toast("Transaction updated", "success");
      } else {
        await api.createTransaction(payload);
        toast("Transaction added", "success");
      }
      onSave();
    } catch (err) {
      toast(err.message, "error");
    }
    setSaving(false);
  };

  // Quick presets for common transaction types
  const presets = [
    { label: "🛒 Expense", debitType: "Expense", creditType: "Asset" },
    { label: "💰 Income", debitType: "Asset", creditType: "Income" },
    { label: "🔄 Transfer", debitType: "Asset", creditType: "Asset" },
    { label: "💳 EMI", debitType: "Liability", creditType: "Asset" },
  ];

  const applyPreset = (p) => {
    const debit = accounts.find((a) => a.account_type === p.debitType);
    const credit = accounts.find((a) => a.account_type === p.creditType);
    setForm({
      ...form,
      debit_account_id: debit?.account_id || "",
      credit_account_id: credit?.account_id || "",
    });
  };

  const grouped = {};
  accounts.forEach((a) => {
    if (!grouped[a.account_type]) grouped[a.account_type] = [];
    grouped[a.account_type].push(a);
  });

  const accountOpts = [
    { value: "", label: "Select account" },
    ...Object.entries(grouped).flatMap(([type, accs]) => [
      { value: `__group_${type}`, label: `── ${type} ──`, disabled: true },
      ...accs.map((a) => ({ value: a.account_id, label: `  ${a.account_name}` })),
    ]),
  ];

  const categories = [
    "Uncategorized", "Groceries", "Dining Out", "Rent", "EMI Payment", "Electricity", "Water", "Internet", "Mobile",
    "Fuel", "Public Transport", "Medical", "Shopping", "Entertainment", "Travel", "Education", "Insurance",
    "Salary", "Interest", "Dividend", "Freelance", "Gift", "Tax", "Donation", "Household", "Personal Care", "Miscellaneous",
  ];

  const taxCategories = ["", "80C", "80D", "80E", "80G", "80TTA", "80CCD", "24(b)", "10(14)", "HRA", "LTA"];

  return (
    <Modal open={open} onClose={onClose} title={editTx ? "Edit Transaction" : "New Transaction"}>
      {!editTx && (
        <div style={{ display: "flex", gap: 6, marginBottom: 16, flexWrap: "wrap" }}>
          {presets.map((p) => (
            <Btn key={p.label} variant="secondary" size="sm" onClick={() => applyPreset(p)}>{p.label}</Btn>
          ))}
        </div>
      )}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0 12px" }}>
        <Input label="Date *" type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
        <Input label="Amount *" type="number" placeholder="₹ 0" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} />
      </div>
      <Select
        label="Debit (From / Where money goes) *"
        value={form.debit_account_id}
        onChange={(e) => setForm({ ...form, debit_account_id: e.target.value })}
        options={accountOpts}
      />
      <Select
        label="Credit (To / Where money comes from) *"
        value={form.credit_account_id}
        onChange={(e) => setForm({ ...form, credit_account_id: e.target.value })}
        options={accountOpts}
      />
      <Input label="Description" placeholder="What was this for?" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
      <Input label="Narration" placeholder="Bank narration / ref" value={form.narration} onChange={(e) => setForm({ ...form, narration: e.target.value })} />
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0 12px" }}>
        <Select label="Category" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} options={categories} />
        <Select
          label="Tax Section"
          value={form.tax_category}
          onChange={(e) => setForm({ ...form, tax_category: e.target.value })}
          options={taxCategories.map((t) => ({ value: t, label: t || "None" }))}
        />
      </div>
      <div style={{ display: "flex", gap: 10, marginTop: 8 }}>
        <Btn variant="secondary" onClick={onClose} style={{ flex: 1 }}>Cancel</Btn>
        <Btn onClick={handleSave} loading={saving} style={{ flex: 2 }}>{editTx ? "Update" : "Add Transaction"}</Btn>
      </div>
    </Modal>
  );
}

// ============================================================
// ACCOUNTS TAB
// ============================================================
function AccountsTab({ accounts, refreshAccounts, toast }) {
  const [showModal, setShowModal] = useState(false);
  const [editAcc, setEditAcc] = useState(null);
  const [filter, setFilter] = useState("All");

  const types = ["All", "Asset", "Liability", "Income", "Expense", "Equity"];
  const filtered = filter === "All" ? accounts : accounts.filter((a) => a.account_type === filter);

  // Group by type
  const grouped = {};
  filtered.forEach((a) => {
    if (!grouped[a.account_type]) grouped[a.account_type] = [];
    grouped[a.account_type].push(a);
  });

  const handleDelete = async (id) => {
    if (!confirm("Delete this account? Only works if no transactions are linked.")) return;
    try {
      await api.deleteAccount(id);
      toast("Account deleted", "success");
      refreshAccounts();
    } catch (err) {
      toast(err.message, "error");
    }
  };

  // Summary cards
  const totals = {};
  accounts.forEach((a) => {
    if (!totals[a.account_type]) totals[a.account_type] = 0;
    totals[a.account_type] += parseFloat(a.calculated_balance || a.current_balance || 0);
  });
  const netWorth = (totals.Asset || 0) - (totals.Liability || 0);

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 22, fontWeight: 700, letterSpacing: "-0.02em" }}>Accounts</h2>
          <span style={{ fontSize: 13, color: theme.textSec }}>{accounts.length} accounts</span>
        </div>
        <Btn onClick={() => { setEditAcc(null); setShowModal(true); }}>{Icons.plus} Add</Btn>
      </div>

      {/* Net Worth Banner */}
      <Card style={{ marginBottom: 16, background: theme.accent, color: "#fff", border: "none" }}>
        <div style={{ fontSize: 12, opacity: 0.7, marginBottom: 2 }}>Net Worth</div>
        <div style={{ fontSize: 28, fontWeight: 700, fontFamily: theme.fontMono, letterSpacing: "-0.02em" }}>{fmtFull(netWorth)}</div>
        <div style={{ display: "flex", gap: 16, marginTop: 10, fontSize: 12 }}>
          <span>Assets: <strong style={{ fontFamily: theme.fontMono }}>{fmtFull(totals.Asset || 0)}</strong></span>
          <span>Liabilities: <strong style={{ fontFamily: theme.fontMono }}>{fmtFull(totals.Liability || 0)}</strong></span>
        </div>
      </Card>

      {/* Type Filter Pills */}
      <div style={{ display: "flex", gap: 6, marginBottom: 16, overflowX: "auto", paddingBottom: 4 }}>
        {types.map((t) => (
          <button
            key={t}
            onClick={() => setFilter(t)}
            style={{
              padding: "6px 14px",
              borderRadius: 20,
              border: "none",
              fontSize: 12,
              fontWeight: 500,
              cursor: "pointer",
              fontFamily: theme.font,
              whiteSpace: "nowrap",
              background: filter === t ? theme.accent : theme.accentLight,
              color: filter === t ? "#fff" : theme.textSec,
            }}
          >
            {t === "All" ? `All (${accounts.length})` : `${t} (${accounts.filter((a) => a.account_type === t).length})`}
          </button>
        ))}
      </div>

      {/* Account Groups */}
      {Object.entries(grouped).map(([type, accs]) => (
        <div key={type} style={{ marginBottom: 20 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
            <span style={{ fontSize: 14, color: typeColors[type] }}>{typeIcons[type]}</span>
            <span style={{ fontSize: 13, fontWeight: 600, color: theme.textSec, textTransform: "uppercase", letterSpacing: "0.05em" }}>{type}</span>
            <span style={{ fontSize: 12, color: theme.textTer, fontFamily: theme.fontMono }}>
              {fmtFull(accs.reduce((s, a) => s + parseFloat(a.calculated_balance || a.current_balance || 0), 0))}
            </span>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            {accs.map((a) => {
              const bal = parseFloat(a.calculated_balance || a.current_balance || 0);
              return (
                <Card key={a.account_id} style={{ padding: "10px 14px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div>
                      <div style={{ fontSize: 14, fontWeight: 500 }}>{a.account_name}</div>
                      {a.sub_type && <div style={{ fontSize: 11, color: theme.textTer }}>{a.sub_type}</div>}
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span style={{ fontSize: 14, fontWeight: 600, fontFamily: theme.fontMono, color: bal < 0 ? theme.danger : theme.text }}>
                        ₹{fmt(bal)}
                      </span>
                      <button onClick={() => { setEditAcc(a); setShowModal(true); }} style={{ background: "none", border: "none", cursor: "pointer", padding: 2, color: theme.textTer }}>{Icons.edit}</button>
                      <button onClick={() => handleDelete(a.account_id)} style={{ background: "none", border: "none", cursor: "pointer", padding: 2, color: theme.textTer }}>{Icons.trash}</button>
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        </div>
      ))}

      {filtered.length === 0 && <EmptyState icon="🏦" title="No accounts found" sub="Add your first account to get started" />}

      <AccountModal
        open={showModal}
        onClose={() => { setShowModal(false); setEditAcc(null); }}
        editAcc={editAcc}
        onSave={() => { setShowModal(false); setEditAcc(null); refreshAccounts(); }}
        toast={toast}
      />
    </div>
  );
}

function AccountModal({ open, onClose, editAcc, onSave, toast }) {
  const [form, setForm] = useState({ account_name: "", account_type: "Asset", sub_type: "", description: "", opening_balance: 0 });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (editAcc) {
      setForm({ account_name: editAcc.account_name, account_type: editAcc.account_type, sub_type: editAcc.sub_type || "", description: editAcc.description || "", opening_balance: 0 });
    } else {
      setForm({ account_name: "", account_type: "Asset", sub_type: "", description: "", opening_balance: 0 });
    }
  }, [editAcc, open]);

  const subTypes = {
    Asset: ["Bank Account", "Cash", "Fixed Deposit", "Investment", "Retirement", "Property", "Gold", "Crypto", "Other"],
    Liability: ["Loan", "Credit Card", "Other"],
    Income: ["Employment", "Passive", "Business", "Investment", "Other"],
    Expense: ["Food", "Housing", "Utilities", "Transport", "Health", "Insurance", "Lifestyle", "Education", "Debt", "Tax", "Personal", "Other"],
    Equity: ["Capital", "Other"],
  };

  const handleSave = async () => {
    if (!form.account_name) { toast("Account name is required", "error"); return; }
    setSaving(true);
    try {
      if (editAcc) {
        await api.updateAccount(editAcc.account_id, form);
        toast("Account updated", "success");
      } else {
        await api.createAccount(form);
        toast("Account created", "success");
      }
      onSave();
    } catch (err) {
      toast(err.message, "error");
    }
    setSaving(false);
  };

  return (
    <Modal open={open} onClose={onClose} title={editAcc ? "Edit Account" : "New Account"}>
      <Input label="Account Name *" placeholder="e.g. SBI Savings" value={form.account_name} onChange={(e) => setForm({ ...form, account_name: e.target.value })} />
      {!editAcc && (
        <Select label="Account Type *" value={form.account_type} onChange={(e) => setForm({ ...form, account_type: e.target.value, sub_type: "" })} options={["Asset", "Liability", "Income", "Expense", "Equity"]} />
      )}
      <Select label="Sub Type" value={form.sub_type} onChange={(e) => setForm({ ...form, sub_type: e.target.value })} options={["", ...(subTypes[form.account_type] || [])].map((s) => ({ value: s, label: s || "Select sub type" }))} />
      <Input label="Description" placeholder="Optional notes" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
      {!editAcc && <Input label="Opening Balance" type="number" placeholder="0" value={form.opening_balance} onChange={(e) => setForm({ ...form, opening_balance: parseFloat(e.target.value) || 0 })} />}
      <div style={{ display: "flex", gap: 10, marginTop: 8 }}>
        <Btn variant="secondary" onClick={onClose} style={{ flex: 1 }}>Cancel</Btn>
        <Btn onClick={handleSave} loading={saving} style={{ flex: 2 }}>{editAcc ? "Update" : "Create Account"}</Btn>
      </div>
    </Modal>
  );
}

// ============================================================
// DASHBOARD TAB
// ============================================================
function DashboardTab({ user, toast }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const d = await api.getDashboard();
        setData(d);
      } catch (err) {
        toast(err.message, "error");
      }
      setLoading(false);
    })();
  }, [toast]);

  if (loading) return <div style={{ textAlign: "center", padding: 60 }}><Spinner size={28} /></div>;
  if (!data) return <EmptyState icon="📊" title="Could not load dashboard" sub="Please try again" />;

  const monthlyData = (data.monthly_summary || []).reverse().slice(-6);
  const maxVal = Math.max(...monthlyData.flatMap((m) => [parseFloat(m.income), parseFloat(m.expenses)]), 1);

  return (
    <div>
      <div style={{ marginBottom: 20 }}>
        <h2 style={{ margin: 0, fontSize: 22, fontWeight: 700, letterSpacing: "-0.02em" }}>Dashboard</h2>
        <span style={{ fontSize: 13, color: theme.textSec }}>Welcome back{user?.name ? `, ${user.name.split(" ")[0]}` : ""}</span>
      </div>

      {/* Summary Cards */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 16 }}>
        {[
          { label: "Net Worth", value: data.net_worth, color: theme.accent },
          { label: "Assets", value: data.total_assets, color: theme.success },
          { label: "Liabilities", value: data.total_liabilities, color: theme.danger },
          { label: "Transactions", value: data.transaction_count, color: theme.info, isCount: true },
        ].map((c) => (
          <Card key={c.label} style={{ padding: 14 }}>
            <div style={{ fontSize: 11, color: theme.textSec, marginBottom: 4, textTransform: "uppercase", letterSpacing: "0.04em" }}>{c.label}</div>
            <div style={{ fontSize: 20, fontWeight: 700, fontFamily: theme.fontMono, color: c.color, letterSpacing: "-0.02em" }}>
              {c.isCount ? c.value : `₹${fmt(c.value)}`}
            </div>
          </Card>
        ))}
      </div>

      {/* Monthly Chart */}
      {monthlyData.length > 0 && (
        <Card style={{ marginBottom: 16, padding: 16 }}>
          <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 14 }}>Monthly Income vs Expenses</div>
          <div style={{ display: "flex", gap: 3, alignItems: "flex-end", height: 120 }}>
            {monthlyData.map((m) => (
              <div key={m.month} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 2 }}>
                <div style={{ display: "flex", gap: 1, alignItems: "flex-end", height: 90, width: "100%" }}>
                  <div style={{ flex: 1, background: "#d1fae5", borderRadius: "3px 3px 0 0", height: `${(parseFloat(m.income) / maxVal) * 100}%`, minHeight: 2, transition: "height 0.3s" }} />
                  <div style={{ flex: 1, background: "#fee2e2", borderRadius: "3px 3px 0 0", height: `${(parseFloat(m.expenses) / maxVal) * 100}%`, minHeight: 2, transition: "height 0.3s" }} />
                </div>
                <div style={{ fontSize: 9, color: theme.textTer, marginTop: 2 }}>{m.month.slice(5)}</div>
              </div>
            ))}
          </div>
          <div style={{ display: "flex", gap: 16, marginTop: 10, justifyContent: "center" }}>
            <span style={{ fontSize: 11, display: "flex", alignItems: "center", gap: 4 }}><span style={{ width: 8, height: 8, borderRadius: 2, background: "#d1fae5", display: "inline-block" }} /> Income</span>
            <span style={{ fontSize: 11, display: "flex", alignItems: "center", gap: 4 }}><span style={{ width: 8, height: 8, borderRadius: 2, background: "#fee2e2", display: "inline-block" }} /> Expense</span>
          </div>
        </Card>
      )}

      {/* Top Categories */}
      {(data.top_categories || []).length > 0 && (
        <Card style={{ marginBottom: 16, padding: 16 }}>
          <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 12 }}>Top Spending (This Month)</div>
          {data.top_categories.slice(0, 6).map((c, i) => {
            const maxCat = parseFloat(data.top_categories[0].total);
            return (
              <div key={c.category} style={{ marginBottom: 10 }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 3 }}>
                  <span style={{ fontSize: 13, color: theme.text }}>{c.category}</span>
                  <span style={{ fontSize: 13, fontFamily: theme.fontMono, color: theme.textSec }}>₹{fmt(c.total)}</span>
                </div>
                <div style={{ height: 4, background: theme.accentLight, borderRadius: 2 }}>
                  <div style={{ height: "100%", background: theme.accent, borderRadius: 2, width: `${(parseFloat(c.total) / maxCat) * 100}%`, opacity: 1 - i * 0.1, transition: "width 0.3s" }} />
                </div>
              </div>
            );
          })}
        </Card>
      )}

      {/* Recent Transactions */}
      {(data.recent_transactions || []).length > 0 && (
        <Card style={{ padding: 16 }}>
          <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 12 }}>Recent Transactions</div>
          {data.recent_transactions.slice(0, 5).map((tx) => (
            <div key={tx.transaction_id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 0", borderBottom: `1px solid ${theme.accentLight}` }}>
              <div>
                <div style={{ fontSize: 13, fontWeight: 500 }}>{tx.description || tx.category}</div>
                <div style={{ fontSize: 11, color: theme.textTer }}>{fmtDate(tx.date)}</div>
              </div>
              <span style={{ fontSize: 14, fontWeight: 600, fontFamily: theme.fontMono }}>₹{fmt(tx.amount)}</span>
            </div>
          ))}
        </Card>
      )}
    </div>
  );
}

// ============================================================
// REPORTS TAB
// ============================================================
function ReportsTab({ toast }) {
  const [fire, setFire] = useState(null);
  const [tax, setTax] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeReport, setActiveReport] = useState("fire");

  useEffect(() => {
    (async () => {
      try {
        const [f, t] = await Promise.all([api.getFIRE("current_age=30&target_age=45"), api.getTaxSummary()]);
        setFire(f);
        setTax(t);
      } catch (err) {
        toast(err.message, "error");
      }
      setLoading(false);
    })();
  }, [toast]);

  if (loading) return <div style={{ textAlign: "center", padding: 60 }}><Spinner size={28} /></div>;

  return (
    <div>
      <h2 style={{ margin: "0 0 16px", fontSize: 22, fontWeight: 700, letterSpacing: "-0.02em" }}>Reports</h2>

      {/* Report Selector */}
      <div style={{ display: "flex", gap: 6, marginBottom: 20 }}>
        {[
          { id: "fire", label: "🔥 FIRE", icon: Icons.fire },
          { id: "tax", label: "📋 Tax Summary" },
        ].map((r) => (
          <button
            key={r.id}
            onClick={() => setActiveReport(r.id)}
            style={{
              padding: "8px 16px",
              borderRadius: 20,
              border: "none",
              fontSize: 13,
              fontWeight: 500,
              cursor: "pointer",
              fontFamily: theme.font,
              background: activeReport === r.id ? theme.accent : theme.accentLight,
              color: activeReport === r.id ? "#fff" : theme.textSec,
            }}
          >
            {r.label}
          </button>
        ))}
      </div>

      {/* FIRE Report */}
      {activeReport === "fire" && fire && (
        <div>
          {/* Progress Ring */}
          <Card style={{ marginBottom: 16, padding: 24, textAlign: "center" }}>
            <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 16 }}>FIRE Progress</div>
            <div style={{ position: "relative", width: 160, height: 160, margin: "0 auto" }}>
              <svg width="160" height="160" viewBox="0 0 160 160">
                <circle cx="80" cy="80" r="70" stroke={theme.accentLight} strokeWidth="10" fill="none" />
                <circle
                  cx="80" cy="80" r="70" stroke={theme.success} strokeWidth="10" fill="none"
                  strokeDasharray={`${2 * Math.PI * 70}`}
                  strokeDashoffset={`${2 * Math.PI * 70 * (1 - Math.min(fire.progress_percentage, 100) / 100)}`}
                  strokeLinecap="round"
                  transform="rotate(-90 80 80)"
                  style={{ transition: "stroke-dashoffset 1s ease" }}
                />
              </svg>
              <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center" }}>
                <div style={{ fontSize: 28, fontWeight: 700, fontFamily: theme.fontMono, color: theme.text }}>{Math.min(fire.progress_percentage, 100).toFixed(1)}%</div>
                <div style={{ fontSize: 11, color: theme.textSec }}>of FIRE goal</div>
              </div>
            </div>
          </Card>

          {/* FIRE Stats */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 16 }}>
            {[
              { label: "FIRE Number", value: `₹${fmt(fire.fire_number)}`, color: theme.warning },
              { label: "Net Worth", value: `₹${fmt(fire.current_net_worth)}`, color: theme.success },
              { label: "Monthly Savings", value: `₹${fmt(fire.monthly_savings)}`, color: theme.info },
              { label: "Savings Rate", value: `${fire.savings_rate}%`, color: fire.savings_rate >= 50 ? theme.success : theme.warning },
              { label: "Years to FIRE", value: fire.years_to_fire || "∞", color: theme.accent },
              { label: "FIRE Age", value: fire.fire_age || "—", color: theme.accent },
            ].map((s) => (
              <Card key={s.label} style={{ padding: 12 }}>
                <div style={{ fontSize: 11, color: theme.textSec, marginBottom: 2, textTransform: "uppercase", letterSpacing: "0.04em" }}>{s.label}</div>
                <div style={{ fontSize: 18, fontWeight: 700, fontFamily: theme.fontMono, color: s.color }}>{s.value}</div>
              </Card>
            ))}
          </div>

          {/* Monthly Breakdown */}
          <Card style={{ padding: 16 }}>
            <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 12 }}>Monthly Snapshot</div>
            {[
              { label: "Income", value: fire.monthly_income, color: theme.success },
              { label: "Expenses", value: fire.monthly_expenses, color: theme.danger },
              { label: "Savings", value: fire.monthly_savings, color: theme.info },
            ].map((r) => (
              <div key={r.label} style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderBottom: `1px solid ${theme.accentLight}` }}>
                <span style={{ fontSize: 13, color: theme.textSec }}>{r.label}</span>
                <span style={{ fontSize: 14, fontWeight: 600, fontFamily: theme.fontMono, color: r.color }}>{fmtFull(r.value)}</span>
              </div>
            ))}
          </Card>
        </div>
      )}

      {/* Tax Report */}
      {activeReport === "tax" && (
        <div>
          <Card style={{ marginBottom: 16, padding: 16 }}>
            <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 4 }}>Tax Summary</div>
            <div style={{ fontSize: 12, color: theme.textSec, marginBottom: 16 }}>FY {tax?.financial_year || "Current"}</div>

            {tax?.tax_categories && Object.keys(tax.tax_categories).length > 0 ? (
              Object.entries(tax.tax_categories).map(([section, info]) => (
                <div key={section} style={{ marginBottom: 16 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                    <Pill color={theme.info}>Section {section}</Pill>
                    <span style={{ fontSize: 14, fontWeight: 600, fontFamily: theme.fontMono }}>{fmtFull(info.total)}</span>
                  </div>
                  {info.items.map((item, i) => (
                    <div key={i} style={{ display: "flex", justifyContent: "space-between", padding: "4px 0 4px 12px", fontSize: 13 }}>
                      <span style={{ color: theme.textSec }}>{item.category}</span>
                      <span style={{ fontFamily: theme.fontMono }}>{fmtFull(item.total_amount)}</span>
                    </div>
                  ))}
                </div>
              ))
            ) : (
              <EmptyState icon="📋" title="No tax data" sub="Tag transactions with tax sections to see them here" />
            )}
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
  const [initializing, setInitializing] = useState(true);

  const toast = useCallback((message, type = "info") => {
    setToastMsg({ message, type, key: Date.now() });
  }, []);

  const refreshAccounts = useCallback(async () => {
    try {
      const accs = await api.getAccounts();
      setAccounts(accs);
    } catch (err) {
      console.error("Failed to refresh accounts:", err);
    }
  }, []);

  // Auto-login from stored token
  useEffect(() => {
    (async () => {
      const token = localStorage.getItem("ft_token");
      if (token) {
        api.token = token;
        try {
          const u = await api.me();
          setUser(u);
          const accs = await api.getAccounts();
          setAccounts(accs);
        } catch {
          localStorage.removeItem("ft_token");
          api.token = null;
        }
      }
      setInitializing(false);
    })();
  }, []);

  const handleLogin = async (u, token) => {
    setUser(u);
    api.token = token;
    try {
      const accs = await api.getAccounts();
      setAccounts(accs);
    } catch {}
  };

  const handleLogout = () => {
    localStorage.removeItem("ft_token");
    api.token = null;
    setUser(null);
    setAccounts([]);
    setTab("transactions");
  };

  if (initializing) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: theme.bg, fontFamily: theme.font }}>
        <div style={{ textAlign: "center" }}>
          <Spinner size={32} />
          <div style={{ marginTop: 12, fontSize: 14, color: theme.textSec }}>Loading...</div>
        </div>
      </div>
    );
  }

  if (!user) return <AuthScreen onLogin={handleLogin} />;

  const tabs = [
    { id: "transactions", label: "Transactions", icon: Icons.transactions },
    { id: "accounts", label: "Accounts", icon: Icons.accounts },
    { id: "dashboard", label: "Dashboard", icon: Icons.dashboard },
    { id: "reports", label: "Reports", icon: Icons.reports },
  ];

  return (
    <div style={{ minHeight: "100vh", background: theme.bg, fontFamily: theme.font, color: theme.text }}>
      {/* Global Styles */}
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;600;700&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { margin: 0; -webkit-font-smoothing: antialiased; }
        input:focus, select:focus { border-color: ${theme.accent} !important; }
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes slideUp { from { transform: translateY(100%); } to { transform: translateY(0); } }
        @keyframes slideDown { from { transform: translateY(-20px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
        ::-webkit-scrollbar { width: 4px; }
        ::-webkit-scrollbar-thumb { background: #d4d4d4; border-radius: 2px; }
        select option:disabled { color: #999; font-weight: 600; font-size: 12px; }
      `}</style>

      {/* Toast */}
      {toastMsg && <Toast {...toastMsg} onClose={() => setToastMsg(null)} />}

      {/* Top Bar */}
      <div style={{ position: "sticky", top: 0, zIndex: 100, background: "rgba(250,250,250,0.85)", backdropFilter: "blur(12px)", borderBottom: `1px solid ${theme.border}` }}>
        <div style={{ maxWidth: 480, margin: "0 auto", padding: "10px 16px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ fontSize: 18, fontWeight: 700, letterSpacing: "-0.03em" }}>₹ tracker</div>
          <button
            onClick={handleLogout}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 4,
              background: "none",
              border: "none",
              cursor: "pointer",
              fontSize: 12,
              color: theme.textSec,
              fontFamily: theme.font,
            }}
          >
            {Icons.logout}
          </button>
        </div>
      </div>

      {/* Content */}
      <div style={{ maxWidth: 480, margin: "0 auto", padding: "16px 16px 100px" }}>
        {tab === "transactions" && <TransactionsTab accounts={accounts} toast={toast} />}
        {tab === "accounts" && <AccountsTab accounts={accounts} refreshAccounts={refreshAccounts} toast={toast} />}
        {tab === "dashboard" && <DashboardTab user={user} toast={toast} />}
        {tab === "reports" && <ReportsTab toast={toast} />}
      </div>

      {/* Bottom Navigation */}
      <div style={{ position: "fixed", bottom: 0, left: 0, right: 0, background: "rgba(255,255,255,0.92)", backdropFilter: "blur(12px)", borderTop: `1px solid ${theme.border}`, zIndex: 100 }}>
        <div style={{ maxWidth: 480, margin: "0 auto", display: "flex" }}>
          {tabs.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              style={{
                flex: 1,
                padding: "8px 0 max(8px, env(safe-area-inset-bottom))",
                border: "none",
                background: "none",
                cursor: "pointer",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: 2,
                color: tab === t.id ? theme.accent : theme.textTer,
                transition: "color 0.15s",
                fontFamily: theme.font,
              }}
            >
              {t.icon}
              <span style={{ fontSize: 10, fontWeight: tab === t.id ? 600 : 400 }}>{t.label}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
