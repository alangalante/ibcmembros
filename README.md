# IBC Membros

Base mobile-first para gestão de membros, visitantes, grupos e eventos, construída com Next.js, Tailwind CSS, Firebase, Cloudinary e FCM.

## Decisão de custo (leia antes de provisionar)

O projeto não usa Firebase Storage: desde 3 de fevereiro de 2026 ele exige Blaze. As fotos serão servidas pelo Cloudinary Free, que não exige cartão e restringe o serviço ao atingir sua franquia. Para preservar o custo zero:

- comprima fotos para WebP antes do upload e use URLs imutáveis/versionadas;
- acompanhe os 25 créditos mensais compartilhados do Cloudinary;
- acompanhe os painéis de uso. Firestore oferece 1 GiB, 50 mil leituras/dia, 20 mil gravações/dia e 10 GiB/mês de saída na franquia gratuita;
- FCM e a maior parte do Firebase Auth são produtos sem custo;
- use Vercel Hobby. O cron diário é permitido, porém pode executar em qualquer instante dentro da hora agendada.

Essa escolha mantém Firebase no plano Spark e evita uma conta de faturamento vinculada ao armazenamento de fotos.

## Arquitetura

```text
PWA Next.js na Vercel
  ├── Firebase Auth (sessão)
  ├── Firestore (dados + RBAC nas Rules)
  ├── Cloudinary Free (fotos WebP + URLs imutáveis)
  ├── IndexedDB + Cache Storage (dados e imagens locais)
  ├── FCM (tokens em users/{uid}/devices)
  └── GET /api/cron/daily (Admin SDK)
       ├── aniversários por birthMonthDay
       └── eventos por eventDate e público por groupIds
```

O documento de grupo mantém `leaderIds` e `participantIds`, como pedido. Também há `groupMemberships/{groupId_userId}` e a projeção `users.groupIds`. Essa pequena duplicação é intencional: facilita auditoria, consultas segmentadas e RBAC sem fazer varreduras caras. Toda alteração de vínculo deve atualizar os três locais em uma transação no backend.

### Sincronização offline-first

Após o primeiro acesso, perfis públicos, grupos permitidos e eventos futuros ficam no IndexedDB `ibc-cache-{uid}`. A abertura seguinte renderiza esses dados antes da rede. O cliente consulta apenas `/api/sync/manifest`; se as versões forem iguais, nenhuma coleção é relida. Quando há mudança, `/api/sync/pull` entrega somente os documentos citados no log `changes`. Se o `schemaVersion` mudar ou o lote incremental ultrapassar o limite seguro, o servidor solicita um snapshot completo.

As fotos usam Cache Storage separado por UID e estratégia Cache First. URLs versionadas do Cloudinary fazem uma foto nova ter uma chave nova sem revalidar as anteriores. No logout, IndexedDB, cache de imagens e token FCM do aparelho são removidos.

## Modelo Firestore

### `users/{authUid}`

```ts
{
  name: "Maria Silva",
  nameSearch: "maria silva",
  birthMonthDay: "08-12",
  phoneE164: "+5522999999999",
  photoUrl: "https://...",
  photoPublicId: "members/uid/id-aleatorio",
  role: "admin" | "leader" | "common",
  type: "member" | "visitor",
  groupIds: ["grupo-central"],
  active: true,
  createdAt: Timestamp,
  updatedAt: Timestamp
}
```

### `userPrivate/{authUid}`

`{ birthDate, conversionDate, conversionReason, updatedAt }`. Somente administradores podem ler estes documentos; líderes, membros e visitantes não recebem nem armazenam localmente o ano ou a idade.

O ID deve ser o UID do Firebase Auth para pessoas com acesso. Cadastros importados sem login usam temporariamente `legacy_{id}`; ao criar o Auth, mova/mescle o perfil para o UID real.

### `users/{uid}/devices/{tokenId}`

Token FCM por navegador: `{ token, platform: "web", enabled, updatedAt }`.

### `groups/{groupId}`

`{ name, description, leaderIds[], participantIds[], active, createdAt, updatedAt }`

### `groupMemberships/{groupId}_{userId}`

`{ groupId, userId, isLeader, active, joinedAt }`

### `events/{eventId}`

`{ title, description, startsAt, eventDate, timezone, scope, groupIds[], createdBy, createdAt, updatedAt }`. Em evento global, `groupIds` é vazio. `eventDate` é a data em `America/Sao_Paulo`, usada pelo cron.

### `sync/{scope}` e `changes/{changeId}`

`sync/global`, `sync/group_{groupId}` e `sync/user_{uid}` guardam versões opacas. `changes` registra entidade, operação, escopo e instante da alteração. Os clientes não leem o log diretamente: a API filtra os registros pelos grupos e pelo usuário autenticado.

