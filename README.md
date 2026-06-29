# educoin-backend (tbsosick)

Enterprise-grade TypeScript backend.

---

## 🚀 CI/CD Pipeline & Automation Deep Dive

This project now includes a fully automated CI/CD (Continuous Integration and Continuous Deployment) pipeline. Below is a detailed breakdown of **what** was done, **why** it was done, and the **thinking** behind every decision.

### 1. The Core Philosophy (কেন এবং কি চিন্তা করে করা হয়েছে)

প্রোজেক্টের স্কেলেবিলিটি এবং রিলায়েবিলিটি নিশ্চিত করার জন্য ম্যানুয়াল ডেপ্লয়মেন্টের সময় অনেক ভুল হওয়ার সম্ভাবনা থাকে। সেই ঝুঁকি কমানোর জন্য এই অটোমেশন সিস্টেম তৈরি করা হয়েছে।

- **Consistency**: "আমার পিসিতে চলে কিন্তু সার্ভারে চলে না" — এই সমস্যা সমাধানের জন্য **Docker** ব্যবহার করা হয়েছে। ডকার কন্টেইনার সব এনভায়রনমেন্টে একইভাবে রান করে।
- **Efficiency**: প্রত্যেকবার ম্যানুয়ালি বিল্ড করে সার্ভারে পুশ করা অনেক সময়সাপেক্ষ। এখন শুধুমাত্র কোড `push` করলেই সব কাজ অটোমেটিক হবে।
- **Quality Assurance**: কোড সার্ভারে যাওয়ার আগে অটোমেটিক লিন্টিং এবং টেস্টিং হয়, যাতে ভুল কোড প্রোডাকশনে না যায়।

---

### 2. What was done? (কি কি করা হয়েছে)

আমরা চারটি মূল কম্পোনেন্ট ইমপ্লিমেন্ট করেছি:

1.  **Setup Script (`scripts/setup-pipeline.ts`)**: পাইপলাইন কনফিগার করার জন্য একটি ইন্টারেক্টিভ টুল।  
2.  **Dockerization (`Dockerfile`, `.dockerignore`)**: প্রোজেক্টটিকে কন্টেইনারাইজ করার জন্য কনফিগারেশন।
3.  **GitHub Actions Workflow (`.github/workflows/deploy-aws.yml`)**: অটোমেশন ইঞ্জিন।
4.  **AWS Integration (`task-definition.json`)**: AWS ECS-এ ডেপ্লয় করার জন্য প্রয়োজনীয় ইনফ্রাস্ট্রাকচার ফাইল।

### 📂 File Locations

