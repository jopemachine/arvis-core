// tslint:disable: no-string-literal

import _ from 'lodash';
import { handleKeywordAction, handleResetInputAction } from '../actions';
import { scriptFilterExcute } from '../actions/scriptFilter';
import { log, LogType, pushInputStrLog } from '../config';
import {
  getPluginInstalledPath,
  getWorkflowInstalledPath,
} from '../config/path';
import { triggerTypes } from '../utils';
import extractJson from '../utils/extractJson';
import { handleAction } from './actionHandler';
import {
  applyExtensionVars,
  extractArgsFromPluginItem,
  extractArgsFromQuery,
  extractArgsFromScriptFilterItem,
} from './argsHandler';
import { getPluginList } from './pluginList';
import { getWorkflowList } from './workflowList';

/**
 * @description Manage the execution of tasks
 *              In the CUI, GUI, create a singleton object of this class to execute action, scriptfilter
 */
export class ActionFlowManager {
  private static instance: ActionFlowManager;

  static getInstance() {
    if (!ActionFlowManager.instance) {
      ActionFlowManager.instance = new ActionFlowManager();
    }
    return ActionFlowManager.instance;
  }

  triggerStk: Trigger[];
  globalVariables?: Record<string, any>;
  rerunTimer?: NodeJS.Timeout | undefined;

  extensionInfo?: {
    execPath?: string;
    name?: string;
    version?: string;
    type: 'workflow' | 'plugin';
  };

  // For debugging, set below variables
  public printActionType?: boolean;
  public printTriggerStack?: boolean;
  public printScriptOutput?: boolean;
  public printArgs?: boolean;
  public printScriptfilter?: boolean;
  public printPluginItems?: boolean;

  public loggerColorType?: 'cui' | 'gui' = 'cui';

  public maxRetrieveCount?: number;

  public isInitialTrigger?: boolean = true;

  public onWorkEndHandler?: () => void;
  public onItemPressHandler?: () => void;

  public onItemShouldBeUpdate?: ({
    items,
    needIndexInfoClear,
  }: {
    items: (ScriptFilterItem | Command)[];
    needIndexInfoClear: boolean;
  }) => void;

  public onInputShouldBeUpdate?: ({
    str,
    needItemsUpdate,
  }: {
    str: string;
    needItemsUpdate: boolean;
  }) => void;

  private constructor() {
    this.triggerStk = [];
    this.globalVariables = {};
  }

  /**
   * @summary
   */
  public getTopTrigger = () => {
    return this.triggerStk[this.triggerStk.length - 1];
  }

  /**
   * @summary
   * @description cleanup work stack and other infomations
   */
  public clearTriggerStk = () => {
    if (this.printTriggerStack) {
      log(LogType.info, 'Trigger stack cleared!');
    }

    this.triggerStk.length = 0;
    this.globalVariables = {};
    this.rerunTimer = undefined;
    this.isInitialTrigger = true;
    this.extensionInfo = undefined;
  }

  /**
   * @summary
   */
  public updateTopTrigger = (keyValueDict: Record<string, any>) => {
    for (const key of Object.keys(keyValueDict)) {
      this.triggerStk[this.triggerStk.length - 1][key] = keyValueDict[key];
    }
  }

  /**
   * @summary
   */
  public hasEmptyTriggerStk = () => {
    return this.triggerStk.length === 0;
  }

  /**
   * @summary
   */
  public prevScriptfilterIsExecuting = () => {
    if (this.hasEmptyTriggerStk() || this.getTopTrigger().type !== 'scriptFilter')
      return false;

    return this.getTopTrigger().scriptfilterCompleted === false;
  }

  /**
   * @param {Trigger} work
   */
  public pushTrigger = (work: Trigger) => {
    this.triggerStk.push(work);
    this.debugTriggerStk();
  }

