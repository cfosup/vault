const { spawn } = require('child_process');
const path = require('path');

const isWindows = process.platform === 'win32';
const npmCmd = isWindows ? 'npm.cmd' : 'npm';

console.log('====================================================');
console.log('🚀 Starting ExpenseFlow Backend and Frontend Servers');
console.log('   - Backend API : http://localhost:4000');
console.log('   - GraphQL IDE : http://localhost:4000/graphql');
console.log('   - Frontend Web: http://localhost:5173');
console.log('====================================================\n');

const server = spawn(npmCmd, ['run', 'dev'], {
  cwd: path.resolve(__dirname, 'server'),
  stdio: 'inherit',
  shell: true,
});

const client = spawn(npmCmd, ['run', 'dev'], {
  cwd: path.resolve(__dirname, 'client'),
  stdio: 'inherit',
  shell: true,
});

server.on('error', (err) => {
  console.error('[Backend Process Error]:', err);
});

client.on('error', (err) => {
  console.error('[Frontend Process Error]:', err);
});

const shutdown = () => {
  console.log('\n🛑 Shutting down ExpenseFlow dev servers...');
  server.kill();
  client.kill();
  process.exit(0);
};

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
