# PEDAL — Configuração de produção

**Resumo para a Pedalar Sem Idade | 28 de julho de 2026**

## 1. Configuração recomendada

| Componente | Recomendado | Custo mensal | Limite / observação |
|---|---|---:|---|
| Aplicação completa | Railway Hobby + Supabase Pro Micro + Gemini | **30–45 USD + IVA** | **50 utilizadores ativos em simultâneo** como limite operacional inicial |
| Railway | [Hobby](https://docs.railway.com/pricing/plans#:~:text=Hobby%20%7C%20%245%20%2F%20month) | 5–10 USD | Depende de CPU, memória e tráfego |
| Supabase | [Pro](https://supabase.com/pricing#:~:text=Pro) + [compute Micro](https://supabase.com/docs/guides/platform/compute-and-disk#:~:text=Micro%20%7C%20%240.01344%20%7C%20~%2410%20%7C%202-core%20%28shared%29%20%7C%201%20GB%20%7C%2010%20GB) | 25 USD | 2 cores partilhados, 1 GB RAM e 10 GB de base de dados recomendada |
| Assistente | [Google Gemini, pago por utilização](https://ai.google.dev/gemini-api/docs/pricing#:~:text=Paid%20Tier%2C%20per%201M%20tokens%20in%20USD) | 0–10 USD | [Quotas por projeto](https://ai.google.dev/gemini-api/docs/rate-limits#:~:text=Rate%20limits%20are%20applied%20per%20project%2C%20not%20per%20API%20key); não limita o restante funcionamento da aplicação |
| E-mail | SMTP do Google Workspace [configurado no Supabase Auth](https://supabase.com/docs/guides/auth/auth-smtp#:~:text=head%20to%20the%20Authentication%20settings%20page%20to%20enable%20and%20configure%20custom%20SMTP) | 0 EUR adicionais | Não aplicável |
| Proteção anti-bot | [Cloudflare Turnstile Free](https://developers.cloudflare.com/turnstile/plans/) com widget Managed | 0 USD adicionais | Protege o registo público; requer conta da associação e chaves próprias do widget |
| Domínio | Domínio existente | 0 EUR adicionais | Não aplicável |
| Repositório | Organização [GitHub Free](https://github.com/pricing) própria; código privado | 0 USD adicionais | Free sem validação da entidade; [Team gratuito para entidades sem fins lucrativos](https://docs.github.com/en/nonprofit/nonprofit-teams-plan/getting-started-with-the-github-team-plan-for-nonprofits), sujeito a aprovação |
| Desenvolvimento | Aplicação e [Supabase locais](https://supabase.com/docs/guides/local-development#:~:text=Cost-effective%3A%20Local%20development%20is%20free); [Supabase Free](https://supabase.com/docs/guides/platform/billing-on-supabase#:~:text=You%20are%20granted%20two%20free%20projects) separado para testes partilhados | 0 USD adicionais | Não aplicável |

Os fornecedores não definem um número máximo de utilizadores da aplicação. Os **50 utilizadores ativos em simultâneo** são, por isso, um limite operacional inicial prudente e não uma garantia.

## 2. Escalonamento e controlo de custos

| Componente | Área | Como escala | Custos e limites | Controlo |
|---|---|---|---|---|
| Railway | Aplicação | [Usa automaticamente mais CPU e memória, até ao teto do plano](https://docs.railway.com/deployments/scaling#:~:text=By%20default%20Railway%20will%20scale%20your%20service%20up%20to%20the%20specified%20vCPU%20and%20Memory%20limits) | O [Hobby inclui 5 USD de utilização](https://docs.railway.com/pricing/understanding-your-bill#:~:text=Your%20subscription%20fee%20goes%20toward%20your%20resource%20usage); acima disso, o custo aumenta. Um [hard limit atingido coloca a aplicação offline](https://docs.railway.com/pricing/cost-control#:~:text=Once%20your%20resource%20usage%20hits%20the%20specified%20hard%20limit%2C%20all%20your%20workloads%20will%20be%20taken%20offline) | Alerta aos 8 USD; hard limit inicial de 20 USD, revisto mensalmente |
| Supabase | Capacidade da base de dados | O [compute Micro não aumenta sozinho](https://supabase.com/docs/guides/platform/compute-and-disk#:~:text=Compute%20sizes%20are%20not%20auto-upgraded%20because%20of%20the%20downtime%20incurred); a passagem para Small é manual | O Micro é coberto pelo crédito de compute. Para Small, o [cálculo oficial é 25 USD + 15 USD - 10 USD = 30 USD/mês](https://supabase.com/docs/guides/platform/manage-your-usage/compute#:~:text=Billing%20examples%23-,One%20project,-%23) | Monitorizar CPU, memória e latência; subir para Small apenas se necessário |
| Supabase | Disco e consumos | [O disco cresce automaticamente aos 90%](https://supabase.com/docs/guides/platform/database-size#:~:text=Disk%20size%20expands%20automatically%20when%20the%20database%20reaches%2090%25%20of%20the%20allocated%20disk%20size.%20The%20disk%20is%20expanded%20to%20be%2050%25%20larger%20%28for%20example%2C%208%20GB%20%2D%3E%2012%20GB%29.) se os excedentes estiverem autorizados | Com [Spend Cap ligado, o item excedido é restringido](https://supabase.com/docs/guides/platform/cost-control#:~:text=After%20exceeding%20the%20quota%20for%20a%20usage%20item%2C%20further%20usage%20of%20that%20item%20is%20disallowed); desligado, continua e cobra excedente | Começar com Spend Cap ligado e acompanhar a utilização |
| Gemini | Assistente | O consumo é [faturado por tokens](https://ai.google.dev/gemini-api/docs/pricing#:~:text=Paid%20Tier%2C%20per%201M%20tokens%20in%20USD) dentro das quotas do projeto | Ao atingir a quota, só o assistente fica temporariamente limitado | Orçamento Google Cloud, alertas, limite de pedidos por utilizador e tamanho máximo das respostas |
| Turnstile | Registo público | Não exige escalonamento para a utilização prevista | Plano Free; uma configuração ausente ou inválida deve fechar o registo sem o deixar desprotegido | Restringir ao hostname da aplicação, guardar a secret no Railway e acompanhar as validações |
| E-mail e domínio | Serviços existentes | Não exigem escalonamento para a utilização prevista | Uma [quota de envio](https://support.google.com/a/answer/166852?hl=pt#:~:text=Google%20limita%20a%20quantidade%20de%20mensagens%20do%20Gmail%20enviadas%20por%20dia) afeta e-mails de autenticação, não a aplicação principal | Monitorizar erros de envio no Supabase e manter as quotas do Google Workspace sob revisão |
