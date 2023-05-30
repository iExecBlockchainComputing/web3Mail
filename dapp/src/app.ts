import fs from 'fs/promises';
import { sendEmail } from './emailService';
import { validateInputs } from './validateInputs';
import { extractEmailFromZipFile } from './extractEmailFromZipFile';

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
  try {
    // Parse the developer secret environment variable
    let developerSecret;
    try {
      developerSecret = JSON.parse(process.env.IEXEC_APP_DEVELOPER_SECRET);
    } catch {
      console.error('Failed to parse the developer secret');
      process.exit(1);
    }
    const unsafeEnvVars = {
      iexecIn: process.env.IEXEC_IN,
      iexecOut: process.env.IEXEC_OUT,
      dataFileName: process.env.IEXEC_DATASET_FILENAME,
      mailJetApiKeyPublic: developerSecret.MJ_APIKEY_PUBLIC,
      mailJetApiKeyPrivate: developerSecret.MJ_APIKEY_PRIVATE,
      mailJetSender: developerSecret.MJ_SENDER,
      mailObject: process.env.IEXEC_REQUESTER_SECRET_1,
      mailContent: process.env.IEXEC_REQUESTER_SECRET_2,
    };
    const envVars = validateInputs(unsafeEnvVars);
    const email = await extractEmailFromZipFile(
      `${envVars.iexecIn}/${envVars.dataFileName}`
    );
    if (!email) {
      throw new Error('Missing email in protectedData');
    }
    const response = await sendEmail({
      email,
      mailJetApiKeyPublic: envVars.mailJetApiKeyPublic,
      mailJetApiKeyPrivate: envVars.mailJetApiKeyPrivate,
      mailObject: envVars.mailObject,
      mailContent: envVars.mailContent,
      mailJetSender: envVars.mailJetSender,
    });

    await writeTaskOutput(
      `${envVars.iexecOut}/result.txt`,
      JSON.stringify(response, null, 2)
    );
    await writeTaskOutput(
      `${envVars.iexecOut}/computed.json`,
      JSON.stringify({
        'deterministic-output-path': `${envVars.iexecOut}/result.txt`,
      })
    );
  } catch (error) {
    console.error(`Error: ${error.message}`);
    process.exit(1);
  }
}
