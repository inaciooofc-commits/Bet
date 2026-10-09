# Umbrella Inside: Bet

Endereço: https://umbrella-inside-bet-v1.inaciooofc.workers.dev

Arena do Zarcovi com moedas fictícias Ryos. Primeira versão funcional em Cloudflare Workers + D1, HTML/CSS/JS responsivo e manifesto para instalação pelo navegador. Sem planilhas. Sem depósitos, compra de moedas ou saques em dinheiro. A carteira é própria deste app; integração com uma carteira externa do Zarcovi ainda não foi implementada.

## Recursos disponíveis
- Cadastro e login com senha, sessão em cookie HttpOnly, saída da conta.
- 1.000 Ryos iniciais e 100 Ryos diários, uma vez por dia no horário de Brasília.
- Eventos por categoria, de 2 a 6 resultados na API (até 3 na interface), odds e encerramento por data/hora.
- Boletim de aposta simples, retorno potencial e odd fixa registrada ao apostar.
- Liquidação por vencedor informado pelo administrador; cancelamento com restituição.
- Carteira, extrato, histórico de apostas e acompanhamento dos prêmios resgatados.
- Ranking por saldo, incluindo o efeito dos bônus e dos resgates.
- Códigos promocionais com início, fim, quantidade de Ryos, limite total e uso único por conta.
- Prêmios programáveis: nome, descrição/regras, custo, estoque, início/fim e visibilidade.
- Administração dos resgates: entrega ou cancelamento com restituição dos Ryos e do estoque.
- Auditoria administrativa e limpeza diária de sessões/tentativas expiradas.
- Ativação privada e única do primeiro administrador.

## Abrir no celular
Abra o endereço publicado. No Chrome/Android, use o menu para adicionar à tela inicial; a disponibilidade de instalação depende do navegador. É um app web, ainda não um APK nativo. Conexão necessária para apostar e consultar saldo.

## Ativar administração
1. Crie sua conta no app e entre nela.
2. Abra **Bônus & recompensas → Configuração inicial do proprietário**.
3. Cole o código do arquivo privado de ativação entregue separadamente. Nunca publique esse código no GitHub.
4. Abra **Administração**. A ativação do primeiro administrador é única, e o primeiro cadastro comum nunca ganha acesso administrativo sozinho.

## Programar prêmios
Em Administração, abra **Programar prêmio**. Defina título, regras de entrega, custo em Ryos, estoque e período de disponibilidade. Escolha um prêmio existente para editar. A programação usa o horário local mostrado pelo dispositivo; o servidor armazena timestamps UTC. No catálogo, o resgate só funciona dentro do período, com estoque e saldo suficientes. Para ocultar um prêmio, desmarque sua visibilidade. Após o resgate, a entrega é manual pelo administrador.

## Publicar eventos e bônus
Crie o evento, escolhas, odds e horário de encerramento. Odds de 2,50 são enviadas como inteiro 250 na API. Ao verificar o resultado, escolha o vencedor e confirme o pagamento. Cancelar restitui todas as apostas pendentes; evento finalizado não pode ser liquidado outra vez. Códigos de bônus aceitam letras, números, _ e -, possuem validade e número máximo de resgates.

## Desenvolvimento local
Requisitos: Node.js 24 e npm.

```sh
npm ci
npm run db:local
npm run dev
```

Para testar ativação local, crie `.dev.vars` com `SETUP_HASH` contendo SHA-256 hexadecimal de um código privado de 64 caracteres. Não versione esse arquivo. Testes:

```sh
npm test
npm run check
npm run types
npx wrangler deploy --dry-run
```

## Publicação pela Cloudflare ou GitHub
O `wrangler.jsonc` contém o nome do Worker e o ID do D1 desta instalação. Para outra conta, crie um D1 com `npx wrangler d1 create umbrella-inside-bet-v1` e atualize o ID. Execute `npx wrangler login`, `npm run db:remote` e `npm run deploy`. Defina o segredo `SETUP_HASH` com `npx wrangler secret put SETUP_HASH` antes da ativação inicial, quando ainda não existir administrador.

No GitHub, configure os secrets `CLOUDFLARE_API_TOKEN` e `CLOUDFLARE_ACCOUNT_ID`, depois execute **Actions → Publicar na Cloudflare → Run workflow**. O token deve ter acesso ao Worker e D1 desta conta. Os testes rodam nos pushes; a publicação é manual. Segredos não entram no repositório. As atualizações pelo Wrangler mantêm os segredos já definidos no Worker.

## Integridade e testes
Débitos, créditos, estoque, bônus e resultados são aplicados por triggers SQLite na mesma transação. Uma restrição impede saldo negativo; chaves únicas impedem duplicação de operações. Testes exercitam cadastro, login, autorização, apostas, saldo insuficiente, pagamento único, bônus diário, limite de código, resgate/estoque/restituição, resultado inválido, cancelamento, origem de requisição e limite do corpo. Esses testes usam SQLite real, complementados por validação de build com Wrangler e inspeção do app publicado. O runtime local não iniciou neste ambiente por erro de interfaces de rede; execute `npm run dev` na sua máquina para testes locais adicionais.

## Escopo desta versão
Os eventos e seus resultados são administrados manualmente. Não há feed esportivo automático, transmissão ao vivo, apostas múltiplas, cash-out, cassino, recuperação de senha por e-mail ou validação de identidade. Não há prevenção completa contra múltiplos cadastros; adicione validação de e-mail e Turnstile antes de campanhas abertas de alto volume. Prêmios não são entregues automaticamente por um serviço externo. Nenhuma tabela ou carteira anterior do Zarcovi é alterada por esta instalação. Disponibilidade e custos da infraestrutura dependem do uso e dos limites da sua conta Cloudflare.
