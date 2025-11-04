#!/usr/bin/env node

/**
 * Cross-platform setup script runner
 * Detects OS and runs the appropriate setup script
 */

const { execSync } = require('child_process');
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

// Helper function to extract mode value
function getModeValue() {
  const modeIndex = args.findIndex(arg => arg === '--mode' || arg === '-Mode' || arg === '--mode=' || arg === '-Mode=');
  let modeValue = null;
  
  if (modeIndex !== -1) {
    // Check if it's in format --mode=value
    if (args[modeIndex].includes('=')) {
      modeValue = args[modeIndex].split('=')[1];
    } else if (args[modeIndex + 1] && !args[modeIndex + 1].startsWith('-')) {
      modeValue = args[modeIndex + 1];
    }
  }
  
  return modeValue;
}

// Build command based on platform
let command;
let shell;

if (isWindows) {
  // Windows: Use PowerShell
  const modeValue = getModeValue();
  shell = true; // Use shell on Windows
  
  if (modeValue) {
    command = `powershell.exe -ExecutionPolicy Bypass -NoProfile -File "${normalizedScriptPath}" -Mode "${modeValue}"`;
  } else {
    command = `powershell.exe -ExecutionPolicy Bypass -NoProfile -File "${normalizedScriptPath}"`;
  }
} else {
  // Unix/Linux/macOS: Use bash
  const modeValue = getModeValue();
  shell = '/bin/bash';
  
  // Make script executable
  try {
    fs.chmodSync(normalizedScriptPath, '755');
  } catch (err) {
    // Ignore chmod errors, might already be executable
  }
  
  if (modeValue) {
    command = `"${normalizedScriptPath}" --mode "${modeValue}"`;
  } else {
    command = `"${normalizedScriptPath}"`;
  }
}

// Display platform info
console.log(`🚀 Running setup script...`);
console.log(`📋 Platform: ${platform} (${isWindows ? 'Windows' : isMac ? 'macOS' : isLinux ? 'Linux' : 'Unix'})`);
console.log(`📁 Script: ${normalizedScriptPath}`);
if (args.length > 0) {
  console.log(`📝 Arguments: ${args.join(' ')}`);
}
console.log('');

// Run the command
try {
  if (isWindows) {
    // On Windows, use execSync with shell option
    execSync(command, {
      stdio: 'inherit',
      cwd: projectRoot,
      env: process.env,
      shell: true,
      windowsVerbatimArguments: false
    });
  } else {
    // On Unix/Linux/macOS, use bash explicitly
    execSync(command, {
      stdio: 'inherit',
      cwd: projectRoot,
      env: process.env,
      shell: shell
    });
  }
} catch (error) {
  console.error('\n❌ Setup script failed');
  if (error.status) {
    console.error(`   Exit code: ${error.status}`);
  }
  if (error.message) {
    console.error(`   Error: ${error.message}`);
  }
  process.exit(error.status || 1);
}


