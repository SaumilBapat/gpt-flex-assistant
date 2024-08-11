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
          url: `https://handler.twilio.com/twiml/EH48e1e4cb7110c75c91cb317bf904aa41`, // Replace with your TwiML URL that handles the payment process
          method: 'POST'
        })
        .then(call => console.log(`Call SID: ${call.sid} successfully forwarded to payment gateway.`))
        .catch(error => console.error(`Failed to forward call SID: ${callSid} - ${error.message}`));
    }

    console.log('All calls have been processed.');
  } catch (error) {
    console.error(`Failed to forward calls: ${error.message}`);
  }
}

forwardToPaymentGateway();
