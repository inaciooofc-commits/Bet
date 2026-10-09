# Umbrella Inside: Bet

Aplicativo web responsivo com Ryos fictícios do Zarcovi. Cloudflare Workers + D1; sem planilhas. Sem depósitos, saques ou conversão em dinheiro. Catálogo inicial de recompensas digitais.

## Incluído nesta versão

- Cadastro, login, senha PBKDF2 e sessão HttpOnly de 7 dias; logout.
- 1.000 Ryos de boas-vindas; check-in de 100 Ryos por dia em Brasília.
- Confrontos de lutas e clãs, odds decimais e bilhete simples com retorno estimado.
- Carteira com histórico; ranking por saldo; histórico dos bilhetes.
- Códigos de bônus com período, limite global e um uso por conta.
- Prêmios com descrição, custo, estoque, início e fim. Resgates pendentes, entregues ou cancelados com reembolso.
- Administração: criar confrontos, publicar resultados, anular e devolver apostas; criar/editar/pausar prêmios e códigos; auditoria.
- Manifesto para adicionar à tela inicial. Aplicativo web online, não APK.

## Como administrar pelo celular

1. Abra o endereço publicado e crie sua conta com senha de pelo menos 10 caracteres.
2. Abra **Carteira → Configuração do proprietário** e informe o código privado recebido na instalação. Ele funciona uma única vez e nunca fica no GitHub.
3. Abra **Administração → Programar prêmio**. Preencha nome, descrição, custo, estoque e datas. Os campos de data usam o horário do dispositivo.
4. Use **Editar** para alterar custo, estoque ou período; **Pausar** para suspender novos resgates.
5. Acompanhe **Entregas de prêmios**, faça a entrega digital e marque como entregue. Cancelar devolve o custo e uma unidade ao estoque.
6. Cadastre os confrontos e suas odds. Em **Resultados**, escolha o vencedor ou anule o evento. O pagamento acontece automaticamente e uma única vez.
7. Cadastre campanhas em **Código de bônus**. O código inicial é `UMBRELLA500`.

Os eventos e prêmios iniciais são exemplos. Não existe integração automática com resultados esportivos nem entrega automática de itens externos. Bilhetes múltiplos, cash out, cassino, notificações push, recuperação de senha por e-mail, verificação de e-mail e integração de saldo com outro app Zarcovi ainda não estão implementados. As carteiras são próprias deste aplicativo.

## Desenvolvimento

Node.js 22 ou superior, Python 3 e conta Cloudflare.

```bash
npm ci
npm run test
npm run build
npm run db:local
npm run dev
```

Configure `BOOTSTRAP_TOKEN` em `.dev.vars` para ativar um administrador local. Nunca coloque esse arquivo no GitHub. A administração não é atribuída por e-mail nem ao primeiro cadastro público.

## Cloudflare e GitHub

O `wrangler.jsonc` contém o banco desta instalação. Para outra conta, crie um banco D1 e substitua seu ID.

```bash
npx wrangler login
npm run db:remote
npx wrangler secret put BOOTSTRAP_TOKEN
npm run deploy
```

Use um código aleatório longo no segredo. Após a ativação do proprietário, pode excluir o segredo de bootstrap na Cloudflare.

O workflow GitHub Actions executa testes em pushes e PRs. A publicação é manual em **Actions → Cloudflare → Run workflow**, usando os secrets `CLOUDFLARE_API_TOKEN` e `CLOUDFLARE_ACCOUNT_ID`. O token precisa permitir Workers Scripts Edit e D1 Edit na conta. Não coloque o token em arquivos ou mensagens públicas.

## Integridade e operação

Débitos, créditos, estoque e liquidação são executados em triggers do D1, com saldo não negativo e transações. Odds são validadas no servidor; códigos e bônus diários têm chaves únicas. Repetir o mesmo identificador de aposta ou resgate não duplica a operação. As telas exibem os 100 registros mais recentes; ranking mostra 20 contas, entregas administrativas 200.

Antes de ampliar a comunidade, implemente recuperação de conta, verificação de e-mail, Turnstile e testes de carga. O limite de tentativas por IP protege login/cadastro; não impede a criação de contas com vários e-mails. O banco de limites deve ser limpo periodicamente. A compatibilidade e os custos dependem do plano e do uso da conta Cloudflare.
