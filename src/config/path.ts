import envPathsGenerator from 'env-paths';
import fse from 'fs-extra';
import path from 'path';
import { checkFileExists } from '../utils';

const envPaths = envPathsGenerator('arvis');

const installedDataPath = envPaths.data;
const cachePath = envPaths.cache;

/**
 * @description Store workflow, plugin data
 */
const extensionDataPath = `${installedDataPath}${path.sep}data`;

/**
 * @description Store workflow, plugin caches
 */
const extensionCachePath = `${cachePath}${path.sep}cache`;

/**
 * @description Store workflow files
 */
const workflowInstallPath = `${installedDataPath}${path.sep}workflows`;

/**
 * @description Store plugin's files
 */
const pluginInstallPath = `${installedDataPath}${path.sep}plugins`;

/**
 * @description Store temp files
 */
const tempPath = envPaths.temp;

/**
 * @summary Create the necessary paths for the Arvis if they don't exists
 */
const initializePath = async () => {
  if (!(await checkFileExists(workflowInstallPath))) {
    await fse.mkdir(workflowInstallPath, { recursive: true });
  }
  if (!(await checkFileExists(extensionDataPath))) {
    await fse.mkdir(extensionDataPath, { recursive: true });
  }
  if (!(await checkFileExists(extensionCachePath))) {
    await fse.mkdir(extensionCachePath, { recursive: true });
  }
  if (!(await checkFileExists(pluginInstallPath))) {
    await fse.mkdir(pluginInstallPath, { recursive: true });
  }
  if (!(await checkFileExists(tempPath))) {
    await fse.mkdir(tempPath, { recursive: true });
  }
};

/**
 * @param  {string} bundleId
 */
const getExtensionDataPath = (bundleId: string) => {
  return `${extensionDataPath}${path.sep}${bundleId}`;
};

/**
 * @param  {string} bundleId
 */
const getExtensionCachePath = (bundleId: string) => {
  return `${extensionCachePath}${path.sep}${bundleId}`;
};

/**
 * @param  {string} bundleId
 */
const getWorkflowInstalledPath = (bundleId: string) => {
  return `${workflowInstallPath}${path.sep}${bundleId}`;
};

/**
 * @param  {string} bundleId
 */
const getPluginInstalledPath = (bundleId: string) => {
  return `${pluginInstallPath}${path.sep}${bundleId}`;
};

/**
 * @param  {string} bundleId
 */
const getPluginConfigJsonPath = (bundleId: string) => {
  return `${getPluginInstalledPath(bundleId)}${path.sep}arvis-plugin.json`;
};

/**
 * @param  {string} bundleId
 */
const getWorkflowConfigJsonPath = (bundleId: string) => {
  return `${getWorkflowInstalledPath(bundleId)}${path.sep}arvis-workflow.json`;
};

export {
  tempPath,
  installedDataPath,
  workflowInstallPath,
  pluginInstallPath,
  getExtensionCachePath,
  getExtensionDataPath,
  getPluginConfigJsonPath,
  getPluginInstalledPath,
  getWorkflowConfigJsonPath,
  getWorkflowInstalledPath,
  initializePath,
};

export default {
  tempPath,
  installedDataPath,
  workflowInstallPath,
  pluginInstallPath,
  getExtensionCachePath,
  getExtensionDataPath,
  getPluginConfigJsonPath,
  getPluginInstalledPath,
  getWorkflowConfigJsonPath,
  getWorkflowInstalledPath,
  initializePath,
};
