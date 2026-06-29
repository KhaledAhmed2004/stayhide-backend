# 🤖 GitHub Actions CI/CD Guide (AWS Deployment)

Ei guide-e amra dekhbo kivabe [deploy-aws.yml](../../.github/workflows/deploy-aws.yml) file-ta use kore apnar project automation setup korben.

> **Note:** Apnar borthoman workflow-ti **AWS ECS (Elastic Container Service)** target kore banano. Eta VPS-er cheyeo aro advanced ebong scalable system.

---

## 🛠️ Phase 1: AWS Setup (One-time)

GitHub Actions run korar agee AWS Console-e nicher jinish gulo setup thakte hobe:

1.  **ECR (Elastic Container Registry):**
    - AWS-e giye ekta naya Private Repository banan (Name match koren: `educoin-backend`).
    - Ekhanei apnar Docker images gulo store hobe.
2.  **ECS Cluster:**
    - Ekta ECS Cluster banan (Name: `educoin-cluster`).
3.  **Task Definition:**
    - Ekta `task-definition.json` file banan jekhane apnar container-er config thakbe (Port 5002, environment variables, etc).
4.  **ECS Service:**
    - Cluster-er bhetore ekta Service banan jeta Task Definition-ke run korabe.

---

## 🔐 Phase 2: GitHub Secrets Setup

GitHub Repository settings-e giye **Actions Secrets**-e nicher value gulo add koren:

| Secret Name | Description |
|---|---|
| `AWS_ACCESS_KEY_ID` | Apnar AWS IAM User-er Access Key. |
| `AWS_SECRET_ACCESS_KEY` | Apnar AWS IAM User-er Secret Key. |

---

## 🚀 Phase 3: How the Workflow Works

Amader kache ২-dhoroner deployment option ache:

### **Option A: EC2 + Docker (Recommended for Simplicity)**
File: [.github/workflows/deploy-ec2-ssh.yml](../../.github/workflows/deploy-ec2-ssh.yml)
Eta shorashori apnar EC2 server-e SSH diye ঢুকে `git pull` ebong `docker-compose` run kore.

**Setup Secrets:**
- `EC2_HOST`: Server IP
- `EC2_USER`: Username (e.g., ubuntu)
- `EC2_SSH_KEY`: Full private key (.pem file content)

### **Option B: AWS ECS (Enterprise Scaling)**
File: [.github/workflows/deploy-aws.yml](../../.github/workflows/deploy-aws.yml)
Eta Docker image build kore AWS ECR-e push kore ebong ECS Cluster-e deploy kore.

---

## 💡 Pro-Tip: VPS Deployment Details (Option A)

Jodi apni Option A use koren, tobe workflow-ta nicher kaj gulo korbe:
1. Server-e login korbe.
2. `git pull` diye naya code nibe.
3. `npm run docker:up` diye Docker image rebuild korbe ebong containers restart dibe.
4. Old unused images muche dibe jate server space full na hoy.


---

### **Action Items for You:**
1. [deploy-aws.yml](../../.github/workflows/deploy-aws.yml) file-ta ekhon commented out ache. Setup shesh hole ekhankar `#` gulo muche active korte hobe.
2. Apnar project root-e ekta `task-definition.json` file add korte hobe jodi apni ECS-e deploy korte chan.

Apni jodi VPS-e automation korte chan, bolben, ami VPS-er jonno ekta simpler workflow file baniye dibo.
