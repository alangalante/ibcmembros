# IBC Membros — Estado da Implementação

Atualizado em: 1 de agosto de 2026  
Workspace: `/Users/acg/Projects/ibc_membros`  
Repositório remoto: `https://github.com/alangalante/ibcmembros.git`


## 1. Objetivo

Aplicativo mobile-first para gestão de membros e frequentadores da igreja, com:

- membros, frequentadores e conversões;
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

- manifesto PWA;
- metadados de instalação e ícones;
- service worker com estratégia `StaleWhileRevalidate` para arquivos do App Shell (`ibc-app-shell-v1`);
- estratégia `CacheFirst` isolada por UID para imagens do Cloudinary (`ibc-{uid}-images-v1`);
- limpeza automática de versões de cache obsoletas no evento `activate`;
- clique em notificações abrindo rotas internas e WhatsApp para aniversariantes.

Arquivos:

- `src/app/manifest.ts`
- `src/app/layout.tsx`
- `public/firebase-messaging-sw.js`
- `src/components/pwa-register.tsx`
- `public/icons/icon-192.svg`
- `public/icons/icon-512.svg`


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

Somente administradores podem ler. Líderes, membros e frequentadores não recebem nem armazenam localmente o ano ou a idade.

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
- Frequentador não lê `userPrivate`.
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

### Trava de Escrita Direta (Concluída)

Todas as escritas diretas nas coleções `users`, `userPrivate`, `groups`, `groupMemberships`, `events`, `sync`, `changes` e `auditLogs` foram travadas via cliente com `allow write: if false;` ou `allow create, update, delete: if false;`. 

Qualquer mutação de dados é forçada a trafegar pelas APIs servidoras do Next.js utilizando o Firebase Admin SDK. Isso garante 100% de consistência de esquema, auditoria, versionamento e atualização dos cursores de sincronização offline.

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

- `POST /api/admin/users`: Criação de novo membro ou frequentador (com conta Auth opcional) e gravação atômica dos perfis público e privado.
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

## 14. Migração legada (Concluída)

Fonte: `membros_rows.csv`, com 374 registros além do cabeçalho.

Script: `scripts/import-members.ts`.

Status: **Concluído com sucesso no Firebase de produção.**

- Importação executada via `npm run migrate:members`.
- IDs `legacy_{id}` criados e normalizados.
- Perfis públicos (`birthMonthDay`) e privados (`birthDate`) populados com segurança.
- Telefones normalizados e formatados.
- Versão global de sincronização inicializada.

## 15. Índices e Regras de Segurança (Concluído)

Arquivos: `firestore.indexes.json` e `firestore.rules`.

Status: **Implantados e ativos no ambiente de produção do Firebase.**

- Travamento total de escritas diretas efetuado (`firestore.rules`).
- Índices compostos de usuários, grupos, eventos e mudanças configurados.

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
- TypeScript aprovado (0 erros);
- Build de produção aprovado;
- Testes das Firestore Rules aprovados.

## 17. Dependências e segurança

- A última auditoria das dependências de produção encontrou 0 vulnerabilidades.
- Alertas transitivos em ferramentas dev mantidos sob controle. Overrides para `postcss` e `sharp` mantidos.

## 18. GitHub e Versionamento (Concluído)

Remoto:

```text
https://github.com/alangalante/ibcmembros.git
```

Status: **100% Sincronizado.**

- Repositório Git inicializado e conectado ao remoto.
- Branch `main` local sincronizada e totalmente atualizada com `origin/main` (`working tree clean`).
- Todos os commits recentes de recursos (PWA, logo da igreja, layout responsivo desktop, membros, grupos e eventos) devidamente publicados.

## 19. Estado Consolidado do Projeto

O projeto **IBC Membros** encontra-se em estágio **de produção / pronto para uso com todas as melhorias recentes integradas**:

1. **Autenticação**: Login por número de telefone (DDD + número) e senha, normalizando DDI (+55), com admin master promovido.
2. **Dados Legados**: 374 membros importados do CSV para o Cloud Firestore de produção com sucesso.
3. **Módulos Administrativos**: Telas `/admin/users`, `/admin/groups` e `/admin/events` ativas, com suporte a criação, edição e exclusão de eventos e membros com live sync.
4. **PWA & UI Responsiva**:
   - Funcional em telas mobile, laptops e desktops em layout grid.
   - Ícones e favicons com a logo oficial da igreja.
   - Suporte offline-first com IndexedDB.
   - Componente `PullToRefresh` no Dashboard.
5. **Fotos**: Redimensionamento e compressão automática no navegador para formato WebP (400x400) com upload direto e assinado no Cloudinary.
6. **Segurança & Privacidade**:
   - Data e ano de nascimento totalmente protegidos na coleção privada `userPrivate`.
   - Trava de escrita direta no Firestore via cliente (`firestore.rules`).
   - Sincronização de grupos ativos liberada para visualização de vínculos por qualquer membro.
7. **Melhorias de Experiência e Correções Recentes (Agosto/2026)**:
   - **Modal de Perfil Reutilizável (`MemberDetailModal`)**: Exibição de foto, dados, WhatsApp direto, aniversário (dia/mês) e grupos em Aniversariantes, Membros e Grupos do Dashboard.
   - **Modal de Grupos no Dashboard**: Clique nos cards de "Meus Grupos" exibe a lista de participantes e líderes, permitindo clicar em qualquer membro para abrir seu perfil.
   - **Visualização de Grupos por Membros Comuns**: Ajuste nas regras e rota `/api/sync/pull` garantindo que membros não-administradores consigam visualizar os grupos de outros membros.
   - **Edição de Eventos**: Painel `/admin/events` conta com fluxo completo de edição de eventos por administradores e líderes criadores.
   - **Máscara e Validação de Telefone**: Formatação em tempo real `(XX) XXXXX-XXXX` ou `(XX) XXXX-XXXX` nos formulários de membros e validação Zod backend com higienização de caracteres.
   - **Modal Customizado de Confirmação (`ConfirmModal`)**: Exclusão de eventos, cadastros e desvinculações sem mensagens com domínio do navegador (exibindo apenas "IBC Membros").
   - **Notificações Push / FCM**: Auto-registro em múltiplos dispositivos no login e correção no Service Worker para manter a navegação no PWA sem redirecionar para a Vercel.

## 20. Resumo de Atividades Futuras / Melhorias Opcionais

1. Monitoramento continuo de tráfego do plano Spark do Firebase e Cloudinary Free.
2. Expansão contínua de relatórios de auditoria e novos filtros nos painéis conforme necessidade da igreja.

