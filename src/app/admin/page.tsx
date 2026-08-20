"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  BarChart3,
  ClipboardList,
  LayoutGrid,
  LogOut,
  Printer,
  Settings,
  Ticket,
  UtensilsCrossed,
} from "lucide-react";
import Link from "next/link";
import {
  formatBRL,
  itemTotal,
  STATUS_LABEL,
  PAYMENT_LABEL,
  PAYMENT_STATUS_LABEL,
  uid,
} from "@/lib/utils";
import type {
  Category,
  Coupon,
  Order,
  OrderStatus,
  PaymentStatus,
  Product,
  ProductHighlight,
  StoreData,
  TableComanda,
} from "@/lib/types";
import {
  AdminModal,
  FieldInput,
  FieldLabel,
  FieldSelect,
  FieldTextarea,
  PrimaryButton,
  SecondaryButton,
} from "@/components/admin-modal";

type Tab =
  | "orders"
  | "menu"
  | "coupons"
  | "tables"
  | "reports"
  | "settings";

const TABS: { id: Tab; label: string; icon: React.ReactNode }[] = [
  { id: "orders", label: "Pedidos", icon: <ClipboardList className="h-4 w-4" /> },
  { id: "menu", label: "Cardápio", icon: <UtensilsCrossed className="h-4 w-4" /> },
  { id: "tables", label: "Mesas", icon: <LayoutGrid className="h-4 w-4" /> },
  { id: "coupons", label: "Cupons", icon: <Ticket className="h-4 w-4" /> },
  { id: "reports", label: "Relatórios", icon: <BarChart3 className="h-4 w-4" /> },
  { id: "settings", label: "Config", icon: <Settings className="h-4 w-4" /> },
];

export default function AdminPage() {
  const [password, setPassword] = useState("");
  const [authed, setAuthed] = useState(false);
  const [error, setError] = useState("");
  const [store, setStore] = useState<StoreData | null>(null);
  const [tab, setTab] = useState<Tab>("orders");
  const [saving, setSaving] = useState(false);
  const [printOrder, setPrintOrder] = useState<Order | null>(null);

  useEffect(() => {
    const saved = sessionStorage.getItem("admin_pw");
    if (saved) {
      setPassword(saved);
      void login(saved, true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function login(pw = password, silent = false) {
    setError("");
    const res = await fetch("/api/auth", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password: pw }),
    });
    if (!res.ok) {
      if (!silent) setError("Senha incorreta");
      setAuthed(false);
      return;
    }
    sessionStorage.setItem("admin_pw", pw);
    setPassword(pw);
    setAuthed(true);
    await reload(pw);
  }

  const reload = useCallback(async (pw = password) => {
    const res = await fetch("/api/store");
    const data = await res.json();
    // keep password locally for saves
    data.settings.adminPassword = pw;
    setStore(data);
  }, [password]);

  async function saveStore(next: StoreData) {
    setSaving(true);
    try {
      // nunca manda senha vazia (GET zera o campo); só troca se o admin digitou outra
      const settingsToSave = {
        ...next.settings,
        adminPassword:
          next.settings.adminPassword &&
          next.settings.adminPassword !== password &&
          next.settings.adminPassword.trim().length > 0
            ? next.settings.adminPassword.trim()
            : password,
      };

      const res = await fetch("/api/store", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "x-admin-password": password,
        },
        body: JSON.stringify({ ...next, settings: settingsToSave }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        alert(data.error || "Erro ao salvar");
        return false;
      }
      const data = await res.json();
      const newPw = settingsToSave.adminPassword || password;
      if (newPw !== password) {
        sessionStorage.setItem("admin_pw", newPw);
        setPassword(newPw);
      }
      data.settings.adminPassword = newPw;
      setStore(data);
      alert("Salvo com sucesso!");
      return true;
    } finally {
      setSaving(false);
    }
  }

  async function updateOrderStatus(id: string, status: OrderStatus) {
    const res = await fetch("/api/orders", {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        "x-admin-password": password,
      },
      body: JSON.stringify({ id, status }),
    });
    if (res.ok) await reload();
  }

  async function updatePaymentStatus(id: string, paymentStatus: PaymentStatus) {
    const res = await fetch("/api/orders", {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        "x-admin-password": password,
      },
      body: JSON.stringify({ id, paymentStatus }),
    });
    if (res.ok) await reload();
  }

  function logout() {
    sessionStorage.removeItem("admin_pw");
    setAuthed(false);
    setStore(null);
  }

  // Só atualiza pedidos automaticamente — nas outras abas o reload
  // apagava o que o usuário estava digitando a cada 8s.
  useEffect(() => {
    if (!authed || tab !== "orders") return;
    const t = setInterval(() => void reload(), 8000);
    return () => clearInterval(t);
  }, [authed, tab, reload]);

  if (!authed) {
    return (
      <div className="flex min-h-screen items-center justify-center px-4">
        <div className="w-full max-w-sm rounded-2xl border border-border bg-card p-6">
          <Link
            href="/"
            className="mb-4 inline-flex items-center gap-1 text-sm text-muted hover:text-ink"
          >
            <ArrowLeft className="h-4 w-4" /> Cardápio
          </Link>
          <h1 className="text-xl font-bold">Painel do restaurante</h1>
          <p className="mt-1 text-sm text-muted">
            Senha padrão inicial: <code className="text-accent-soft">admin123</code>
          </p>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && void login()}
            placeholder="Senha do admin"
            className="mt-4 w-full rounded-xl border border-border bg-bg px-3 py-3 outline-none focus:border-accent"
          />
          {error && <p className="mt-2 text-sm text-danger">{error}</p>}
          <button
            type="button"
            onClick={() => void login()}
            className="mt-4 w-full rounded-xl bg-accent py-3 font-semibold text-stone-950"
          >
            Entrar
          </button>
        </div>
      </div>
    );
  }

  if (!store) {
    return (
      <div className="flex min-h-screen items-center justify-center text-muted">
        Carregando…
      </div>
    );
  }

  return (
    <div className="mx-auto min-h-screen max-w-6xl px-3 py-4 md:px-6">
      <header className="no-print mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-widest text-accent-soft">
            PDV / Admin
          </p>
          <h1 className="text-xl font-bold md:text-2xl">{store.settings.name}</h1>
        </div>
        <div className="flex items-center gap-2">
          {saving && <span className="text-xs text-muted">Salvando…</span>}
          <Link
            href="/"
            className="rounded-xl border border-border px-3 py-2 text-sm hover:border-accent"
          >
            Ver cardápio
          </Link>
          <button
            type="button"
            onClick={logout}
            className="inline-flex items-center gap-1 rounded-xl border border-border px-3 py-2 text-sm text-muted hover:text-ink"
          >
            <LogOut className="h-4 w-4" /> Sair
          </button>
        </div>
      </header>

      <nav className="no-print mb-4 flex gap-1 overflow-x-auto rounded-2xl border border-border bg-card p-1">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`flex shrink-0 items-center gap-1.5 rounded-xl px-3 py-2.5 text-sm font-medium ${
              tab === t.id
                ? "bg-accent text-stone-950"
                : "text-muted hover:text-ink"
            }`}
          >
            {t.icon}
            {t.label}
          </button>
        ))}
      </nav>

      <div className="no-print">
        {tab === "orders" && (
          <OrdersTab
            orders={store.orders}
            onStatus={updateOrderStatus}
            onPayment={updatePaymentStatus}
            onPrint={setPrintOrder}
          />
        )}
        {tab === "menu" && (
          <MenuTab store={store} onSave={saveStore} />
        )}
        {tab === "coupons" && (
          <CouponsTab store={store} onSave={saveStore} />
        )}
        {tab === "tables" && (
          <TablesTab store={store} onSave={saveStore} />
        )}
        {tab === "reports" && <ReportsTab orders={store.orders} />}
        {tab === "settings" && (
          <SettingsTab store={store} onSave={saveStore} />
        )}
      </div>

      {printOrder && (
        <PrintTicket
          order={printOrder}
          restaurant={store.settings.name}
          onClose={() => setPrintOrder(null)}
        />
      )}
    </div>
  );
}

