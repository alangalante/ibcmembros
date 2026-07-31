# IBC Membros — Estado da Implementação

Atualizado em: 31 de julho de 2026  
Workspace: `/Users/acg/Projects/ibc_membros`  
Repositório remoto: `https://github.com/alangalante/ibcmembros.git`

## 1. Objetivo

Aplicativo mobile-first para gestão de membros e visitantes da igreja, com:

- membros, visitantes e conversões;
- grupos de comunhão, líderes e participantes;
- eventos globais e restritos;
- aniversariantes;
- notificações push;
- fotos;
- controle de acesso por papel;
- funcionamento rápido, offline-first e com baixo tráfego;
- infraestrutura com custo rigidamente controlado.

## 2. Arquitetura acordada

- Frontend/PWA: Next.js, React, TypeScript e TailwindCSS na Vercel Hobby.
- Autenticação: Firebase Auth.
- Banco: Cloud Firestore no plano Spark.
- Notificações: Firebase Cloud Messaging.
- Fotos: Cloudinary Free, sem Firebase Storage.
- Automação: Vercel Cron diário.
- Cache de dados: IndexedDB isolado por UID.
- Cache de imagens: Cache Storage controlado pelo service worker.
- Sincronização: manifesto de versões, cursores e mudanças incrementais.
- Escritas sensíveis: rotas Next.js autenticadas usando Firebase Admin SDK.

## 3. Estado atual

### 3.1 Base Next.js

Implementado:

- Next.js 15 e React 19;
- TypeScript estrito;
- TailwindCSS 4;
- ESLint;
- App Router;
- build para Vercel;
- variáveis de ambiente documentadas.

Arquivos principais:

- `package.json`
- `next.config.ts`
- `tsconfig.json`
- `eslint.config.mjs`
- `.env.example`

### 3.2 PWA

Implementado:

- manifesto;
- metadados de instalação;
- cores e ícones;
- service worker inicial;
- clique em notificações abrindo uma rota interna.

Arquivos:

- `src/app/manifest.ts`
- `src/app/layout.tsx`
- `public/firebase-messaging-sw.js`
- `public/icons/icon-192.svg`
- `public/icons/icon-512.svg`

Pendente:

- cache completo do app shell;
- tela offline;
- políticas `CacheFirst`, `NetworkFirst` e `StaleWhileRevalidate`;
- limpeza de versões antigas de imagens e arquivos estáticos.

### 3.3 Firebase

Implementado:

- Firebase Web SDK para navegador;
- Firebase Admin SDK para servidor;
- Firebase Auth;
- Firestore;
- FCM;
- fallback somente para permitir build sem variáveis reais;
- validação explícita das variáveis públicas no navegador.

Arquivos:

- `src/lib/firebase/client.ts`
- `src/lib/firebase/admin.ts`
- `src/lib/firebase/messaging.ts`

O Firebase Storage foi retirado da arquitetura e da configuração. O antigo arquivo `storage.rules` foi removido e o deploy do Firebase agora contempla somente Rules e índices do Firestore.

### 3.4 Autenticação

Implementado:

- login com e-mail e senha;
- observação da sessão;
- contexto React;
- logout;
- proteção visual da tela de aniversários.

Arquivos:

- `src/components/auth-provider.tsx`
- `src/components/login-form.tsx`

Pendente:

- recuperação e redefinição de senha;
- criação de contas pelo administrador;
- tratamento de conta desativada;
- proteção adicional de rotas;
- Firebase App Check.

### 3.5 Dashboard & Navegação

Implementado:

- identificação do usuário e saudação;
- grupos vinculados ao usuário;
- próximos eventos com rota dedicada `/events/[eventId]`;
- ativação de push FCM;
- navegação superior unificada (`NavHeader`) com suporte a permissões dinâmicas;
- renderização *IndexedDB-first* via `useOfflineData()`.

Arquivos: `src/components/dashboard.tsx`, `src/components/nav-header.tsx`, `src/app/events/[eventId]/page.tsx`.


## 4. Modelo de dados

