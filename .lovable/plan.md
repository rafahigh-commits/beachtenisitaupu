## Adicionar atletas no painel admin

Atualmente a aba "Atletas" só permite editar quem já está cadastrado. Vou adicionar a capacidade de criar novos atletas.

### Mudanças

**1. Botão "Novo atleta"** no topo da aba Atletas (`src/pages/Admin.tsx`), ao lado dos filtros de busca/status.

**2. Reaproveitar o `EditAthleteDialog`** transformando-o em `AthleteFormDialog` que funciona em dois modos:
- **Criar** (sem `athlete` passado): insere novo registro em `athletes` e mostra "Novo atleta" no título.
- **Editar** (com `athlete` passado): mantém o comportamento atual.

Campos do formulário (mesmos da edição):
- Nome completo (obrigatório)
- WhatsApp, Email
- Aniversário, Data de entrada (default: hoje na criação)
- Plano
- Status manual
- Observações

**3. Insert no Supabase** usando a tabela `athletes` (já tem RLS "Admins gerenciam atletas"). Campos opcionais enviados como `null` se vazios. `user_id` fica `null` (atleta sem login vinculado) — admin pode vincular depois.

**4. Após salvar**, recarrega a lista (`load()`) e fecha o diálogo, igual ao fluxo de edição.

### Detalhes técnicos

- Estado novo no `Admin`: `createOpen` (boolean) para abrir o diálogo em modo criação.
- O diálogo detecta o modo pelo `athlete` ser `null` e troca o handler de submit (`insert` vs `update`).
- Toast: "Atleta cadastrado!" no sucesso.

### Arquivos

- `src/pages/Admin.tsx` — adicionar botão "Novo atleta", estado `createOpen`, e adaptar `EditAthleteDialog` para suportar criação.

Sem migração de banco — a tabela `athletes` já existe e tem as policies certas.
