const { promises: fs } = require('fs');
const {
  IExecDataProtectorDeserializer,
} = require('@iexec/dataprotector-deserializer');
const sendEmail = require('./emailService');
const {
  validateWorkerEnv,
  validateAppSecret,
  validateRequesterSecret,
  validateProtectedData,
} = require('./validation');
const {
  downloadEncryptedContent,
  decryptContent,
} = require('./decryptEmailContent');
const { validateEmailAddress } = require('./validateEmailAddress');

async function writeTaskOutput(path, message) {
  try {
    await fs.writeFile(path, message);
    console.log(`File successfully written at path: ${path}`);
  } catch {
    console.error(`Failed to write Task Output`);
    process.exit(1);
  }
}

async function start() {
  const { IEXEC_OUT, IEXEC_APP_DEVELOPER_SECRET, IEXEC_REQUESTER_SECRET_1 } =
    process.env;

  // Check worker env
  const workerEnv = validateWorkerEnv({ IEXEC_OUT });

  // Parse the app developer secret environment variable
  let appDeveloperSecret;
  try {
    appDeveloperSecret = JSON.parse(IEXEC_APP_DEVELOPER_SECRET);
  } catch {
    throw Error('Failed to parse the developer secret');
  }
  appDeveloperSecret = validateAppSecret(appDeveloperSecret);

  // Parse the requester secret environment variable
  let requesterSecret;
  try {
    requesterSecret = IEXEC_REQUESTER_SECRET_1
      ? JSON.parse(IEXEC_REQUESTER_SECRET_1)
      : {};
  } catch {
    throw Error('Failed to parse requester secret');
  }
  requesterSecret = validateRequesterSecret(requesterSecret);

  // Get the secret email address from the protected data
  let protectedData;
  try {
    const deserializer = new IExecDataProtectorDeserializer();
    protectedData = {
      email: await deserializer.getValue('email', 'string'),
    };
  } catch (e) {
    throw Error(`Failed to parse ProtectedData: ${e.message}`);
  }

  // 1- Validate email address syntax (Joi regexp)
  validateProtectedData(protectedData);

  // 2- Third-party validation service (Mailgun)
  const { isEmailAddressValid, result } = await validateEmailAddress({
    emailAddress: protectedData.email,
    mailgunApiKey: appDeveloperSecret.MAILGUN_APIKEY,
  });

  if (isEmailAddressValid === false) {
    await writeTaskOutput(
      `${workerEnv.IEXEC_OUT}/result.txt`,
      JSON.stringify(
        {
          message:
            'The protected email address seems to be invalid. See task logs for more information.',
          ...result,
          // Don't include email address
          address: undefined,
        },
        null,
        2
      )
    );
    await writeTaskOutput(
      `${workerEnv.IEXEC_OUT}/computed.json`,
      JSON.stringify({
        'deterministic-output-path': `${workerEnv.IEXEC_OUT}/result.txt`,
      })
    );
    return;
  }

  const encryptedEmailContent = await downloadEncryptedContent(
    requesterSecret.emailContentMultiAddr
  );
  const requesterEmailContent = decryptContent(
    encryptedEmailContent,
    requesterSecret.emailContentEncryptionKey
  );

  const response = await sendEmail({
    // from protected data
    email: protectedData.email,
    // from app developer secrets
    mailJetApiKeyPublic: appDeveloperSecret.MJ_APIKEY_PUBLIC,
    mailJetApiKeyPrivate: appDeveloperSecret.MJ_APIKEY_PRIVATE,
    mailJetSender: appDeveloperSecret.MJ_SENDER,
    mailgunApiKey: appDeveloperSecret.MAILGUN_APIKEY,
    // from requester secret
    emailContent: requesterEmailContent,
    emailSubject: requesterSecret.emailSubject,
    contentType: requesterSecret.contentType,
    senderName: requesterSecret.senderName,
  });

  await writeTaskOutput(
    `${workerEnv.IEXEC_OUT}/result.txt`,
    JSON.stringify(response, null, 2)
  );
  await writeTaskOutput(
    `${workerEnv.IEXEC_OUT}/computed.json`,
    JSON.stringify({
      'deterministic-output-path': `${workerEnv.IEXEC_OUT}/result.txt`,
    })
  );
}

module.exports = start;
