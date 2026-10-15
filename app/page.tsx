"use client";

import {
  ArrowDownLeft,
  ArrowUpRight,
  BarChart3,
  Bell,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  CalendarDays,
  CircleHelp,
  ClipboardList,
  CreditCard,
  LayoutDashboard,
  Menu,
  PackageSearch,
  Plus,
  ScanLine,
  Search,
  Settings,
  Smartphone,
  TrendingUp,
  X,
} from "lucide-react";
import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";

type Status = "In stock" | "Sold" | "Returned";
type Phone = {
  id: number;
  model: string;
  brand: string;
  imei: string;
  purchasePrice: number;
  salePrice?: number;
  purchasedAt: string;
  soldAt?: string;
  status: Status;
  sellerName?: string;
  sellerCnic?: string;
  customer?: string;
};
type Admin = { id?: string; name: string; username: string; email?: string; emailVerifiedAt?: string | null };

const navItems = [
  { label: "Home", icon: LayoutDashboard },
  { label: "Inventory", icon: Smartphone },
  { label: "Ledger", icon: ClipboardList },
  { label: "Reports", icon: BarChart3 },
];

const money = (value: number) => `Rs ${value.toLocaleString("en-PK")}`;
const dateKey = (date: Date) => { const offset = date.getTimezoneOffset(); return new Date(date.getTime() - offset * 60000).toISOString().slice(0, 10); };
const appViews = ["Home", "Inventory", "Ledger", "Reports", "Settings"] as const;
type AppView = typeof appViews[number];
const viewFromLocation = (): AppView => { const view = new URLSearchParams(window.location.search).get("view"); return appViews.includes(view as AppView) ? view as AppView : "Home"; };

const mapApiPhone = (phone: Record<string, unknown>): Phone => ({
  id: String(phone.id) as unknown as number,
  model: String(phone.model ?? ""),
  brand: String(phone.brand ?? "Other"),
  imei: String(phone.imei ?? ""),
  purchasePrice: Number(phone.purchase_price ?? 0),
  salePrice: phone.sale_price == null ? undefined : Number(phone.sale_price),
  purchasedAt: String(phone.purchased_at ?? ""),
  soldAt: phone.sold_at == null ? undefined : String(phone.sold_at),
  status: String(phone.status ?? "In stock") as Status,
  sellerName: phone.seller_name == null ? undefined : String(phone.seller_name),
  sellerCnic: phone.seller_cnic == null ? undefined : String(phone.seller_cnic),
  customer: phone.customer_name == null ? undefined : String(phone.customer_name),
});

