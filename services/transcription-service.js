require('colors'); // Import the colors package for colored console output
const { createClient, LiveTranscriptionEvents } = require('@deepgram/sdk'); // Import Deepgram SDK for live transcription
const { Buffer } = require('node:buffer'); // Import Buffer for handling binary data
const EventEmitter = require('events'); // Import EventEmitter for handling events

/**
 * TranscriptionService Class
 *
 * This class extends EventEmitter to manage live transcription using the Deepgram API. 
 * It processes live audio streams, listens for transcription events, and emits transcriptions 
 * or interim results as needed. The class is designed to handle natural pauses in speech and 
 * accurately determine when to finalize and emit transcribed text.
 *
 * Key Features:
 * - Establishes a live connection to Deepgram for real-time transcription of audio streams.
 * - Handles various transcription events such as receiving final results, handling speech pauses, 
 *   and managing errors or warnings.
 * - Emits transcription results, either as finalized text or as interim utterances.
 * - Manages the buffering and processing of audio streams, ensuring accurate transcription.
 *
 * @param {Object} websocket - The WebSocket connection used for sending audio and media events.
 */

class TranscriptionService extends EventEmitter {
  constructor() {
    super();
    const deepgram = createClient(process.env.DEEPGRAM_API_KEY); // Initialize Deepgram client with API key

    // Establish a live transcription connection with specified options
    this.dgConnection = deepgram.listen.live({
      encoding: 'mulaw', // Audio encoding format
      sample_rate: '8000', // Sample rate in Hz
      model: 'nova-2', // Deepgram model for transcription
      punctuate: true, // Enable automatic punctuation
      interim_results: true, // Receive interim transcription results
      endpointing: 200, // Endpointing configuration for determining pauses
      utterance_end_ms: 1000 // Time in ms to wait for utterance end
    });

    this.finalResult = ''; // Store the final transcription result
    this.speechFinal = false; // Track if Deepgram detected a natural pause in the speaker's speech

    // Handle the opening of the Deepgram connection
    this.dgConnection.on(LiveTranscriptionEvents.Open, () => {
      // Listen for transcription events
      this.dgConnection.on(LiveTranscriptionEvents.Transcript, (transcriptionEvent) => {
        const alternatives = transcriptionEvent.channel?.alternatives; // Extract alternatives from the transcription event
        let text = '';
        if (alternatives) {
          text = alternatives[0]?.transcript; // Get the transcript text
        }
        
        // Handle the end of an utterance if speechFinal has not been triggered
        if (transcriptionEvent.type === 'UtteranceEnd') {
          if (!this.speechFinal) {
            console.log(`UtteranceEnd received before speechFinal, emit the text collected so far: ${this.finalResult}`.yellow);
            this.emit('transcription', this.finalResult); // Emit the final result if speechFinal hasn't been reached
            return;
          } else {
            console.log('STT -> Speech was already final when UtteranceEnd received'.yellow);
            return;
          }
        }
    
        // Process the transcription if it is final and has meaningful content
        if (transcriptionEvent.is_final === true && text.trim().length > 0) {
          this.finalResult += ` ${text}`; // Append the text to the final result
          if (transcriptionEvent.speech_final === true) {
            // Handle a natural pause in speech
            this.speechFinal = true; // Prevents emitting multiple times after speechFinal
            this.emit('transcription', this.finalResult); // Emit the final transcription result
            this.finalResult = ''; // Reset the final result buffer
          } else {
            // Reset speechFinal if the transcription is not final
            this.speechFinal = false;
          }
        } else {
          this.emit('utterance', text); // Emit the interim text as an utterance
        }
      });

      // Handle Deepgram errors
      this.dgConnection.on(LiveTranscriptionEvents.Error, (error) => {
        console.error('STT -> Deepgram error');
        console.error(error);
      });

      // Handle Deepgram warnings
      this.dgConnection.on(LiveTranscriptionEvents.Warning, (warning) => {
        console.error('STT -> Deepgram warning');
        console.error(warning);
      });

      // Handle Deepgram metadata events
      this.dgConnection.on(LiveTranscriptionEvents.Metadata, (metadata) => {
        console.error('STT -> Deepgram metadata');
        console.error(metadata);
      });

      // Handle the closing of the Deepgram connection
      this.dgConnection.on(LiveTranscriptionEvents.Close, () => {
        console.log('STT -> Deepgram connection closed'.yellow);
      });
    });
  }

  /**
   * Send the payload to Deepgram for transcription.
   *
   * @param {String} payload - A base64-encoded MULAW/8000 audio stream.
   */
  send(payload) {
    // Ensure the connection is open before sending the audio payload
    if (this.dgConnection.getReadyState() === 1) {
      this.dgConnection.send(Buffer.from(payload, 'base64')); // Send the audio payload as a Buffer
    }
  }
}

module.exports = { TranscriptionService }; // Export the TranscriptionService class