| Component | File Path |
|---|---|
| **Setup Script** | [`scripts/setup-pipeline.ts`](file:///c:/Users/khale/projects/re-factor/tbsosick/scripts/setup-pipeline.ts) |
| **Dockerfile** | [`Dockerfile`](file:///c:/Users/khale/projects/re-factor/tbsosick/Dockerfile) |
| **Docker Ignore** | [`.dockerignore`](file:///c:/Users/khale/projects/re-factor/tbsosick/.dockerignore) |
| **GHA Workflow** | [`.github/workflows/deploy-aws.yml`](file:///c:/Users/khale/projects/re-factor/tbsosick/.github/workflows/deploy-aws.yml) |
| **Task Definition** | [`task-definition.json`](file:///c:/Users/khale/projects/re-factor/tbsosick/task-definition.json) |

---

### 3. Detailed Breakdown (কিভাবে এবং কেন করা হয়েছে)

#### 🛠 Setup Script
- **How**: `inquirer` ব্যবহার করে একটি CLI (Command Line Interface) তৈরি করা হয়েছে।
- **Thinking**: আমরা হার্ডকোডেড ভ্যালু ব্যবহার না করে ডাইনামিক ভ্যালু নেওয়ার সুযোগ রেখেছি যাতে টিমের অন্য কেউ সহজেই পাইপলাইনটি নতুন কোনো AWS একাউন্টে সেটআপ করতে পারে।

#### 🐳 Docker Configuration (`Dockerfile`)
- **Thinking (Multi-stage Build)**: ডকার ডাইলে আমরা **Multi-stage build** ব্যবহার করেছি।
    - **Stage 1 (Builder)**: এখানে সব ডিপেন্ডেন্সি ইনস্টল করে TypeScript কোডকে JavaScript-এ ট্রান্সপাইল (Build) করা হয়।
    - **Stage 2 (Production)**: এখানে শুধুমাত্র ফাইনাল বিল্ড কোড এবং প্রোডাকশন ডিপেন্ডেন্সিগুলো রাখা হয়।
- **Benefit**: এর ফলে ফাইনাল ইমেজের সাইজ অনেক ছোট হয় (৫০০-৬০০ MB থেকে কমে ১০০-১২০ MB হতে পারে), যা ডেপ্লয়মেন্টকে আরও ফাস্ট করে।

#### ⛓️ GitHub Actions Pipeline
পাইপলাইনটি তিনটি লজিক্যাল স্টেপে কাজ করে:
1.  **CI (Continuous Integration)**: 
    - `npm ci` ব্যবহার করা হয় (এটি `npm install` থেকে ফাস্ট এবং রিলায়েবল)।
    - `lint:check`, `prettier:check`, এবং `test:run` কমান্ডগুলো রান করা হয়। কোনো একটি ফেল করলে পাইপলাইন ওখানেই স্টপ হয়ে যাবে।
2.  **Build & Push**: 
    - কোড একদম ঠিক থাকলে ডকার ইমেজ বিল্ড করা হয়।
    - ইমেজটি **AWS ECR (Elastic Container Registry)**-এ পুশ করা হয়।
3.  **Deploy**: 
    - নতুন ইমেজটি দিয়ে **AWS ECS (Elastic Container Service)**-এর টাস্ক আপডেট করা হয়।

#### ☁️ AWS ECS Task Definition
- এটি মূলত একটি ম্যানিফেস্ট ফাইল যা AWS-কে বলে দেয় কন্টেইনারটির জন্য কতটুকু CPU/Memory লাগবে এবং কোন পোর্টে অ্যাপটি চলবে।

---

### 4. Development Commands

```bash
npm run dev              # Start dev server
npm run build           # Compile TypeScript
npm run lint:fix        # Auto-fix linting
npm run prettier:fix    # Auto-format
npm test                # Vitest watch mode
npm run test:run        # Run tests once

# CI/CD Setup
npx ts-node --transpile-only scripts/setup-pipeline.ts
```

---

### 5. Setup Instructions (কিভাবে ব্যবহার করবেন)

1.  **Pipeline Configure**: 
    `scripts/setup-pipeline.ts` রান করে আপনার AWS ডিটেইলস দিন। এটি `.github/workflows/deploy-aws.yml` ফাইলটি আপডেট করে দিবে।
2.  **GitHub Secrets**: 
    আপনার রিপোজিটরির Settings-এ গিয়ে `AWS_ACCESS_KEY_ID` এবং `AWS_SECRET_ACCESS_KEY` যোগ করুন।
3.  **Task Definition**: 
    রুট ডিরেক্টরির `task-definition.json` ফাইলটি আপনার AWS ECS এর সাথে ম্যাচ করে চেক করে নিন।

---

### 6. Security & Best Practices
- **Never Commit .env**: সেনসিটিভ তথ্য সরাসরি পাইপলাইনে না দিয়ে GitHub Secrets ব্যবহার করা হয়েছে।
- **Docker Ignore**: অপ্রয়োজনীয় ফাইল (যেমন `.git`, `node_modules`, `docs`) ডকার ইমেজে বাদ দেওয়া হয়েছে `.dockerignore` এর মাধ্যমে, যাতে ইমেজ সিকিউর এবং লাইটওয়েট থাকে।