export default function Home() {
  const [active, setActive] = useState<AppView>(() => typeof window === "undefined" ? "Home" : viewFromLocation());
  const [phones, setPhones] = useState<Phone[]>([]);
  const [query, setQuery] = useState("");
  const [period, setPeriod] = useState("Today");
  const [showScanner, setShowScanner] = useState(false);
  const [showPurchase, setShowPurchase] = useState(false);
  const [showSale, setShowSale] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [toast, setToast] = useState("");
  const [selectedPhone, setSelectedPhone] = useState<Phone | null>(null);
  const [liveMode, setLiveMode] = useState(false);
  const [ledgerSummary, setLedgerSummary] = useState<{ sales: number; purchases: number; cost_of_goods: number; gross_profit: number; sales_count: number; purchases_count: number } | null>(null);
  const [monthSummary, setMonthSummary] = useState<{ sales: number; purchases: number; cost_of_goods: number; gross_profit: number; sales_count: number; purchases_count: number } | null>(null);
  const [dataVersion, setDataVersion] = useState(0);
  const [admin, setAdmin] = useState<Admin | null>(null);

  const filteredPhones = useMemo(() => {
    const needle = query.toLowerCase().trim();
    if (!needle) return phones;
    return phones.filter((phone) => `${phone.model} ${phone.brand} ${phone.imei} ${phone.status}`.toLowerCase().includes(needle));
  }, [phones, query]);

  const { soldPhones, stockPhones, todaySoldPhones, todayPurchasedPhones, todaySales, todayPurchases, todayProfit } = useMemo(() => {
    const sold = phones.filter((phone) => phone.status === "Sold");
    const stock = phones.filter((phone) => phone.status === "In stock");
    const currentDay = dateKey(new Date());
    const todaySold = sold.filter((phone) => phone.soldAt === currentDay);
    const todayPurchased = phones.filter((phone) => phone.purchasedAt === currentDay);
    return {
      soldPhones: sold,
      stockPhones: stock,
      todaySoldPhones: todaySold,
      todayPurchasedPhones: todayPurchased,
      todaySales: todaySold.reduce((total, phone) => total + (phone.salePrice ?? 0), 0),
      todayPurchases: todayPurchased.reduce((total, phone) => total + phone.purchasePrice, 0),
      todayProfit: todaySold.reduce((total, phone) => total + ((phone.salePrice ?? 0) - phone.purchasePrice), 0),
    };
  }, [phones]);

  const navigate = useCallback((view: AppView, replace = false) => {
    setActive(view);
    if (typeof window !== "undefined") {
      const url = `/?view=${view.toLowerCase()}`;
      if (window.location.pathname + window.location.search !== url) window.history[replace ? "replaceState" : "pushState"]({ view }, "", url);
    }
  }, []);

  const openScanner = useCallback(() => setShowScanner(true), []);
  const openPurchase = useCallback(() => setShowPurchase(true), []);
  const openSale = useCallback(() => setShowSale(true), []);
  const viewInventory = useCallback(() => navigate("Inventory"), [navigate]);
  const viewLedger = useCallback(() => navigate("Ledger"), [navigate]);
  const viewReports = useCallback(() => navigate("Reports"), [navigate]);
  const adminName = admin?.name || "Administrator";
  const adminInitials = adminName.split(/\s+/).map((part) => part[0]).join("").slice(0, 2).toUpperCase();
  const syncChannelRef = useRef<BroadcastChannel | null>(null);
  const notifyDataChanged = useCallback(() => syncChannelRef.current?.postMessage({ type: "data-changed" }), []);

  const refreshData = useCallback(async (signal?: AbortSignal) => {
    try {
      const now = new Date();
      const today = dateKey(now);
      const monthStart = dateKey(new Date(now.getFullYear(), now.getMonth(), 1));
      const [phonesResponse, todayResponse, monthResponse] = await Promise.all([
        fetch("/api/phones", { signal }),
        fetch(`/api/ledger?from=${today}&to=${today}`, { signal }),
        fetch(`/api/ledger?from=${monthStart}&to=${today}`, { signal }),
      ]);
      if (signal?.aborted) return;
      const [phonesPayload, todayPayload, monthPayload] = await Promise.all([
        phonesResponse.ok ? phonesResponse.json() : Promise.resolve(null),
        todayResponse.ok ? todayResponse.json() : Promise.resolve(null),
        monthResponse.ok ? monthResponse.json() : Promise.resolve(null),
      ]);
      if (signal?.aborted) return;
      if (phonesPayload?.phones) {
        setPhones(phonesPayload.phones.map(mapApiPhone));
        setLiveMode(true);
      }
      if (todayPayload?.summary) setLedgerSummary({ sales: Number(todayPayload.summary.sales ?? 0), purchases: Number(todayPayload.summary.purchases ?? 0), cost_of_goods: Number(todayPayload.summary.cost_of_goods ?? 0), gross_profit: Number(todayPayload.summary.gross_profit ?? 0), sales_count: Number(todayPayload.summary.sales_count ?? 0), purchases_count: Number(todayPayload.summary.purchases_count ?? 0) });
      if (monthPayload?.summary) setMonthSummary({ sales: Number(monthPayload.summary.sales ?? 0), purchases: Number(monthPayload.summary.purchases ?? 0), cost_of_goods: Number(monthPayload.summary.cost_of_goods ?? 0), gross_profit: Number(monthPayload.summary.gross_profit ?? 0), sales_count: Number(monthPayload.summary.sales_count ?? 0), purchases_count: Number(monthPayload.summary.purchases_count ?? 0) });
      setDataVersion((current) => current + 1);
    } catch (error) {
      if (!(error instanceof DOMException && error.name === "AbortError")) console.error("live sync failed", error);
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    const syncIfVisible = () => { if (document.visibilityState === "visible") void refreshData(controller.signal); };
    const channel = typeof BroadcastChannel === "undefined" ? null : new BroadcastChannel("ledgerline-data");
    syncChannelRef.current = channel;
    void refreshData(controller.signal);
    const interval = window.setInterval(syncIfVisible, 60000);
    window.addEventListener("focus", syncIfVisible);
    document.addEventListener("visibilitychange", syncIfVisible);
    channel?.addEventListener("message", syncIfVisible);
    return () => {
      controller.abort();
      window.clearInterval(interval);
      window.removeEventListener("focus", syncIfVisible);
      document.removeEventListener("visibilitychange", syncIfVisible);
      channel?.removeEventListener("message", syncIfVisible);
      channel?.close();
      syncChannelRef.current = null;
    };
  }, [refreshData]);

  useEffect(() => {
    fetch("/api/auth/me").then(async (response) => response.ok ? response.json() : null).then((payload) => { if (payload?.admin) setAdmin({ id: String(payload.admin.id || ""), name: String(payload.admin.name || "Administrator"), username: String(payload.admin.username || ""), email: payload.admin.email ? String(payload.admin.email) : undefined, emailVerifiedAt: payload.admin.email_verified_at ? String(payload.admin.email_verified_at) : null }); }).catch(() => undefined);
  }, []);

  useEffect(() => {
    const syncView = () => setActive(viewFromLocation());
    window.addEventListener("popstate", syncView);
    return () => window.removeEventListener("popstate", syncView);
  }, []);

  useEffect(() => {
    if (!toast) return;
    const timeout = window.setTimeout(() => setToast(""), 2800);
    return () => window.clearTimeout(timeout);
  }, [toast]);

  useEffect(() => {
    const handleKey = (event: KeyboardEvent) => {
      if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) return;
      if (event.key === "/") { event.preventDefault(); document.getElementById("global-search")?.focus(); }
      if (event.key.toLowerCase() === "p") setShowPurchase(true);
      if (event.key.toLowerCase() === "s") setShowSale(true);
      if (event.key.toLowerCase() === "i") setShowScanner(true);
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, []);

  const notify = (message: string) => setToast(message);

  const handleScan = (value: string) => {
    setShowScanner(false);
    const found = phones.find((phone) => phone.imei === value.trim());
    if (found) {
      setSelectedPhone(found);
      navigate("Inventory");
      notify(`Found ${found.model}`);
    } else {
      setQuery(value);
      navigate("Inventory");
      notify("No exact match — showing search results");
    }
  };

  const handlePurchase = (phone: Phone) => {
    fetch("/api/phones", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(phone) })
      .then(async (response) => ({ response, payload: await response.json().catch(() => ({})) }))
      .then(({ response, payload }) => {
        if (!response.ok) throw new Error(payload.error || "Unable to save purchase");
        setPhones((current) => [...current, mapApiPhone(payload.phone)]);
        const amount = Number(phone.purchasePrice);
        setLedgerSummary((current) => current ? { ...current, purchases: current.purchases + amount, purchases_count: current.purchases_count + 1 } : current);
        setMonthSummary((current) => current ? { ...current, purchases: current.purchases + amount, purchases_count: current.purchases_count + 1 } : current);
        setLiveMode(true);
        setShowPurchase(false);
        void refreshData();
        notifyDataChanged();
        notify("Purchase saved — phone is now in stock");
      })
      .catch(() => {
        notify("Purchase could not be saved. Check the database connection and try again.");
      });
  };

  const handleSale = (imei: string, salePrice: number, customer: string) => {
    const target = phones.find((phone) => phone.imei === imei);
    if (liveMode && target) {
      fetch(`/api/phones/${target.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "sell", salePrice, customer, soldAt: dateKey(new Date()) }) })
        .then(async (response) => ({ response, payload: await response.json().catch(() => ({})) }))
        .then(({ response, payload }) => {
          if (!response.ok) throw new Error(payload.error || "Unable to complete sale");
          setPhones((current) => current.map((phone) => phone.imei === imei ? mapApiPhone(payload.phone) : phone));
          const grossProfit = salePrice - target.purchasePrice;
          setLedgerSummary((current) => current ? { ...current, sales: current.sales + salePrice, cost_of_goods: current.cost_of_goods + target.purchasePrice, gross_profit: current.gross_profit + grossProfit, sales_count: current.sales_count + 1 } : current);
          setMonthSummary((current) => current ? { ...current, sales: current.sales + salePrice, cost_of_goods: current.cost_of_goods + target.purchasePrice, gross_profit: current.gross_profit + grossProfit, sales_count: current.sales_count + 1 } : current);
          setShowSale(false);
          void refreshData();
          notifyDataChanged();
          notify("Sale completed — ledger updated");
        })
        .catch((error) => notify(error.message));
      return;
    }
    notify("Sale could not be completed because the live database is unavailable.");
  };

  const handleReturn = (phone: Phone) => {
    fetch(`/api/phones/${phone.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "return" }) })
      .then(async (response) => ({ response, payload: await response.json().catch(() => ({})) }))
      .then(({ response, payload }) => { if (!response.ok) throw new Error(payload.error || "Unable to record return"); setPhones((current) => current.map((item) => item.imei === phone.imei ? mapApiPhone(payload.phone) : item)); const returnedProfit = (phone.salePrice ?? 0) - phone.purchasePrice; setLedgerSummary((current) => current ? { ...current, sales: current.sales - (phone.salePrice ?? 0), cost_of_goods: current.cost_of_goods - phone.purchasePrice, gross_profit: current.gross_profit - returnedProfit, sales_count: Math.max(0, current.sales_count - 1) } : current); setMonthSummary((current) => current ? { ...current, sales: current.sales - (phone.salePrice ?? 0), cost_of_goods: current.cost_of_goods - phone.purchasePrice, gross_profit: current.gross_profit - returnedProfit, sales_count: Math.max(0, current.sales_count - 1) } : current); void refreshData(); notifyDataChanged(); setSelectedPhone(null); notify("Return recorded — phone is back in stock history"); })
      .catch((error) => notify(error.message));
  };

  return (
    <main className="app-shell">
      <aside className={`sidebar ${showMenu ? "sidebar-open" : ""}`}>
        <div className="brand-lockup">
          <div className="brand-mark">L</div>
          <div><strong>ledgerline</strong><span>shop operations</span></div>
        </div>
        <nav className="primary-nav" aria-label="Primary navigation">
          {navItems.map(({ label, icon: Icon }) => (
            <button key={label} className={`nav-item ${active === label ? "active" : ""}`} onClick={() => { navigate(label as AppView); setShowMenu(false); }}>
              <Icon size={18} strokeWidth={1.8} /><span>{label}</span>
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <button className={`nav-item ${active === "Settings" ? "active" : ""}`} onClick={() => navigate("Settings")}><Settings size={18} strokeWidth={1.8} /><span>Settings</span></button>
          <div className="shop-card"><div className="avatar">{adminInitials}</div><div><strong>{adminName}</strong><span>Administrator</span></div><ChevronDown size={15} /></div>
        </div>
      </aside>

      <section className="main-area">
        <header className="topbar">
          <button className="mobile-menu" onClick={() => setShowMenu(!showMenu)} aria-label="Open menu"><Menu size={21} /></button>
          <div className="breadcrumb"><span>Shop /</span><strong>{active}</strong></div>
          <div className="top-actions">
            <button className="icon-button" aria-label="Help"><CircleHelp size={18} /></button>
            <button className="icon-button notification" aria-label="Notifications"><Bell size={18} /><i /></button>
            <div className="top-avatar">{adminInitials}</div>
          </div>
        </header>

        <div className="content">
          <div className="welcome-row">
          <div><p className="eyebrow">{new Date().toLocaleDateString("en-PK", { weekday: "long", day: "numeric", month: "long", year: "numeric" })} <span className={`mode-pill ${liveMode ? "live" : "demo"}`}>{liveMode ? "LIVE" : "READY"}</span></p><h1>Good morning{admin?.name ? `, ${admin.name}` : ""}.</h1><p className="subtle">Here&apos;s your shop at a glance.</p></div>
          <div className="desktop-actions"><button className="button secondary" onClick={openScanner}><ScanLine size={17} /> Scan IMEI</button><button className="button primary" onClick={openPurchase}><Plus size={17} /> Add purchase</button></div>
          </div>

          {active === "Home" && <Dashboard phones={phones} stockPhones={stockPhones} todaySales={ledgerSummary?.sales ?? todaySales} todayPurchases={ledgerSummary?.purchases ?? todayPurchases} todayProfit={ledgerSummary?.gross_profit ?? todayProfit} salesCount={ledgerSummary?.sales_count ?? todaySoldPhones.length} purchasesCount={ledgerSummary?.purchases_count ?? todayPurchasedPhones.length} monthSummary={monthSummary} onPurchase={openPurchase} onSell={openSale} onScan={openScanner} onViewInventory={viewInventory} onViewLedger={viewLedger} onViewReports={viewReports} />}
          {active === "Inventory" && <Inventory phones={filteredPhones} query={query} setQuery={setQuery} onScan={openScanner} onSelect={setSelectedPhone} />}
          {active === "Ledger" && <Ledger phones={phones} period={period} setPeriod={setPeriod} version={dataVersion} />}
          {active === "Reports" && <Reports phones={phones} version={dataVersion} />}
          {active === "Settings" && <SettingsPanel admin={admin} onAdminUpdated={setAdmin} />}
        </div>
      </section>

      <div className="mobile-dock">
        <button onClick={() => navigate("Home")} className={active === "Home" ? "active" : ""}><LayoutDashboard size={18} /><span>Home</span></button>
        <button onClick={() => navigate("Inventory")} className={active === "Inventory" ? "active" : ""}><Smartphone size={18} /><span>Stock</span></button>
        <button className="dock-scan" onClick={openScanner} aria-label="Scan IMEI"><ScanLine size={22} /></button>
        <button onClick={() => navigate("Ledger")} className={active === "Ledger" ? "active" : ""}><ClipboardList size={18} /><span>Ledger</span></button>
        <button onClick={() => navigate("Reports")} className={active === "Reports" ? "active" : ""}><BarChart3 size={18} /><span>Reports</span></button>
      </div>

      {selectedPhone && <PhoneDetail phone={selectedPhone} onClose={() => setSelectedPhone(null)} onSell={() => { setSelectedPhone(null); setShowSale(true); }} onReturn={() => handleReturn(selectedPhone)} />}
      {showScanner && <ScannerModal onClose={() => setShowScanner(false)} onScan={handleScan} />}
      {showPurchase && <PurchaseModal onClose={() => setShowPurchase(false)} onSave={handlePurchase} />}
      {showSale && <SaleModal phones={stockPhones} onClose={() => setShowSale(false)} onSave={handleSale} />}
      {toast && <div className="toast"><span className="toast-dot" />{toast}</div>}
    </main>
  );
}

const Dashboard = memo(function Dashboard({ phones, stockPhones, todaySales, todayPurchases, todayProfit, salesCount, purchasesCount, monthSummary, onPurchase, onSell, onScan, onViewInventory, onViewLedger, onViewReports }: { phones: Phone[]; stockPhones: Phone[]; todaySales: number; todayPurchases: number; todayProfit: number; salesCount: number; purchasesCount: number; monthSummary: { sales: number; purchases: number; cost_of_goods: number; gross_profit: number; sales_count: number; purchases_count: number } | null; onPurchase: () => void; onSell: () => void; onScan: () => void; onViewInventory: () => void; onViewLedger: () => void; onViewReports: () => void }) {
  const recentPhones = [...phones].sort((a, b) => (b.soldAt ?? b.purchasedAt).localeCompare(a.soldAt ?? a.purchasedAt)).slice(0, 3);
  const now = new Date();
  const daysElapsed = now.getDate();
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const monthStart = dateKey(new Date(now.getFullYear(), now.getMonth(), 1));
  const monthSoldPhones = phones.filter((phone) => phone.status === "Sold" && phone.soldAt && phone.soldAt >= monthStart && phone.soldAt <= dateKey(now));
  const monthPurchasedPhones = phones.filter((phone) => phone.purchasedAt >= monthStart && phone.purchasedAt <= dateKey(now));
  const monthSales = monthSummary?.sales ?? monthSoldPhones.reduce((sum, phone) => sum + (phone.salePrice ?? 0), 0);
  const monthPurchases = monthSummary?.purchases ?? monthPurchasedPhones.reduce((sum, phone) => sum + phone.purchasePrice, 0);
  const monthProfit = monthSummary?.gross_profit ?? monthSoldPhones.reduce((sum, phone) => sum + ((phone.salePrice ?? 0) - phone.purchasePrice), 0);
  const monthSalesCount = monthSummary?.sales_count ?? monthSoldPhones.length;
  const averageDailySales = daysElapsed ? monthSales / daysElapsed : 0;
  const projectedMonthSales = averageDailySales * daysInMonth;
  const stockValue = stockPhones.reduce((total, phone) => total + phone.purchasePrice, 0);
  const totalTracked = phones.length;
  const sellThrough = totalTracked ? Math.round((phones.filter((phone) => phone.status === "Sold").length / totalTracked) * 100) : 0;
  const profitMargin = monthSales ? Math.round((monthProfit / monthSales) * 100) : 0;
  return <>
    <section className="hero-grid"><div className="hero-card"><div className="hero-card-heading"><div><span className="hero-label">CORE ACTIONS</span><h2>Run the counter from one place.</h2></div><p>Choose an action to get started.</p></div><div className="hero-action-rail"><button className="hero-action" onClick={onPurchase}><span className="hero-action-icon purchase"><Plus size={20} /></span><span><strong>Purchase phone</strong><small>Receive into stock</small></span></button><button className="hero-action scan-primary" onClick={onScan}><span className="hero-action-icon scan"><ScanLine size={25} /></span><span><strong>Scan IMEI</strong><small>Lookup or start a transaction</small></span><kbd>I</kbd></button><button className="hero-action" onClick={onSell}><span className="hero-action-icon sale"><CreditCard size={20} /></span><span><strong>Sell phone</strong><small>Complete a sale</small></span></button></div></div></section>
    <section className="performance-panel"><div className="performance-panel-heading"><div><span className="eyebrow">SHOP PERFORMANCE</span><h3>Daily and monthly position</h3></div><span className="subtle">Live operating view</span></div><div className="performance-subheading"><span className="eyebrow">TODAY</span><span>What happened at the counter today</span></div><section className="metric-grid">
      <Metric label="Sales today" value={money(todaySales)} change={`${salesCount} phone${salesCount === 1 ? "" : "s"} sold`} icon={<ArrowUpRight size={16} />} positive />
      <Metric label="Purchases today" value={money(todayPurchases)} change={`${purchasesCount} phone${purchasesCount === 1 ? "" : "s"} received`} icon={<ArrowDownLeft size={16} />} />
      <Metric label="Gross profit today" value={money(todayProfit)} change={todaySales ? `${Math.round((todayProfit / todaySales) * 100)}% margin` : "No sales yet"} icon={<TrendingUp size={16} />} positive />
      <Metric label="Phones in stock" value={String(stockPhones.length).padStart(2, "0")} change={`${money(stockValue)} at cost`} icon={<Smartphone size={16} />} />
    </section><div className="performance-subheading month-performance-heading"><div><span className="eyebrow">MONTH TO DATE</span><span>Know where the month is heading</span></div><span className="subtle">Through {now.toLocaleDateString("en-PK", { day: "numeric", month: "short" })}</span></div><div className="insight-grid"><div className="insight-card"><span className="insight-label">Sales this month</span><strong>{money(monthSales)}</strong><small>{monthSalesCount} phones sold</small></div><div className="insight-card"><span className="insight-label">Average daily sales</span><strong>{money(averageDailySales)}</strong><small>Based on {daysElapsed} elapsed days</small></div><div className="insight-card accent-insight"><span className="insight-label">Estimated month-end sales</span><strong>{money(projectedMonthSales)}</strong><small>Current pace × {daysInMonth} days</small></div><div className="insight-card"><span className="insight-label">Month gross profit</span><strong className={monthProfit >= 0 ? "positive-text" : "negative-text"}>{money(monthProfit)}</strong><small>{profitMargin}% gross margin · {sellThrough}% sell-through</small></div></div></section>
    <section className="section-row"><div className="section-title"><div><span className="eyebrow">SHORTCUTS</span><h3>Keep the shop in view.</h3></div></div><div className="quick-actions"><button onClick={onViewLedger}><span className="quick-icon accent"><ClipboardList size={19} /></span><span><strong>Today&apos;s ledger</strong><small>Review sales, purchases, and profit</small></span><ArrowUpRight size={16} /></button><button onClick={onViewReports}><span className="quick-icon dark"><BarChart3 size={19} /></span><span><strong>Reports &amp; insights</strong><small>See trends and stock risk</small></span><ArrowUpRight size={16} /></button><button onClick={onViewInventory}><span className="quick-icon pale"><PackageSearch size={19} /></span><span><strong>Stock to watch</strong><small>Review phones currently held</small></span><ArrowUpRight size={16} /></button></div></section>
    <section className="lower-grid"><div className="panel"><div className="panel-heading"><div><span className="eyebrow">RECENT ACTIVITY</span><h3>Latest transactions</h3></div><button className="text-button">See all <ArrowUpRight size={14} /></button></div><div className="transaction-list">{recentPhones.map((phone) => <Transaction key={phone.id} icon={phone.status === "Sold" ? <ArrowUpRight /> : <ArrowDownLeft />} title={`${phone.model} ${phone.status === "Sold" ? "sold" : "purchased"}`} meta={`IMEI ending ${phone.imei.slice(-4)} · ${phone.customer ?? phone.sellerName ?? "Direct purchase"}`} amount={`${phone.status === "Sold" ? "+" : "−"}${money(phone.status === "Sold" ? (phone.salePrice ?? 0) : phone.purchasePrice)}`} positive={phone.status === "Sold"} />)}</div></div><div className="panel stock-panel"><div className="panel-heading"><div><span className="eyebrow">ON HAND</span><h3>Stock to watch</h3></div><button className="text-button" onClick={onViewInventory}>All stock <ArrowUpRight size={14} /></button></div>{stockPhones.slice(0, 3).map((phone) => <div className="stock-row" key={phone.id}><div className="phone-placeholder"><Smartphone size={18} /></div><div><strong>{phone.model}</strong><small>{phone.imei.slice(-4)} · {phone.brand}</small></div><span>{money(phone.purchasePrice)}</span></div>)}</div></section>
  </>;
});

function Metric({ label, value, change, icon, positive }: { label: string; value: string; change: string; icon: React.ReactNode; positive?: boolean }) { return <div className="metric"><div className="metric-top"><span>{label}</span><span className={`metric-icon ${positive ? "positive" : ""}`}>{icon}</span></div><strong>{value}</strong><small className={positive ? "positive-text" : ""}>{change}</small></div>; }
function Transaction({ icon, title, meta, amount, positive }: { icon: React.ReactNode; title: string; meta: string; amount: string; positive?: boolean }) { return <div className="transaction"><span className={`transaction-icon ${positive ? "positive" : ""}`}>{icon}</span><div><strong>{title}</strong><small>{meta}</small></div><b className={positive ? "positive-text" : ""}>{amount}</b></div>; }

function Inventory({ phones, query, setQuery, onScan, onSelect }: { phones: Phone[]; query: string; setQuery: (value: string) => void; onScan: () => void; onSelect: (phone: Phone) => void }) { return <><div className="page-heading"><div><span className="eyebrow">INVENTORY / IMEI SEARCH</span><h2>Every phone, accounted for.</h2><p className="subtle">Search by IMEI, model, or current status.</p></div><button className="button primary" onClick={onScan}><ScanLine size={17} /> Scan IMEI</button></div><div className="inventory-toolbar"><div className="search-field"><Search size={17} /><input id="global-search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search IMEI or model..." /><kbd>/</kbd></div><button className="filter-button">All phones <ChevronDown size={15} /></button></div><div className="inventory-table"><div className="table-head"><span>PHONE</span><span>IMEI</span><span>PURCHASED</span><span>STATUS</span><span>VALUE</span></div>{phones.map((phone) => <button className="table-row" key={phone.id} onClick={() => onSelect(phone)}><span className="phone-cell"><span className="phone-thumb"><Smartphone size={17} /></span><span><strong>{phone.model}</strong><small>{phone.brand}</small></span></span><span className="mono">{phone.imei}</span><span>{phone.purchasedAt}</span><span><em className={`status ${phone.status.toLowerCase().replace(" ", "-")}`}>{phone.status}</em></span><span className="value-cell">{money(phone.salePrice ?? phone.purchasePrice)} <ArrowUpRight size={14} /></span></button>)}{phones.length === 0 && <div className="empty-state"><PackageSearch size={24} /><strong>No phones found</strong><span>Try another IMEI, model, or status.</span></div>}</div></>; }

function Ledger({ phones, period, setPeriod, version }: { phones: Phone[]; period: string; setPeriod: (value: string) => void; version: number }) {
  const [summary, setSummary] = useState<{ sales: number; purchases: number; cost_of_goods: number; gross_profit: number; sales_count: number; purchases_count: number } | null>(null);
  const [transactions, setTransactions] = useState<Array<{ event_type: string; amount: string; event_date: string }>>([]);
  useEffect(() => {
    setSummary(null);
    const now = new Date(); const from = new Date(now);
    if (period === "Week") from.setDate(now.getDate() - 6);
    if (period === "Month") from.setDate(1);
    if (period === "Year") { from.setMonth(0); from.setDate(1); }
    const fromKey = dateKey(from); const toKey = dateKey(now);
    fetch(`/api/ledger?from=${fromKey}&to=${toKey}`).then(async (response) => response.ok ? response.json() : null).then((payload) => { if (payload?.summary) setSummary({ sales: Number(payload.summary.sales ?? 0), purchases: Number(payload.summary.purchases ?? 0), cost_of_goods: Number(payload.summary.cost_of_goods ?? 0), gross_profit: Number(payload.summary.gross_profit ?? 0), sales_count: Number(payload.summary.sales_count ?? 0), purchases_count: Number(payload.summary.purchases_count ?? 0) }); setTransactions(payload?.transactions ?? []); }).catch(() => undefined);
  }, [period, version]);
  const now = new Date(); const toKey = dateKey(now); const fromDate = new Date(now);
  if (period === "Week") fromDate.setDate(now.getDate() - 6);
  if (period === "Month") fromDate.setDate(1);
  if (period === "Year") { fromDate.setMonth(0); fromDate.setDate(1); }
  const fromKey = dateKey(fromDate);
  const periodSold = phones.filter((p) => p.status === "Sold" && p.soldAt && p.soldAt >= fromKey && p.soldAt <= toKey);
  const periodPurchased = phones.filter((p) => p.purchasedAt >= fromKey && p.purchasedAt <= toKey);
  const sales = summary?.sales ?? periodSold.reduce((sum, p) => sum + (p.salePrice ?? 0), 0);
  const purchases = summary?.purchases ?? periodPurchased.reduce((sum, p) => sum + p.purchasePrice, 0);
  const costOfGoods = summary?.cost_of_goods ?? periodSold.reduce((sum, p) => sum + p.purchasePrice, 0);
  const profit = summary?.gross_profit ?? sales - costOfGoods;
  const salesCount = summary?.sales_count ?? periodSold.length;
  const purchasesCount = summary?.purchases_count ?? periodPurchased.length;
  const chartDates = Array.from(new Set(transactions.map((row) => row.event_date))).sort().slice(-7);
  const chartSalesValues = chartDates.map((date) => transactions.filter((row) => row.event_date === date && row.event_type === "sale").reduce((sum, row) => sum + Number(row.amount ?? 0), 0));
  const chartPurchaseValues = chartDates.map((date) => transactions.filter((row) => row.event_date === date && row.event_type === "purchase").reduce((sum, row) => sum + Number(row.amount ?? 0), 0));
  const chartMax = Math.max(1, ...chartSalesValues, ...chartPurchaseValues);
  const makeChartPath = (values: number[]) => values.map((value, index) => `${index ? "L" : "M"}${chartDates.length > 1 ? (index / (chartDates.length - 1)) * 700 : 350} ${170 - (value / chartMax) * 150}`).join(" ");
  const salesPath = makeChartPath(chartSalesValues);
  const purchasesPath = makeChartPath(chartPurchaseValues);
  return <><div className="page-heading"><div><span className="eyebrow">LEDGER / FINANCIAL OVERVIEW</span><h2>{period}, at a glance.</h2><p className="subtle">A clear view of money moving through the shop.</p></div><div className="period-picker">{["Today", "Week", "Month", "Year"].map((value) => <button key={value} className={period === value ? "active" : ""} onClick={() => setPeriod(value)}>{value}</button>)}</div></div><div className="ledger-metrics"><Metric label="Total sales" value={money(sales)} change={`${salesCount} phones sold`} positive icon={<ArrowUpRight size={16} />} /><Metric label="Total purchases" value={money(purchases)} change={`${purchasesCount} phones received`} icon={<ArrowDownLeft size={16} />} /><Metric label="Gross profit" value={money(profit)} change={sales ? `${((profit / sales) * 100).toFixed(1)}% margin` : "0% margin"} positive icon={<TrendingUp size={16} />} /></div><div className="panel ledger-panel"><div className="panel-heading"><div><span className="eyebrow">TRANSACTION FLOW</span><h3>Money in and out</h3></div><button className="button secondary" onClick={() => downloadLedgerCsv(transactions)}>Export CSV</button></div><div className="ledger-chart"><div className="chart-y"><span>{money(chartMax)}</span><span>{money(chartMax * .66)}</span><span>{money(chartMax * .33)}</span><span>Rs 0</span></div><div className="chart-body"><div className="grid-line" /><div className="grid-line" /><div className="grid-line" /><div className="grid-line" /><svg viewBox="0 0 700 180" preserveAspectRatio="none" aria-label="Ledger trend"><path d={salesPath} fill="none" stroke="#2e66e7" strokeWidth="3" vectorEffect="non-scaling-stroke" /><path d={purchasesPath} fill="none" stroke="#a9b2c2" strokeWidth="2" vectorEffect="non-scaling-stroke" /></svg><div className="chart-x">{chartDates.map((date) => <span key={date}>{date.slice(5)}</span>)}</div></div></div><div className="legend"><span><i className="blue-dot" /> Sales</span><span><i className="gray-dot" /> Purchases</span></div></div></>;
}

function downloadLedgerCsv(rows: Array<{ event_type: string; amount: string; event_date: string }>) { const csv = ["event_type,amount,event_date", ...rows.map((row) => `${row.event_type},${row.amount},${row.event_date}`)].join("\n"); const link = document.createElement("a"); link.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" })); link.download = "ledger.csv"; link.click(); URL.revokeObjectURL(link.href); }

function DatePicker({ value, onChange, min }: { value: string; onChange: (value: string) => void; min?: string }) {
  const [open, setOpen] = useState(false);
  const selected = new Date(`${value}T00:00:00`);
  const [month, setMonth] = useState(new Date(selected.getFullYear(), selected.getMonth(), 1));
  const monthName = month.toLocaleDateString("en-PK", { month: "long", year: "numeric" });
  const firstDay = new Date(month.getFullYear(), month.getMonth(), 1).getDay();
  const daysInMonth = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
  const cells = [...Array(firstDay).fill(null), ...Array.from({ length: daysInMonth }, (_, index) => index + 1)];
  const display = selected.toLocaleDateString("en-PK", { day: "2-digit", month: "short", year: "numeric" });
  const pick = (day: number) => {
    const picked = dateKey(new Date(month.getFullYear(), month.getMonth(), day));
    if (min && picked < min) return;
    onChange(picked);
    setOpen(false);
  };
  return <div className="date-picker"><button className="date-picker-trigger" onClick={() => setOpen((current) => !current)}><CalendarDays size={15} /><span>{display}</span><ChevronDown size={14} /></button>{open && <div className="date-popover"><div className="date-popover-header"><button className="date-nav" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))}><ChevronLeft size={15} /></button><strong>{monthName}</strong><button className="date-nav" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))}><ChevronRight size={15} /></button></div><div className="date-weekdays">{["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"].map((day) => <span key={day}>{day}</span>)}</div><div className="date-grid">{cells.map((day, index) => day ? <button key={index} className={dateKey(new Date(month.getFullYear(), month.getMonth(), day)) === value ? "selected" : ""} disabled={Boolean(min && dateKey(new Date(month.getFullYear(), month.getMonth(), day)) < min)} onClick={() => pick(day)}>{day}</button> : <span key={index} />)}</div></div>}</div>;
}