## RBAC aplicado

- Admin: CRUD de usuários, grupos, vínculos e eventos.
- Líder: lê seu grupo, altera apenas `participantIds` dele e cria/edita evento restrito a um grupo que lidera. Um evento de vários grupos fica reservado ao admin.
- Comum: lê perfis públicos ativos, seus grupos e eventos globais ou cujo `groupIds` intersecte seu `users.groupIds`.
- Tokens FCM: somente o proprietário acessa sua subcoleção.
- Dados privados: somente admin lê; escritas passam por API transacional mesmo para admin.
- Tudo que não foi explicitamente permitido é negado.

As regras ficam em [firestore.rules](./firestore.rules). O Admin SDK usado pelas APIs ignora Rules; por isso cada rota valida o Firebase ID Token e o papel antes de alterar dados.

## Configuração local

1. Use Node 22 LTS e execute `npm install`.
2. Copie `.env.example` para `.env.local` e preencha os dados do app Web em Firebase Console > Configurações do projeto.
3. Ative Auth por e-mail/senha, Firestore e Cloud Messaging. Gere uma chave Web Push (VAPID).
4. Crie uma conta Cloudinary Free e configure as variáveis `CLOUDINARY_*`.
5. Para credenciais administrativas na Vercel, crie uma service account com privilégios mínimos e configure `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL` e `FIREBASE_PRIVATE_KEY`.
6. Gere um segredo longo (`openssl rand -hex 32`) para `CRON_SECRET`.
7. Copie `.firebaserc.example` para `.firebaserc`, informe o project ID e rode `npm run firebase:deploy`.
8. Rode `npm run dev`. Para Rules localmente, use `npm run firebase:emulators`.

Para executar os testes de privacidade das Rules: `npm run test:rules`.

## Primeiro administrador

Crie a conta no Firebase Auth e depois crie manualmente `users/{UID}` no Firestore com `role: "admin"`, `type: "member"`, `active: true`, `groupIds: []` e os demais campos do modelo. Não existe autoelevação no cliente.

## Migração do CSV legado

O script processa o arquivo local `membros_rows.csv`, grava somente dia/mês no perfil público, coloca a data completa em `userPrivate` e é idempotente por `legacyId`. O arquivo real está no `.gitignore` por conter dados pessoais; use `membros_rows.example.csv` como referência de formato.

```bash
GOOGLE_APPLICATION_CREDENTIALS=/caminho/service-account.json npm run migrate:members
```

Os caminhos de foto antigos são preservados como `legacyPhotoPath` privado. Depois da migração para Cloudinary, `photoUrl` e `photoPublicId` serão preenchidos no perfil público. Telefones compostos apenas de zeros ficam vazios.

## Automação diária

`vercel.json` usa `0 12 * * *`: 12:00 UTC corresponde a 09:00 em São Paulo no regime atual. A rota recalcula a data no fuso `America/Sao_Paulo`, portanto a seleção continua correta mesmo que regras de fuso mudem. No Hobby, a Vercel oferece precisão horária (pode executar entre 09:00 e 09:59).

Fluxo:

1. busca aniversariantes por `active + birthMonthDay`;
2. envia uma única notificação textual e abre `/birthdays`; foto e WhatsApp aparecem dentro do aplicativo;
3. busca eventos por `eventDate`;
4. para global, envia a todos; para restrito, consulta usuários cujo `groupIds` contém algum grupo permitido;
5. envia em lotes de 500 e remove tokens FCM inválidos.

Alternativa sem Vercel Cron: um workflow diário do GitHub Actions chama `curl -H "Authorization: Bearer $CRON_SECRET" https://SEU_DOMINIO/api/cron/daily`.

## Ordem recomendada de implementação

1. Provisionar Firebase/Vercel, variáveis e Rules.
2. Criar o primeiro admin e validar login/PWA.
3. Implementar telas administrativas de usuários, conversão de visitante e upload comprimido.
4. Implementar serviço transacional de vínculos (grupo, membership e `users.groupIds`).
5. Implementar CRUD de eventos conforme o papel.
6. Ativar push em aparelho real e testar WhatsApp.
7. Importar o legado, sanear telefones/fotos e vincular contas Auth.
8. Testar Rules no Emulator Suite e a rota cron em preview antes da produção.

## Critérios de produção

- nunca armazenar senha ou `senha_hash` no Firestore; o Firebase Auth é o dono das credenciais;
- ativar App Check para reduzir abuso;
- registrar ações administrativas numa coleção `auditLogs` escrita apenas no servidor;
- obter consentimento explícito para push e tratamento de foto/telefone (LGPD);
- criar testes de Rules para todas as negações, além dos caminhos felizes;
- monitorar leitura por listeners em tempo real; paginação reduz consumo quando a base crescer.