### 4.1 Perfil público — `users/{uid}`

```ts
{
  name,
  nameSearch,
  birthMonthDay, // MM-DD
  phoneE164,
  photoUrl,
  photoPublicId,
  role,
  type,
  groupIds,
  active,
  createdAt,
  updatedAt
}
```

O ano de nascimento e a idade nunca ficam nesse documento.

### 4.2 Perfil privado — `userPrivate/{uid}`

```ts
{
  birthDate, // YYYY-MM-DD
  conversionDate,
  conversionReason,
  legacyPhotoPath,
  updatedAt
}
```

Somente administradores podem ler. Líderes, membros e visitantes não recebem nem armazenam localmente o ano ou a idade.

### 4.3 Grupos — `groups/{groupId}`

```ts
{
  name,
  description,
  leaderIds,
  participantIds,
  active,
  createdAt,
  updatedAt
}
```

### 4.4 Vínculos — `groupMemberships/{groupId}_{userId}`

```ts
{
  groupId,
  userId,
  isLeader,
  active,
  joinedAt,
  updatedAt
}
```

A coleção de vínculos complementa os arrays do grupo e facilita auditoria, consultas e sincronização.

### 4.5 Eventos — `events/{eventId}`

```ts
{
  title,
  description,
  startsAt,
  eventDate,
  timezone: "America/Sao_Paulo",
  scope: "global" | "groups",
  groupIds,
  createdBy,
  createdAt,
  updatedAt
}
```

### 4.6 Tokens FCM — `users/{uid}/devices/{deviceId}`

```ts
{
  token,
  platform: "web",
  enabled,
  updatedAt
}
```

## 5. Privacidade

A privacidade do nascimento foi aplicada no banco e nas Firestore Rules, não apenas escondida na tela.

- Admin lê `userPrivate`.
- Líder não lê `userPrivate`.
- Membro não lê `userPrivate`.
- Visitante não lê `userPrivate`.
- Perfis públicos possuem somente `birthMonthDay`.
- A idade não deve ser calculada ou enviada em APIs, notificações ou caches comuns.
- Escrita direta em `userPrivate` é negada até para admin; alterações passam pela API segura.

Isso impede a descoberta do ano pelo SDK do Firebase, DevTools, IndexedDB ou chamadas diretas ao Firestore.

## 6. RBAC atual

Papéis:

- `admin`
- `leader`
- `common`

### Admin

- lê dados privados;
- consulta usuários;
- gerencia dados por APIs administrativas;
- possui permissões administrativas de grupos e eventos;
- consulta auditoria.

### Líder

- lê seus grupos;
- gerencia participantes dos grupos que lidera;
- cria evento restrito a um único grupo liderado por ele;
- edita seus próprios eventos restritos;
- consulta vínculos relacionados ao grupo.

### Comum

- lê perfis públicos ativos;
- lê seus grupos;
- lê eventos globais;
- lê eventos dos seus grupos;
- gerencia seus tokens FCM.

### Pendência de segurança

As Rules ainda permitem algumas escritas diretas de grupos, eventos e memberships. O objetivo é fazer todas as mutações relevantes passarem pelas APIs transacionais para garantir versão, consistência e auditoria. Depois disso, as escritas diretas restantes devem ser fechadas.

Arquivo: `firestore.rules`.

## 7. APIs implementadas

### 7.1 Autenticação de servidor

Arquivo: `src/lib/server/auth.ts`.

Responsabilidades:

- receber Firebase ID Token;
- verificar assinatura e validade;
- carregar perfil;
- rejeitar usuário inexistente ou inativo;
- retornar UID e papel;
- aplicar `requireAdmin`;
- padronizar respostas de erro.

### 7.2 Alteração administrativa de usuário

Rota: `PATCH /api/admin/users/{uid}`.  
Arquivo: `src/app/api/admin/users/[uid]/route.ts`.

Implementado:

- autenticação;
- exigência de admin;
- validação Zod;
- separação entre patch público e privado;
- derivação de `birthMonthDay` a partir de `birthDate`;
- atualização da versão global;
- atualização da versão pessoal;
- registro de mudança;
- auditoria;
- transação Firestore.

