import {
  IExecDataProtector,
  ProtectedDataWithSecretProps,
} from '@iexec/dataprotector';
import { beforeAll, describe, expect, it } from '@jest/globals';
import { HDNodeWallet } from 'ethers';
import {
  WEB3_MAIL_DAPP_ADDRESS,
  WHITELIST_SMART_CONTRACT_ADDRESS,
  PROD_WORKERPOOL_ADDRESS,
} from '../../src/config/config.js';
import { IExecWeb3mail, WorkflowError } from '../../src/index.js';
import {
  MAX_EXPECTED_BLOCKTIME,
  MAX_EXPECTED_WEB2_SERVICES_TIME,
  TEST_CHAIN,
  createAndPublishAppOrders,
  createAndPublishWorkerpoolOrder,
  getRandomWallet,
  getTestConfig,
  getTestIExecOption,
  getTestWeb3SignerProvider,
  sleep,
} from '../test-utils.js';
import { IExec } from 'iexec';

describe('web3mail.sendEmail()', () => {
  let consumerWallet: HDNodeWallet;
  let providerWallet: HDNodeWallet;
  let web3mail: IExecWeb3mail;
  let dataProtector: IExecDataProtector;
  let validProtectedData: ProtectedDataWithSecretProps;
  let invalidProtectedData: ProtectedDataWithSecretProps;
  let workerpoolAddress: string;

  beforeAll(async () => {
    providerWallet = getRandomWallet();
    consumerWallet = getRandomWallet();
    const ethProvider = getTestWeb3SignerProvider(
      TEST_CHAIN.appOwnerWallet.privateKey
    );
    const iexecOptions = getTestIExecOption();
    const resourceProvider = new IExec({ ethProvider }, iexecOptions);

    await createAndPublishAppOrders(resourceProvider, WEB3_MAIL_DAPP_ADDRESS);

    await createAndPublishWorkerpoolOrder(
      PROD_WORKERPOOL_ADDRESS,
      TEST_CHAIN.prodWorkerpoolOwnerWallet
    );

    //create valid protected data
    dataProtector = new IExecDataProtector(
      ...getTestConfig(providerWallet.privateKey)
    );
    validProtectedData = await dataProtector.protectData({
      data: { email: 'example@test.com' },
      name: 'test do not use',
    });
    await dataProtector.grantAccess({
      authorizedApp: WEB3_MAIL_DAPP_ADDRESS,
      protectedData: validProtectedData.address,
      authorizedUser: consumerWallet.address, // consumer wallet
      numberOfAccess: 1000,
    });

    //create invalid protected data
    invalidProtectedData = await dataProtector.protectData({
      data: { foo: 'bar' },
      name: 'test do not use',
    });

    web3mail = new IExecWeb3mail(...getTestConfig(consumerWallet.privateKey));
    // avoid race condition with subgraph indexation
    await sleep(5_000);
  }, 4 * MAX_EXPECTED_BLOCKTIME + MAX_EXPECTED_WEB2_SERVICES_TIME + 5_000);

  it(
    'should successfully send email',
    async () => {
      const params = {
        emailSubject: 'e2e mail object for test',
        emailContent: 'e2e mail content for test',
        protectedData: validProtectedData.address,
        workerpoolAddressOrEns: workerpoolAddress,
      };

      const sendEmailResponse = await web3mail.sendEmail(params);
      expect(sendEmailResponse.taskId).toBeDefined();
    },
    2 * MAX_EXPECTED_BLOCKTIME + MAX_EXPECTED_WEB2_SERVICES_TIME
  );
  it(
    'should successfully send email with granted access to whitelist address',
    async () => {
      //create valid protected data
      const protectedDataForWhitelist = await dataProtector.protectData({
        data: { email: 'example@test.com' },
        name: 'test do not use',
      });
      //grant access to whitelist
      await dataProtector.grantAccess({
        authorizedApp: WHITELIST_SMART_CONTRACT_ADDRESS, //whitelist address
        protectedData: protectedDataForWhitelist.address,
        authorizedUser: consumerWallet.address, // consumer wallet
        numberOfAccess: 1000,
      });

      const params = {
        emailSubject: 'e2e mail object for test',
        emailContent: 'e2e mail content for test',
        protectedData: protectedDataForWhitelist.address,
        workerpoolAddressOrEns: workerpoolAddress,
      };

      const sendEmailResponse = await web3mail.sendEmail(params);
      expect(sendEmailResponse.taskId).toBeDefined();
    },
    2 * MAX_EXPECTED_BLOCKTIME + MAX_EXPECTED_WEB2_SERVICES_TIME
  );
  it(
    'should successfully send email with content type html',
    async () => {
      const params = {
        emailSubject: 'e2e mail object for test',
        emailContent:
          '<html><body><h1>Test html</h1> <p>test paragraph </p></body></html>',
        protectedData: validProtectedData.address,
        contentType: 'text/html',
        workerpoolAddressOrEns: workerpoolAddress,
      };

      const sendEmailResponse = await web3mail.sendEmail(params);
      expect(sendEmailResponse.taskId).toBeDefined();
    },
    2 * MAX_EXPECTED_BLOCKTIME + MAX_EXPECTED_WEB2_SERVICES_TIME
  );
  it(
    'should fail if the protected data is not valid',
    async () => {
      const params = {
        emailSubject: 'e2e mail object for test',
        emailContent: 'e2e mail content for test',
        protectedData: invalidProtectedData.address,
        workerpoolAddressOrEns: workerpoolAddress,
      };

      await expect(web3mail.sendEmail(params)).rejects.toThrow(
        new WorkflowError({
          message: 'Failed to sendEmail',
          errorCause: Error('ProtectedData is not valid'),
        })
      );
    },
    MAX_EXPECTED_WEB2_SERVICES_TIME
  );
  it(
    'should fail if there is no Dataset order found',
    async () => {
      //create valid protected data with blank order to not have: datasetorder is fully consumed error from iexec sdk
      const protectedData = await dataProtector.protectData({
        data: { email: 'example@test.com' },
        name: 'test do not use',
      });
      const params = {
        emailSubject: 'e2e mail object for test',
        emailContent: 'e2e mail content for test',
        protectedData: protectedData.address,
        workerpoolAddressOrEns: workerpoolAddress,
      };
      await sleep(5_000);
      await expect(web3mail.sendEmail(params)).rejects.toThrow(
        new WorkflowError({
          message: 'Failed to sendEmail',
          errorCause: Error('No Dataset order found for the desired price'),
        })
      );
    },
    2 * MAX_EXPECTED_BLOCKTIME + MAX_EXPECTED_WEB2_SERVICES_TIME + 5_000
  );
  it(
    'should successfully send email with a valid senderName',
    async () => {
      const params = {
        emailSubject: 'e2e mail object for test',
        emailContent: 'e2e mail content for test',
        protectedData: validProtectedData.address,
        senderName: 'Product Team',
        workerpoolAddressOrEns: workerpoolAddress,
      };

      const sendEmailResponse = await web3mail.sendEmail(params);
      expect(sendEmailResponse.taskId).toBeDefined();
    },
    2 * MAX_EXPECTED_BLOCKTIME + MAX_EXPECTED_WEB2_SERVICES_TIME
  );
  it(
    'should successfully send email with email content size < 512 kilo-bytes',
    async () => {
      const desiredSizeInBytes = 500000; // 500 kilo-bytes
      const characterToRepeat = 'A';
      const LARGE_CONTENT = characterToRepeat.repeat(desiredSizeInBytes);

      const params = {
        emailSubject: 'e2e mail object for test',
        emailContent: LARGE_CONTENT,
        protectedData: validProtectedData.address,
        senderName: 'Product Team',
        workerpoolAddressOrEns: workerpoolAddress,
      };

      const sendEmailResponse = await web3mail.sendEmail(params);
      expect(sendEmailResponse.taskId).toBeDefined();
    },
    2 * MAX_EXPECTED_BLOCKTIME + MAX_EXPECTED_WEB2_SERVICES_TIME
  );
  it(
    'should fail to send email with email content size > 512 kilo-bytes',
    async () => {
      const desiredSizeInBytes = 520000; // 520 kilo-bytes
      const characterToRepeat = 'A';
      const OVERSIZED_CONTENT = characterToRepeat.repeat(desiredSizeInBytes);

      const params = {
        emailSubject: 'e2e mail object for test',
        emailContent: OVERSIZED_CONTENT,
        protectedData: validProtectedData.address,
        senderName: 'Product Team',
        workerpoolAddressOrEns: workerpoolAddress,
      };
      await expect(web3mail.sendEmail(params)).rejects.toThrow(
        new WorkflowError({
          message: 'Failed to sendEmail',
          errorCause: Error('emailContent must be at most 512000 characters'),
        })
      );
    },
    MAX_EXPECTED_WEB2_SERVICES_TIME
  );
  it(
    'should fail to send email with an invalid (too short) senderName',
    async () => {
      const params = {
        emailSubject: 'e2e mail object for test',
        emailContent: 'e2e mail content for test',
        protectedData: validProtectedData.address,
        senderName: 'AB',
        workerpoolAddressOrEns: workerpoolAddress,
      };
      await expect(web3mail.sendEmail(params)).rejects.toThrow(
        new WorkflowError({
          message: 'Failed to sendEmail',
          errorCause: Error('senderName must be at least 3 characters'),
        })
      );
    },
    MAX_EXPECTED_WEB2_SERVICES_TIME
  );
  it(
    'should fail to send email with an invalid (too long) senderName',
    async () => {
      const params = {
        emailSubject: 'e2e mail object for test',
        emailContent: 'e2e mail content for test',
        protectedData: validProtectedData.address,
        senderName: 'A very long sender name',
        workerpoolAddressOrEns: workerpoolAddress,
      };
      await expect(web3mail.sendEmail(params)).rejects.toThrow(
        new WorkflowError({
          message: 'Failed to sendEmail',
          errorCause: Error('senderName must be at most 20 characters'),
        })
      );
    },
    MAX_EXPECTED_WEB2_SERVICES_TIME
  );
  it(
    'should successfully send email with a valid label',
    async () => {
      const params = {
        emailSubject: 'e2e mail object for test',
        emailContent: 'e2e mail content for test',
        protectedData: validProtectedData.address,
        label: 'ID1234678',
      };
      const sendEmailResponse = await web3mail.sendEmail(params);
      expect(sendEmailResponse.taskId).toBeDefined();
    },
    2 * MAX_EXPECTED_BLOCKTIME + MAX_EXPECTED_WEB2_SERVICES_TIME
  );
  it(
    'should fail to send email with an invalid (too long) label',
    async () => {
      const params = {
        emailSubject: 'e2e mail object for test',
        emailContent: 'e2e mail content for test',
        protectedData: validProtectedData.address,
        label: 'ID123456789',
        workerpoolAddressOrEns: workerpoolAddress,
      };
      await expect(web3mail.sendEmail(params)).rejects.toThrow(
        new WorkflowError({
          message: 'Failed to sendEmail',
          errorCause: Error('label must be at most 10 characters'),
        })
      );
    },
    MAX_EXPECTED_WEB2_SERVICES_TIME
  );
  it(
    'should fail to send email with an invalid (too short) label',
    async () => {
      const params = {
        emailSubject: 'e2e mail object for test',
        emailContent: 'e2e mail content for test',
        protectedData: validProtectedData.address,
        label: 'ID',
        workerpoolAddressOrEns: workerpoolAddress,
      };
      await expect(web3mail.sendEmail(params)).rejects.toThrow(
        new WorkflowError({
          message: 'Failed to sendEmail',
          errorCause: Error('label must be at least 3 characters'),
        })
      );
    },
    MAX_EXPECTED_WEB2_SERVICES_TIME
  );

  it(
    'should throw a protocol error',
    async () => {
      // Call getTestConfig to get the default configuration
      const [ethProvider, defaultOptions] = getTestConfig(
        providerWallet.privateKey
      );

      const options = {
        ...defaultOptions,
        iexecOptions: {
          ...defaultOptions.iexecOptions,
          iexecGatewayURL: 'https://test',
        },
      };

      // Pass the modified options to IExecWeb3mail
      const invalidWeb3mail = new IExecWeb3mail(ethProvider, options);
      let error: WorkflowError | undefined;

      try {
        await invalidWeb3mail.sendEmail({
          protectedData: validProtectedData.address,
          emailSubject: 'My email subject',
          emailContent: 'My email content',
        });
      } catch (err) {
        error = err as WorkflowError;
      }

      expect(error).toBeInstanceOf(WorkflowError);
      expect(error?.message).toBe(
        "A service in the iExec protocol appears to be unavailable. You can retry later or contact iExec's technical support for help."
      );
      expect(error?.isProtocolError).toBe(true);
    },
    2 * MAX_EXPECTED_BLOCKTIME + MAX_EXPECTED_WEB2_SERVICES_TIME
  );

  it(
    'should throw a fetchUserContacts error',
    async () => {
      // Call getTestConfig to get the default configuration
      const [ethProvider, defaultOptions] = getTestConfig(
        providerWallet.privateKey
      );

      const options = {
        ...defaultOptions,
        dataProtectorSubgraph: 'https://test',
      };

      // Pass the modified options to IExecWeb3mail
      const invalidWeb3mail = new IExecWeb3mail(ethProvider, options);
      let error: WorkflowError | undefined;

      try {
        await invalidWeb3mail.fetchMyContacts();
      } catch (err) {
        error = err as WorkflowError;
      }

      expect(error).toBeInstanceOf(WorkflowError);
      expect(error?.message).toBe('Failed to fetch user contacts');
      expect(error?.isProtocolError).toBe(false);
    },
    2 * MAX_EXPECTED_BLOCKTIME + MAX_EXPECTED_WEB2_SERVICES_TIME
  );
});
