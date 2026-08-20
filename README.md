# Cardápio Digital + PDV (estilo Foodzap, sem mensalidade)

MVP completo para **uma** hamburgueria: cardápio online, **PIX na plataforma**, pedidos, fidelidade, mesas e painel admin.

## O que tem

| Recurso | Onde |
|--------|------|
| Cardápio digital | `/` |
| PIX com QR + Copia e Cola | checkout |
| Mercado Pago (opcional, confirmação automática) | `.env` |
| Pedidos + WhatsApp | `/` + `/admin` |
| Cupons, fidelidade, mesas, relatórios | `/admin` |
| Supabase (opcional) | `.env` + `supabase/schema.sql` |

Acesso admin no cardápio: **só o emoji no canto superior direito** (sem texto "Admin").

## Como rodar

```bash
npm install
npm run dev
```

- Cardápio: http://localhost:3000  
- Admin: http://localhost:3000/admin (ou clique no emoji do canto)  
- Senha: `admin123`

## PIX

1. Em **Admin → Config**, cadastre a **chave PIX**, nome e cidade do recebedor  
2. No checkout, o cliente escolhe PIX → vê QR Code e Copia e Cola  
3. Clica **Já paguei** → pedido vai pro painel como "Cliente disse que pagou"  
4. A loja confere no extrato e clica **Confirmar PIX recebido**

### Mercado Pago (depois)

1. Crie conta no Mercado Pago e pegue o Access Token  
2. Coloque em `.env.local`: `MERCADOPAGO_ACCESS_TOKEN=...`  
3. Webhook: `https://SEU-DOMINIO/api/webhooks/mercadopago`  
Com o token, o app gera PIX pelo MP e pode confirmar sozinho quando o pagamento cair.

## Supabase (opcional)

Sem `.env`, usa `data/store.json` (ok no PC da loja).

Com Supabase (melhor na nuvem):

1. Crie um projeto em [supabase.com](https://supabase.com)  
2. Rode o SQL de `supabase/schema.sql`  
3. Em `.env.local`:

```
NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJ...
```

4. Reinicie `npm run dev`

## Personalizar

Admin → Config: nome, WhatsApp (`5518…`), PIX, horários, senha.  
Admin → Cardápio: produtos reais.

## Não incluso ainda

Robô/IA no WhatsApp, multi-restaurante.