Pendente:

- criação de usuário;
- desativação/exclusão;
- conversão dedicada;
- criação da conta no Firebase Auth;
- interface administrativa.

### 7.3 Inclusão em grupo

Rota: `POST /api/groups/{groupId}/members`.  
Arquivo: `src/app/api/groups/[groupId]/members/route.ts`.

Implementado:

- admin ou líder do grupo pode incluir participante;
- somente admin promove líder;
- atualização atômica do grupo, usuário e membership;
- versão do grupo;
- versão do usuário;
- mudança incremental;
- auditoria.

Pendente:

### 7.4 Rotas Administrativas de Usuários, Grupos e Eventos

Implementado:

- `POST /api/admin/users`: Criação de novo membro ou visitante (com conta Auth opcional) e gravação atômica dos perfis público e privado.
- `GET /api/admin/users/[uid]`: Leitura de perfil público e dados privados (`birthDate`, `conversionDate`, `conversionReason`) restrita a administradores.
- `PATCH /api/admin/users/[uid]`: Alteração transacional de campos públicos e privados com derivação de `birthMonthDay`.
- `POST /api/admin/groups` & `PATCH /api/admin/groups/[groupId]`: Criação e edição transacional de grupos de comunhão.
- `POST /api/admin/events`, `PATCH /api/admin/events/[eventId]` & `DELETE /api/admin/events/[eventId]`: Gestão completa de eventos (globais e restritos a grupos) com validação de papéis de líderes e admins.
- Interface visual administrativa: `/admin/users`, `/admin/groups` e `/admin/events`.


## 8. Sincronização versionada

Estruturas criadas:

```text
sync/global
sync/group_{groupId}
sync/user_{uid}
changes/{changeId}
auditLogs/{logId}
```

Documento de sincronização:

```ts
{
  version,
  schemaVersion,
  updatedAt
}
```

Documento de mudança:

```ts
{
  entity,
  entityId,
  operation: "create" | "update" | "delete",
  scope: "global" | "group" | "user",
  groupId,
  userId,
  actorId,
  version,
  changedAt
}
```

Serviço: `src/lib/server/sync.ts`.

### Manifesto

Rota: `GET /api/sync/manifest`.  
Arquivo: `src/app/api/sync/manifest/route.ts`.

Retorna:

- versão do esquema;
- versão global;
- versão pessoal;
- versões dos grupos do usuário.

Pendente:

- endpoint incremental de mudanças;
- cursor;
- paginação;
- tombstones de exclusão;
- confirmação do cursor local;
- integração com IndexedDB;
- limpeza total quando `schemaVersion` mudar;
- remoção seletiva quando permissões mudarem.

## 9. Cache local & Sync Engine (Implementado)

Implementado:

- Banco IndexedDB isolado por UID (`ibc-cache-{uid}`) (`src/lib/offline/db.ts`);
- Armazenamento local de usuários, grupos, vínculos, eventos e metadados de sincronização;
- `SyncEngine` (`src/lib/offline/sync-engine.ts`) com verificação de manifesto de versão;
- Limpeza total automática de cache local quando `schemaVersion` altera;
- Provedor React `OfflineDataProvider` (`src/components/offline-data-provider.tsx`);
- Renderização *IndexedDB-first* em `/`, `/birthdays`, `/admin/users`, `/admin/groups` e `/admin/events`.


Fluxo:

```text
Abrir aplicativo
    ↓
Renderizar dados do IndexedDB
    ↓
Buscar manifesto pequeno
    ↓
Comparar versões
    ↓
Buscar somente diferenças necessárias
```

Políticas planejadas:

- app shell: `StaleWhileRevalidate`;
- imagens: `CacheFirst`;
- manifesto: `NetworkFirst`;
- dados de domínio: IndexedDB-first;
- cache e banco isolados por UID;
- limpeza completa ao sair ou trocar de conta;
- expiração de segurança quando não for possível validar permissões.