  /**
   * @summary If the script filters are nested, return to the previous script filter.
   */
  public popTrigger = () => {
    this.throwErrOnRendererUpdaterNotSet();

    if (this.triggerStk.length >= 2) {
      if (this.getTopTrigger().type === 'hotkey') {
        // Double pop when executed through hotkey
        this.triggerStk.pop();
      }

      this.triggerStk.pop();
      if (this.getTopTrigger().type === 'scriptFilter') {
        this.onItemShouldBeUpdate!({
          items: this.getTopTrigger().items!,
          needIndexInfoClear: true,
        });
      } else if (this.getTopTrigger().type === 'keyword') {
        const keywordItem = (this.getTopTrigger().actionTrigger) as any;
        this.onItemShouldBeUpdate!({
          items: [{
            title: keywordItem.title,
            subtitle: keywordItem.subtitle
          }],
          needIndexInfoClear: true,
        });
      }

      this.onInputShouldBeUpdate!({
        str: this.getTopTrigger().input,
        needItemsUpdate: false,
      });

      this.debugTriggerStk();
    } else if (this.triggerStk.length !== 0) {
      this.clearTriggerStk();
      this.onInputShouldBeUpdate!({ str: '', needItemsUpdate: true });
    } else {
      this.clearTriggerStk();
      this.onInputShouldBeUpdate!({ str: '', needItemsUpdate: true });
      this.onWorkEndHandler!();
    }
  }

  /**
   * @param  {any} err
   * @param  {ScriptFilterItem[]} errorItems
   * @summary When an error occurs, onItemShouldBeUpdate is called by this method
   *          And those error messages are displayed to the user in the form of items.
   */
  public setErrorItem = ({
    error,
    errorItems,
    options,
  }: {
    error?: any;
    errorItems?: ScriptFilterItem[];
    options?: { extractJson?: boolean } | undefined;
  }) => {
    if (!this.onItemShouldBeUpdate) {
      throw new Error('Renderer update funtions are not set!');
    }

    if (options && options.extractJson === true && errorItems!.length >= 1) {
      if (errorItems) {
        this.onItemShouldBeUpdate({
          items: errorItems,
          needIndexInfoClear: true,
        });
      } else {
        throw new Error(
          '"options.extractJson" is set but errorItems is not given.'
        );
      }
    } else {
      if (!error) {
        throw new Error(
          '"options.extractJson" is false or errorItems is empty. but error is not given.'
        );
      }

      this.onItemShouldBeUpdate({
        items: [
          {
            bundleId: 'error',
            valid: false,
            title: error.name,
            subtitle: error.message,
            text: {
              copy: error.message,
              largetype: error.message,
            },
          },
        ],
        needIndexInfoClear: true,
      });
    }
  }

  /**
   * @param  {number} selectedItemIdx
   * @param  {ModifierInput} modifiers
   */
  public setModifierOnScriptFilterItem = (
    selectedItemIdx: number,
    modifiers: ModifierInput
  ) => {
    this.throwErrOnRendererUpdaterNotSet();

    if (
      this.hasEmptyTriggerStk() ||
      this.getTopTrigger().type !== 'scriptFilter' ||
      !this.getTopTrigger().scriptfilterCompleted
    ) {
      return;
    }

    const pressedModifier: string = _.filter(
      Object.keys(modifiers),
      (modifier: string) => {
        return modifiers[modifier] === true ? true : false;
      }
    )[0];

    const items = _.map(this.getTopTrigger().items, _.cloneDeep);

    if (!pressedModifier || !items || !items.length) {
      return;
    }

    if (
      items[selectedItemIdx].mods &&
      items[selectedItemIdx].mods![pressedModifier]
    ) {
      const targetMods = items[selectedItemIdx].mods![pressedModifier];
      const modifiersAttributes = Object.keys(targetMods);
      for (const modifierAttribute of modifiersAttributes) {
        items[selectedItemIdx][modifierAttribute] =
          targetMods[modifierAttribute];
      }
    } else {
      items[selectedItemIdx] = {
        ...items[selectedItemIdx],
        subtitle: '',
      };
    }

    this.onItemShouldBeUpdate!({ items, needIndexInfoClear: false });
  }

  /**
   * @summary
   */
  public clearModifierOnScriptFilterItem = () => {
    this.throwErrOnRendererUpdaterNotSet();

    if (
      this.hasEmptyTriggerStk() ||
      this.getTopTrigger().type !== 'scriptFilter' ||
      !this.getTopTrigger().scriptfilterCompleted
    ) {
      return;
    }

    this.onItemShouldBeUpdate!({
      items: this.getTopTrigger().items!,
      needIndexInfoClear: false,
    });
  }

