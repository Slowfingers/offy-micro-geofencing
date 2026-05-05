<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# OFFY - Micro-Geofencing Smart Push Notifications

Система смарт-уведомлений внутри торговых центров с Micro-Geofencing технологией.

## Основные функции (согласно технической документации)

- **Micro-Geofencing**: Определение входа пользователя в полигон торгового центра
- **Smart Push Trigger**: Умные уведомления на основе:
  - Скорость < 5 км/ч (V < V_walk)
  - Время остановки > 2 минуты (T_dwell > 2min)
  - Находится внутри полигона (InsidePolygon)
- **Центрированный оффер**: Алгоритм выбора ТОП-1 скидки конкретного молла
- **Smart Moderation**: Авто-фильтрация спама (Regex/AI), прозрачность (негативные отзывы сохраняются), B2B контроль для Premium
- **Flying Clouds**: Плавающие комментарии в реальном времени с оптимизированной анимацией (requestAnimationFrame)
- **B2B Модель**: Standard (Parsing) vs Premium (Partnership) с Flash скидками, Scratch to Win, модерацией отзывов

## Run Locally

**Prerequisites:** Node.js

1. Install dependencies:
   ```bash
   npm install
   ```

2. Configure Firebase:
   - Убедитесь, что `firebase-applet-config.json` настроен корректно

3. Seed malls (опционально):
   ```bash
   npm run seed:malls
   ```

4. Run the app:
   ```bash
   npm run dev
   ```

## API Documentation

### Mall Management

#### GET /api/malls
Получить список всех торговых центров

#### GET /api/malls/:id
Получить информацию о конкретном ТЦ

#### POST /api/malls
Создать новый ТЦ
```json
{
  "name": "Mall Name",
  "address": "Address",
  "polygon": {
    "coordinates": [
      {"lat": 41.3115, "lng": 69.2795},
      {"lat": 41.3115, "lng": 69.2815},
      {"lat": 41.3095, "lng": 69.2815},
      {"lat": 41.3095, "lng": 69.2795}
    ]
  },
  "center": {"lat": 41.3105, "lng": 69.2805}
}
```

#### PUT /api/malls/:id
Обновить информацию о ТЦ

### Discounts

#### GET /api/malls/:id/top-discount
Получить ТОП-1 скидку для конкретного ТЦ

#### POST /api/malls/:mallId/top-offer/:discountId
Установить скидку как топ-оффер для ТЦ

### Geolocation

#### POST /api/check-location
Проверить нахождение точки внутри полигона ТЦ
```json
{
  "lat": 41.3105,
  "lng": 69.2805,
  "mallId": "optional-mall-id"
}
```

#### POST /api/evaluate-trigger
Оценить триггер Smart Push согласно технической документации
```json
{
  "userId": "user123",
  "lat": 41.3105,
  "lng": 69.2805,
  "velocity": 3.5,
  "dwellTime": 150,
  "mallId": "mall-id"
}
```

#### POST /api/user-location
Сохранить геолокацию пользователя для отслеживания
```json
{
  "userId": "user123",
  "lat": 41.3105,
  "lng": 69.2805,
  "velocity": 3.5,
  "accuracy": 10
}
```

### Existing Endpoints

#### GET /api/discounts
Получить список скидок

#### POST /api/save-discounts
Сохранить скидки в базу данных

### Review System with Smart Moderation

#### POST /api/reviews
Создать отзыв с авто-фильтрацией
```json
{
  "userId": "user123",
  "discountId": "discount-id",
  "mallId": "mall-id",
  "rating": 5,
  "text": "Отличная скидка!"
}
```

#### GET /api/reviews/:discountId
Получить отзывы для скидки (только нефильтрованные)

### B2B Brand Management

#### POST /api/brands
Создать бренд
```json
{
  "name": "Brand Name",
  "plan": "standard" | "premium",
  "mallIds": ["mall-id-1", "mall-id-2"],
  "scratchCodes": ["CODE1", "CODE2"]
}
```

#### GET /api/brands/:id
Получить информацию о бренде с правами модерации

#### GET /api/brands/plan/:plan
Получить бренды по плану (standard/premium)

### Flash Discounts (Premium only)

#### POST /api/flash-discounts
Создать Flash скидку
```json
{
  "brandId": "brand-id",
  "mallId": "mall-id",
  "title": "Flash Sale",
  "description": "Limited time offer",
  "discountValue": "50%",
  "validUntil": "2026-12-31T23:59:59Z",
  "isActive": true
}
```

#### GET /api/flash-discounts/:mallId
Получить активные Flash скидки для ТЦ

#### DELETE /api/flash-discounts/:id
Деактивировать Flash скидку

### Scratch to Win (Premium only)

#### POST /api/scratch/validate
Проверить Scratch код
```json
{
  "brandId": "brand-id",
  "code": "CODE123"
}
```

#### POST /api/scratch/use
Использовать Scratch код (одноразовый)

### Premium Priority Push

#### POST /api/evaluate-trigger-premium
Оценить триггер с приоритетом Premium в радиусе ТЦ
```json
{
  "userId": "user123",
  "lat": 41.3105,
  "lng": 69.2805,
  "velocity": 3.5,
  "dwellTime": 150,
  "mallId": "mall-id",
  "brandId": "brand-id"
}
```

Premium бренды получают приоритет Flash скидок при нахождении внутри полигона ТЦ.

## Структура проекта

- `src/types/mall.ts` - TypeScript типы для моллов, геолокации, скидок, отзывов, брендов, Flash скидок
- `src/services/geolocation.ts` - Сервис геолокации с алгоритмом проверки точки внутри полигона и логикой Smart Push Trigger
- `src/services/mallService.ts` - Сервис для работы с моллами и скидками
- `src/services/moderationService.ts` - Сервис Smart Moderation с авто-фильтрацией и B2B контролем
- `src/services/b2bService.ts` - Сервис для B2B модели (бренды, Flash скидки, Scratch to Win)
- `src/components/FloatingComments.tsx` - React компонент для плавающих комментариев с оптимизированной анимацией
- `server.ts` - Express сервер с API эндпоинтами
- `scraper.ts` - Скрапер для Telegram каналов со скидками
- `seed_malls.ts` - Скрипт для добавления тестовых моллов

## Smart Push Trigger Logic

Согласно технической документации:

```
Trigger = True, если (Скорость < 5 км/ч) И (Время_остановки > 2 минуты) И (InsidePolygon)
Trigger = False, в противном случае
```

Использует гироскоп и GPS-фильтрацию для определения этажности и защиты от "Drive-by" срабатываний.

## B2B Модель: Standard vs Premium

| Функционал | Standard (Parsing) | Premium (Partnership) |
|-----------|-------------------|---------------------|
| Размещение скидок | Авто-парсинг | Ручное управление + Flash |
| Push-уведомления | Общий алгоритм | Приоритет в радиусе ТЦ |
| Scratch to Win | ❌ Нет | ✅ Да (свои коды) |
| Работа с отзывами | Только чтение | Редакция и модерация |

## Smart Moderation

- **Auto-Filter**: Автоматическое удаление мусора, спама и бессмысленных наборов символов (Regex/AI)
- **Transparency**: Негативные отзывы не удаляются системой для сохранения доверия и честности
- **B2B Control**: Право модерации и ответов на отзывы передается владельцам брендов в Premium пакете

## Flying Clouds (Social Engine)

Плавающие комментарии от других пользователей на экране оффера в реальном времени, создающие ощущение живого сообщества. Компонент использует:
- `requestAnimationFrame` для оптимизированной анимации
- CSS transforms для плавного движения
- `will-change` hint для браузерной оптимизации
