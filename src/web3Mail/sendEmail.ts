import { IExecConsumer, SendEmailParams, SendEmailResponse } from './types.js';
import {
  WEB3_MAIL_DAPP_ADDRESS,
  WORKERPOOL_ADDRESS,
} from '../config/config.js';
import { WorkflowError } from '../utils/errors.js';
import {
  addressOrEnsSchema,
  emailSubjectSchema,
  throwIfMissing,
} from '../utils/validators.js';
import { generateSecureUniqueId } from '../utils/generateUniqueId.js';
const sendEmail = async ({
  iexec = throwIfMissing(),
  emailSubject,
  emailContent,
  protectedData,
}: IExecConsumer & SendEmailParams): Promise<SendEmailResponse> => {
  try {
    const vDatasetAddress = addressOrEnsSchema()
      .required()
      .label('protectedData')
      .validateSync(protectedData);
    const vEmailSubject = emailSubjectSchema()
      .required()
      .label('emailSubject')
      .validateSync(emailSubject);
    const vEmailContent = emailSubjectSchema()
      .required()
      .label('emailContent')
      .validateSync(emailContent);

    // TODO: check the protectedData implements the schema `{email: "string"}`

    const requesterAddress = await iexec.wallet.getAddress();
    // Initialize IPFS storage if not already initialized
    const isIpfsStorageInitialized =
      await iexec.storage.checkStorageTokenExists(requesterAddress);
    if (!isIpfsStorageInitialized) {
      const token = await iexec.storage.defaultStorageLogin();
      await iexec.storage.pushStorageToken(token);
    }
    // Fetch dataset order
    const datasetOrderbook = await iexec.orderbook.fetchDatasetOrderbook(
      vDatasetAddress,
      {
        app: WEB3_MAIL_DAPP_ADDRESS,
        requester: requesterAddress,
      }
    );
    const datasetorder = datasetOrderbook?.orders[0]?.order;
    if (!datasetorder) {
      throw new Error('Dataset order not found');
    }
    // Fetch app order
    const appOrderbook = await iexec.orderbook.fetchAppOrderbook(
      WEB3_MAIL_DAPP_ADDRESS,
      {
        minTag: ['tee', 'scone'],
        maxTag: ['tee', 'scone'],
        workerpool: WORKERPOOL_ADDRESS,
      }
    );
    const apporder = appOrderbook?.orders[0]?.order;
    if (!apporder) {
      throw new Error('App order not found');
    }
    // Fetch workerpool order
    const workerpoolOrderbook = await iexec.orderbook.fetchWorkerpoolOrderbook({
      workerpool: WORKERPOOL_ADDRESS,
      app: WEB3_MAIL_DAPP_ADDRESS,
      dataset: vDatasetAddress,
      minTag: ['tee', 'scone'],
      maxTag: ['tee', 'scone'],
      category: 0,
    });
    const workerpoolorder = workerpoolOrderbook?.orders[0]?.order;
    if (!workerpoolorder) {
      throw new Error('Workerpool order not found');
    }
    // Push requester secrets
    const emailSubjectId = generateSecureUniqueId(16);
    const emailContentId = generateSecureUniqueId(16);
    await iexec.secrets.pushRequesterSecret(emailSubjectId, vEmailSubject);
    await iexec.secrets.pushRequesterSecret(emailContentId, vEmailContent);
    // Create and sign request order
    const requestorderToSign = await iexec.order.createRequestorder({
      app: WEB3_MAIL_DAPP_ADDRESS,
      category: workerpoolorder.category,
      dataset: vDatasetAddress,
      appmaxprice: apporder.appprice,
      workerpoolmaxprice: workerpoolorder.workerpoolprice,
      tag: ['tee', 'scone'],
      workerpool: WORKERPOOL_ADDRESS,
      params: {
        iexec_developer_logger: true,
        iexec_secrets: {
          1: emailSubjectId,
          2: emailContentId,
        },
      },
    });
    const requestorder = await iexec.order.signRequestorder(requestorderToSign);
    // Match orders and compute task ID
    const { dealid } = await iexec.order.matchOrders({
      apporder,
      datasetorder,
      workerpoolorder,
      requestorder,
    });
    const taskId = await iexec.deal.computeTaskId(dealid, 0);

    return {
      taskId,
    };
  } catch (error) {
    throw new WorkflowError(`${error.message}`, error);
  }
};

export default sendEmail;