function OrdersTab({
  orders,
  onStatus,
  onPayment,
  onPrint,
}: {
  orders: Order[];
  onStatus: (id: string, status: OrderStatus) => void;
  onPayment: (id: string, status: PaymentStatus) => void;
  onPrint: (o: Order) => void;
}) {
  const active = orders.filter((o) => o.status !== "entregue" && o.status !== "cancelado");
  const done = orders.filter((o) => o.status === "entregue" || o.status === "cancelado");

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold">Pedidos em andamento ({active.length})</h2>
      {active.length === 0 && (
        <p className="rounded-2xl border border-dashed border-border p-8 text-center text-muted">
          Nenhum pedido ativo. Quando o cliente pedir no site, aparece aqui.
        </p>
      )}
      <div className="grid gap-3 md:grid-cols-2">
        {active.map((o) => (
          <OrderCard
            key={o.id}
            order={o}
            onStatus={onStatus}
            onPayment={onPayment}
            onPrint={onPrint}
          />
        ))}
      </div>
      {done.length > 0 && (
        <>
          <h2 className="pt-4 text-lg font-semibold">Histórico recente</h2>
          <div className="grid gap-3 md:grid-cols-2">
            {done.slice(0, 10).map((o) => (
              <OrderCard
                key={o.id}
                order={o}
                onStatus={onStatus}
                onPayment={onPayment}
                onPrint={onPrint}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function OrderCard({
  order,
  onStatus,
  onPayment,
  onPrint,
}: {
  order: Order;
  onStatus: (id: string, status: OrderStatus) => void;
  onPayment: (id: string, status: PaymentStatus) => void;
  onPrint: (o: Order) => void;
}) {
  const payStatus = order.paymentStatus ?? "pending";
  return (
    <article className="rounded-2xl border border-border bg-card p-4">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="font-bold">#{order.number} · {order.customerName}</p>
          <p className="text-xs text-muted">
            {new Date(order.createdAt).toLocaleString("pt-BR")} ·{" "}
            {order.fulfillment === "delivery"
              ? "Entrega"
              : order.fulfillment === "pickup"
                ? "Retirada"
                : "Mesa"}
          </p>
        </div>
        <div className="flex flex-col items-end gap-1">
          <span className="rounded-full bg-elevated px-2 py-1 text-xs font-medium">
            {STATUS_LABEL[order.status]}
          </span>
          <span
            className={`rounded-full px-2 py-1 text-[10px] font-semibold ${
              payStatus === "paid"
                ? "bg-success/20 text-success"
                : payStatus === "awaiting_confirmation"
                  ? "bg-accent/20 text-accent-soft"
                  : "bg-elevated text-muted"
            }`}
          >
            {order.payment === "pix" || order.payment === "online"
              ? (PAYMENT_STATUS_LABEL[payStatus] ?? payStatus)
              : PAYMENT_LABEL[order.payment]}
          </span>
        </div>
      </div>
      <ul className="mt-3 space-y-1 text-sm">
        {order.items.map((i, idx) => (
          <li key={idx}>
            {i.qty}x {i.name}
            {i.extras?.length ? ` (+${i.extras.map((e) => e.name).join(", ")})` : ""}
          </li>
        ))}
      </ul>
      <p className="mt-2 text-sm text-muted">
        {order.customerPhone}
        {order.address ? ` · ${order.address}` : ""}
      </p>
      <p className="mt-1 font-semibold text-accent-soft">
        {formatBRL(order.total)} · {PAYMENT_LABEL[order.payment]}
        {order.payment === "online" && order.onlineCardType
          ? ` (${order.onlineCardType === "debito" ? "débito" : "crédito"})`
          : ""}
        {order.payment === "dinheiro" && order.cashChangeFor
          ? ` · troco p/ ${formatBRL(order.cashChangeFor)}`
          : order.payment === "dinheiro"
            ? " · sem troco"
            : ""}
      </p>
      {(order.payment === "pix" || order.payment === "online") && (
        <div className="mt-2 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => onPayment(order.id, "paid")}
            className="rounded-lg bg-success/20 px-2 py-1 text-xs font-semibold text-success"
          >
            Confirmar pagamento
          </button>
          <button
            type="button"
            onClick={() => onPayment(order.id, "pending")}
            className="rounded-lg bg-elevated px-2 py-1 text-xs text-muted"
          >
            Ainda não caiu
          </button>
        </div>
      )}
      <div className="mt-3 flex flex-wrap gap-2">
        {(
          [
            "novo",
            "preparando",
            "pronto",
            "saiu_entrega",
            "entregue",
            "cancelado",
          ] as OrderStatus[]
        ).map((st) => (
          <button
            key={st}
            type="button"
            onClick={() => onStatus(order.id, st)}
            className={`rounded-lg px-2 py-1 text-xs ${
              order.status === st
                ? "bg-accent text-stone-950"
                : "bg-elevated text-muted hover:text-ink"
            }`}
          >
            {STATUS_LABEL[st]}
          </button>
        ))}
        <button
          type="button"
          onClick={() => onPrint(order)}
          className="inline-flex items-center gap-1 rounded-lg bg-elevated px-2 py-1 text-xs hover:text-accent-soft"
        >
          <Printer className="h-3.5 w-3.5" /> Imprimir
        </button>
      </div>
    </article>
  );
}

function MenuTab({
  store,
  onSave,
}: {
  store: StoreData;
  onSave: (s: StoreData) => Promise<boolean | void>;
}) {
  const [draft, setDraft] = useState(store);
  const [dirty, setDirty] = useState(false);
  const [catModal, setCatModal] = useState(false);
  const [prodModal, setProdModal] = useState(false);
  const [catName, setCatName] = useState("");
  const [prodForm, setProdForm] = useState({
    name: "",
    description: "",
    price: "",
    categoryId: "",
    highlight: "" as "" | ProductHighlight,
  });

  useEffect(() => {
    if (!dirty) setDraft(store);
  }, [store, dirty]);

  function patch(next: StoreData) {
    setDirty(true);
    setDraft(next);
  }

  function openCategoryModal() {
    setCatName("");
    setCatModal(true);
  }

  function openProductModal() {
    if (!draft.categories.length) {
      alert("Crie uma categoria primeiro");
      return;
    }
    setProdForm({
      name: "",
      description: "",
      price: "",
      categoryId: draft.categories[0].id,
      highlight: "",
    });
    setProdModal(true);
  }

  function confirmCategory() {
    const name = catName.trim();
    if (!name) return;
    const cat: Category = {
      id: uid("cat"),
      name,
      order: draft.categories.length + 1,
      active: true,
    };
    patch({ ...draft, categories: [...draft.categories, cat] });
    setCatModal(false);
  }

  function confirmProduct() {
    const name = prodForm.name.trim();
    if (!name) return;
    const price = Number(String(prodForm.price).replace(",", "."));
    const highlight = prodForm.highlight || undefined;
    const product: Product = {
      id: uid("prod"),
      categoryId: prodForm.categoryId || draft.categories[0].id,
      name,
      description: prodForm.description.trim(),
      price: Number.isFinite(price) ? price : 0,
      active: true,
      featured: Boolean(highlight),
      highlight,
    };
    patch({ ...draft, products: [...draft.products, product] });
    setProdModal(false);
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={openCategoryModal}
          className="rounded-xl bg-elevated px-3 py-2 text-sm"
        >
          + Categoria
        </button>
        <button
          type="button"
          onClick={openProductModal}
          className="rounded-xl bg-elevated px-3 py-2 text-sm"
        >
          + Produto
        </button>
        <button
          type="button"
          onClick={async () => {
            const ok = await onSave(draft);
            if (ok !== false) setDirty(false);
          }}
          className="rounded-xl bg-accent px-4 py-2 text-sm font-semibold text-stone-950"
        >
          Salvar cardápio
        </button>
        {dirty && (
          <span className="self-center text-xs text-accent-soft">
            Alterações não salvas
          </span>
        )}
      </div>

      <div className="grid gap-3">
        {draft.products.map((p, idx) => (
          <div
            key={p.id}
            className="grid gap-2 rounded-2xl border border-border bg-card p-3 md:grid-cols-6"
          >
            <input
              className="rounded-lg border border-border bg-bg px-2 py-2 text-sm md:col-span-2"
              value={p.name}
              onChange={(e) => {
                const products = [...draft.products];
                products[idx] = { ...p, name: e.target.value };
                patch({ ...draft, products });
              }}
            />
            <select
              className="rounded-lg border border-border bg-bg px-2 py-2 text-sm"
              value={p.categoryId}
              onChange={(e) => {
                const products = [...draft.products];
                products[idx] = { ...p, categoryId: e.target.value };
                patch({ ...draft, products });
              }}
            >
              {draft.categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
            <input
              type="number"
              step="0.01"
              className="rounded-lg border border-border bg-bg px-2 py-2 text-sm"
              value={p.price}
              onChange={(e) => {
                const products = [...draft.products];
                products[idx] = { ...p, price: Number(e.target.value) };
                patch({ ...draft, products });
              }}
            />
            <select
              className="rounded-lg border border-border bg-bg px-2 py-2 text-sm"
              value={p.highlight ?? ""}
              onChange={(e) => {
                const value = e.target.value as "" | ProductHighlight;
                const products = [...draft.products];
                products[idx] = {
                  ...p,
                  highlight: value || undefined,
                  featured: Boolean(value) || p.featured,
                };
                if (value) products[idx].featured = true;
                if (!value && p.highlight) products[idx].featured = false;
                patch({ ...draft, products });
              }}
            >
              <option value="">Sem destaque</option>
              <option value="mais_pedidos">Mais pedidos</option>
              <option value="promocao">Promo da semana</option>
            </select>
            <div className="flex items-center gap-3">
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={p.active}
                  onChange={(e) => {
                    const products = [...draft.products];
                    products[idx] = { ...p, active: e.target.checked };
                    patch({ ...draft, products });
                  }}
                />
                Ativo
              </label>
              <button
                type="button"
                className="text-sm text-danger"
                onClick={() =>
                  patch({
                    ...draft,
                    products: draft.products.filter((x) => x.id !== p.id),
                  })
                }
              >
                Excluir
              </button>
            </div>
            <textarea
              className="rounded-lg border border-border bg-bg px-2 py-2 text-sm md:col-span-6"
              rows={2}
              placeholder="Descrição"
              value={p.description}
              onChange={(e) => {
                const products = [...draft.products];
                products[idx] = { ...p, description: e.target.value };
                patch({ ...draft, products });
              }}
            />
          </div>
        ))}
      </div>

      <AdminModal
        open={catModal}
        title="Nova categoria"
        onClose={() => setCatModal(false)}
        footer={
          <div className="flex gap-2">
            <SecondaryButton type="button" onClick={() => setCatModal(false)}>
              Cancelar
            </SecondaryButton>
            <PrimaryButton type="button" onClick={confirmCategory}>
              Adicionar
            </PrimaryButton>
          </div>
        }
      >
        <FieldLabel>Nome da categoria</FieldLabel>
        <FieldInput
          autoFocus
          value={catName}
          onChange={(e) => setCatName(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && confirmCategory()}
          placeholder="Ex: Hambúrgueres, Bebidas…"
        />
      </AdminModal>

      <AdminModal
        open={prodModal}
        title="Novo produto"
        onClose={() => setProdModal(false)}
        footer={
          <div className="flex gap-2">
            <SecondaryButton type="button" onClick={() => setProdModal(false)}>
              Cancelar
            </SecondaryButton>
            <PrimaryButton type="button" onClick={confirmProduct}>
              Adicionar ao cardápio
            </PrimaryButton>
          </div>
        }
      >
        <div className="space-y-3">
          <div>
            <FieldLabel>Nome</FieldLabel>
            <FieldInput
              autoFocus
              value={prodForm.name}
              onChange={(e) =>
                setProdForm((f) => ({ ...f, name: e.target.value }))
              }
              placeholder="Ex: Big Mac"
            />
          </div>
          <div>
            <FieldLabel>Descrição</FieldLabel>
            <FieldTextarea
              rows={3}
              value={prodForm.description}
              onChange={(e) =>
                setProdForm((f) => ({ ...f, description: e.target.value }))
              }
              placeholder="Ingredientes, tamanho…"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <FieldLabel>Preço (R$)</FieldLabel>
              <FieldInput
                inputMode="decimal"
                value={prodForm.price}
                onChange={(e) =>
                  setProdForm((f) => ({ ...f, price: e.target.value }))
                }
                placeholder="29,90"
              />
            </div>
            <div>
              <FieldLabel>Categoria</FieldLabel>
              <FieldSelect
                value={prodForm.categoryId}
                onChange={(e) =>
                  setProdForm((f) => ({ ...f, categoryId: e.target.value }))
                }
              >
                {draft.categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </FieldSelect>
            </div>
          </div>
          <div>
            <FieldLabel>Destaque (opcional)</FieldLabel>
            <FieldSelect
              value={prodForm.highlight}
              onChange={(e) =>
                setProdForm((f) => ({
                  ...f,
                  highlight: e.target.value as "" | ProductHighlight,
                }))
              }
            >
              <option value="">Nenhum</option>
              <option value="mais_pedidos">Mais pedidos</option>
              <option value="promocao">Promoções da semana</option>
            </FieldSelect>
          </div>
        </div>
      </AdminModal>
    </div>
  );
}

function CouponsTab({
  store,
  onSave,
}: {
  store: StoreData;
  onSave: (s: StoreData) => Promise<boolean | void>;
}) {
  const [draft, setDraft] = useState(store.coupons);
  const [dirty, setDirty] = useState(false);
  const [modal, setModal] = useState(false);
  const [code, setCode] = useState("PROMO10");
  const [type, setType] = useState<"percent" | "fixed">("percent");
  const [value, setValue] = useState("10");
  const [minOrder, setMinOrder] = useState("0");

  useEffect(() => {
    if (!dirty) setDraft(store.coupons);
  }, [store.coupons, dirty]);

  function patch(next: Coupon[]) {
    setDirty(true);
    setDraft(next);
  }

  function confirmAdd() {
    const c: Coupon = {
      id: uid("cup"),
      code: code.trim().toUpperCase() || "PROMO",
      type,
      value: Number(value) || 0,
      minOrder: Number(minOrder) || 0,
      active: true,
    };
    patch([...draft, c]);
    setModal(false);
  }

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => {
            setCode("PROMO10");
            setType("percent");
            setValue("10");
            setMinOrder("0");
            setModal(true);
          }}
          className="rounded-xl bg-elevated px-3 py-2 text-sm"
        >
          + Cupom
        </button>
        <button
          type="button"
          onClick={async () => {
            const ok = await onSave({ ...store, coupons: draft });
            if (ok !== false) setDirty(false);
          }}
          className="rounded-xl bg-accent px-4 py-2 text-sm font-semibold text-stone-950"
        >
          Salvar cupons
        </button>
        {dirty && (
          <span className="self-center text-xs text-accent-soft">
            Alterações não salvas
          </span>
        )}
      </div>
      {draft.map((c, idx) => (
        <div key={c.id} className="grid gap-2 rounded-2xl border border-border bg-card p-3 md:grid-cols-5">
          <input
            className="rounded-lg border border-border bg-bg px-2 py-2 text-sm uppercase"
            value={c.code}
            onChange={(e) => {
              const next = [...draft];
              next[idx] = { ...c, code: e.target.value.toUpperCase() };
              patch(next);
            }}
          />
          <select
            className="rounded-lg border border-border bg-bg px-2 py-2 text-sm"
            value={c.type}
            onChange={(e) => {
              const next = [...draft];
              next[idx] = { ...c, type: e.target.value as "percent" | "fixed" };
              patch(next);
            }}
          >
            <option value="percent">% porcentagem</option>
            <option value="fixed">R$ fixo</option>
          </select>
          <input
            type="number"
            className="rounded-lg border border-border bg-bg px-2 py-2 text-sm"
            value={c.value}
            onChange={(e) => {
              const next = [...draft];
              next[idx] = { ...c, value: Number(e.target.value) };
              patch(next);
            }}
          />
          <input
            type="number"
            className="rounded-lg border border-border bg-bg px-2 py-2 text-sm"
            value={c.minOrder}
            placeholder="Mínimo"
            onChange={(e) => {
              const next = [...draft];
              next[idx] = { ...c, minOrder: Number(e.target.value) };
              patch(next);
            }}
          />
          <div className="flex items-center gap-3">
            <label className="flex items-center gap-1 text-sm">
              <input
                type="checkbox"
                checked={c.active}
                onChange={(e) => {
                  const next = [...draft];
                  next[idx] = { ...c, active: e.target.checked };
                  patch(next);
                }}
              />
              Ativo
            </label>
            <button
              type="button"
              className="text-sm text-danger"
              onClick={() => patch(draft.filter((x) => x.id !== c.id))}
            >
              Excluir
            </button>
          </div>
        </div>
      ))}

      <AdminModal
        open={modal}
        title="Novo cupom"
        onClose={() => setModal(false)}
        footer={
          <div className="flex gap-2">
            <SecondaryButton type="button" onClick={() => setModal(false)}>
              Cancelar
            </SecondaryButton>
            <PrimaryButton type="button" onClick={confirmAdd}>
              Criar cupom
            </PrimaryButton>
          </div>
        }
      >
        <div className="space-y-3">
          <div>
            <FieldLabel>Código</FieldLabel>
            <FieldInput
              autoFocus
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              placeholder="PROMO10"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <FieldLabel>Tipo</FieldLabel>
              <FieldSelect
                value={type}
                onChange={(e) =>
                  setType(e.target.value as "percent" | "fixed")
                }
              >
                <option value="percent">Porcentagem (%)</option>
                <option value="fixed">Valor fixo (R$)</option>
              </FieldSelect>
            </div>
            <div>
              <FieldLabel>Valor</FieldLabel>
              <FieldInput
                value={value}
                onChange={(e) => setValue(e.target.value)}
                placeholder="10"
              />
            </div>
          </div>
          <div>
            <FieldLabel>Pedido mínimo (R$)</FieldLabel>
            <FieldInput
              value={minOrder}
              onChange={(e) => setMinOrder(e.target.value)}
              placeholder="0"
            />
          </div>
        </div>
      </AdminModal>
    </div>
  );
}

function TablesTab({
  store,
  onSave,
}: {
  store: StoreData;
  onSave: (s: StoreData) => Promise<boolean | void>;
}) {
  const [itemModal, setItemModal] = useState<TableComanda | null>(null);
  const [itemName, setItemName] = useState("");
  const [itemPrice, setItemPrice] = useState("");

  function toggle(table: TableComanda) {
    const tables = store.tables.map((t) => {
      if (t.id !== table.id) return t;
      if (t.status === "livre") {
        return {
          ...t,
          status: "ocupada" as const,
          openedAt: new Date().toISOString(),
          items: [],
        };
      }
      return { ...t, status: "livre" as const, openedAt: undefined, items: [] };
    });
    void onSave({ ...store, tables });
  }

  function openAddItem(table: TableComanda) {
    const product = store.products.find((p) => p.active);
    setItemName(product?.name ?? "");
    setItemPrice(product ? String(product.price) : "");
    setItemModal(table);
  }

  function confirmAddItem() {
    if (!itemModal) return;
    const name = itemName.trim();
    if (!name) return;
    const price = Number(String(itemPrice).replace(",", ".")) || 0;
    const product = store.products.find((p) => p.active);
    const tables = store.tables.map((t) => {
      if (t.id !== itemModal.id) return t;
      return {
        ...t,
        status: "ocupada" as const,
        openedAt: t.openedAt ?? new Date().toISOString(),
        items: [
          ...t.items,
          {
            productId: product?.id ?? "custom",
            name,
            unitPrice: price,
            qty: 1,
          },
        ],
      };
    });
    void onSave({ ...store, tables });
    setItemModal(null);
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted">
        Gestão simples de mesas/comandas para salão (estilo PDV básico).
      </p>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {store.tables.map((t) => {
          const total = t.items.reduce((s, i) => s + itemTotal(i), 0);
          return (
            <div key={t.id} className="rounded-2xl border border-border bg-card p-4">
              <div className="flex items-center justify-between">
                <h3 className="font-bold">{t.label}</h3>
                <span
                  className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                    t.status === "livre"
                      ? "bg-success/20 text-success"
                      : "bg-accent/20 text-accent-soft"
                  }`}
                >
                  {t.status}
                </span>
              </div>
              <ul className="mt-3 min-h-12 space-y-1 text-sm text-muted">
                {t.items.map((i, idx) => (
                  <li key={idx}>
                    {i.qty}x {i.name} — {formatBRL(itemTotal(i))}
                  </li>
                ))}
                {t.items.length === 0 && <li>Sem itens</li>}
              </ul>
              <p className="mt-2 font-semibold">{formatBRL(total)}</p>
              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => openAddItem(t)}
                  className="rounded-lg bg-elevated px-2 py-1 text-xs"
                >
                  + Item
                </button>
                <button
                  type="button"
                  onClick={() => toggle(t)}
                  className="rounded-lg bg-elevated px-2 py-1 text-xs"
                >
                  {t.status === "livre" ? "Abrir" : "Fechar / liberar"}
                </button>
              </div>
            </div>
          );
        })}
      </div>

      <AdminModal
        open={Boolean(itemModal)}
        title={`Item — ${itemModal?.label ?? ""}`}
        onClose={() => setItemModal(null)}
        footer={
          <div className="flex gap-2">
            <SecondaryButton type="button" onClick={() => setItemModal(null)}>
              Cancelar
            </SecondaryButton>
            <PrimaryButton type="button" onClick={confirmAddItem}>
              Adicionar
            </PrimaryButton>
          </div>
        }
      >
        <div className="space-y-3">
          <div>
            <FieldLabel>Nome do item</FieldLabel>
            <FieldInput
              autoFocus
              value={itemName}
              onChange={(e) => setItemName(e.target.value)}
            />
          </div>
          <div>
            <FieldLabel>Preço (R$)</FieldLabel>
            <FieldInput
              value={itemPrice}
              onChange={(e) => setItemPrice(e.target.value)}
            />
          </div>
        </div>
      </AdminModal>
    </div>
  );
}

function ReportsTab({ orders }: { orders: Order[] }) {
  const stats = useMemo(() => {
    const paid = orders.filter((o) => o.status !== "cancelado");
    const today = new Date().toDateString();
    const todayOrders = paid.filter(
      (o) => new Date(o.createdAt).toDateString() === today
    );
    const sum = (list: Order[]) => list.reduce((s, o) => s + o.total, 0);
    const byDay: Record<string, number> = {};
    for (const o of paid) {
      const key = new Date(o.createdAt).toLocaleDateString("pt-BR");
      byDay[key] = (byDay[key] ?? 0) + o.total;
    }
    const topItems: Record<string, number> = {};
    for (const o of paid) {
      for (const i of o.items) {
        topItems[i.name] = (topItems[i.name] ?? 0) + i.qty;
      }
    }
    const top = Object.entries(topItems)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);
    return {
      todayCount: todayOrders.length,
      todayTotal: sum(todayOrders),
      allCount: paid.length,
      allTotal: sum(paid),
      byDay: Object.entries(byDay).slice(0, 14),
      top,
    };
  }, [orders]);

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Pedidos hoje" value={String(stats.todayCount)} />
        <Stat label="Faturamento hoje" value={formatBRL(stats.todayTotal)} />
        <Stat label="Pedidos (total)" value={String(stats.allCount)} />
        <Stat label="Faturamento (total)" value={formatBRL(stats.allTotal)} />
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        <div className="rounded-2xl border border-border bg-card p-4">
          <h3 className="font-semibold">Por dia</h3>
          <ul className="mt-3 space-y-2 text-sm">
            {stats.byDay.length === 0 && (
              <li className="text-muted">Sem dados ainda</li>
            )}
            {stats.byDay.map(([day, total]) => (
              <li key={day} className="flex justify-between">
                <span className="text-muted">{day}</span>
                <span>{formatBRL(total)}</span>
              </li>
            ))}
          </ul>
        </div>
        <div className="rounded-2xl border border-border bg-card p-4">
          <h3 className="font-semibold">Itens mais pedidos</h3>
          <ul className="mt-3 space-y-2 text-sm">
            {stats.top.length === 0 && (
              <li className="text-muted">Sem dados ainda</li>
            )}
            {stats.top.map(([name, qty]) => (
              <li key={name} className="flex justify-between">
                <span className="text-muted">{name}</span>
                <span>{qty}x</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <p className="text-xs text-muted">{label}</p>
      <p className="mt-1 text-xl font-bold text-accent-soft">{value}</p>
    </div>
  );
}

function SettingsTab({
  store,
  onSave,
}: {
  store: StoreData;
  onSave: (s: StoreData) => Promise<boolean | void>;
}) {
  const [s, setS] = useState(store.settings);
  const [newPassword, setNewPassword] = useState("");
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    if (!dirty) {
      setS({ ...store.settings, adminPassword: "" });
      setNewPassword("");
    }
  }, [store.settings, dirty]);

  function update<K extends keyof typeof s>(key: K, value: (typeof s)[K]) {
    setDirty(true);
    setS((prev) => ({ ...prev, [key]: value }));
  }

  return (
    <div className="max-w-2xl space-y-3">
      {(
        [
          ["name", "Nome da hamburgueria"],
          ["slogan", "Slogan"],
          ["phone", "Telefone exibido"],
          ["whatsapp", "WhatsApp (só números, ex: 5518999990000)"],
          ["address", "Rua e bairro"],
          ["pixKey", "Chave PIX (CPF, CNPJ, e-mail, telefone ou aleatória)"],
          ["pixMerchantName", "Nome no PIX (máx. 25 caracteres, sem acento)"],
          ["pixCity", "Cidade no PIX (máx. 15 caracteres)"],
          ["bannerEmoji", "Emoji do banner / ícone discreto do canto"],
        ] as const
      ).map(([key, label]) => (
        <div key={key}>
          <label className="mb-1 block text-xs text-muted">{label}</label>
          <input
            className="w-full rounded-xl border border-border bg-card px-3 py-2.5 text-sm outline-none focus:border-accent"
            value={String(s[key] ?? "")}
            onChange={(e) => update(key, e.target.value)}
          />
        </div>
      ))}

      <div>
        <label className="mb-1 block text-xs text-muted">
          Nova senha do admin (deixe em branco para manter)
        </label>
        <input
          type="password"
          autoComplete="new-password"
          className="w-full rounded-xl border border-border bg-card px-3 py-2.5 text-sm outline-none focus:border-accent"
          value={newPassword}
          placeholder="••••••••"
          onChange={(e) => {
            setDirty(true);
            setNewPassword(e.target.value);
          }}
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        {(
          [
            ["minOrderDelivery", "Pedido mín. entrega"],
            ["deliveryFee", "Taxa de entrega"],
          ] as const
        ).map(([key, label]) => (
          <div key={key}>
            <label className="mb-1 block text-xs text-muted">{label}</label>
            <input
              type="number"
              className="w-full rounded-xl border border-border bg-card px-3 py-2.5 text-sm outline-none focus:border-accent"
              value={Number(s[key])}
              onChange={(e) => update(key, Number(e.target.value))}
            />
          </div>
        ))}
      </div>

      <h3 className="pt-2 font-semibold">Horários</h3>
      {s.hours.map((h, idx) => (
        <div key={h.day} className="grid grid-cols-4 gap-2">
          <span className="flex items-center text-sm">{h.label}</span>
          <input
            className="rounded-lg border border-border bg-card px-2 py-2 text-sm"
            value={h.open}
            onChange={(e) => {
              const hours = [...s.hours];
              hours[idx] = { ...h, open: e.target.value };
              update("hours", hours);
            }}
          />
          <input
            className="rounded-lg border border-border bg-card px-2 py-2 text-sm"
            value={h.close}
            onChange={(e) => {
              const hours = [...s.hours];
              hours[idx] = { ...h, close: e.target.value };
              update("hours", hours);
            }}
          />
          <label className="flex items-center gap-1 text-sm">
            <input
              type="checkbox"
              checked={!!h.closed}
              onChange={(e) => {
                const hours = [...s.hours];
                hours[idx] = { ...h, closed: e.target.checked };
                update("hours", hours);
              }}
            />
            Fechado
          </label>
        </div>
      ))}

      <div className="flex flex-wrap items-center gap-3 pt-2">
        <button
          type="button"
          onClick={async () => {
            const ok = await onSave({
              ...store,
              settings: {
                ...s,
                adminPassword: newPassword.trim(),
              },
            });
            if (ok !== false) {
              setDirty(false);
              setNewPassword("");
            }
          }}
          className="rounded-xl bg-accent px-5 py-3 font-semibold text-stone-950"
        >
          Salvar configurações
        </button>
        {dirty && (
          <span className="text-xs text-accent-soft">Alterações não salvas</span>
        )}
      </div>
    </div>
  );
}

function PrintTicket({
  order,
  restaurant,
  onClose,
}: {
  order: Order;
  restaurant: string;
  onClose: () => void;
}) {
  useEffect(() => {
    const t = setTimeout(() => window.print(), 300);
    return () => clearTimeout(t);
  }, []);

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/50 p-4">
      <div className="w-full max-w-sm rounded-xl bg-white p-6 text-black shadow-xl">
        <div className="print-only">
          <h2 className="text-center text-lg font-bold">{restaurant}</h2>
          <p className="text-center text-sm">Pedido #{order.number}</p>
          <p className="text-center text-xs">
            {new Date(order.createdAt).toLocaleString("pt-BR")}
          </p>
          <hr className="my-3" />
          <p className="text-sm">
            <strong>{order.customerName}</strong>
            <br />
            {order.customerPhone}
            <br />
            {order.fulfillment === "delivery"
              ? `Entrega: ${order.address}`
              : order.fulfillment === "pickup"
                ? "Retirada no balcão"
                : `Mesa ${order.tableId}`}
          </p>
          <hr className="my-3" />
          {order.items.map((i, idx) => (
            <div key={idx} className="mb-2 text-sm">
              <div className="flex justify-between">
                <span>
                  {i.qty}x {i.name}
                </span>
                <span>{formatBRL(itemTotal(i))}</span>
              </div>
              {i.extras?.map((e) => (
                <div key={e.name} className="pl-3 text-xs">
                  + {e.name}
                </div>
              ))}
              {i.notes && <div className="pl-3 text-xs">Obs: {i.notes}</div>}
            </div>
          ))}
          <hr className="my-3" />
          <div className="flex justify-between text-sm">
            <span>Total</span>
            <strong>{formatBRL(order.total)}</strong>
          </div>
          <p className="mt-2 text-xs">Pagamento: {PAYMENT_LABEL[order.payment]}</p>
          {order.payment === "dinheiro" && (
            <p className="mt-1 text-xs">
              {order.cashChangeFor
                ? `Troco para ${formatBRL(order.cashChangeFor)}`
                : "Sem troco"}
            </p>
          )}
          {order.notes && <p className="mt-1 text-xs">Obs: {order.notes}</p>}
        </div>
        <button
          type="button"
          onClick={onClose}
          className="no-print mt-4 w-full rounded-xl bg-stone-900 py-2 text-white"
        >
          Fechar
        </button>
      </div>
    </div>
  );
}
