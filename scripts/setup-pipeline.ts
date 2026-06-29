import fs from 'fs';
import path from 'path';
import inquirer from 'inquirer';
import chalk from 'chalk';

const GITHUB_WORKFLOW_DIR = path.join(process.cwd(), '.github', 'workflows');
const DEPLOY_FILE_PATH = path.join(GITHUB_WORKFLOW_DIR, 'deploy-aws.yml');

async function setup() {
  console.log(chalk.bold.cyan('\n🚀 CI/CD Pipeline Setup (GitHub Actions + AWS)\n'));

  const answers = await inquirer.prompt([
    {
      type: 'input',
      name: 'awsRegion',
      message: 'AWS Region:',
      default: 'us-east-1',
    },
    {
      type: 'input',
      name: 'ecrRepository',
      message: 'ECR Repository Name:',
      default: 'educoin-backend',
    },
    {
      type: 'input',
      name: 'ecsCluster',
      message: 'ECS Cluster Name:',
      default: 'educoin-cluster',
    },
    {
      type: 'input',
      name: 'ecsService',
      message: 'ECS Service Name:',
      default: 'educoin-service',
    },
    {
      type: 'input',
      name: 'mainBranch',
      message: 'Main Branch Name:',
      default: 'main',
    },
  ]);

  const workflowYaml = `name: Deploy to AWS

on:
  push:
    branches: [ ${answers.mainBranch} ]
  pull_request:
    branches: [ ${answers.mainBranch} ]

env:
  AWS_REGION: ${answers.awsRegion}
  ECR_REPOSITORY: ${answers.ecrRepository}
  ECS_SERVICE: ${answers.ecsService}
  ECS_CLUSTER: ${answers.ecsCluster}
  ECS_TASK_DEFINITION: task-definition.json # Ensure this file exists or is generated
  CONTAINER_NAME: app

jobs:
  ci:
    name: Continuous Integration
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      
      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
          
      - name: Install dependencies
        run: npm ci
        
      - name: Lint check
        run: npm run lint:check
        
      - name: Prettier check
        run: npm run prettier:check
        
      - name: Run tests
        run: npm run test:run

  deploy:
    name: Build & Deploy
    needs: ci
    if: github.event_name == 'push' && github.ref == 'refs/heads/${answers.mainBranch}'
    runs-on: ubuntu-latest
    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Configure AWS credentials
        uses: aws-actions/configure-aws-credentials@v4
        with:
          aws-access-key-id: \${{ secrets.AWS_ACCESS_KEY_ID }}
          aws-secret-access-key: \${{ secrets.AWS_SECRET_ACCESS_KEY }}
          aws-region: \${{ env.AWS_REGION }}

      - name: Login to Amazon ECR
        id: login-ecr
        uses: aws-actions/amazon-ecr-login@v2

      - name: Build, tag, and push image to Amazon ECR
        id: build-image
        env:
          ECR_REGISTRY: \${{ steps.login-ecr.outputs.registry }}
          IMAGE_TAG: \${{ github.sha }}
        run: |
          docker build -t $ECR_REGISTRY/$ECR_REPOSITORY:$IMAGE_TAG .
          docker push $ECR_REGISTRY/$ECR_REPOSITORY:$IMAGE_TAG
          echo "image=$ECR_REGISTRY/$ECR_REPOSITORY:$IMAGE_TAG" >> $GITHUB_OUTPUT

      - name: Fill in the new image ID in the Amazon ECS task definition
        id: task-def
        uses: aws-actions/amazon-ecs-render-task-definition@v1
        with:
          task-definition: \${{ env.ECS_TASK_DEFINITION }}
          container-name: \${{ env.CONTAINER_NAME }}
          image: \${{ steps.build-image.outputs.image }}

      - name: Deploy Amazon ECS task definition
        uses: aws-actions/amazon-ecs-deploy-task-definition@v1
        with:
          task-definition: \${{ steps.task-def.outputs.task-definition }}
          service: \${{ env.ECS_SERVICE }}
          cluster: \${{ env.ECS_CLUSTER }}
          wait-for-service-stability: true
`;

  // Create .github/workflows directory if it doesn't exist
  if (!fs.existsSync(GITHUB_WORKFLOW_DIR)) {
    fs.mkdirSync(GITHUB_WORKFLOW_DIR, { recursive: true });
  }

  // Write the workflow file
  fs.writeFileSync(DEPLOY_FILE_PATH, workflowYaml);

  console.log(chalk.green(`\n✅ Successfully created: ${path.relative(process.cwd(), DEPLOY_FILE_PATH)}`));
  console.log(chalk.yellow('\n⚠️  Next Steps:'));
  console.log(chalk.white('1. Add these secrets to your GitHub Repository Settings:'));
  console.log(chalk.cyan('   - AWS_ACCESS_KEY_ID'));
  console.log(chalk.cyan('   - AWS_SECRET_ACCESS_KEY'));
  console.log(chalk.white('2. Ensure `task-definition.json` exists in your root directory.'));
  console.log(chalk.white('3. Commit and push the new files.'));
}

setup().catch(err => {
  console.error(chalk.red('\n❌ Setup failed:'), err);
  process.exit(1);
});
