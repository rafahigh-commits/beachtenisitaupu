## Mostrar último pagamento no card do atleta

Na grid de atletas (aba "Atletas" do Admin), exibir ao lado do nome:
- **Data do último pagamento** (campo `paid_at` mais recente)
- **Valor do último pagamento** (campo `amount` correspondente)

### Onde

Arquivo: `src/pages/Admin.tsx`, dentro do bloco que renderiza cada atleta (linhas ~340–350, abaixo do nome e do "Plano · WhatsApp").

### Como

1. Calcular o último pagamento ordenando `a.payments` por `paid_at` desc e pegando o primeiro.
2. Adicionar uma linha logo abaixo do "plano · telefone" com o formato:
   - `Último pagto: 15/04/2026 · R$ 120,00`
   - Se não houver pagamentos: `Último pagto: —`
3. Usar `formatCurrency` (já importado de `@/lib/membership`) e `format` do `date-fns` (já importado) com a máscara `dd/MM/yyyy`.
4. Estilo consistente com as outras infos secundárias: `text-xs text-muted-foreground`.

### Layout resultante (mobile e desktop)

```text
[AV] Nome do Atleta
     Plano Mensal · (47) 99999-9999
     Último pagto: 15/04/2026 · R$ 120,00
     📝 nota (se houver)
```

A informação de "Validade" continua na coluna da direita junto ao status, sem alterações.

Nenhuma mudança de banco, query ou tipo é necessária — `paid_at` e `amount` já vêm em `a.payments`.