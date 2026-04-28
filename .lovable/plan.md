## Mudanças

### 1. Grid de atletas (`src/pages/Admin.tsx`) — exibir "Validade até"

Na lista de atletas, adicionar a data de vencimento (a `due_date` mais recente do banco) próximo ao status de cada atleta.

- Calcular a maior `due_date` dos `payments` de cada atleta (já carregados em `a.payments`).
- Exibir como pequeno texto na área direita do card, ex.: `Validade: 26/10/2026`.
- Se o atleta não tiver nenhum pagamento com `due_date`, exibir `Validade: —`.
- Formatar com `date-fns` no padrão `dd/MM/yyyy`.

Local: bloco de cada atleta (atualmente entre `StatusBadge` e os botões "Pagto" / editar, linhas ~282–295).

### 2. Diálogo "Registrar pagamento" — campos em branco por padrão

Em `openPayDialog` (linhas ~158–171) e nos estados iniciais (linhas ~76–77):

- `payMonth` (Mês de referência): iniciar como string vazia `""` em vez de `format(new Date(), "yyyy-MM-01")`.
- `payDate` (Pago em): iniciar como string vazia `""` em vez da data de hoje.
- O campo "Validade até" continua sendo sugerido com base no plano (comportamento atual mantido).
- Ajustar o `<Input type="month">` para lidar com valor vazio sem quebrar o `slice(0,7)` (usar `payMonth ? payMonth.slice(0,7) : ""`).
- Ao salvar, manter `required` nos dois campos para que o admin preencha conscientemente.

### Resumo dos arquivos
- `src/pages/Admin.tsx`: adicionar coluna/texto de validade no card do atleta; limpar valores iniciais de "Mês de referência" e "Pago em" no diálogo de pagamento.
