# Push Notifications (Firebase Cloud Messaging)

Esta integração adiciona Push Notifications ao portal usando Firebase Cloud
Messaging (FCM), sem alterar a arquitetura existente.

## 1. Pré-requisitos no Firebase

1. Acesse <https://console.firebase.google.com> e crie (ou abra) um projeto.
2. **Project settings → General → Your apps**: adicione um app **Web** e copie:
   - `apiKey`, `authDomain`, `projectId`, `messagingSenderId`, `appId`.
3. **Project settings → Cloud Messaging**:
   - Em *Web configuration*, gere um **Web Push certificate (VAPID key)**.
   - Em *Service accounts*, clique em **Generate new private key** — isso baixa
     um JSON com `client_email` e `private_key` (usado no backend).

## 2. Variáveis de ambiente (frontend)

Crie/edite o arquivo `.env` na raiz do projeto adicionando:

```
VITE_FIREBASE_API_KEY=...
VITE_FIREBASE_AUTH_DOMAIN=...
VITE_FIREBASE_PROJECT_ID=...
VITE_FIREBASE_MESSAGING_SENDER_ID=...
VITE_FIREBASE_APP_ID=...
VITE_FIREBASE_VAPID_KEY=...
```

> Sem essas variáveis o código fica desativado silenciosamente — nada quebra.

## 3. Service Worker

Edite **`public/firebase-messaging-sw.js`** e substitua os valores
`REPLACE_*` pelas mesmas credenciais públicas do passo 2 (apiKey,
authDomain, projectId, messagingSenderId, appId).

> O SW precisa estar em `/public` para ser servido em `/firebase-messaging-sw.js`.

## 4. Secrets do backend (Edge Function)

A função `send-push-notification` usa a HTTP v1 API do FCM. Configure os
secrets em **Lovable Cloud → Backend → Secrets**:

- `FIREBASE_PROJECT_ID` — o mesmo `projectId`.
- `FIREBASE_CLIENT_EMAIL` — campo `client_email` do JSON do service account.
- `FIREBASE_PRIVATE_KEY` — campo `private_key` do JSON, mantendo `\n` escapados.

## 5. Como funciona

- Ao logar, `usePushNotifications` pede permissão, registra o service
  worker, gera o token FCM e salva em `device_tokens` (1 linha por dispositivo).
- O sino no header (`NotificationBell`) lista as notificações da tabela
  `notifications` e atualiza em tempo real (badge com contador de não lidas).
- Em **Painel Admin → Comunicações → Push Notifications** o admin envia
  para todos ou para destinatários selecionados. A Edge Function envia via FCM
  e grava na tabela `notifications`.

## 6. Como testar

1. Configure tudo acima e faça login com um usuário.
2. Aceite o pedido de permissão de notificações.
3. Confirme em `device_tokens` que o token foi salvo.
4. Como admin, envie uma push em **Comunicações → Push Notifications**.
5. Com a aba em foreground aparece um toast; em background aparece uma
   notificação nativa do navegador.

## 7. Tabelas envolvidas

- `device_tokens` — tokens FCM (gerenciado pelo próprio usuário).
- `notifications` — histórico exibido na central de notificações.
