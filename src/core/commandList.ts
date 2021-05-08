import { Store } from '../config/config';

const getCommandList = () => {
  const store = Store.getInstance();
  return store.getCommands();
};

export {
  getCommandList
};