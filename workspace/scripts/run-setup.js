#!/usr/bin/env node

/**
 * Cross-platform setup script runner
 * Detects OS and runs the appropriate setup script
 */

const { spawnSync } = require('child_process');
const path = require('path');
const os = require('os');
const fs = require('fs');

const args = process.argv.slice(2);

// Detect OS
const platform = os.platform();
const isWindows = platform === 'win32';
const isMac = platform === 'darwin';
const isLinux = platform === 'linux';

// Get project root (2 levels up from this script: workspace/scripts/ -> workspace/ -> root)
const projectRoot = path.resolve(__dirname, '..', '..');
const scriptsDir = path.join(projectRoot, 'workspace', 'scripts');

// Determine which script to run
const scriptPath = isWindows
  ? path.join(scriptsDir, 'setup.ps1')
  : path.join(scriptsDir, 'setup.sh');

// Normalize path for Windows (convert backslashes if needed)
const normalizedScriptPath = path.normalize(scriptPath);

// Verify script exists
if (!fs.existsSync(normalizedScriptPath)) {
  console.error(`❌ Setup script not found: ${normalizedScriptPath}`);
  console.error(`   Expected location: ${normalizedScriptPath}`);
  process.exit(1);
}

// Display platform info
console.log(`🚀 Running setup script...`);
console.log(`📋 Platform: ${platform} (${isWindows ? 'Windows' : isMac ? 'macOS' : isLinux ? 'Linux' : 'Unix'})`);
console.log(`📁 Script: ${normalizedScriptPath}`);
if (args.length > 0) {
  console.log(`📝 Arguments: ${args.join(' ')}`);
}
console.log('');

const windowsArgs = [];
if (isWindows) {
  for (let i = 0; i < args.length; i += 1) {
    const current = args[i];
    const next = args[i + 1];

    const pushFlagWithValue = (flag, value, warningLabel) => {
      if (value && !value.startsWith('-')) {
        windowsArgs.push(flag, value);
        return true;
      }
      console.warn(`⚠️  Ignoring ${warningLabel} flag without value`);
      return false;
    };

    if (current === '--mode') {
      if (pushFlagWithValue('-Mode', next, '--mode')) i += 1;
    } else if (current.startsWith('--mode=')) {
      windowsArgs.push('-Mode', current.split('=')[1]);
    } else if (current === '--env' || current === '--environment') {
      if (pushFlagWithValue('-Environment', next, '--env')) i += 1;
    } else if (current.startsWith('--env=') || current.startsWith('--environment=')) {
      windowsArgs.push('-Environment', current.split('=')[1]);
    } else if (current === '--seed') {
      if (pushFlagWithValue('-Seed', next, '--seed')) i += 1;
    } else if (current.startsWith('--seed=')) {
      windowsArgs.push('-Seed', current.split('=')[1]);
    } else if (current === '--api-key') {
      if (pushFlagWithValue('-ApiKey', next, '--api-key')) i += 1;
    } else if (current.startsWith('--api-key=')) {
      windowsArgs.push('-ApiKey', current.split('=')[1]);
    } else if (current === '--auto') {
      windowsArgs.push('-Auto');
    } else if (current === '--skip-api-key') {
      windowsArgs.push('-SkipApiKey');
    } else {
      windowsArgs.push(current);
    }
  }
}

let result;

if (isWindows) {
  // Windows: Use PowerShell
  const command = 'powershell.exe';
  const commandArgs = ['-ExecutionPolicy', 'Bypass', '-NoProfile', '-File', normalizedScriptPath, ...windowsArgs];

  result = spawnSync(command, commandArgs, {
    stdio: 'inherit',
    cwd: projectRoot,
    env: process.env,
    windowsVerbatimArguments: false
  });
} else {
  // Unix/Linux/macOS: ensure script is executable and run directly
  try {
    fs.chmodSync(normalizedScriptPath, '755');
  } catch (err) {
    // Ignore chmod errors, might already be executable
  }

  result = spawnSync(normalizedScriptPath, args, {
    stdio: 'inherit',
    cwd: projectRoot,
    env: process.env,
    shell: false
  });
}

if (result.error) {
  console.error('\n❌ Setup script failed to start');
  console.error(`   Error: ${result.error.message}`);
  process.exit(result.status || 1);
}

if (result.status !== 0) {
  console.error('\n❌ Setup script failed');
  console.error(`   Exit code: ${result.status}`);
  process.exit(result.status || 1);
}


