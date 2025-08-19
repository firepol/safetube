#!/usr/bin/env node

/**
 * Test script to demonstrate FirstRunSetup functionality
 * This simulates what happens when the app starts in production mode
 */

const path = require('path');
const fs = require('fs');

// Simulate production environment
process.env.NODE_ENV = 'production';

// Mock Electron app.getPath
global.app = {
  getPath: (name) => {
    if (name === 'userData') {
      return path.join(process.env.HOME || process.env.USERPROFILE, '.config', 'SafeTube');
    }
    return path.join(process.env.HOME || process.env.USERPROFILE, '.config', 'SafeTube');
  }
};

// Import the FirstRunSetup (we'll need to build it first)
async function testFirstRunSetup() {
  try {
    console.log('🧪 Testing FirstRunSetup...\n');
    
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
    
    // Check if config exists
    const configPath = path.join(process.cwd(), 'config');
    if (fs.existsSync(configPath)) {
      console.log('✅ config directory found');
      const files = fs.readdirSync(configPath);
      console.log('   Files:', files.join(', '));
    } else {
      console.log('❌ config directory not found');
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
    
    console.log('\n✨ FirstRunSetup would:');
    console.log('   1. Create missing directories');
    console.log('   2. Copy config files from config.example to production config');
    console.log('   3. Create .env file from .env.example or generate minimal one');
    console.log('   4. Ensure all required files are present before app starts');
    
  } catch (error) {
    console.error('❌ Error testing FirstRunSetup:', error);
  }
}

// Run the test
testFirstRunSetup();