  /**
   * @param  {any} err
   */
  public handleScriptFilterError = (
    err: any,
    options?: { extractJson?: boolean } | undefined
  ) => {
    const possibleJsons = extractJson(err.toString());
    const errors = possibleJsons.filter((item) => item.items);

    const errorItems = _.reduce(
      errors,
      (ret: any, errorObj: any) => {
        ret.push(errorObj.items[0]);
        return ret;
      },
      []
    );

    this.setErrorItem({ error: err, errorItems, options });
  }

  /**
   * @param  {any[]} itemArr
   * @param  {number} index
   * @param  {string} runningSubText
   */
  public setRunningText({ selectedItem }: { selectedItem: Command }) {
    this.throwErrOnRendererUpdaterNotSet();
    selectedItem.subtitle = selectedItem.runningSubtext ?? '';

    this.onItemShouldBeUpdate!({
      items: [selectedItem],
      needIndexInfoClear: true,
    });
  }

  /**
   * @param  {PluginItem|Command} item
   */
  public setExtensionInfo = (item: PluginItem | Command) => {
    if (item['isPluginItem']) {
      this.extensionInfo = {
        execPath: getPluginInstalledPath(item.bundleId!),
        name: getPluginList()[item.bundleId!].name,
        version: getPluginList()[item.bundleId!].version,
        type: 'plugin',
      };
    } else {
      this.extensionInfo = {
        execPath: getWorkflowInstalledPath(item.bundleId!),
        name: getWorkflowList()[item.bundleId!].name,
        version: getWorkflowList()[item.bundleId!].version,
        type: 'workflow',
      };
    }
  }

  /**
   * @summary
   */
  public debugTriggerStk = (): void => {
    if (!this.printTriggerStack) return;

    log(LogType.info, '* ---------- Debug trigger stack ---------- *');
    for (const item of this.triggerStk) {
      log(LogType.info, item);
    }
    log(LogType.info, '* ----------------------------------------- *');
  }

  /**
   * @param  {Command | ScriptFilterItem | PluginItem} item
   * @description If triggerStk is empty, return item's action
   *              otherwise, return nextAction (topWork's action)
   */
  private prepareNextActions = ({
    item,
  }: {
    item: Command | ScriptFilterItem | PluginItem;
  }): Action[] | undefined => {
    if (this.hasEmptyTriggerStk()) {
      return (item as Command | PluginItem).actions;
    } else {
      return this.getTopTrigger().actions;
    }
  }

  /**
   * @param  {Command | ScriptFilterItem | PluginItem} item
   * @param  {string} inputStr
   * @return {Record<string, any>}
   * @description Returns args using according args extraction method
   */
  private prepareArgs = ({
    item,
    inputStr,
  }: {
    item: Command | ScriptFilterItem | PluginItem;
    inputStr: string;
  }): Record<string, any> => {
    const bundleId: string = this.hasEmptyTriggerStk()
      ? item.bundleId!
      : this.getTopTrigger().bundleId;

    const extensionVariables = item['isPluginItem']
      ? getPluginList()[bundleId].variables
      : getWorkflowList()[bundleId].variables ?? {};

    const emptyQuery = {
      '{query}': '',
      $1: '',
    };

    // Plugin Trigger
    if (this.hasEmptyTriggerStk() && item['isPluginItem']) {
      return applyExtensionVars(
        extractArgsFromPluginItem(item as PluginItem),
        extensionVariables
      );
    }

    // Workflow Trigger: Hotkey
    if (this.hasEmptyTriggerStk() && item['type'] === 'hotkey') {
      return applyExtensionVars(
        emptyQuery,
        extensionVariables
      );
    }

    // Workflow Trigger: Keyword, scriptfilter
    if (this.hasEmptyTriggerStk()) {
      const [_emptyStr, queryStr] = inputStr.split(
        (item as Command).command!
      );

      return applyExtensionVars(
        extractArgsFromQuery(
          queryStr ? queryStr.trim().split((item as Command).command!) : []
        ),
        extensionVariables
      );
    }

    if (this.getTopTrigger().type === 'keyword') {
      return applyExtensionVars(
        extractArgsFromQuery(inputStr.split(' ')),
        extensionVariables
      );
    }

    // Handle scriptfilter action
    if (this.getTopTrigger().type === 'scriptFilter') {
      item = item as ScriptFilterItem;
      const vars = { ...item.variables, ...this.globalVariables! };
      return applyExtensionVars(
        extractArgsFromScriptFilterItem(item, vars),
        extensionVariables
      );
    }

    log(LogType.error, 'Args type infer failed');
    return emptyQuery;
  }

