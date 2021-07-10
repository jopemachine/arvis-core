import fse from 'fs-extra';
import { userConfigPath } from './path';

/**
 * @description Migrate previous extenion's setting
 */
export const applyUserConfigs = (userConfig: any, extensionInfo: any): any => {
  const result = { ...extensionInfo };

  // Migrate previous variables
  if (userConfig && userConfig.variables) {
    for (const variable of Object.keys(userConfig.variables)) {
      result.variables[variable] = userConfig.variables[variable];
    }
  }

  return result;
};

export const getUserConfigs = async (): Promise<any> => {
  return fse.readJSON(userConfigPath);
};

export const addUserConfigs = async (bundleId: string, type: 'variables', target: any): Promise<void> => {
  const userConfigs = await getUserConfigs();

  if (!userConfigs[bundleId]) userConfigs[bundleId] = {};

  userConfigs[bundleId][type] = target;
  await fse.writeJSON(userConfigPath, userConfigs, { encoding: 'utf-8' });
};

export const initialzeUserConfigs = async (): Promise<void> => {
  await fse.remove(userConfigPath);
  await fse.writeJSON(userConfigPath, {});
};