## 10. Cloudinary (Implementado)

O Firebase Storage foi completamente substituído pela integração com o Cloudinary.

Implementado:

- Rota de assinatura segura no servidor: `POST /api/cloudinary/sign` (`src/app/api/cloudinary/sign/route.ts`);
- Redimensionamento e compressão automática no navegador para formato **WebP (400x400px)** via HTML Canvas (`src/lib/image.ts`);
- Upload direto assinado do navegador para o Cloudinary (sem consumo de banda do servidor);
- Componente reusável `<PhotoUpload />` (`src/components/photo-upload.tsx`) com preview local e remoção de imagem;
- Atualização e persistência dos campos `photoUrl` e `photoPublicId` no perfil do usuário via API transacional;
- Renderização de avatares com fotos em `/birthdays` e `/admin/users`.


## 11. Aniversários

Tela: `/birthdays`.  
Arquivo: `src/app/birthdays/page.tsx`.

Implementado:

- exige autenticação;
- mostra aniversariantes ativos;
- mostra somente dia/mês;
- mostra foto quando disponível;
- oferece botão para WhatsApp;
- não mostra idade ou ano.

Pendente:

- usar IndexedDB primeiro;
- sincronização em segundo plano;
- cache das fotos;
- tratamento offline completo.

## 12. Notificações

Implementado:

- permissão do navegador;
- token FCM;
- armazenamento por dispositivo;
- service worker;
- envio em lotes de 500;
- remoção de tokens inválidos;
- clique abrindo rota interna.

Arquivos:

- `src/lib/firebase/messaging.ts`
- `src/lib/notifications.ts`
- `public/firebase-messaging-sw.js`

### Aniversários

O cron envia uma única notificação textual. Não envia foto, telefone, idade ou ano. O clique abre `/birthdays`.

### Eventos

O cron segmenta eventos globais e restritos por `groupIds`.

Pendência: criar `/events/{eventId}`, pois o link de evento aponta para uma rota ainda não implementada.

## 13. Cron diário

Rota: `GET /api/cron/daily`.  
Arquivo: `src/app/api/cron/daily/route.ts`.

Proteção:

```http
Authorization: Bearer CRON_SECRET
```

Agenda:

```cron
0 12 * * *
```

Corresponde atualmente a 09:00 em São Paulo. A seleção usa `America/Sao_Paulo`.

Pendente:

- idempotência para evitar envio duplicado;
- histórico de execuções;
- histórico de notificações;
- retry;
- monitoramento de falhas;
- validação em ambiente Vercel real.

## 14. Migração legada

Fonte: `membros_rows.csv`, com 374 registros além do cabeçalho.

Script: `scripts/import-members.ts`.

Implementado:

- IDs `legacy_{id}`;
- `birthMonthDay` público;
- `birthDate` privado;
- `legacyPhotoPath` privado;
- `photoUrl` inicialmente vazio;
- normalização de telefone;
- telefones apenas com zeros ficam vazios;
- importação idempotente;
- inicialização da versão global.

Pendente:

- executar no Firebase real;
- gerar relatório de inconsistências;
- migrar fotos para Cloudinary;
- associar registros aos UIDs do Auth;
- revisar telefones duplicados/inválidos;
- validar datas;
- conferir amostras antes da produção.

## 15. Índices

Arquivo: `firestore.indexes.json`.

Preparados para:

- usuários ativos e aniversário;
- usuários por grupo;
- eventos globais;
- eventos restritos;
- mudanças globais;
- mudanças por grupo;
- mudanças por usuário.

Ainda não foram implantados no projeto Firebase real.

## 16. Testes e validação

Comandos executados:

```bash
npm run lint
npm run typecheck
npm run build
npm run test:rules
```

Resultados:

- ESLint aprovado;
- TypeScript aprovado;
- build de produção aprovado;
- 4 testes das Firestore Rules aprovados no emulador.

Testes existentes:

1. admin lê dados privados;
2. membro não lê dados privados;
3. membro lê perfil público ativo;
4. escrita direta em dados privados é negada até para admin.

