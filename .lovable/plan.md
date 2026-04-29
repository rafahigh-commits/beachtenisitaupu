## Página de Comunicações (Admin)

Nova área para criar templates de mensagem e disparar via WhatsApp (link `wa.me`) para atletas filtrados por status.

### Fluxo do usuário

1. Admin acessa **Painel Admin → aba "Comunicações"**.
2. **Templates**: cria/edita/exclui mensagens reutilizáveis com variáveis `{{nome}}`, `{{vencimento}}`, `{{valor}}`.
3. **Enviar mensagem**:
   - Escolhe um template (ou escreve direto) — preview com variáveis substituídas.
   - Filtra grupo de atletas por **status** (Em dia, Vence em breve, Atrasado, Inativo, Isento, Doente, Saiu, Novo, ou Todos).
   - Lista resultante aparece com **checkbox por atleta** (todos marcados por padrão; toggle "selecionar todos"). Mostra nome, status e telefone. Atletas sem telefone aparecem desabilitados com aviso.
   - Botão **"Abrir conversas no WhatsApp"** itera pelos selecionados e abre `https://wa.me/<telefone>?text=<mensagem>` em novas abas, com a mensagem já personalizada por atleta.

### Backend (Lovable Cloud)

Nova tabela `message_templates`:

```text
id              uuid pk
name            text not null
body            text not null   -- com {{nome}}, {{vencimento}}, {{valor}}
created_by      uuid
created_at      timestamptz default now()
updated_at      timestamptz default now()
```

RLS: apenas admins gerenciam (mesma política de `plans`). Trigger `set_updated_at`.

Nenhuma alteração nas tabelas existentes. Telefones já estão em `athletes.phone`.

### Frontend

Arquivo novo: `src/pages/AdminMessages.tsx` — ou nova `TabsContent value="messages"` dentro de `src/pages/Admin.tsx` (preferido para manter a navegação por abas já existente: Atletas / Planos / Configurações / **Comunicações**).

Estrutura interna da aba:

- **Card "Templates"**: lista de templates com botões Editar/Excluir e CTA "Novo template" (Dialog com nome + textarea + chips clicáveis para inserir variáveis no cursor).
- **Card "Enviar mensagem"**:
  - Select de template (ou "Mensagem livre").
  - Textarea editável (pré-preenchida pelo template) com chips de variáveis.
  - Select de status (reusa `STATUS_FILTERS` já existente).
  - Lista de atletas filtrados com checkbox + ações "Marcar todos / Desmarcar todos".
  - Preview do primeiro selecionado renderizado com variáveis aplicadas.
  - Botão **"Abrir no WhatsApp"** → para cada selecionado: `window.open(\`https://wa.me/${onlyDigits(phone)}?text=${encodeURIComponent(render(body, athlete))}\`, "_blank")`. Pequeno delay (~300ms) entre aberturas para evitar bloqueio de pop-up. Toast informa "Abrindo X conversas — permita pop-ups se necessário".

### Substituição de variáveis (helper)

Função `renderTemplate(body, athlete)` em `src/lib/messageTemplate.ts`:

- `{{nome}}` → primeiro nome de `full_name`
- `{{vencimento}}` → `format(status.lastDueDate, "dd/MM/yyyy")` ou "—"
- `{{valor}}` → `formatCurrency(plan.price)` ou "—"

### Normalização de telefone

Helper `toWhatsappNumber(phone)`:
- Remove tudo que não é dígito.
- Se não começar com `55` (Brasil) e tiver 10–11 dígitos, prefixa `55`.
- Retorna `null` se ficar inválido (impede envio).

### Observações

- Como é click-to-chat, o WhatsApp do **admin** é quem envia — não há custo nem template Meta. Para grandes volumes (>20 atletas) o admin precisará confirmar pop-ups e clicar "Enviar" em cada conversa que abrir.
- Migração futura para Twilio/Cloud API fica fácil: basta trocar a função de envio mantendo templates e seleção.

### Arquivos

- **Migração**: criar tabela `message_templates` + RLS + trigger updated_at.
- **Novo**: `src/lib/messageTemplate.ts` (render + normalize phone).
- **Editado**: `src/pages/Admin.tsx` — adicionar `TabsTrigger value="messages"` e `TabsContent` com os dois cards e seus dialogs/estados.
