import { IExec } from 'iexec';
import { fetchMyContacts } from './fetchMyContacts.js';

export class IExecWeb3Mail {
  fetchMyContacts: () => Promise<any>;

  constructor(
    ethProvider: any,
    { providerOptions = {}, iexecOptions = {} }: any = {}
  ) {
    let iexec: IExec;
    try {
      iexec = new IExec(
        { ethProvider },
        { confirms: 3, providerOptions, ...iexecOptions }
      );
    } catch (e) {
      throw Error('Unsupported ethProvider');
    }
    this.fetchMyContacts = () => fetchMyContacts({ iexec });
  }
}