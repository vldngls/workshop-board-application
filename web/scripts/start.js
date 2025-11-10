#!/usr/bin/env node

const os = require('os');
const path = require('path');
const { spawn } = require('child_process');

const projectRoot = path.resolve(__dirname, '..');

const getLocalAddress = () => {
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    const iface = interfaces[name];
    if (!iface) continue;
    for (const details of iface) {
      if (!details) continue;
      if (details.family === 'IPv4' && !details.internal) {
        return details.address;
      }
    }
  }
  return '127.0.0.1';
};

const host = process.env.HOST || '0.0.0.0';
const port = process.env.PORT || '3000';
const accessHost = host === '0.0.0.0' ? getLocalAddress() : host;

console.log(' ');
console.log('🌐 Web Server Access');
console.log(`   Local:   http://localhost:${port}`);
console.log(`   Network: http://${accessHost}:${port}`);
console.log(' ');

const nextCli = require.resolve('next/dist/bin/next');
const args = ['start', '--hostname', host, '--port', String(port)];

const child = spawn(process.execPath, [nextCli, ...args], {
  cwd: projectRoot,
  stdio: 'inherit',
});

child.on('close', (code) => {
  process.exitCode = code ?? 0;
});

