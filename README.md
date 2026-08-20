# Cardápio Digital + PDV (estilo Foodzap, sem mensalidade)

MVP completo para **uma** hamburgueria: cardápio online, **PIX na plataforma**, pedidos, mesas e painel admin.

Repo: https://github.com/peaugust0/testefood

## Publicar link pro celular (Vercel)

GitHub Pages **não serve** — este app tem APIs (pedidos, PIX, admin). Use a Vercel.

1. Abra: https://vercel.com/new/import?s=https://github.com/peaugust0/testefood  
2. Faça login na Vercel (pode usar a mesma conta do GitHub)  
3. Clique em **Import** → **Deploy**  
4. Copie a URL gerada (ex: `https://testefood-xxxx.vercel.app`) e mande no WhatsApp

### Para pedidos/PIX não sumirem (recomendado)

Na Vercel o disco é temporário. Conecte o Supabase:

1. Crie projeto em https://supabase.com  
2. SQL Editor → cole e rode o conteúdo de [`supabase/schema.sql`](supabase/schema.sql)  
3. Em **Project Settings → API**, copie:
   - Project URL → `NEXT_PUBLIC_SUPABASE_URL`
   - `service_role` (secret) → `SUPABASE_SERVICE_ROLE_KEY`
4. Na Vercel: Project → **Settings → Environment Variables** → adicione as duas → **Redeploy**

## Como rodar local

```bash
npm install
npm run dev
```

- Cardápio: http://localhost:3000  
- Admin: clique no emoji 🍔 no canto (ou `/admin`)  
- Senha: definida em Admin → Config (não aparece no cardápio)

## O que tem

| Recurso | Onde |
|--------|------|
| Cardápio digital | `/` |
| PIX com QR + Copia e Cola | checkout |
| Pedidos + WhatsApp | `/` + `/admin` |
| Cupons, mesas, relatórios | `/admin` |
| Mercado Pago (opcional) | env `MERCADOPAGO_ACCESS_TOKEN` |
| Supabase (nuvem) | env + `supabase/schema.sql` |

## PIX

1. Admin → Config → chave PIX, nome e cidade  
2. Cliente escolhe PIX → QR / Copia e Cola  
3. **Já paguei** → loja confirma no painel  

## Personalizar

Admin → Config: nome, WhatsApp (`5521…`), PIX, horários, senha.  
Admin → Cardápio: produtos reais.
