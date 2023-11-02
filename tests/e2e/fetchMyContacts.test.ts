import {
  IExecDataProtector,
  ProtectedDataWithSecretProps,
  getWeb3Provider as dataprotectorGetWeb3Provider,
} from '@iexec/dataprotector';
import { beforeAll, describe, expect, it, jest } from '@jest/globals';
import { Wallet } from 'ethers';
import { NULL_ADDRESS } from 'iexec/utils';
import { WEB3_MAIL_DAPP_ADDRESS } from '../../src/config/config.js';
import { IExecWeb3mail, getWeb3Provider } from '../../src/index.js';
import { ValidationError, WorkflowError } from '../../src/utils/errors.js';
import { EnhancedWallet, IExec } from 'iexec';

describe('web3mail.fetchMyContacts()', () => {
  let wallet: Wallet;
  let web3mail: IExecWeb3mail;
  let dataProtector: IExecDataProtector;
  let protectedData: ProtectedDataWithSecretProps;
  let ethProvider: EnhancedWallet;

  beforeAll(async () => {
    wallet = Wallet.createRandom();
    ethProvider = getWeb3Provider(wallet.privateKey);
    dataProtector = new IExecDataProtector(
      dataprotectorGetWeb3Provider(wallet.privateKey)
    );
    web3mail = new IExecWeb3mail(ethProvider);

    //create valid protected data
    protectedData = await dataProtector.protectData({
      data: { email: 'test@gmail.com' },
      name: 'test do not use',
    });
  }, 30_000);

  afterEach(() => {
    jest.spyOn(web3mail, 'fetchMyContacts').mockRestore();
  });

  it('pass with a granted access for a specific requester', async () => {
    await dataProtector.grantAccess({
      authorizedApp: WEB3_MAIL_DAPP_ADDRESS,
      protectedData: protectedData.address,
      authorizedUser: wallet.address,
    });

    const res = await web3mail.fetchMyContacts();
    const foundContactForASpecificRequester = res.find((obj) => {
      return obj.address === protectedData.address.toLocaleLowerCase();
    });
    expect(
      foundContactForASpecificRequester &&
        foundContactForASpecificRequester.address
    ).toBeDefined();
    expect(
      foundContactForASpecificRequester &&
        foundContactForASpecificRequester.address
    ).toBe(protectedData.address.toLocaleLowerCase());
  }, 40_000);

  it('pass with a granted access for any requester', async () => {
    const grantedAccessForAnyRequester = await dataProtector.grantAccess({
      authorizedApp: WEB3_MAIL_DAPP_ADDRESS,
      protectedData: protectedData.address,
      authorizedUser: NULL_ADDRESS,
    });

    const res = await web3mail.fetchMyContacts();

    const foundContactForAnyRequester = res.find(
      (obj) => obj.address === protectedData.address.toLowerCase()
    );
    expect(
      foundContactForAnyRequester && foundContactForAnyRequester.address
    ).toBeDefined();
    expect(
      foundContactForAnyRequester && foundContactForAnyRequester.address
    ).toBe(protectedData.address.toLocaleLowerCase());

    //revoke access to not appear as contact for anyone
    const revoke = await dataProtector.revokeOneAccess(
      grantedAccessForAnyRequester
    );
    expect(revoke).toBeDefined();
  }, 40_000);

  it('should return no contact', async () => {
    jest.spyOn(web3mail, 'fetchMyContacts').mockResolvedValue([]);
    const contacts = await web3mail.fetchMyContacts();

    expect(contacts).toEqual([]);
  });

  it('should throw a WorkflowError with a specific message', async () => {
    jest
      .spyOn(web3mail, 'fetchMyContacts')
      .mockRejectedValue(
        new WorkflowError(
          'Failed to fetch my contacts: wrong address is not a valid ethereum address',
          new Error()
        )
      );

    const expectedErrorMessage =
      'Failed to fetch my contacts: wrong address is not a valid ethereum address';

    await expect(web3mail.fetchMyContacts()).rejects.toThrow(WorkflowError);
    await expect(web3mail.fetchMyContacts()).rejects.toThrow(
      expectedErrorMessage
    );
  });

  it('should throw a WorkflowError error for missing parameters', async () => {
    jest
      .spyOn(web3mail, 'fetchMyContacts')
      .mockRejectedValue(new ValidationError('Missing parameter'));

    await expect(web3mail.fetchMyContacts()).rejects.toThrow(ValidationError);
    await expect(web3mail.fetchMyContacts()).rejects.toThrow(
      'Missing parameter'
    );
  });

  it('Should not return dataset as a contact', async () => {
    const iexec = new IExec({
      ethProvider,
    });
    const dataset = await iexec.dataset.deployDataset({
      owner: wallet.address,
      name: 'test do not use',
      multiaddr: '/ipfs/Qmd286K6pohQcTKYqnS1YhWrCiS4gz7Xi34sdwMe9USZ7u',
      checksum:
        '0x84a3f860d54f3f5f65e91df081c8d776e8bcfb5fbc234afce2f0d7e9d26e160d',
    });
    const encryptionKey = await iexec.dataset.generateEncryptionKey();

    await iexec.dataset.pushDatasetSecret(dataset.address, encryptionKey);

    await dataProtector.grantAccess({
      authorizedApp: WEB3_MAIL_DAPP_ADDRESS,
      protectedData: dataset.address,
      authorizedUser: wallet.address,
    });
    const myContacts = await web3mail.fetchMyContacts();
    expect(myContacts.map(({ address }) => address)).not.toContain(
      dataset.address
    );
  }, 40_000);

  it('should return only contacts that have a valid email', async () => {
    const notValidProtectedData = await dataProtector.protectData({
      data: { notemail: 'not email' },
      name: 'test do not use',
    });

    await dataProtector.grantAccess({
      authorizedApp: WEB3_MAIL_DAPP_ADDRESS,
      protectedData: notValidProtectedData.address,
      authorizedUser: wallet.address,
    });

    const res = await web3mail.fetchMyContacts();

    expect(
      res.filter((contact) => contact.address === notValidProtectedData.address)
    ).toStrictEqual([]);
  }, 40_000);
});