function Reports({ phones, version }: { phones: Phone[]; version: number }) {
  const [period, setPeriod] = useState("month");
  const [customDate, setCustomDate] = useState(dateKey(new Date()));
  const [customFrom, setCustomFrom] = useState(dateKey(new Date(new Date().getFullYear(), new Date().getMonth(), 1)));
  const [customTo, setCustomTo] = useState(dateKey(new Date()));
  const [summary, setSummary] = useState<{ sales: number; purchases: number; cost_of_goods: number; gross_profit: number; sales_count: number; purchases_count: number } | null>(null);
  const now = new Date();
  const today = dateKey(now);
  const from = period === "today" ? today : period === "month" ? dateKey(new Date(now.getFullYear(), now.getMonth(), 1)) : period === "90days" ? dateKey(new Date(now.getTime() - 89 * 86400000)) : period === "custom-day" ? customDate : period === "custom-range" ? customFrom : "2000-01-01";
  const to = period === "custom-day" ? customDate : period === "custom-range" ? customTo : today;
  const periodLabel = period === "today" ? "Today" : period === "month" ? "This month" : period === "90days" ? "Last 90 days" : period === "custom-day" ? customDate : period === "custom-range" ? `${customFrom} to ${customTo}` : "All time";

  useEffect(() => {
    setSummary(null);
    fetch(`/api/ledger?from=${from}&to=${to}`)
      .then(async (response) => response.ok ? response.json() : null)
      .then((payload) => payload?.summary && setSummary({ sales: Number(payload.summary.sales ?? 0), purchases: Number(payload.summary.purchases ?? 0), cost_of_goods: Number(payload.summary.cost_of_goods ?? 0), gross_profit: Number(payload.summary.gross_profit ?? 0), sales_count: Number(payload.summary.sales_count ?? 0), purchases_count: Number(payload.summary.purchases_count ?? 0) }))
      .catch(() => setSummary(null));
  }, [from, to, version]);

  const sold = phones.filter((phone) => phone.status === "Sold");
  const stock = phones.filter((phone) => phone.status === "In stock");
  const periodSold = sold.filter((phone) => phone.soldAt && phone.soldAt >= from && phone.soldAt <= to);
  const periodPurchased = phones.filter((phone) => phone.purchasedAt >= from && phone.purchasedAt <= to);
  const stockValue = stock.reduce((sum, phone) => sum + phone.purchasePrice, 0);
  const agedStock = stock.filter((phone) => Math.floor((now.getTime() - new Date(`${phone.purchasedAt}T00:00:00`).getTime()) / 86400000) >= 30).sort((a, b) => a.purchasedAt.localeCompare(b.purchasedAt));
  const agedStockValue = agedStock.reduce((sum, phone) => sum + phone.purchasePrice, 0);
  const saleDurations = sold.filter((phone) => phone.soldAt && phone.purchasedAt).map((phone) => Math.max(0, Math.round((new Date(`${phone.soldAt}T00:00:00`).getTime() - new Date(`${phone.purchasedAt}T00:00:00`).getTime()) / 86400000)));
  const averageDaysToSell = saleDurations.length ? Math.round(saleDurations.reduce((sum, days) => sum + days, 0) / saleDurations.length) : 0;
  const byBrand = Array.from(new Set(phones.map((phone) => phone.brand))).map((brand) => {
    const brandSold = periodSold.filter((phone) => phone.brand === brand);
    const brandStock = stock.filter((phone) => phone.brand === brand);
    const revenue = brandSold.reduce((sum, phone) => sum + (phone.salePrice ?? 0), 0);
    const profit = brandSold.reduce((sum, phone) => sum + ((phone.salePrice ?? 0) - phone.purchasePrice), 0);
    return { brand, sold: brandSold.length, stock: brandStock.length, revenue, profit, stockValue: brandStock.reduce((sum, phone) => sum + phone.purchasePrice, 0) };
  }).sort((a, b) => b.revenue - a.revenue || b.stock - a.stock);
  const sellThrough = phones.length ? Math.round((sold.length / phones.length) * 100) : 0;
  const reportSales = summary?.sales ?? periodSold.reduce((sum, phone) => sum + (phone.salePrice ?? 0), 0);
  const reportPurchases = summary?.purchases ?? periodPurchased.reduce((sum, phone) => sum + phone.purchasePrice, 0);
  const reportProfit = summary?.gross_profit ?? periodSold.reduce((sum, phone) => sum + ((phone.salePrice ?? 0) - phone.purchasePrice), 0);
  const exportReport = () => downloadInventoryCsv(phones);

  return <>
    <div className="page-heading"><div><span className="eyebrow">REPORTS / DECISIONS</span><h2>Know what is moving.</h2><p className="subtle">Use the numbers to decide what to buy, price, and clear.</p></div><div className="report-actions"><div className="period-picker"><button className={period === "today" ? "active" : ""} onClick={() => setPeriod("today")}>Today</button><button className={period === "month" ? "active" : ""} onClick={() => setPeriod("month")}>This month</button><button className={period === "90days" ? "active" : ""} onClick={() => setPeriod("90days")}>90 days</button><button className={period === "all" ? "active" : ""} onClick={() => setPeriod("all")}>All time</button><button className={period === "custom-day" ? "active" : ""} onClick={() => setPeriod("custom-day")}>Date</button><button className={period === "custom-range" ? "active" : ""} onClick={() => setPeriod("custom-range")}>Range</button></div>{period === "custom-day" && <DatePicker value={customDate} onChange={setCustomDate} />}{period === "custom-range" && <div className="report-range-inputs"><DatePicker value={customFrom} onChange={setCustomFrom} /><span>to</span><DatePicker value={customTo} min={customFrom} onChange={setCustomTo} /></div>}<button className="button secondary" onClick={exportReport}>Export CSV</button></div></div>
    <div className="report-context"><span>{periodLabel}</span><small>{summary?.sales_count ?? periodSold.length} sold · {summary?.purchases_count ?? periodPurchased.length} purchased</small></div>
    <section className="report-metrics"><Metric label="Sales revenue" value={money(reportSales)} change={`${summary?.sales_count ?? periodSold.length} phones sold`} icon={<ArrowUpRight size={16} />} positive /><Metric label="Gross profit" value={money(reportProfit)} change={reportSales ? `${Math.round((reportProfit / reportSales) * 100)}% margin` : "No sales in period"} icon={<TrendingUp size={16} />} positive /><Metric label="Capital in stock" value={money(stockValue)} change={`${stock.length} phones currently held`} icon={<Smartphone size={16} />} /><Metric label="Average time to sell" value={`${averageDaysToSell} days`} change={`${sellThrough}% lifetime sell-through`} icon={<BarChart3 size={16} />} /></section>
    <section className="report-grid report-grid-wide"><div className="panel report-card"><div className="panel-heading"><div><span className="eyebrow">BRAND PERFORMANCE</span><h3>Where the money is moving</h3></div><span className="subtle">{periodLabel}</span></div><div className="report-table"><div className="report-table-head"><span>BRAND</span><span>SOLD</span><span>REVENUE</span><span>PROFIT</span><span>STOCK</span></div>{byBrand.map((item) => <div className="report-table-row" key={item.brand}><strong>{item.brand}</strong><span>{item.sold}</span><span>{money(item.revenue)}</span><span className="positive-text">{money(item.profit)}</span><span>{item.stock} · {money(item.stockValue)}</span></div>)}{!byBrand.length && <div className="empty-state">No brand data yet.</div>}</div></div><div className="panel report-card highlight"><PackageSearch size={18} /><span className="eyebrow">CASH RECOVERY</span><h3>{money(agedStockValue)} is tied up in ageing stock.</h3><p>{agedStock.length} phone{agedStock.length === 1 ? " is" : "s are"} over 30 days old, representing {stockValue ? Math.round((agedStockValue / stockValue) * 100) : 0}% of current inventory capital. Review these first for repricing, bundling, or clearance.</p><button className="text-button" onClick={() => window.scrollTo({ top: document.body.scrollHeight, behavior: "smooth" })}>Review ageing stock <ArrowUpRight size={14} /></button></div></section>
    <section className="report-grid report-grid-wide"><div className="panel report-card"><div className="panel-heading"><div><span className="eyebrow">STOCK RISK</span><h3>Phones needing attention</h3></div><span className="subtle">30+ days in stock</span></div>{agedStock.slice(0, 5).map((phone) => <div className="attention-row" key={phone.id}><div><strong>{phone.model}</strong><small>{phone.brand} · IMEI ending {phone.imei.slice(-4)}</small></div><span>{Math.floor((now.getTime() - new Date(`${phone.purchasedAt}T00:00:00`).getTime()) / 86400000)} days</span><b>{money(phone.purchasePrice)}</b></div>)}{!agedStock.length && <div className="empty-state compact"><PackageSearch size={20} /><span>No ageing stock. Keep monitoring new arrivals.</span></div>}</div><div className="panel report-card"><div className="panel-heading"><div><span className="eyebrow">INVENTORY POSITION</span><h3>What the shop is holding</h3></div></div><div className="position-list"><div><span>Stock at cost</span><strong>{money(stockValue)}</strong></div><div><span>Stock units</span><strong>{stock.length}</strong></div><div><span>Lifetime sold</span><strong>{sold.length}</strong></div><div><span>Average profit per sale</span><strong>{sold.length ? money(Math.round(sold.reduce((sum, phone) => sum + ((phone.salePrice ?? 0) - phone.purchasePrice), 0) / sold.length)) : "Rs 0"}</strong></div></div><div className="report-note">Use ageing stock to decide where a discount or bundle may free up cash.</div></div></section>
  </>;
}

