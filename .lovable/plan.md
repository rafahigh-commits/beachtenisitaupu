## Mudanças no diálogo "Registrar pagamento" (`src/pages/Admin.tsx`)

### 1. Validade até — calculada a partir do "Mês de referência"

- Ao abrir o diálogo: campo "Validade até" começa **vazio**.
- Quando o admin preencher/alterar o **Mês de referência**, calcular automaticamente:
  - `validade até = primeiro dia do mês de referência + duração do plano (meses) − 1 dia`
- O admin ainda pode editar manualmente.
- Sem plano vinculado → assume 1 mês.

### 2. Valor (R$) — opções pré-definidas dos planos

Substituir o input por um `<Select>`:
- Lista todos os `plans` ativos: `Nome do plano — R$ 120,00`.
- Ao selecionar, preenche `payAmount` com o preço.
- Opção **"Outro valor"** libera input numérico livre.
- Pré-seleciona o plano atual do atleta (se houver).

### 3. Remover "Forma de pagamento"

- Remover o `<Select>` de método do diálogo.
- No `insert` em `payments`, gravar fixo `method: "PIX"`.
- Remover o estado `payMethod`.

### 4. Upload opcional de comprovante

Backend:
- Criar bucket de storage **`payment-receipts`** (privado).
- RLS em `storage.objects`:
  - Admins podem `INSERT`/`SELECT`/`DELETE` em qualquer arquivo do bucket.
  - Atleta pode `SELECT` apenas seus próprios comprovantes (path começa com `{athlete_id}/`).
- Adicionar coluna `receipt_url text` (nullable) na tabela `payments`.

Frontend (no diálogo, abaixo de "Validade até"):
- Novo campo `<Input type="file" accept="image/*,application/pdf">` rotulado **"Comprovante (opcional)"**.
- Limite 5 MB; validar tipo (imagem ou PDF).
- Ao salvar:
  1. Se houver arquivo, faz upload para `payment-receipts/{athlete_id}/{timestamp}-{nome-sanitizado}`.
  2. Pega o `path` retornado e grava em `payments.receipt_url`.
  3. Se o upload falhar, exibe erro e não registra o pagamento.
- Limpar o arquivo selecionado ao fechar/abrir o diálogo.

### Resumo técnico

Arquivo: `src/pages/Admin.tsx`
- Novos estados: `paySelectedPlanId`, `payReceiptFile`.
- Remover estado: `payMethod`.
- `openPayDialog`: limpar `payDueDate`, pré-selecionar plano do atleta, limpar arquivo.
- `onChange` do mês de referência: recalcular `payDueDate` com base na duração do plano selecionado.
- `handleSavePayment`: upload opcional → insert em `payments` com `method: "PIX"` e `receipt_url`.

Migração SQL:
- `ALTER TABLE payments ADD COLUMN receipt_url text;`
- Criar bucket `payment-receipts` (privado) + políticas RLS.