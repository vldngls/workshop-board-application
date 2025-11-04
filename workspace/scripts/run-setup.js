#!/usr/bin/env node

/**
 * Cross-platform setup script runner
 * Detects OS and runs the appropriate setup script
 */

const { execSync } = require('child_process');
const path = require('path');
const os = require('os');

const args = process.argv.slice(2);
const workspaceDir = path.join(__dirname, '..');
const scriptsDir = path.join(workspaceDir, 'scripts');

// Detect OS
const platform = os.platform();
const isWindows = platform === 'win32';

// Determine which script to run
const scriptPath = isWindows
  ? path.join(scriptsDir, 'setup.ps1')
  : path.join(scriptsDir, 'setup.sh');

// Build command
let command;
if (isWindows) {
  // PowerShell command
  const modeIndex = args.findIndex(arg => arg === '--mode' || arg === '-Mode');
  let modeValue = null;
  
  if (modeIndex !== -1 && args[modeIndex + 1]) {
    modeValue = args[modeIndex + 1];
  } else {
    // Check for --mode=value format
    const modeArg = args.find(arg => arg.startsWith('--mode=') || arg.startsWith('-Mode='));
    if (modeArg) {
      modeValue = modeArg.split('=')[1];
    }
  }
  
  if (modeValue) {
    command = `powershell -ExecutionPolicy Bypass -File "${scriptPath}" -Mode ${modeValue}`;
  } else {
    command = `powershell -ExecutionPolicy Bypass -File "${scriptPath}"`;
  }
} else {
  // Unix/Linux/macOS - bash script
  const modeIndex = args.findIndex(arg => arg === '--mode');
  let modeValue = null;
  
  if (modeIndex !== -1 && args[modeIndex + 1]) {
    modeValue = args[modeIndex + 1];
  } else {
    // Check for --mode=value format
    const modeArg = args.find(arg => arg.startsWith('--mode='));
    if (modeArg) {
      modeValue = modeArg.split('=')[1];
    }
  }
  
  if (modeValue) {
    command = `bash "${scriptPath}" --mode ${modeValue}`;
  } else {
    command = `bash "${scriptPath}"`;
  }
}

// Run the command
try {
  console.log(`🚀 Running setup script...`);
  console.log(`📋 Platform: ${platform}`);
  console.log(`📝 Command: ${command}\n`);
  
  execSync(command, {
    stdio: 'inherit',
    cwd: path.join(__dirname, '..', '..'),
    env: process.env
  });
} catch (error) {
  console.error('❌ Setup script failed:', error.message);
  process.exit(1);
}

