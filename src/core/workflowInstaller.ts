import alfredWorkflowPlistConvert from 'arvis-plist-converter';
import chmodr from 'chmodr';
import * as fse from 'fs-extra';
import path from 'path';
import rimraf from 'rimraf';
import unzipper from 'unzipper';
import { v4 as uuidv4 } from 'uuid';
import { log, LogType } from '../config';
import { getWorkflowInstalledPath, tempPath } from '../config/path';
import { Store } from '../config/store';
import { checkFileExists, sleep } from '../utils';

/**
 * @param  {string} installedPath
 * @return {Promise<void | Error>}
 */
const installByPath = async (installedPath: string): Promise<void | Error> => {
  const store = Store.getInstance();
  const workflowConfFilePath = path.resolve(
    path.normalize(`${installedPath}${path.sep}arvis-workflow.json`)
  );

  return new Promise(async (resolve, reject) => {
    let workflowConfig: WorkflowConfigFile;
    try {
      workflowConfig = await fse.readJson(workflowConfFilePath);
    } catch (err) {
      reject(err);
      return;
    }

    if (!workflowConfig.bundleId || workflowConfig.bundleId === '') {
      reject(new Error('Invalid workflow - bundleId is not set'));
      return;
    }

    if (
      workflowConfig.platform &&
      !workflowConfig.platform.includes(process.platform)
    ) {
      reject(new Error(`This workflows not supports '${process.platform}'`));
      return;
    }

    const arr = workflowConfFilePath.split(path.sep);
    const workflowConfDirPath = arr.slice(0, arr.length - 1).join(path.sep);

    const destinationPath = getWorkflowInstalledPath(workflowConfig.bundleId);

    if (await checkFileExists(destinationPath)) {
      await fse.remove(destinationPath);
    }

    await fse.copy(workflowConfDirPath, destinationPath, {
      recursive: true,
      overwrite: true,
      preserveTimestamps: false,
    });

    // Makes scripts, binaries of installed paths executable
    chmodr(destinationPath, 0o777, () => {
      workflowConfig.enabled = workflowConfig.enabled ?? true;
      store.setWorkflow(workflowConfig);
      resolve();
    });
  });
};

/**
 * @param  {string} installFile arvisworkflow files or alfredworkflow files
 * @return {Promise<void | Error>}
 */
const install = async (installFile: string): Promise<void | Error> => {
  let extractedPath: string;
  let unzipStream: unzipper.ParseStream | null;
  const zipFileName: string = installFile.split(path.sep).pop()!;

  if (
    installFile.endsWith('.arvisworkflow') ||
    installFile.endsWith('.alfredworkflow')
  ) {
    // Create temporary folder and delete it after installtion
    const temporaryFolderName = uuidv4();

    extractedPath = `${tempPath}${path.sep}${temporaryFolderName}`;
    unzipStream = fse
      .createReadStream(installFile)
      .pipe(unzipper.Extract({ path: extractedPath }));
  } else {
    throw new Error(`Install error, '${installFile}' is not valid`);
  }

  return new Promise(async (resolve, reject) => {
    unzipStream!.on('finish', async () => {
      log(LogType.debug, 'Unzip finished..');
      // even if the install pipe is finalized, there might be a short time when the file is not created yet.
      // it's not clear, so change below logic if it matters later.
      await sleep(1000);

      const innerPath = zipFileName.split('.')[0];
      const plistPath = `${extractedPath}${path.sep}info.plist`;
      const arvisWorkflowConfigPath = `${extractedPath}${path.sep}arvis-workflow.json`;
      // Supports both compressed with folder and compressed without folders
      const containedInfoPlist = await checkFileExists(plistPath);
      const containedWorkflowConf = await checkFileExists(
        arvisWorkflowConfigPath
      );
      const folderNotContained = containedInfoPlist || containedWorkflowConf;

      // Suppose it is in the inner folder if it is not in the outer folder. if not, throw error.
      const installedPath = folderNotContained
        ? extractedPath
        : `${extractedPath}${path.sep}${innerPath}`;

      // Need to convert alfred's info.plist to json first
      if (installFile.endsWith('.alfredworkflow')) {
        try {
          await alfredWorkflowPlistConvert(
            `${installedPath}${path.sep}info.plist`,
            `${installedPath}${path.sep}arvis-workflow.json`
          );
        } catch (err) {
          fse.remove(extractedPath);
          reject(err);
        }
      }

      installByPath(installedPath)
        .then(resolve)
        .catch(reject)
        .finally(() => {
          fse.remove(extractedPath);
        });
    });
  });
};

/**
 * @param  {{bundleId:string}} bundleId
 * @return {Promise<void>}
 */
const unInstall = async ({ bundleId }: { bundleId: string }): Promise<void> => {
  const store = Store.getInstance();
  const installedDir = getWorkflowInstalledPath(bundleId);
  log(LogType.debug, `Uninstalling '${bundleId}'...`);

  try {
    rimraf(installedDir, () => {
      store.deleteWorkflow(bundleId);
    });
  } catch (e) {
    if (!(await checkFileExists(installedDir))) {
      return;
    }
    throw new Error(e);
  }
};

export { install, installByPath, unInstall };
