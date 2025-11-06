const { spawn } = require('child_process');
const apps = require('./app.config.js');

const appName = process.argv[2];

if (!appName) {
  console.error('Error: You must provide an app name.');
  console.log('Usage: npm run start <AppName>');
  console.log('\nAvailable apps:');
  apps.forEach(app => console.log(`  - ${app.name}`));
  process.exit(1);
}

const appConfig = apps.find(app => app.name === appName);
if (!appConfig) {
  console.error(`Error: App "${appName}" not found in app.config.js.`);
  process.exit(1);
}

console.log(`\n--- Starting ${appName} in development mode ---`);

const env = Object.assign({}, process.env, {
  NODE_ENV: 'development',
  BUILD_TARGET: appName
});

const child = spawn('npm', ['run', 'start:react'], {
  stdio: 'inherit',
  env,
  shell: true
});

child.on('close', code => {
  process.exit(code);
});