import execa, { ExecaError } from '../../execa';
import { log, LogType } from '../config';
import { execute } from '../core';
import { applyArgsToScript } from '../core/argsHandler';
import { extractScriptOnThisPlatform } from '../core/scriptExtracter';
import { WorkManager } from '../core/workManager';

/**
 * @param  {ExecaError} err
 */
const scriptErrorHandler = (err: ExecaError) => {
  if (err.timedOut) {
    log(LogType.error, `Script timeout!`);
  } else if (err.isCanceled) {
    log(LogType.error, `Script canceled`);
  } else {
    log(LogType.error, `Script Error\n${err}`);
  }
};

/**
 * @param  {ScriptAction} action
 * @param  {object} queryArgs
 */
const handleScriptAction = async (action: ScriptAction, queryArgs: object) => {
  const workManager = WorkManager.getInstance();
  const scriptStr = extractScriptOnThisPlatform(action.script);
  const scriptWork = execute({
    bundleId: workManager.getTopWork().bundleId,
    scriptStr: applyArgsToScript({ scriptStr, queryArgs }),
    options: { all: true },
  });

  return scriptWork
    .then((result: execa.ExecaReturnValue<string>) => {
      if (workManager.printWorkflowOutput) {
        log(LogType.info, `[Output]\n\n ${result.all}`);
      }
    })
    .catch(scriptErrorHandler);
};

export { handleScriptAction };