function downloadInventoryCsv(phones: Phone[]) { const csv = ["model,brand,imei,status,purchase_price,sale_price,purchased_at,seller_name,seller_cnic,customer", ...phones.map((phone) => [phone.model, phone.brand, phone.imei, phone.status, phone.purchasePrice, phone.salePrice ?? "", phone.purchasedAt, phone.sellerName ?? "", phone.sellerCnic ?? "", phone.customer ?? ""].map((value) => `"${String(value).replaceAll('"', '""')}"`).join(","))].join("\n"); const link = document.createElement("a"); link.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" })); link.download = "inventory.csv"; link.click(); URL.revokeObjectURL(link.href); }
function SettingsPanel({ admin, onAdminUpdated }: { admin: Admin | null; onAdminUpdated: (admin: Admin) => void }) {
  const name = admin?.name || "Administrator";
  const initials = name.split(/\s+/).map((part) => part[0]).join("").slice(0, 2).toUpperCase();
  const [email, setEmail] = useState(admin?.email || "");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  async function updateRecoveryEmail() {
    setLoading(true); setMessage(""); setError("");
    const response = await fetch("/api/auth/recovery-email", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, password }) });
    const payload = await response.json().catch(() => ({})); setLoading(false);
    if (!response.ok) { setError(payload.error || "Unable to update recovery email."); return; }
    setPassword(""); setMessage(payload.message || "Verification link sent."); onAdminUpdated({ ...admin, name, username: admin?.username || "", email: payload.email, emailVerifiedAt: null });
  }
  return <><div className="page-heading"><div><span className="eyebrow">SETTINGS / SHOP PROFILE</span><h2>Keep things in order.</h2><p className="subtle">Manage your shop preferences and protect admin access.</p></div></div><div className="settings-grid"><div className="panel settings-card"><span className="eyebrow">SHOP PROFILE</span><label>Shop name<input defaultValue="Ledgerline Mobiles" /></label><label>Currency<select defaultValue="PKR"><option>PKR — Pakistani Rupee</option><option>USD — US Dollar</option></select></label><button className="button primary">Save changes</button></div><div className="panel settings-card"><span className="eyebrow">RECOVERY EMAIL</span><div className="admin-row"><div className="avatar">{initials}</div><div><strong>{name}</strong><span>Administrator · {admin?.username || "Primary account"}</span></div></div><p className="subtle settings-help">{admin?.emailVerifiedAt ? `Verified recovery email: ${admin.email}` : "Add an email you control. A verification link is required before it can reset your password."}</p><label>Recovery email<input type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="owner@example.com" /></label><label>Current password<input type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Confirm your identity" /></label>{error && <p className="form-error">{error}</p>}{message && <p className="form-success">{message}</p>}<button className="button secondary" onClick={updateRecoveryEmail} disabled={loading}>{loading ? "Sending verification..." : "Verify recovery email"}</button></div></div></>;
}

