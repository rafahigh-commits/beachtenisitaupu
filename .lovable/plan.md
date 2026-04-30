## Vincular conta de usuário ao atleta automaticamente

### Problema

Quando um atleta faz signup (ou já tem conta) com o mesmo email cadastrado na tabela `athletes`, os dois registros não são ligados. Exemplo confirmado no banco:

- `auth.users`: `sfterra.rafael@gmail.com` → user_id `7267e434-...`
- `athletes`: `sfterra.rafael@gmail.com` → user_id `NULL` (não vinculado)

A função `handle_new_user` hoje só cria o `profile` e o role `member` — ignora a tabela `athletes`.

Resultado: o atleta loga, mas o painel não reconhece que ele é o mesmo da lista, então ele não enxerga seus dados/pagamentos.

### Solução

#### 1. Vinculação automática no signup (banco)

Atualizar a função `handle_new_user()` para, além de criar profile e role, fazer:

```sql
UPDATE public.athletes
SET user_id = NEW.id
WHERE user_id IS NULL
  AND lower(email) = lower(NEW.email);
```

Isso garante que qualquer signup novo com email batendo com um atleta cadastrado vincula automaticamente.

#### 2. Migração para corrigir dados já existentes (one-shot)

Rodar uma vez para vincular todos os atletas que já têm conta criada mas estão com `user_id = NULL`:

```sql
UPDATE public.athletes a
SET user_id = u.id
FROM auth.users u
WHERE a.user_id IS NULL
  AND lower(a.email) = lower(u.email);
```

Isso resolve o caso do `sfterra.rafael@gmail.com` e qualquer outro pendente.

#### 3. Vinculação manual no painel admin (UI)

No diálogo de edição de atleta (`EditAthleteDialog` em `src/pages/Admin.tsx`), adicionar uma seção "Conta vinculada":

- Mostrar status atual: "Vinculado a: <email do auth.user>" ou "Nenhuma conta vinculada".
- Se não vinculado: botão **"Buscar conta por email"** — busca em `auth.users` (via RPC) por email correspondente e vincula no clique.
- Se vinculado: botão **"Desvincular"** que seta `user_id = NULL`.

Como o cliente não pode ler `auth.users` diretamente, criar uma RPC `find_user_by_email(_email text)` com `SECURITY DEFINER` que retorna apenas `id` quando o caller é admin (`has_role(auth.uid(), 'admin')`).

### Arquivos

- **Migração SQL**: atualizar `handle_new_user()` + UPDATE one-shot + criar RPC `find_user_by_email`.
- `src/pages/Admin.tsx`: adicionar seção "Conta vinculada" no `EditAthleteDialog` com busca/vincular/desvincular.

### Resumo do comportamento depois da mudança

- Atletas já cadastrados com email correto: serão vinculados imediatamente pela migração.
- Novos signups: vinculação automática se houver atleta com mesmo email.
- Casos sem email ou com email divergente: admin pode vincular manualmente pelo diálogo de edição.
