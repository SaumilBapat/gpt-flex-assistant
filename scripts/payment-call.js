require('dotenv').config();
const twilio = require('twilio');

async function forwardToPaymentGateway() {
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const client = twilio(accountSid, authToken);

  try {
    // Fetch active calls
    const calls = await client.calls.list({ status: 'in-progress', limit: 100 }); // Increase limit if needed

    if (calls.length === 0) {
      console.log('No active calls found.');
      return;
    }

    console.log(`Found ${calls.length} active calls.`);

    // Iterate over each active call
    for (const call of calls) {
      const callSid = call.sid;
      console.log(`Forwarding call SID: ${callSid} to the payment gateway...`);

      // Update the call to forward it to the payment gateway
      await client.calls(callSid)
        .update({
          twiml: `<Response><Dial timeout="20">${process.env.PAYMENT_NUMBER}</Dial><Pause length="5"/></Response>`, // Corrected the twiml attribute
          method: 'POST'
        })
        .then(() => {
          console.log(`Call SID: ${callSid} successfully forwarded to payment gateway.`);
        })
        .catch(error => {
          console.error(`Failed to forward call SID: ${callSid} - ${error.message}`);
        });
    }

    console.log('All calls have been processed.');
  } catch (error) {
    console.error(`Failed to forward calls: ${error.message}`);
  }
}

forwardToPaymentGateway();
