// fetch is not included in node 14
const fetch = require('node-fetch');

/**
 * Mailgun answer should look like this:
 *   {
 *     "address": "foo@mailgun.net",
 *     "is_disposable_address": false,
 *     "is_role_address": false,
 *     "reason": [],
 *     "result": "deliverable",
 *     "risk": "low"
 *   }
 */
async function validateEmailAddress({ emailAddress, mailgunApiKey }) {
  // https://documentation.mailgun.com/docs/inboxready/mailgun-validate/single-valid-ir/#single-validation
  const basicAuth = Buffer.from(`api:${mailgunApiKey}`).toString('base64');
  const response = await fetch(
    `https://api.mailgun.net/v4/address/validate?address=${encodeURIComponent(
      emailAddress
    )}`,
    {
      method: 'GET',
      headers: {
        Authorization: `Basic ${basicAuth}`,
      },
    }
  );

  if (!response.ok) {
    // Mailgun API down? Prefer not to throw
    console.warn("Oops, can't reach mailgun validation API");
    const notOkResponse = await response.json();
    console.warn(notOkResponse);
    return { isEmailAddressValid: null };
  }

  const emailAddressSeemsLegit = await response.json();

  if (emailAddressSeemsLegit.result !== 'deliverable') {
    console.error('The protected email address seems to be invalid.', {
      ...emailAddressSeemsLegit,
      // Don't log email address
      address: undefined,
    });
    return { isEmailAddressValid: false, result: emailAddressSeemsLegit };
  }

  return { isEmailAddressValid: true };
}

module.exports = {
  validateEmailAddress,
};
