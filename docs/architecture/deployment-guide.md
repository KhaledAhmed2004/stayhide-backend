# 🚀 Deployment & DevOps Guide: Local to AWS (A-Z)

Ei document-e apnar project-er local development theke shuru kore AWS production-e neya porjonto shob step shohoj bhabe lekha ache.

---

## 💻 Part 1: Local Development (Docker-er maddhome)

Ekhon theke apnar PC-te MongoDB ba Redis install thakar dorkar nai. Shob kichu Docker-e cholbe.

### **Quick Start Commands**
| Command | Ki kaj kore? |
|---|---|
| `npm run docker:up` | Database, Redis ebong API ekshathe start korbe. |
| `npm run docker:down` | Shob bondho kore dibe. |
| `npm run docker:logs` | API-r bhetore ki error hocche sheta live dekhabe. |

### **Environment Setup**
Apnar `.env` file-e nicher line gulo thaka dorkar:
```bash
PORT=5002
DATABASE_URL=mongodb://mongodb:27017/okjt100  # Docker-er bhetorer DB use korle
REDIS_URL=redis://redis:6379
```

---

## 🏗️ Part 2: Understanding the "Box" (Docker)

Apnar project-e ২-ti main file ache Docker-er jonno:
1.  **[Dockerfile](./Dockerfile)**: Eta hocche "Recipe". Eta bole dey Docker-ke je apnar code kivabe build korte hobe (Node version ki, kon file copy hobe etc).
2.  **[docker-compose.yml](./docker-compose.yml)**: Eta hocche "Manager". Eta API-r shathe MongoDB ebong Redis-ke ekshathe connect kore.

---

## ☁️ Part 3: AWS Production Deployment (Step-by-Step)

AWS-e deploy korar shomoy amra sadharonoto **EC2 Instance** (Linux Server) use kori.

### **Step 1: Server Ready Kora**
AWS EC2-te ekta Ubuntu server nen ebong nicher jinish gulo install koren:
- Docker
- Docker Compose

### **Step 2: Project Clone & Config**
Server-e login kore:
```bash
git clone <your-repo-url>
cd okjt100
cp .env.example .env  # Tarpore .env edit kore production values boshan
```

### **Step 3: Run in Production**
```bash
npm run docker:up
```

---

## 🔐 Part 4: Important Checklist (Dhopas kore porar agee)

1.  **Secrets Folder**: Social login (Apple/Google) er jonno `secrets/` folder-e `.p8` ba `.json` file gulo thaka dorkar. Dockerfile-e amra eta auto-copy korar system kore diyechi.
2.  **Volumes**: User-er upload kora chobi jate muche na jay, sheijonno `docker-compose`-e `uploads` volume add kora hoyeche. Server-e `uploads` folder-er permission thik thakte hobe.
3.  **Security Groups (AWS)**: AWS firewall (Security Group)-e port `5002` (ba apni jeta use koren) open kore dite hobe, noile baire theke API access kora jabe na.
4.  **Reverse Proxy**: Production-e shorashori port 5002-te hit na kore **Nginx** use kora bhalo (SSL/HTTPS er jonno).

---

## 🛠️ Troubleshooting (Jodi kichu kaj na kore)

- **Container cholche na?** `docker ps` diye check koren container up ache kina.
- **Database connection error?** Check koren `DATABASE_URL`-e `mongodb://mongodb` (service name) use kora hoyeche kina.
- **File khuje pacche na?** `docker exec -it okjt100-api sh` diye container-er bhetore ঢুকে check kora jay file gulo thikmoto copy hoyeche kina.

---

> **Pro-Tip**: Github Actions use korle apni chaitile [deploy-aws.yml](file:///d:/Khaled/re-factor/okjt100/.github/workflows/deploy-aws.yml) diye auto-deploy-o set korte parben.
