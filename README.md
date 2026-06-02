<img width="2532" height="1786" alt="image" src="https://github.com/user-attachments/assets/9609c26e-d282-48a0-b0b7-3a4ed4401bb5" />



# Lolzteam Launcher

Десктопный лаунчер для покупателей на [lzt.market](https://lzt.market) - вход в купленные аккаунты в один клик.

Поддерживает **Steam**, **Telegram** и вход по cookie через браузер.

## Установка

Скачайте установщик со страницы [Releases](https://github.com/iamextasy/Lolzteam-Launcher/releases) и запустите.

> Windows SmartScreen может предупредить о неизвестном издателе (сборка не подписана цифровым сертификатом).
> Нажмите **Подробнее → Выполнить в любом случае**, чтобы продолжить.

## Сборка из исходников

Требуется [Node.js](https://nodejs.org) ≥ 20.18 и [pnpm](https://pnpm.io) 10.

Если `pnpm` не установлено, установите его через npm:

```bash
npm install -g pnpm
```

или включите Corepack (если он доступен):

```bash
corepack enable pnpm
```

```bash
pnpm install
pnpm dev      # запуск в режиме разработки
pnpm dist     # сборка установщика для Windows (папка release/)
```

## Стек

Electron 33 · React 19 · TypeScript · electron-vite · TanStack Query · Zustand · pnpm workspaces

## Безопасность

Лаунчер работает с конфиденциальными данными аккаунтов. Как они защищены — см. [SECURITY.md](SECURITY.md).

## Лицензия

[MIT](LICENSE)
