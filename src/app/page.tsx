"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Clock,
  MapPin,
  Phone,
  ShoppingBag,
  Star,
  Bike,
  Store,
  X,
  Minus,
  Plus,
  Ticket,
  MessageCircle,
  Copy,
  Check,
  QrCode,
  Flame,
  Tag,
} from "lucide-react";
import Link from "next/link";
import type {
  Coupon,
  Order,
  PaymentMethod,
  Product,
  StoreData,
} from "@/lib/types";
import {
  applyCoupon,
  formatBRL,
  isOpenNow,
  itemTotal,
} from "@/lib/utils";
import { buildWhatsAppOrderMessage, whatsappUrl } from "@/lib/whatsapp";
import { useCart } from "@/components/cart-context";

type Panel =
  | "none"
  | "cart"
  | "checkout"
  | "hours"
  | "product"
  | "pix";

export default function HomePage() {
  const [store, setStore] = useState<StoreData | null>(null);
  const [panel, setPanel] = useState<Panel>("none");
  const [selected, setSelected] = useState<Product | null>(null);
  const [extraIds, setExtraIds] = useState<string[]>([]);
  const [itemNotes, setItemNotes] = useState("");
  const [qty, setQty] = useState(1);
  const [couponCode, setCouponCode] = useState("");
  const [appliedCoupon, setAppliedCoupon] = useState<Coupon | undefined>();
  const [couponError, setCouponError] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [address, setAddress] = useState("");
  const [notes, setNotes] = useState("");
  const [payment, setPayment] = useState<PaymentMethod>("pix");
  const [submitting, setSubmitting] = useState(false);
  const [activeCat, setActiveCat] = useState<string>("featured");
  const [pixOrder, setPixOrder] = useState<Order | null>(null);
  const [pixQr, setPixQr] = useState("");
  const [pixCopy, setPixCopy] = useState("");
  const [pixProvider, setPixProvider] = useState<"static" | "mercadopago">(
    "static"
  );
  const [copied, setCopied] = useState(false);

  const cart = useCart();

  useEffect(() => {
    fetch("/api/store")
      .then((r) => r.json())
      .then((data: StoreData) => {
        setStore(data);
        setActiveCat("featured");
      });
  }, []);

  const openInfo = useMemo(
    () => (store ? isOpenNow(store.settings.hours) : { open: false, label: "" }),
    [store]
  );

  const categories = useMemo(
    () =>
      (store?.categories ?? [])
        .filter((c) => c.active)
        .sort((a, b) => a.order - b.order),
    [store]
  );

  const activeProducts = useMemo(
    () => (store?.products ?? []).filter((p) => p.active),
    [store]
  );

  const products = useMemo(() => {
    if (activeCat === "featured") {
      return activeProducts.filter(
        (p) => p.featured || p.highlight === "mais_pedidos" || p.highlight === "promocao"
      );
    }
    if (activeCat === "all") return activeProducts;
    return activeProducts.filter((p) => p.categoryId === activeCat);
  }, [activeProducts, activeCat]);

  const maisPedidos = useMemo(
    () =>
      activeProducts.filter(
        (p) => p.highlight === "mais_pedidos" || (p.featured && !p.highlight)
      ),
    [activeProducts]
  );

  const promocoes = useMemo(
    () => activeProducts.filter((p) => p.highlight === "promocao"),
    [activeProducts]
  );

  const deliveryFee =
    cart.fulfillment === "delivery" ? (store?.settings.deliveryFee ?? 0) : 0;
  const discount = applyCoupon(appliedCoupon, cart.subtotal);
  const total = Math.max(0, cart.subtotal + deliveryFee - discount);

  function openProduct(p: Product) {
    setSelected(p);
    setExtraIds([]);
    setItemNotes("");
    setQty(1);
    setPanel("product");
  }

  function confirmAdd() {
    if (!selected) return;
    const extras = (selected.extras ?? []).filter((e) =>
      extraIds.includes(e.id)
    );
    cart.addProduct(selected, {
      qty,
      extras: extras.map((e) => ({ name: e.name, price: e.price })),
      notes: itemNotes || undefined,
    });
    setPanel("cart");
  }

  function tryCoupon() {
    if (!store) return;
    const found = store.coupons.find(
      (c) => c.active && c.code.toUpperCase() === couponCode.trim().toUpperCase()
    );
    if (!found) {
      setAppliedCoupon(undefined);
      setCouponError("Cupom inválido");
      return;
    }
    if (cart.subtotal < found.minOrder) {
      setAppliedCoupon(undefined);
      setCouponError(
        `Pedido mínimo de ${formatBRL(found.minOrder)} para este cupom`
      );
      return;
    }
    setAppliedCoupon(found);
    setCouponError("");
  }

  async function submitOrder() {
    if (!store) return;
    if (!customerName.trim() || !customerPhone.trim()) {
      alert("Preencha nome e WhatsApp");
      return;
    }
    if (cart.fulfillment === "delivery" && !address.trim()) {
      alert("Informe o endereço para entrega");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: cart.items.map(({ key: _k, ...rest }) => rest),
          fulfillment: cart.fulfillment,
          customerName,
          customerPhone,
          address: cart.fulfillment === "delivery" ? address : undefined,
          couponCode: appliedCoupon?.code,
          payment,
          notes,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        alert(data.error || "Erro ao criar pedido");
        return;
      }

      const order = data.order as Order;

      if (payment === "pix" && data.pix) {
        setPixOrder(order);
        setPixQr(data.pix.qrDataUrl);
        setPixCopy(data.pix.copyPaste);
        setPixProvider(
          data.pix.provider === "mercadopago" ? "mercadopago" : "static"
        );
        cart.clear();
        setAppliedCoupon(undefined);
        setCouponCode("");
        setPanel("pix");
        const refreshed = await fetch("/api/store").then((r) => r.json());
        setStore(refreshed);
        return;
      }

      const msg = buildWhatsAppOrderMessage(order, store.settings);
      const url = whatsappUrl(store.settings.whatsapp, msg);
      cart.clear();
      setAppliedCoupon(undefined);
      setCouponCode("");
      setPanel("none");
      window.open(url, "_blank");
      const refreshed = await fetch("/api/store").then((r) => r.json());
      setStore(refreshed);
      alert(`Pedido #${order.number} criado! Abrindo WhatsApp…`);
    } finally {
      setSubmitting(false);
    }
  }

  async function copyPix() {
    try {
      await navigator.clipboard.writeText(pixCopy);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      prompt("Copie o código PIX:", pixCopy);
    }
  }

  async function confirmPixPaid() {
    if (!pixOrder || !store) return;
    await fetch("/api/orders", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: pixOrder.id,
        paymentStatus: "awaiting_confirmation",
        customerConfirm: true,
      }),
    });
    const msg =
      buildWhatsAppOrderMessage(
        { ...pixOrder, paymentStatus: "awaiting_confirmation" },
        store.settings
      ) +
      "\n\n*Pagamento:* PIX — cliente confirmou o pagamento na plataforma." +
      (pixCopy ? `\nCódigo PIX usado no pedido #${pixOrder.number}` : "");
    window.open(whatsappUrl(store.settings.whatsapp, msg), "_blank");
    setPanel("none");
    setPixOrder(null);
    alert("Pedido enviado! A loja vai conferir o PIX e preparar.");
  }

  if (!store) {
    return (
      <div className="flex min-h-screen items-center justify-center text-muted">
        Carregando cardápio…
      </div>
    );
  }

  const s = store.settings;

  return (
    <div className="relative mx-auto min-h-screen max-w-lg bg-bg pb-28">
      {/* Acesso admin discreto — só o emoji/logo, sem texto */}
      <Link
        href="/admin"
        aria-label="Área restrita"
        title=" "
        className="absolute right-3 top-3 z-30 flex h-9 w-9 items-center justify-center rounded-full bg-black/20 text-lg opacity-40 backdrop-blur-sm transition hover:opacity-90"
      >
        {s.bannerEmoji || "🍔"}
      </Link>

      {/* Hero */}
      <header className="relative overflow-hidden border-b border-border bg-gradient-to-br from-orange-600/30 via-stone-900 to-bg px-4 pb-5 pt-6">
        <div className="absolute -right-8 -top-8 text-8xl opacity-20">
          {s.bannerEmoji}
        </div>
        <div className="relative">
          <div className="mb-3 flex items-start justify-between gap-3 pr-10">
            <div>
              <p className="text-xs font-medium uppercase tracking-widest text-accent-soft">
                Cardápio digital
              </p>
              <h1 className="mt-1 text-2xl font-bold tracking-tight">{s.name}</h1>
              <p className="mt-1 text-sm text-muted">{s.slogan}</p>
            </div>
            <span
              className={`rounded-full px-3 py-1 text-xs font-semibold ${
                openInfo.open
                  ? "bg-success/20 text-success"
                  : "bg-danger/20 text-danger"
              }`}
            >
              {openInfo.open ? "Aberto" : "Fechado"}
            </span>
          </div>

          <div className="mt-4 grid gap-2 text-sm text-muted">
            <button
              type="button"
              onClick={() => setPanel("hours")}
              className="flex items-center gap-2 text-left hover:text-ink"
            >
              <Clock className="h-4 w-4 text-accent" />
              {openInfo.label} · ver horários
            </button>
            <p className="flex items-center gap-2">
              <MapPin className="h-4 w-4 text-accent" />
              {s.address}
            </p>
            <p className="flex items-center gap-2">
              <Phone className="h-4 w-4 text-accent" />
              {s.phone}
            </p>
          </div>
        </div>
      </header>

      {/* Fulfillment toggle */}
      <div className="sticky top-0 z-20 border-b border-border bg-bg/95 px-4 py-3 backdrop-blur">
        <div className="grid grid-cols-2 gap-2 rounded-xl bg-card p-1">
          <button
            type="button"
            onClick={() => cart.setFulfillment("delivery")}
            className={`flex items-center justify-center gap-2 rounded-lg py-2.5 text-sm font-semibold transition ${
              cart.fulfillment === "delivery"
                ? "bg-accent text-stone-950"
                : "text-muted hover:text-ink"
            }`}
          >
            <Bike className="h-4 w-4" />
            Entrega
          </button>
          <button
            type="button"
            onClick={() => cart.setFulfillment("pickup")}
            className={`flex items-center justify-center gap-2 rounded-lg py-2.5 text-sm font-semibold transition ${
              cart.fulfillment === "pickup"
                ? "bg-accent text-stone-950"
                : "text-muted hover:text-ink"
            }`}
          >
            <Store className="h-4 w-4" />
            Retirada
          </button>
        </div>
        {cart.fulfillment === "delivery" && (
          <p className="mt-2 text-center text-xs text-muted">
            Mín. {formatBRL(s.minOrderDelivery)} · Taxa {formatBRL(s.deliveryFee)}
          </p>
        )}
      </div>

      {/* Categories */}
      <div className="no-scrollbar flex gap-2 overflow-x-auto px-4 py-4">
        <CatChip
          active={activeCat === "featured"}
          onClick={() => setActiveCat("featured")}
          icon={<Star className="h-3.5 w-3.5" />}
          label="Destaques"
        />
        {categories.map((c) => (
          <CatChip
            key={c.id}
            active={activeCat === c.id}
            onClick={() => setActiveCat(c.id)}
            label={c.name}
          />
        ))}
      </div>

      {/* Products */}
      <main className="space-y-6 px-4">
        {activeCat === "featured" ? (
          <>
            <FeaturedSection
              title="Mais pedidos"
              icon={<Flame className="h-4 w-4 text-accent" />}
              items={maisPedidos}
              onOpen={openProduct}
            />
            <FeaturedSection
              title="Promoções da semana"
              icon={<Tag className="h-4 w-4 text-accent" />}
              items={promocoes}
              onOpen={openProduct}
            />
            {maisPedidos.length === 0 && promocoes.length === 0 && (
              <p className="py-10 text-center text-muted">
                Nenhum destaque no momento.
              </p>
            )}
          </>
        ) : (
          <>
            {products.map((p) => (
              <ProductCard key={p.id} product={p} onOpen={openProduct} />
            ))}
            {products.length === 0 && (
              <p className="py-10 text-center text-muted">
                Nenhum item nesta categoria.
              </p>
            )}
          </>
        )}
      </main>

      {/* Floating cart */}
      {cart.count > 0 && panel === "none" && (
        <button
          type="button"
          onClick={() => setPanel("cart")}
          className="fixed bottom-5 left-1/2 z-30 flex w-[calc(100%-2rem)] max-w-lg -translate-x-1/2 items-center justify-between rounded-2xl bg-accent px-4 py-3.5 font-semibold text-stone-950 shadow-lg shadow-orange-900/40"
        >
          <span className="flex items-center gap-2">
            <ShoppingBag className="h-5 w-5" />
            Ver carrinho · {cart.count}
          </span>
          <span>{formatBRL(cart.subtotal)}</span>
        </button>
      )}

      {/* Overlay panels */}
      {panel !== "none" && (
        <div className="fixed inset-0 z-40 flex items-end justify-center bg-black/60 sm:items-center">
          <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-t-3xl border border-border bg-card sm:rounded-3xl">
            <div className="sticky top-0 z-10 flex items-center justify-between border-b border-border bg-card px-4 py-3">
              <h2 className="text-lg font-bold">
                {panel === "cart" && "Carrinho"}
                {panel === "checkout" && "Finalizar pedido"}
                {panel === "hours" && "Horários"}
                {panel === "product" && selected?.name}
                {panel === "pix" && "Pagar com PIX"}
              </h2>
              <button
                type="button"
                onClick={() => setPanel("none")}
                className="rounded-full p-2 hover:bg-elevated"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="p-4">
              {panel === "hours" && (
                <div className="space-y-2">
                  <p className="mb-3 text-sm text-muted">
                    Fora do horário, o cardápio continua visível — combine
                    encomendas pelo WhatsApp.
                  </p>
                  {s.hours.map((h) => (
                    <div
                      key={h.day}
                      className="flex justify-between rounded-xl bg-elevated px-3 py-2.5 text-sm"
                    >
                      <span>{h.label}</span>
                      <span className="text-muted">
                        {h.closed ? "Fechado" : `${h.open} – ${h.close}`}
                      </span>
                    </div>
                  ))}
                </div>
              )}

              {panel === "product" && selected && (
                <div className="space-y-4">
                  <p className="text-sm text-muted">{selected.description}</p>
                  <p className="text-xl font-bold text-accent-soft">
                    {formatBRL(selected.price)}
                  </p>
                  {(selected.extras?.length ?? 0) > 0 && (
                    <div>
                      <p className="mb-2 text-sm font-semibold">Adicionais</p>
                      <div className="space-y-2">
                        {selected.extras!.map((e) => (
                          <label
                            key={e.id}
                            className="flex cursor-pointer items-center justify-between rounded-xl bg-elevated px-3 py-2.5 text-sm"
                          >
                            <span className="flex items-center gap-2">
                              <input
                                type="checkbox"
                                checked={extraIds.includes(e.id)}
                                onChange={(ev) => {
                                  setExtraIds((prev) =>
                                    ev.target.checked
                                      ? [...prev, e.id]
                                      : prev.filter((id) => id !== e.id)
                                  );
                                }}
                              />
                              {e.name}
                            </span>
                            <span className="text-muted">
                              + {formatBRL(e.price)}
                            </span>
                          </label>
                        ))}
                      </div>
                    </div>
                  )}
                  <textarea
                    value={itemNotes}
                    onChange={(e) => setItemNotes(e.target.value)}
                    placeholder="Observação (ex: sem cebola)"
                    className="w-full rounded-xl border border-border bg-bg px-3 py-3 text-sm outline-none focus:border-accent"
                    rows={2}
                  />
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3 rounded-xl bg-elevated px-2 py-1">
                      <button
                        type="button"
                        onClick={() => setQty((q) => Math.max(1, q - 1))}
                        className="p-2"
                      >
                        <Minus className="h-4 w-4" />
                      </button>
                      <span className="w-6 text-center font-bold">{qty}</span>
                      <button
                        type="button"
                        onClick={() => setQty((q) => q + 1)}
                        className="p-2"
                      >
                        <Plus className="h-4 w-4" />
                      </button>
                    </div>
                    <button
                      type="button"
                      onClick={confirmAdd}
                      className="rounded-xl bg-accent px-5 py-3 font-semibold text-stone-950"
                    >
                      Adicionar
                    </button>
                  </div>
                </div>
              )}

              {panel === "cart" && (
                <div className="space-y-4">
                  {cart.items.length === 0 ? (
                    <p className="py-8 text-center text-muted">
                      Carrinho vazio
                    </p>
                  ) : (
                    <>
                      {cart.items.map((item) => (
                        <div
                          key={item.key}
                          className="flex gap-3 rounded-xl bg-elevated p-3"
                        >
                          <div className="flex-1">
                            <p className="font-semibold">
                              {item.qty}x {item.name}
                            </p>
                            {item.extras && item.extras.length > 0 && (
                              <p className="text-xs text-muted">
                                + {item.extras.map((e) => e.name).join(", ")}
                              </p>
                            )}
                            {item.notes && (
                              <p className="text-xs text-muted">
                                Obs: {item.notes}
                              </p>
                            )}
                            <p className="mt-1 text-sm font-medium text-accent-soft">
                              {formatBRL(itemTotal(item))}
                            </p>
                          </div>
                          <div className="flex flex-col items-end gap-2">
                            <button
                              type="button"
                              onClick={() => cart.removeItem(item.key)}
                              className="text-xs text-danger"
                            >
                              Remover
                            </button>
                            <div className="flex items-center gap-1">
                              <button
                                type="button"
                                className="rounded bg-card p-1"
                                onClick={() =>
                                  cart.updateQty(item.key, item.qty - 1)
                                }
                              >
                                <Minus className="h-3.5 w-3.5" />
                              </button>
                              <button
                                type="button"
                                className="rounded bg-card p-1"
                                onClick={() =>
                                  cart.updateQty(item.key, item.qty + 1)
                                }
                              >
                                <Plus className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          </div>
                        </div>
                      ))}

                      <div className="flex gap-2">
                        <input
                          value={couponCode}
                          onChange={(e) => setCouponCode(e.target.value)}
                          placeholder="Cupom de desconto"
                          className="flex-1 rounded-xl border border-border bg-bg px-3 py-2.5 text-sm outline-none focus:border-accent"
                        />
                        <button
                          type="button"
                          onClick={tryCoupon}
                          className="flex items-center gap-1 rounded-xl border border-border px-3 text-sm hover:border-accent"
                        >
                          <Ticket className="h-4 w-4" />
                          Aplicar
                        </button>
                      </div>
                      {couponError && (
                        <p className="text-xs text-danger">{couponError}</p>
                      )}
                      {appliedCoupon && (
                        <p className="text-xs text-success">
                          Cupom {appliedCoupon.code} aplicado
                        </p>
                      )}

                      <div className="space-y-1 border-t border-border pt-3 text-sm">
                        <Row label="Subtotal" value={formatBRL(cart.subtotal)} />
                        {deliveryFee > 0 && (
                          <Row
                            label="Entrega"
                            value={formatBRL(deliveryFee)}
                          />
                        )}
                        {discount > 0 && (
                          <Row
                            label="Desconto"
                            value={`- ${formatBRL(discount)}`}
                          />
                        )}
                        <Row
                          label="Total"
                          value={formatBRL(total)}
                          bold
                        />
                      </div>

                      <button
                        type="button"
                        onClick={() => setPanel("checkout")}
                        className="flex w-full items-center justify-center gap-2 rounded-xl bg-accent py-3.5 font-semibold text-stone-950"
                      >
                        Continuar
                      </button>
                    </>
                  )}
                </div>
              )}

              {panel === "checkout" && (
                <div className="space-y-3">
                  <Field
                    label="Seu nome"
                    value={customerName}
                    onChange={setCustomerName}
                    placeholder="Como te chamamos?"
                  />
                  <Field
                    label="WhatsApp"
                    value={customerPhone}
                    onChange={setCustomerPhone}
                    placeholder="(18) 99999-9999"
                  />
                  {cart.fulfillment === "delivery" && (
                    <Field
                      label="Endereço completo"
                      value={address}
                      onChange={setAddress}
                      placeholder="Rua, número, bairro, referência"
                    />
                  )}
                  <div>
                    <label className="mb-1.5 block text-xs font-medium text-muted">
                      Forma de pagamento
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      {(
                        [
                          ["pix", "PIX"],
                          ["dinheiro", "Dinheiro"],
                          ["cartao", "Cartão"],
                          ["na_entrega", "Na entrega"],
                        ] as const
                      ).map(([id, label]) => (
                        <button
                          key={id}
                          type="button"
                          onClick={() => setPayment(id)}
                          className={`rounded-xl border px-3 py-2.5 text-sm ${
                            payment === id
                              ? "border-accent bg-accent/10 text-accent-soft"
                              : "border-border bg-elevated"
                          }`}
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                    {payment === "pix" && (
                      <p className="mt-2 flex items-start gap-1.5 text-xs text-muted">
                        <QrCode className="mt-0.5 h-3.5 w-3.5 shrink-0 text-accent" />
                        Você vai pagar com QR Code / Pix Copia e Cola na próxima
                        tela, dentro do app.
                      </p>
                    )}
                  </div>
                  <div>
                    <label className="mb-1.5 block text-xs font-medium text-muted">
                      Observações do pedido
                    </label>
                    <textarea
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      rows={2}
                      className="w-full rounded-xl border border-border bg-bg px-3 py-3 text-sm outline-none focus:border-accent"
                    />
                  </div>
                  <div className="rounded-xl bg-elevated p-3 text-sm">
                    <Row label="Total" value={formatBRL(total)} bold />
                  </div>
                  <button
                    type="button"
                    disabled={submitting}
                    onClick={submitOrder}
                    className="flex w-full items-center justify-center gap-2 rounded-xl bg-success py-3.5 font-semibold text-stone-950 disabled:opacity-60"
                  >
                    {payment === "pix" ? (
                      <>
                        <QrCode className="h-5 w-5" />
                        {submitting ? "Gerando PIX…" : "Pagar com PIX"}
                      </>
                    ) : (
                      <>
                        <MessageCircle className="h-5 w-5" />
                        {submitting ? "Enviando…" : "Pedir no WhatsApp"}
                      </>
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={() => setPanel("cart")}
                    className="w-full py-2 text-sm text-muted"
                  >
                    Voltar ao carrinho
                  </button>
                </div>
              )}

              {panel === "pix" && pixOrder && (
                <div className="space-y-4 text-center">
                  <p className="text-sm text-muted">
                    Pedido <strong className="text-ink">#{pixOrder.number}</strong> ·{" "}
                    {formatBRL(pixOrder.total)}
                  </p>
                  {pixQr && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={pixQr}
                      alt="QR Code PIX"
                      className="mx-auto rounded-2xl border border-border bg-white p-3"
                      width={220}
                      height={220}
                    />
                  )}
                  <p className="text-xs text-muted">
                    {pixProvider === "mercadopago"
                      ? "PIX via Mercado Pago — confirmação automática após o pagamento."
                      : "Abra o app do banco, escaneie o QR ou cole o código abaixo."}
                  </p>
                  <button
                    type="button"
                    onClick={() => void copyPix()}
                    className="flex w-full items-center justify-center gap-2 rounded-xl border border-border bg-elevated py-3 text-sm font-medium"
                  >
                    {copied ? (
                      <>
                        <Check className="h-4 w-4 text-success" /> Código copiado
                      </>
                    ) : (
                      <>
                        <Copy className="h-4 w-4" /> Pix Copia e Cola
                      </>
                    )}
                  </button>
                  <p className="break-all rounded-xl bg-bg p-2 text-[10px] leading-relaxed text-muted">
                    {pixCopy}
                  </p>
                  <button
                    type="button"
                    onClick={() => void confirmPixPaid()}
                    className="w-full rounded-xl bg-success py-3.5 font-semibold text-stone-950"
                  >
                    Já paguei — enviar pedido
                  </button>
                  <p className="text-[11px] text-muted">
                    A loja confere o PIX no extrato. Com Mercado Pago ativo, a
                    confirmação pode ser automática.
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function FeaturedSection({
  title,
  icon,
  items,
  onOpen,
}: {
  title: string;
  icon: React.ReactNode;
  items: Product[];
  onOpen: (p: Product) => void;
}) {
  if (items.length === 0) return null;
  return (
    <section className="space-y-3">
      <div className="flex items-center gap-2">
        {icon}
        <h2 className="text-sm font-bold uppercase tracking-wide text-accent-soft">
          {title}
        </h2>
      </div>
      <div className="space-y-3">
        {items.map((p) => (
          <ProductCard key={p.id} product={p} onOpen={onOpen} />
        ))}
      </div>
    </section>
  );
}

function ProductCard({
  product: p,
  onOpen,
}: {
  product: Product;
  onOpen: (p: Product) => void;
}) {
  const badge =
    p.highlight === "promocao"
      ? "Promo"
      : p.highlight === "mais_pedidos"
        ? "Top"
        : p.featured
          ? "Top"
          : null;

  return (
    <button
      type="button"
      onClick={() => onOpen(p)}
      className="flex w-full gap-3 rounded-2xl border border-border bg-card p-3 text-left transition hover:border-accent/60"
    >
      <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-xl bg-elevated text-3xl">
        {p.categoryId.includes("drink")
          ? "🥤"
          : p.categoryId.includes("dessert")
            ? "🍨"
            : p.categoryId.includes("side")
              ? "🍟"
              : p.categoryId.includes("combo")
                ? "🍱"
                : "🍔"}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
          <h3 className="font-semibold leading-tight">{p.name}</h3>
          {badge && (
            <span className="rounded bg-accent/20 px-1.5 py-0.5 text-[10px] font-bold uppercase text-accent-soft">
              {badge}
            </span>
          )}
        </div>
        <p className="mt-1 line-clamp-2 text-xs text-muted">{p.description}</p>
        <p className="mt-2 font-bold text-accent-soft">{formatBRL(p.price)}</p>
      </div>
    </button>
  );
}

function CatChip({
  active,
  onClick,
  label,
  icon,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  icon?: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex shrink-0 items-center gap-1.5 rounded-full px-3.5 py-2 text-sm font-medium transition ${
        active
          ? "bg-accent text-stone-950"
          : "border border-border bg-card text-muted hover:text-ink"
      }`}
    >
      {icon}
      {label}
    </button>
  );
}

function Row({
  label,
  value,
  bold,
}: {
  label: string;
  value: string;
  bold?: boolean;
}) {
  return (
    <div
      className={`flex justify-between ${bold ? "text-base font-bold" : ""}`}
    >
      <span className={bold ? "" : "text-muted"}>{label}</span>
      <span>{value}</span>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <div>
      <label className="mb-1.5 block text-xs font-medium text-muted">
        {label}
      </label>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded-xl border border-border bg-bg px-3 py-3 text-sm outline-none focus:border-accent"
      />
    </div>
  );
}
