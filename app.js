require('dotenv').config(); // Load environment variables from a .env file
require('colors'); // Import the colors package for colored console output

const express = require('express'); // Import Express for handling HTTP requests
const ExpressWs = require('express-ws'); // Import Express WebSocket for handling WebSocket connections
const EventEmitter = require('events'); // Import EventEmitter for handling events

const { GptService } = require('./services/gpt-service');
const { StreamService } = require('./services/stream-service');
const { TranscriptionService } = require('./services/transcription-service');
const { TextToSpeechService } = require('./services/tts-service');
const { recordingService } = require('./services/recording-service');

const VoiceResponse = require('twilio').twiml.VoiceResponse;

const app = express();
ExpressWs(app);

const PORT = process.env.PORT || 3000;

// In-memory store for transcriptions
const transcriptions = {}; // Stores transcriptions by callSid
const transcriptionEmitter = new EventEmitter(); // Emits events when a transcription is added

/**
 * Main Server Application
 *
 * This script sets up an Express server with WebSocket support, designed to manage live voice interactions using Twilio, Deepgram, and GPT-4. It handles incoming voice calls, streams audio data, transcribes it, processes it with GPT-4, and converts responses back to speech.
 *
 * Key Features:
 * - Handles incoming voice calls via Twilio, connecting them to a WebSocket stream.
 * - Utilizes Deepgram for live transcription of the audio stream.
 * - Uses GPT-4 to generate responses based on the transcribed text.
 * - Converts GPT-4 responses into speech using a TTS service.
 * - Streams the audio back to Twilio for playback to the caller.
 * - Stores and provides access to the full transcription of the call for later retrieval.
 */