Arquivo: `tests/firestore.rules.test.ts`.

Pendente testar:

- líder e limites do grupo;
- evento global e restrito;
- membership;
- manifesto;
- APIs;
- transações;
- cron;
- FCM;
- cache;
- invalidação;
- troca de conta;
- conversão de visitante.

Observação: o Firebase CLI avisou que versões futuras exigirão Java 21. O ambiente atual possui Java 17 e executou os testes com sucesso.

## 17. Dependências e segurança

- A última auditoria das dependências de produção encontrou 0 vulnerabilidades.
- Existem alertas transitivos nas ferramentas de desenvolvimento, principalmente no Firebase CLI.
- Não executar `npm audit fix --force`, pois ele sugeriu downgrades e alterações incompatíveis.
- Foram usados overrides pontuais para `postcss`, `sharp` e `uuid`.

## 18. GitHub — bloqueio atual

Remoto informado:

```text
https://github.com/alangalante/ibcmembros.git
```

O diretório local ainda não foi inicializado/publicado porque o GitHub CLI informou token inválido para `alangalante`.

Antes de continuar:

```bash
gh auth login -h github.com
gh auth status
```

Depois da autenticação:

1. executar `git init`;
2. configurar `origin`;
3. confirmar a branch padrão do remoto;
4. criar `agent/fundacao-segura`;
5. revisar arquivos e segredos;
6. criar commit inicial;
7. executar os testes;
8. fazer push;
9. abrir uma PR draft.

## 19. Próximas prioridades

### Prioridade 1 — Cache e sincronização

1. criar `CacheRepository` sobre IndexedDB;
2. criar banco isolado por UID;
3. implementar endpoint incremental de mudanças;
4. implementar cursores e paginação;
5. implementar tombstones;
6. criar `SyncEngine`;
7. comparar manifesto local/remoto;
8. sincronizar somente escopos modificados;
9. limpar dados quando permissões mudarem;
10. limpar tudo quando `schemaVersion` mudar;
11. migrar dashboard e aniversários para IndexedDB-first.

### Prioridade 2 — Cloudinary

1. rota de assinatura;
2. compressão WebP;
3. upload direto;
4. URLs imutáveis;
5. cache de imagens;
6. substituição/exclusão;
7. migração legada.

### Prioridade 3 — Administração

- criar/listar/editar/desativar pessoas;
- converter visitante;
- criar contas Auth;
- atribuir papéis;
- administrar grupos e líderes;
- administrar eventos;
- visualizar auditoria.

### Prioridade 4 — Segurança

- mover todas as mutações para APIs;
- fechar escritas diretas restantes;
- App Check;
- rate limiting;
- auditoria completa;
- expiração de cache;
- proteção contra duplicação do cron;
- documentação e consentimento LGPD.

### Prioridade 5 — Implantação

- autenticar GitHub CLI e publicar PR;
- configurar Firebase real;
- configurar Cloudinary;
- configurar variáveis da Vercel;
- implantar Rules e índices;
- criar primeiro admin;
- importar legado;
- validar push em Android e iPhone;
- configurar domínio;
- executar piloto e monitorar consumo.

## 20. Ponto exato de retomada

Ao retomar o desenvolvimento:

1. ler este documento e `README.md`;
2. executar `gh auth status`;
3. se autenticado, publicar o estado atual em PR draft;
4. executar `npm run lint`, `npm run typecheck`, `npm run build` e `npm run test:rules`;
5. iniciar `CacheRepository` e o banco IndexedDB por UID;
6. implementar o endpoint incremental de mudanças;
7. criar `SyncEngine` e integrar primeiro a tela `/birthdays`;
8. depois integrar o dashboard;
9. somente então iniciar o upload Cloudinary.

O projeto está compilável e possui a fundação de privacidade, RBAC, sincronização e notificações. Ainda não está pronto para produção: faltam cache offline-first, sincronização incremental completa, Cloudinary, telas administrativas, testes amplos, migração real e implantação dos serviços.
