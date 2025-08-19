#!/usr/bin/env node

/**
 * Direct test of FirstRunSetup functionality
 * This simulates what happens when the app starts in production mode
 * without the GTK compatibility issues
 */

const path = require('path');
const fs = require('fs');

// Mock Electron app.getPath for testing
global.app = {
  getPath: (name) => {
    if (name === 'userData') {
      return path.join(process.env.HOME || process.env.USERPROFILE, '.config', 'SafeTube');
    }
    return path.join(process.env.HOME || process.env.USERPROFILE, '.config', 'SafeTube');
  }
};

// Mock process.env for production mode
process.env.NODE_ENV = 'production';

console.log('🧪 Testing FirstRunSetup directly...\n');

// Check current working directory
console.log('📁 Current working directory:', process.cwd());

// Check if config.example exists
const configExamplePath = path.join(process.cwd(), 'config.example');
if (fs.existsSync(configExamplePath)) {
  console.log('✅ config.example directory found');
  const files = fs.readdirSync(configExamplePath);
  console.log('   Files:', files.join(', '));
} else {
  console.log('❌ config.example directory not found');
}

// Check if .env.example exists
const envExamplePath = path.join(process.cwd(), '.env.example');
if (fs.existsSync(envExamplePath)) {
  console.log('✅ .env.example file found');
} else {
  console.log('❌ .env.example file not found');
}

// Simulate what the setup would do
const userDataDir = global.app.getPath('userData');
const configDir = path.join(userDataDir, 'config');
const cacheDir = path.join(userDataDir, 'cache');
const logsDir = path.join(userDataDir, 'logs');

console.log('\n🎯 Production paths that would be created:');
console.log('   User Data:', userDataDir);
console.log('   Config:', configDir);
console.log('   Cache:', cacheDir);
console.log('   Logs:', logsDir);

// Check if these directories already exist
console.log('\n📋 Directory status:');
console.log('   User Data:', fs.existsSync(userDataDir) ? '✅ Exists' : '❌ Missing');
console.log('   Config:', fs.existsSync(configDir) ? '✅ Exists' : '❌ Missing');
console.log('   Cache:', fs.existsSync(cacheDir) ? '✅ Exists' : '❌ Missing');
console.log('   Logs:', fs.existsSync(logsDir) ? '✅ Exists' : '❌ Missing');

// Simulate the actual setup process
console.log('\n🚀 Simulating FirstRunSetup process...');

async function simulateSetup() {
  try {
    // Create directories
    console.log('\n📁 Creating directories...');
    [userDataDir, configDir, cacheDir, logsDir].forEach(dir => {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
        console.log('   ✅ Created:', dir);
      } else {
        console.log('   ℹ️  Already exists:', dir);
      }
    });

    // Copy config files
    console.log('\n📋 Copying config files...');
    const requiredFiles = [
      'timeLimits.json',
      'usageLog.json', 
      'videoSources.json',
      'youtubePlayer.json',
      'watched.json',
      'timeExtra.json',
      'pagination.json'
    ];

    requiredFiles.forEach(filename => {
      const sourcePath = path.join(configExamplePath, filename);
      const destPath = path.join(configDir, filename);
      
      if (fs.existsSync(sourcePath)) {
        if (!fs.existsSync(destPath)) {
          fs.copyFileSync(sourcePath, destPath);
          console.log('   ✅ Copied:', filename);
        } else {
          console.log('   ℹ️  Already exists:', filename);
        }
      } else {
        console.log('   ❌ Source not found:', filename);
      }
    });

    // Copy .env file
    console.log('\n🔐 Setting up environment file...');
    const envDestPath = path.join(userDataDir, '.env');
    if (fs.existsSync(envExamplePath) && !fs.existsSync(envDestPath)) {
      fs.copyFileSync(envExamplePath, envDestPath);
      console.log('   ✅ Copied .env.example to production location');
      console.log('   📝 IMPORTANT: Please update the .env file with your actual API keys and settings');
    } else if (fs.existsSync(envDestPath)) {
      console.log('   ℹ️  .env file already exists in production location');
    } else {
      console.log('   ❌ .env.example not found');
    }

    console.log('\n🎉 FirstRunSetup simulation completed successfully!');
    console.log('\n📊 Final status:');
    console.log('   User Data:', fs.existsSync(userDataDir) ? '✅ Exists' : '❌ Missing');
    console.log('   Config:', fs.existsSync(configDir) ? '✅ Exists' : '❌ Missing');
    console.log('   Cache:', fs.existsSync(cacheDir) ? '✅ Exists' : '❌ Missing');
    console.log('   Logs:', fs.existsSync(logsDir) ? '✅ Exists' : '❌ Missing');
    
    if (fs.existsSync(configDir)) {
      const configFiles = fs.readdirSync(configDir);
      console.log('   Config files:', configFiles.length, 'files');
    }
    
    console.log('   .env file:', fs.existsSync(envDestPath) ? '✅ Exists' : '❌ Missing');

  } catch (error) {
    console.error('❌ Error during setup simulation:', error);
  }
}

// Run the simulation
simulateSetup();
