import envPathsGenerator from 'env-paths';
import fse from 'fs-extra';
import path from 'path';
import pathExists from 'path-exists';
import { getHistoryFilePath } from '../config';

const envPaths = envPathsGenerator('arvis');

const installedDataPath = envPaths.data;
const cachePath = envPaths.cache;
const configPath = envPaths.config;

/**
 * @description User config value
 */
const userConfigPath = path.resolve(configPath, 'user-configs.json');

/**
 * @description Store workflow, plugin data
 */
const extensionDataPath = path.resolve(installedDataPath, 'data');

/**
 * @description Store workflow, plugin caches
 */
const extensionCachePath = path.resolve(cachePath, 'cache');

/**
 * @description Store workflow files
 */
const workflowInstallPath = path.resolve(installedDataPath, 'workflows');

/**
 * @description Store plugin's files
 */
const pluginInstallPath = path.resolve(installedDataPath, 'plugins');

/**
 * @description Store temp files
 */
const tempPath = envPaths.temp;

/**
 * @summary Create the necessary paths for the Arvis if they don't exists
 */
const initializePath = async () => {
  const ensureFileExist = async (filePath: string, type: 'directory' | 'json') => {
    if (!(await pathExists(filePath))) {
      if (type === 'directory') {
        await fse.mkdir(filePath, { recursive: true });
      } else if (type === 'json') {
        await fse.writeJSON(userConfigPath, {});
      }
    }
  };

  await Promise.all([
    ensureFileExist(workflowInstallPath, 'directory'),
    ensureFileExist(pluginInstallPath, 'directory'),
    ensureFileExist(extensionDataPath, 'directory'),
    ensureFileExist(extensionCachePath, 'directory'),
    ensureFileExist(tempPath, 'directory'),
    ensureFileExist(userConfigPath, 'json'),
  ]).catch(console.error);
};

/**
 * @summary
 */
const getExtensionHistoryPath = () => {
  return getHistoryFilePath();
};

/**
 * @param  {string} bundleId
 */
const getExtensionDataPath = (bundleId: string) => {
  return path.resolve(extensionDataPath, bundleId);
};

/**
 * @param  {string} bundleId
 */
const getExtensionCachePath = (bundleId: string) => {
  return path.resolve(extensionCachePath, bundleId);
};

/**
 * @param  {string} bundleId
 */
const getWorkflowInstalledPath = (bundleId: string) => {
  return path.resolve(workflowInstallPath, bundleId);
};

/**
 * @param  {string} bundleId
 */
const getPluginInstalledPath = (bundleId: string) => {
  return path.resolve(pluginInstallPath, bundleId);
};

/**
 * @param  {string} bundleId
 */
const getWorkflowConfigJsonPath = (bundleId: string) => {
  return path.resolve(getWorkflowInstalledPath(bundleId), 'arvis-workflow.json');
};

/**
 * @param  {string} bundleId
 */
const getPluginConfigJsonPath = (bundleId: string) => {
  return path.resolve(getPluginInstalledPath(bundleId), 'arvis-plugin.json');
};

export {
  cachePath,
  configPath,
  envPathsGenerator,
  getExtensionCachePath,
  getExtensionDataPath,
  getExtensionHistoryPath,
  getPluginConfigJsonPath,
  getPluginInstalledPath,
  getWorkflowConfigJsonPath,
  getWorkflowInstalledPath,
  initializePath,
  installedDataPath,
  pluginInstallPath,
  tempPath,
  userConfigPath,
  workflowInstallPath,
};

export default {
  cachePath,
  configPath,
  envPathsGenerator,
  getExtensionCachePath,
  getExtensionDataPath,
  getPluginConfigJsonPath,
  getPluginInstalledPath,
  getWorkflowConfigJsonPath,
  getWorkflowInstalledPath,
  initializePath,
  installedDataPath,
  pluginInstallPath,
  tempPath,
  userConfigPath,
  workflowInstallPath,
};
