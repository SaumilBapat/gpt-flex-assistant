require('colors'); // Import the colors package for colored console output

/**
 * recordingService Function
 *
 * This function is responsible for initiating the recording of a phone call using the Twilio API. 
 * If the recording feature is enabled via an environment variable, the function will first use 
 * the TextToSpeechService to announce that the call will be recorded, and then proceed to create 
 * a recording for the specified call.
 *
 * Key Features:
 * - Checks if call recording is enabled through the `RECORDING_ENABLED` environment variable.
 * - Uses the Twilio API to start recording the call, specifically with dual-channel recording for 
 *   better audio separation.
 * - Utilizes the TextToSpeechService to generate an announcement indicating that the call will be recorded.
 * - Handles and logs errors that may occur during the process, such as API failures or other exceptions.
 *
 * @param {Object} ttsService - An instance of the TextToSpeechService class used to generate speech.
 * @param {string} callSid - The unique identifier for the Twilio call to be recorded.
 */

async function recordingService(ttsService, callSid) {
  try {
    // Check if recording is enabled via environment variable
    if (process.env.RECORDING_ENABLED === 'true') {
      // Initialize Twilio client with account SID and auth token from environment variables
      const client = require('twilio')(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
      
      // Use the TextToSpeechService to announce that the call will be recorded
      ttsService.generate({ partialResponseIndex: null, partialResponse: 'This call will be recorded.' }, 0);

      // Create a recording for the specified call with dual-channel recording
      const recording = await client.calls(callSid)
        .recordings
        .create({
          recordingChannels: 'dual' // Dual-channel recording to separate audio streams for each participant
        });
          
      console.log(`Recording Created: ${recording.sid}`.red); // Log the recording SID in red for visibility
    }
  } catch (err) {
    console.log(err); // Log any errors that occur during the process
  }
}

module.exports = { recordingService }; // Export the recordingService function
