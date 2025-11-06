const path = require('path');
const apps = require('./scripts/app.config.js');

function getAppConfig() {
  const target = process.env.BUILD_TARGET;
  if (!target) {
    return null;
  }
  return apps.find(app => app.name === target);
}

function overridePaths(paths, env) {
  const appConfig = getAppConfig();
  if (!appConfig) {
    return paths;
  }

  const entryPath = path.resolve(process.cwd(), appConfig.entry);
  paths.appIndexJs = entryPath;
  
  return paths;
}

function overrideWebpack(config, env) {
  const appConfig = getAppConfig();
  if (!appConfig) {
    return config;
  }

  const entryPath = path.resolve(process.cwd(), appConfig.entry);
  
  config.entry = entryPath;

  if (env === 'production' && config.output) {
    config.output.filename = 'static/js/[name].bundle.js';
    config.output.chunkFilename = 'static/js/[name].chunk.js';
  }

  return config;
}

module.exports = {
  webpack: overrideWebpack,
  paths: overridePaths
};