// Route to list all available transcriptions by callSid
app.get('/', (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html lang="en">

    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Available Transcriptions</title>
      <link href="https://cdnjs.cloudflare.com/ajax/libs/salesforce-lightning-design-system/2.15.4/styles/salesforce-lightning-design-system.min.css" rel="stylesheet">
      <style>
        body {
          font-family: "Salesforce Sans", Arial, sans-serif;
          margin: 0;
          padding: 1rem;
          background-color: #f4f6f9;
        }

        h1 {
          font-size: 1.5rem;
          margin-bottom: 1rem;
        }

        h2 {
          font-size: 1.25rem;
          margin-bottom: 0.5rem;
        }

        .slds-card {
          background: #ffffff;
          border: 1px solid #dddbda;
          border-radius: 0.25rem;
          box-shadow: 0 2px 2px 0 rgba(0, 0, 0, 0.16);
          margin-bottom: 1rem;
          padding: 1rem;
        }

        .slds-card__header {
          border-bottom: 1px solid #dddbda;
          margin-bottom: 1rem;
          padding-bottom: 0.5rem;
        }

        .slds-card__body {
          padding: 0.5rem;
        }

        ul {
          list-style-type: none;
          padding-left: 0;
        }

        li {
          padding: 0.25rem 0;
        }

        li:not(:last-child) {
          border-bottom: 1px solid #dddbda;
        }

        .slds-text-heading_medium {
          font-size: 1rem;
          margin-bottom: 0.5rem;
        }

        .slds-text-body_regular {
          font-size: 0.875rem;
        }

        .customer-text {
          color: red;
        }

        .ivr-text {
          color: blue;
        }
      </style>
    </head>

    <body>
      <div id="transcriptionContainer" class="slds-grid slds-wrap"></div>

      <script>
        const source = new EventSource('/transcription-updates');
        const transcriptionContainer = document.getElementById('transcriptionContainer');

        source.onmessage = function(event) {
          const data = JSON.parse(event.data);
          console.log('Received data:', data);

          transcriptionContainer.innerHTML = '';

          transcriptionContainer.innerHTML = Object.keys(data).map(callSid => {
            const transcriptions = data[callSid];
            if (Array.isArray(transcriptions)) {
              return \`
              <div class="slds-card slds-size_1-of-1 slds-medium-size_1-of-2">
                <div class="slds-card__body">
                  <ul>\${transcriptions.map(transcription => {
                    if (transcription.startsWith('Customer:')) {
                      return \`<li class="slds-text-body_regular customer-text">\${transcription}</li>\`;
                    } else if (transcription.startsWith('IVR:')) {
                      return \`<li class="slds-text-body_regular ivr-text">\${transcription}</li>\`;
                    } else {
                      return \`<li class="slds-text-body_regular">\${transcription}</li>\`;
                    }
                  }).join('')}</ul>
                </div>
              </div>\`;
            } else {
              console.error('Expected array, received:', transcriptions);
              return \`<div class="slds-card"><div class="slds-card__body">Error: Transcriptions for \${callSid} are not in the expected format.</div></div>\`;
            }
          }).join('');
        };
      </script>
    </body>

    </html>
  `);
});


// Test endpoint to trigger a transcription update event
app.get('/trigger-update', (req, res) => {
  transcriptionEmitter.emit('update', transcriptions);
  res.send('Update triggered');
});

// SSE (Server-Sent Events) endpoint to send transcription updates to the client
app.get('/transcription-updates', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  const updateTranscriptions = (data) => {
    const jsonData = JSON.stringify(data); // Convert the object to a JSON string
    res.write(`data: ${jsonData}\n\n`); // Send the stringified data
  };

  // Send the initial state of transcriptions
  updateTranscriptions(transcriptions);

  // Listen for updates and send them to the client
  transcriptionEmitter.on('update', updateTranscriptions);

  // Cleanup when the client disconnects
  req.on('close', () => {
    transcriptionEmitter.removeListener('update', updateTranscriptions);
  });
});

// Twilio webhook endpoint to handle incoming calls
app.post('/incoming', (req, res) => {
  try {
    const response = new VoiceResponse();
    const connect = response.connect();
    connect.stream({ url: `wss://${process.env.SERVER}/connection` });
    console.log('~~~/incoming ->' + `wss://${process.env.SERVER}/connection`);
    res.type('text/xml');
    res.end(response.toString());
  } catch (err) {
    console.log(err);
  }
});

// WebSocket endpoint to handle live audio streaming
app.ws('/connection', (ws) => {
  console.log('~~~/connection -> start');
  
  try {
    ws.on('error', console.error);
    let streamSid;
    let callSid;

    const gptService = new GptService(); // Initialize GPT service
    const streamService = new StreamService(ws); // Initialize stream service
    const transcriptionService = new TranscriptionService(); // Initialize transcription service
    const ttsService = new TextToSpeechService({}); // Initialize TTS service
  
    let marks = []; // Array to track marks in the audio stream
    let interactionCount = 0; // Counter for tracking interactions
  
    // Handle incoming WebSocket messages
    ws.on('message', function message(data) {
      const msg = JSON.parse(data);
      if (msg.event === 'start') {
        streamSid = msg.start.streamSid;
        callSid = msg.start.callSid;
        
        streamService.setStreamSid(streamSid);
        gptService.setCallSid(callSid);

        // Initialize transcription storage for the callSid
        if (!transcriptions[callSid]) {
          transcriptions[callSid] = [];
        }

        // Emit initial update to notify clients that a new transcription is available
        transcriptionEmitter.emit('update', transcriptions);

        // Set RECORDING_ENABLED='true' in .env to record calls
        recordingService(ttsService, callSid).then(() => {
          console.log(`Twilio -> Starting Media Stream for ${streamSid}`.underline.red);
          ttsService.generate({partialResponseIndex: null, partialResponse: 'Hello! I understand you\'re looking for a pair of AirPods, is that correct?'}, 0);
        });
      } else if (msg.event === 'media') {
        // Send audio payload for transcription
        transcriptionService.send(msg.media.payload);
      } else if (msg.event === 'mark') {
        const label = msg.mark.name;
        console.log(`Twilio -> Audio completed mark (${msg.sequenceNumber}): ${label}`.red);
        marks = marks.filter(m => m !== msg.mark.name);
      } else if (msg.event === 'stop') {
        console.log(`Twilio -> Media stream ${streamSid} ended.`.underline.red);
      }
    });
  
    // Handle transcription utterance events
    transcriptionService.on('utterance', async (text) => {
      // Filter out empty utterances and handle interruptions
      if (marks.length > 0 && text?.length > 5) {
        console.log('Twilio -> Interruption, Clearing stream'.red);
        ws.send(
          JSON.stringify({
            streamSid,
            event: 'clear',
          })
        );
      }
    });
  
    // Handle final transcription events
    transcriptionService.on('transcription', async (text) => {
      if (!text) { return; }
      console.log(`Interaction ${interactionCount} – STT -> GPT: ${text}`.yellow);
      transcriptions[callSid].push(`Customer:  ${text}`);

      // Emit update to notify clients that a new transcription is available
      transcriptionEmitter.emit('update', transcriptions);

      gptService.completion(text, interactionCount);
      interactionCount += 1;
    });
    
    // Handle GPT reply events
    gptService.on('gptreply', async (gptReply, icount) => {
      console.log(`Interaction ${icount}: GPT -> TTS: ${gptReply.partialResponse}`.green );
      transcriptions[callSid].push(`IVR: ${gptReply.partialResponse}`);
      ttsService.generate(gptReply, icount);
    });
  
    // Handle TTS speech events
    ttsService.on('speech', (responseIndex, audio, label, icount) => {
      console.log(`Interaction ${icount}: TTS -> TWILIO: ${label}`.blue);
      streamService.buffer(responseIndex, audio);
    });
  
    // Handle audio sent events
    streamService.on('audiosent', (markLabel) => {
      marks.push(markLabel);
    });
  } catch (err) {
    console.log(err);
  }
});

// Endpoint to retrieve a specific transcription by callSid
app.get('/transcription/:callSid', (req, res) => {
  const callSid = req.params.callSid;

  // Return the stored transcription for the given callSid
  if (transcriptions[callSid]) {
    res.json({ transcription: transcriptions[callSid] });
  } else {
    res.status(404).send('Transcription not found for this callSid');
  }
});

// Start the server on the specified port
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
