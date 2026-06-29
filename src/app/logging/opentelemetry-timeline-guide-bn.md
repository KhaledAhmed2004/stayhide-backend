# OpenTelemetry Timeline Guide (BN)

এই ফোল্ডারে OpenTelemetry ইন্টিগ্রেশন add করা হয়েছে যাতে request-এর সম্পূর্ণ flow সহজে দেখা যায় — middleware → controller → service → cache → repository → database → crypto → response serialization → HTTP send।

## কী যোগ করা হয়েছে
- `opentelemetry.ts`: NodeSDK bootstrap + custom `TimelineConsoleExporter` — প্রতি request শেষ হলে সুন্দর timeline console-এ print করে।
- `otelExpress.ts`: Express middleware — `Middleware Start`, `Response Serialization`, `HTTP Response Send` span তৈরি করে।
- `autoLabelBootstrap.ts`: Controller/Service call-গুলো এখন OTel span দিয়ে wrap করা — duration দেখাবে।
- `patchBcrypt.ts`: `bcrypt.hash`/`bcrypt.compare` span emit করে।
- `helpers/jwtHelper.ts`: `JWT.sign`/`JWT.verify` span emit করে।

## কোথায় wire করা হয়েছে
- `src/app.ts` শুরুর দিকে:
  - `import './app/logging/opentelemetry'` → SDK init
  - `import './app/logging/patchBcrypt'` → bcrypt patch
  - `import { otelExpressMiddleware } from './app/logging/otelExpress'`
  - `app.use(otelExpressMiddleware)` → Client Hints header-এর পরে
- `autoLabelBootstrap.ts` controller/service wrapper আগেই ব্যবহার হচ্ছিল — এখন span যোগ হয়েছে।

## Dependency লাগবে
প্রজেক্টে OpenTelemetry package গুলি install করুন:
```
npm i -S @opentelemetry/api @opentelemetry/sdk-node @opentelemetry/auto-instrumentations-node @opentelemetry/sdk-trace-base @opentelemetry/resources @opentelemetry/semantic-conventions
```
ইনস্টল না থাকলে কোড graceful-ভাবে চালু থাকবে, শুধু span প্রিন্ট হবে না।

## Timeline কেমন দেখাবে
উদাহরণ (format আপনারটার মতো):
```
OpenTelemetry diya ⏱️  TIMELINE (Total: 559ms)
 ├─ [0ms] Middleware Start - 0ms
 ├─ [5ms] Controller: AuthController.loginUser - 10ms
 ├─ [15ms] Service: AuthService.loginUserFromDB - 360ms
 ├─ [18ms] Cache: Redis.get (MISS) - 2ms
 ├─ [22ms] Repository: UserRepository.findOne - 5ms
 ├─ [25ms] 🐌 Database: MongoDB.findOne - 337ms ⚠️
 ├─ [365ms] bcrypt.compare - 5ms
 ├─ [370ms] JWT.sign - 8ms
 ├─ [378ms] Cache: Redis.set - 2ms
 ├─ [385ms] Response Serialization - 15ms
 └─ [400ms] 🌐 HTTP Response Send - 159ms
```
- Total ms = পুরো request-এর duration
- প্রতিটি লাইনে `[startOffset] label - duration`
- `⚠️` থাকলে error বা slow op নির্দেশ করে

## Controller/Service auto-label কিভাবে কাজ করে
- Pattern follow করুন:
  - Controller: `export const FooController = { methodA, methodB }`
  - Service: `export const FooService = { methodA, methodB }`
- নতুন module add করলে `autoLabelBootstrap.ts`-এ এইভাবে wire করুন:
```ts
import { PaymentService } from '../modules/payment/payment.service';
import { PaymentController } from '../modules/payment/payment.controller';
// ...
wrapService('PaymentService', PaymentService);
wrapController('PaymentController', PaymentController);
```
- wrapper এখন OTel span দিয়ে call-কে ঘিরে রাখে, তাই duration timeline-এ দেখা যাবে।

## Response serialization এবং send
- `otelExpressMiddleware` → `res.json` override করে serialization time span তৈরি করে।
- `res.on('finish')` → socket flush হওয়া পর্যন্ত send duration span তৈরি করে।

## Database insight (Mongoose)
- `mongooseMetrics.ts` plugin query duration, aggregate summary, index usage, docs examined ইত্যাদি collect করে।
- OTel auto-instrumentation MongoDB driver span-ও capture করবে।
- Slow query হলে timeline-এ `🐌 Database:` হিসেবে দেখাবে এবং duration বেশি হলে warning পাবে।

## Cache insight
- প্রজেক্টে `NodeCache`-based `CacheHelper` আছে — hit/miss duration `requestContext`-এ record হয়।
- চাইলে Redis ব্যবহার করলে OTel instrumentation (`@opentelemetry/instrumentation-redis`) enable করতে পারবেন।

## JWT/Bcrypt
- `JWT.sign`/`JWT.verify` এবং `bcrypt.hash`/`bcrypt.compare` timeline-এ আলাদা span হিসেবে দেখাবে।

## Error trace
- কোনো span-এর ভিতরে exception হলে exporter `⚠️` দেখাবে এবং span status `ERROR` সেট হবে।
- Global error handler (`globalErrorHandler`) আগের মতোই কাজ করবে; OTel span exception record করলে timeline-এ সহজে spot করা যাবে।

## Service Name
- `OTEL_SERVICE_NAME` env দিলে service name সেট হবে (default: `my-service`)।

## কিভাবে নিজের custom step যোগ করবেন
- যেকোনো async কাজকে এই helper দিয়ে wrap করুন:
```ts
import { trace } from '@opentelemetry/api';
const tracer = trace.getTracer('app');
await tracer.startActiveSpan('External: PaymentGateway.capture', async span => {
  try {
    await callGateway();
  } catch (e) {
    span.recordException(e as any);
    throw e;
  } finally {
    span.end();
  }
});
```

## Note
- OpenTelemetry collector/Jaeger/Zipkin ব্যবহার করতে চাইলে exporter swap করে দিতে পারবেন; এখানে console timeline focus করা হয়েছে যাতে dev-রা দ্রুত বুঝতে পারে কোথায় সময় যাচ্ছে এবং কোথায় error হচ্ছে।

— Enjoy fast debugging 🚀
