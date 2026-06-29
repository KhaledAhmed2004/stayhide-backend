import 'dotenv/config';
import { spawn } from 'child_process';

/**
 * Dynamically runs ngrok based on .env PORT or command line argument.
 * Usage:
 *   npm run ngrok        # uses PORT from .env
 *   npm run ngrok 8080   # uses port 8080
 */

const getPort = (): string => {
  // 1. Check command line arguments (e.g., npm run ngrok 8080)
  const argPort = process.argv[2];
  if (argPort && !isNaN(Number(argPort))) {
    return argPort;
  }

  // 2. Check .env PORT
  if (process.env.PORT) {
    return process.env.PORT;
  }

  // 3. Default fallback
  return '5001';
};

const port = getPort();
const domain = process.env.NGROK_DOMAIN;

console.log(`\n🚀 Starting ngrok tunnel for http://localhost:${port}...`);
if (domain) {
  console.log(`🔗 Using static domain: ${domain}`);
}
console.log(`💡 Tip: You can change the port in .env or use "npm run ngrok <port>"\n`);

const args = ['http', port];
if (domain) {
  args.push(`--domain=${domain}`);
}

const ngrok = spawn('ngrok', args, {
  stdio: 'inherit',
  shell: true,
});

ngrok.on('error', (err) => {
  if ((err as any).code === 'ENOENT') {
    console.error('✗ Error: ngrok is not installed or not in your PATH.');
    console.log('  Install it with: npm install -g ngrok');
  } else {
    console.error('✗ Failed to start ngrok:', err.message);
  }
  process.exit(1);
});