  /**
   * @param  {}
   */
  private throwErrOnRendererUpdaterNotSet = () => {
    if (
      !this.onItemPressHandler ||
      !this.onInputShouldBeUpdate ||
      !this.onItemShouldBeUpdate ||
      !this.onWorkEndHandler
    ) {
      throw new Error('Renderer update funtions are not set!');
    }
  }

  /**
   * @param  {Action} nextAction
   * @param  {Record<string, any>} args
   * @description This function handle Trigger as Actions.
   *              Which means keyword, scriptfilter.
   *              If one of those would be Action, force users to enter input and enter again.
   */
  private handleTriggerAction = (nextAction: Action, args: Record<string, any>): void => {
    this.throwErrOnRendererUpdaterNotSet();

    if (nextAction.type === 'resetInput') {
      handleResetInputAction(nextAction.newInput);
      return;
    }

    if (nextAction.type === 'scriptFilter' || nextAction.type === 'keyword') {
      const nextInput = args['{query}'] ?? '';
      const optionalWhitespace = nextAction['argType'] === 'required' ? ' ' : '';

      this.pushTrigger({
        actions: (nextAction as ScriptFilterAction | KeywordAction).actions,
        actionTrigger: nextAction,
        args,
        bundleId: this.getTopTrigger().bundleId,
        input: nextInput,
        type: nextAction.type,
        scriptfilterCompleted: false,
        scriptfilterProc: null,
      });

      if (nextAction.type === 'scriptFilter') {
        scriptFilterExcute(nextInput);

        this.onInputShouldBeUpdate!({
          str: nextInput + optionalWhitespace,
          needItemsUpdate: false,
        });
      } else if (nextAction.type === 'keyword') {
        handleKeywordAction(nextAction as KeywordAction);

        this.onInputShouldBeUpdate!({
          str: nextInput + optionalWhitespace,
          needItemsUpdate: false,
        });
      }

      this.onItemPressHandler!();
      return;
    }
  }

  /**
   * @param  {Action} action
   */
  private hasAsyncActionChain = (action: Action) => {
    return action['asyncChain'];
  }

  /**
   * @param  {Command|ScriptFilterItem|PluginItem} item
   * @param  {Record<string, any>} args
   * @param  {Action[]|undefined} targetActions
   * @param  {ModifierInput} modifier
   * @param  {Action} nextAction
   * @description Actions after async action (like script) must be executed after the async action is completed.
   *              This function handle these async action chain.
   *              Actions after async action are removed from targetActions.
   *              And return this targetActions.
   */
  private handleAsyncActionChain = (
    item: Command | ScriptFilterItem | PluginItem,
    args: Record<string, any>,
    targetActions: Action[],
    modifier: ModifierInput,
    nextAction: Action
  ): Action[] => {
    targetActions = targetActions.filter(
      (targetAction) => targetAction !== nextAction
    );

    nextAction['asyncChain'].then((result: any) => {
      switch (nextAction['asyncChainType']) {
        case 'script': {
          args['{query}'] = result.all;
          args['$1'] = result.all;
          break;
        }
        case 'clipboard': {
          args['{query}'] = result;
          args['$1'] = result;
          break;
        }
      }

      this.handleActionChain({
        item,
        args,
        modifier,
        targetActions: [nextAction],
      });
    });

    return targetActions;
  }

  /**
   * @description
   */
  private getParentAction = () => {
    return !this.hasEmptyTriggerStk()
      ? this.getTopTrigger().actionTrigger
        ? this.getTopTrigger().actionTrigger['type']
        : undefined
      : undefined;
  }

