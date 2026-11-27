# Google OAuth — активация M-academy

> Проверено 27.11.2026. Код входа существует; внешняя конфигурация провайдера и фактический вход через Google пока не подтверждены.

## Точно установленные адреса

| Назначение | Адрес |
|---|---|
| M-academy, HTTPS | `https://m-academy-pilot.vercel.app/` |
| Supabase test project | `https://ohwjlvcahzjktdqgridm.supabase.co` |
| Google Cloud → Authorized redirect URI | `https://ohwjlvcahzjktdqgridm.supabase.co/auth/v1/callback` |
| Supabase → Authentication → URL Configuration → Site URL | `https://m-academy-pilot.vercel.app/` |
| Supabase → Authentication → URL Configuration → Redirect URLs | `https://m-academy-pilot.vercel.app/**` (разрешить точный root URL; wildcard — только если нужны другие маршруты) |

Не использовать callback Firebase ECO CLUB вместо callback Supabase.

## Одноразовая конфигурация в консолях

1. Откройте [Google Cloud Auth](https://console.cloud.google.com/auth/overview). Создайте либо выберите разрешённый проект (предпочтительно выделенный для M-academy, **не менять работающие OAuth-настройки ECO CLUB**). Настройте consent screen и тестовую аудиторию.
2. В Google Cloud создайте OAuth client типа **Web application**. В разрешённые redirect URI добавьте **точно** `https://ohwjlvcahzjktdqgridm.supabase.co/auth/v1/callback`. Сохраните Client ID и Client Secret только в соответствующем защищённом сервисе.
3. Откройте [Supabase Google Provider](https://supabase.com/dashboard/project/ohwjlvcahzjktdqgridm/auth/providers) → Google → Enabled; внесите ID/Secret **напрямую в Supabase Dashboard** и сохраните. Не коммитить и не отправлять секрет в чат.
4. Откройте [Supabase URL Configuration](https://supabase.com/dashboard/project/ohwjlvcahzjktdqgridm/auth/url-configuration). Site URL и разрешённый Redirect URL укажите как выше.
5. Включите для OAuth только тестовые учётные записи взрослых. Убедитесь, что Vercel Deployment Protection допускает тестирование нужными пользователями, не отключая её для всего проекта.
6. Откройте M-academy, войдите через Google и затем перейдите к `/auth-check`. Для активной роли `memberships` будет показана школа; для нового аккаунта **без** роли — отказ в школьных правах.
7. Проверьте две отрицательные ситуации: новый Google-аккаунт не получает класс и администрирование; выход и повторный вход не открывают доступ к чужим данным.
8. Если пользователь прежде входил по email OTP, отдельно проверьте, не появился ли другой Supabase Auth UID; **не переносите назначения на основании совпадения email без проверки личности**.

## Что уже выполнено

- Google Sign-In через `client.auth.signInWithOAuth({ provider: 'google' })` и корректный URL возврата в корень M-academy в `backend/pilot-app/app/page.tsx`.
- Отдельный экран `/auth-check`, проверяющий текущего пользователя и активные роли/классы.
- Supabase `m-academy-test` подключён к Vercel публичным publishable ключом. RLS включён на учебных таблицах.
- Серверное развёртывание Vercel получило состояние READY.

## Что ещё не подтверждено

- Включён ли Google Provider в Supabase; инструменты базы данных не управляют OAuth-конфигурацией платформы.
- Существует ли OAuth Client в Google Cloud с актуальными Client ID / Client Secret.
- Site URL и redirect allowlist в Supabase.
- Реальный браузерный вход, identity linking с OTP-пользователями и проверка живых сессий.

**Статус: приложение готово к активации Google OAuth, но не заявлено как завершённое единое SSO.**

Документация: [Supabase Google](https://supabase.com/docs/guides/auth/social-sign-in/auth-google).