function ModalShell({ title, eyebrow, children, onClose }: { title: string; eyebrow: string; children: React.ReactNode; onClose: () => void }) { return <div className="modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && onClose()}><div className="modal"><div className="modal-header"><div><span className="eyebrow">{eyebrow}</span><h2>{title}</h2></div><button className="icon-button" onClick={onClose} aria-label="Close"><X size={19} /></button></div>{children}</div></div>; }
function ScannerModal({ onClose, onScan }: { onClose: () => void; onScan: (value: string) => void }) {
  const [imei, setImei] = useState("");
  const [cameraState, setCameraState] = useState("Starting camera...");
  const videoRef = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    let stream: MediaStream | undefined;
    let timer: number | undefined;
    let active = true;
    async function startCamera() {
      try {
        if (!navigator.mediaDevices?.getUserMedia) throw new Error("Camera unavailable");
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: "environment" } }, audio: false });
        if (!active || !videoRef.current) return;
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
        const BarcodeDetectorClass = (window as unknown as { BarcodeDetector?: new (options?: { formats: string[] }) => { detect: (source: HTMLVideoElement) => Promise<Array<{ rawValue?: string }>> } }).BarcodeDetector;
        if (!BarcodeDetectorClass) { setCameraState("Camera ready — use the manual field or USB scanner."); return; }
        setCameraState("Point at the phone barcode...");
        const detector = new BarcodeDetectorClass({ formats: ["code_128", "ean_13", "ean_8", "qr_code"] });
        timer = window.setInterval(async () => {
          if (!videoRef.current || videoRef.current.readyState < 2) return;
          const codes = await detector.detect(videoRef.current).catch(() => []);
          const value = codes[0]?.rawValue?.replace(/\D/g, "").slice(0, 15) ?? "";
          if (value.length >= 4) { setImei(value); onScan(value); }
        }, 450);
      } catch { setCameraState("Camera unavailable — enter the IMEI or use a USB scanner."); }
    }
    startCamera();
    return () => { active = false; if (timer) window.clearInterval(timer); stream?.getTracks().forEach((track) => track.stop()); };
  }, [onScan]);
  return <ModalShell title="Scan an IMEI" eyebrow="QUICK ACTION / SEARCH" onClose={onClose}><div className="scanner-preview"><video ref={videoRef} className="scanner-video" muted playsInline /><div className="scanner-frame"><ScanLine size={26} /><span>{cameraState}</span></div><p>Point your camera at the phone box barcode, or use a USB scanner.</p></div><div className="form-field"><label>Enter IMEI manually</label><input autoFocus value={imei} onChange={(event) => setImei(event.target.value.replace(/\D/g, "").slice(0, 15))} placeholder="15 digit IMEI" onKeyDown={(event) => event.key === "Enter" && imei.length > 0 && onScan(imei)} /><small>USB scanners will fill this field automatically.</small></div><div className="modal-actions"><button className="button secondary" onClick={onClose}>Cancel</button><button className="button primary" disabled={imei.length < 4} onClick={() => onScan(imei)}><Search size={16} /> Find phone</button></div></ModalShell>;
}
function PurchaseModal({ onClose, onSave }: { onClose: () => void; onSave: (phone: Phone) => void }) { const [form, setForm] = useState({ model: "", brand: "", imei: "", purchasePrice: "", sellerName: "", sellerCnic: "" }); return <ModalShell title="Add a purchase" eyebrow="INVENTORY / RECEIVE PHONE" onClose={onClose}><div className="form-grid"><label>Brand<input autoFocus placeholder="e.g. Apple" value={form.brand} onChange={(e) => setForm({ ...form, brand: e.target.value })} /></label><label>Model<input placeholder="e.g. iPhone 15 Pro" value={form.model} onChange={(e) => setForm({ ...form, model: e.target.value })} /></label><label className="full">IMEI<input placeholder="15 digit IMEI" value={form.imei} onChange={(e) => setForm({ ...form, imei: e.target.value.replace(/\D/g, "").slice(0, 15) })} /></label><label>Purchase price<input type="number" placeholder="Rs 0" value={form.purchasePrice} onChange={(e) => setForm({ ...form, purchasePrice: e.target.value })} /></label><label>Seller name<input placeholder="Seller name" value={form.sellerName} onChange={(e) => setForm({ ...form, sellerName: e.target.value })} /></label><label className="full">Seller CNIC<input inputMode="numeric" placeholder="13 digit CNIC number" value={form.sellerCnic} onChange={(e) => setForm({ ...form, sellerCnic: e.target.value.replace(/\D/g, "").slice(0, 13) })} /></label></div><div className="modal-actions"><button className="button secondary" onClick={onClose}>Cancel</button><button className="button primary" disabled={!form.model || form.imei.length < 4 || !form.purchasePrice} onClick={() => onSave({ id: 0, model: form.model, brand: form.brand || "Other", imei: form.imei, purchasePrice: Number(form.purchasePrice), purchasedAt: dateKey(new Date()), status: "In stock", sellerName: form.sellerName || undefined, sellerCnic: form.sellerCnic || undefined })}>Save purchase</button></div></ModalShell>; }
function SaleModal({ phones, onClose, onSave }: { phones: Phone[]; onClose: () => void; onSave: (imei: string, price: number, customer: string) => void }) { const [imei, setImei] = useState(phones[0]?.imei ?? ""); const [price, setPrice] = useState(""); const [customer, setCustomer] = useState(""); const phone = phones.find((p) => p.imei === imei); return <ModalShell title="Record a sale" eyebrow="SALES / COMPLETE TRANSACTION" onClose={onClose}><div className="form-field"><label>Find in-stock phone</label><select value={imei} onChange={(e) => setImei(e.target.value)}>{phones.map((p) => <option key={p.imei} value={p.imei}>{p.model} · {p.imei.slice(-4)}</option>)}</select></div>{phone && <div className="sale-summary"><div><span>Purchase cost</span><strong>{money(phone.purchasePrice)}</strong></div><div><span>Current status</span><em className="status in-stock">In stock</em></div></div>}<div className="form-grid"><label>Sale price<input autoFocus type="number" placeholder="Rs 0" value={price} onChange={(e) => setPrice(e.target.value)} /></label><label>Customer<input placeholder="Customer name" value={customer} onChange={(e) => setCustomer(e.target.value)} /></label></div><div className="modal-actions"><button className="button secondary" onClick={onClose}>Cancel</button><button className="button primary" disabled={!phone || !price} onClick={() => onSave(imei, Number(price), customer || "Walk-in customer")}>Complete sale</button></div></ModalShell>; }
function PhoneDetail({ phone, onClose, onSell, onReturn }: { phone: Phone; onClose: () => void; onSell: () => void; onReturn: () => void }) { return <div className="modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && onClose()}><div className="side-detail"><div className="detail-top"><button className="icon-button" onClick={onClose}><X size={19} /></button><em className={`status ${phone.status.toLowerCase().replace(" ", "-")}`}>{phone.status}</em></div><div className="detail-identity"><div className="large-phone"><Smartphone size={29} /></div><span className="eyebrow">{phone.brand}</span><h2>{phone.model}</h2><span className="mono">{phone.imei}</span></div><div className="detail-grid"><div><span>Purchase price</span><strong>{money(phone.purchasePrice)}</strong></div><div><span>Purchase date</span><strong>{phone.purchasedAt}</strong></div><div><span>Seller</span><strong>{phone.sellerName || "—"}</strong></div><div><span>Seller CNIC</span><strong>{phone.sellerCnic || "—"}</strong></div><div><span>Sale price</span><strong>{phone.salePrice ? money(phone.salePrice) : "—"}</strong></div><div><span>Gross profit</span><strong className="positive-text">{phone.salePrice ? money(phone.salePrice - phone.purchasePrice) : "—"}</strong></div></div><div className="detail-timeline"><span className="eyebrow">TIMELINE</span><div><i className="timeline-dot blue" /><span><strong>Purchased</strong><small>{phone.purchasedAt} · {phone.sellerName || "Direct purchase"}{phone.sellerCnic ? ` · CNIC ${phone.sellerCnic}` : ""}</small></span><b>{money(phone.purchasePrice)}</b></div>{phone.soldAt && <div><i className="timeline-dot green" /><span><strong>Sold</strong><small>{phone.soldAt} · {phone.customer}</small></span><b>{money(phone.salePrice ?? 0)}</b></div>}</div>{phone.status === "In stock" && <button className="button primary full-button" onClick={onSell}><CreditCard size={17} /> Sell this phone</button>}{phone.status === "Sold" && <button className="button secondary full-button" onClick={onReturn}>Record customer return</button>}</div></div>; }