  /**
   * @returns {boolean} If return false, commandExcute quits to enable users to give more input
   * @description Handle Multiple Actions, Process a sequence of actions that follow back.
   */
  private handleActionChain = ({
    item,
    args,
    targetActions,
    modifier,
  }: {
    item: Command | ScriptFilterItem | PluginItem;
    args: Record<string, any>;
    targetActions: Action[];
    modifier: ModifierInput;
  }): boolean => {
    this.throwErrOnRendererUpdaterNotSet();
    const actionFlowManager = ActionFlowManager.getInstance();

    let handleActionResult: {
      nextActions: Action[];
      args: Record<string, any>;
    } = { args, nextActions: [] };

    let quit = true;
    let actionsPointer = targetActions ? [...targetActions] : [];

    actionsPointer.sort((actionA, actionB) => {
      const aIsTrig = triggerTypes.includes(actionA.type);
      const bIsTrig = triggerTypes.includes(actionB.type);
      if ((aIsTrig && !bIsTrig) || (!aIsTrig && bIsTrig)) return 1;
      return -1;
    });

    while (actionsPointer.length > 0) {
      const parentActionType = this.getParentAction();

      const needToPreventQuit = triggerTypes.includes(actionsPointer[0].type) &&
        (!actionFlowManager.isInitialTrigger ||
          triggerTypes.includes(parentActionType));

      if (needToPreventQuit) {
        this.handleTriggerAction(actionsPointer[0], args);
        actionFlowManager.isInitialTrigger = false;
        quit = false;
        actionsPointer.splice(0, 1);
        continue;
      } else {
        handleActionResult = handleAction({
          actions: actionsPointer,
          queryArgs: args,
          modifiersInput: modifier,
        });

        actionsPointer = handleActionResult.nextActions;
      }

      if (actionsPointer) {
        for (const nextAction of actionsPointer) {
          if (this.hasAsyncActionChain(nextAction)) {
            actionsPointer = this.handleAsyncActionChain(
              item,
              args,
              actionsPointer,
              modifier,
              nextAction
            );
          }

          if (nextAction.type === 'resetInput') {
            actionsPointer = [];
          }

          if (triggerTypes.includes(nextAction.type)) {
            this.handleTriggerAction(nextAction, handleActionResult.args);
            quit = false;
          }
        }
      }
    }

    return quit;
  }

  /**
   * @param  {Command|ScriptFilterItem|PluginItem} item
   * @param  {string} inputStr
   * @param  {ModifierInput} modifier
   * @summary Handle command item properly
   * @returns {boolean} If return value is true, no need more user input
   *                    If return value is false, need more user input
   */
  public commandExcute(
    item: Command | ScriptFilterItem | PluginItem,
    inputStr: string,
    modifier: ModifierInput
  ): boolean {
    // If triggerStk is empty, the args becomes query, otherwise args becomes arg of items
    // If triggerStk is empty, the actions becomes command, otherwise the top action of the stack is 'actions'.
    const actions = this.prepareNextActions({ item });
    const args = this.prepareArgs({ item, inputStr });

    if (this.hasEmptyTriggerStk()) {
      // Trigger Type: one of 'keyword', 'scriptFilter'
      this.pushTrigger({
        actions,
        actionTrigger: item as Command | PluginItem,
        args,
        bundleId: (item as Command | PluginItem).bundleId!,
        input: inputStr,
        type: (item as Command | PluginItem).type,
      });

      this.setExtensionInfo(item as Command | PluginItem);

      if (item['isPluginItem']) {
        pushInputStrLog(item.bundleId!, (item as PluginItem).title);
      } else {
        pushInputStrLog(item.bundleId!, (item as Command).command!);
      }
    } else {
      this.isInitialTrigger = false;
    }

    if (this.getTopTrigger().type === 'scriptFilter') {
      this.updateTopTrigger({
        input: inputStr
      });
    }

    return this.handleActionChain({
      item,
      args,
      modifier,
      targetActions: actions ?? [],
    });
  }

  /**
   * @param  {Command|ScriptFilterItem|PluginItem} item
   * @param  {string} inputStr
   * @param  {ModifierInput} modifier
   * @summary Handler for enter event.
   *          Handle command item properly and call renderer update functions
   */
  public handleItemPressEvent(
    item: Command | ScriptFilterItem | PluginItem,
    inputStr: string,
    modifier: ModifierInput
  ): void {
    this.throwErrOnRendererUpdaterNotSet();

    // Ignore this exeution if previous work is pending.
    if (this.prevScriptfilterIsExecuting()) {
      return;
    }

    if (this.commandExcute(item, inputStr, modifier)) {
      this.clearTriggerStk();
      this.onItemShouldBeUpdate!({ items: [], needIndexInfoClear: true });
      this.onItemPressHandler!();
      this.onWorkEndHandler!();
    }
  }
}