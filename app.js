require('dotenv').config();
require('colors');

const express = require('express');
const ExpressWs = require('express-ws');
const EventEmitter = require('events');

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

// List all available transcriptions by callSid
app.get('/', (req, res) => {
  const callSids = Object.keys(transcriptions);

  res.send(`
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Available Transcriptions</title>
    </head>
    <body>
      <h1>Available Transcriptions</h1>
      <ul id="transcriptionContainer"></ul>

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
                <div>
                  <h2>Transcription for CallSid: \${callSid}</h2>
                  <ul>\${transcriptions.map(transcription => \`<li>\${transcription}</li>\`).join('')}</ul>
                </div>\`;
            } else {
              console.error('Expected array, received:', transcriptions);
              return \`<div>Error: Transcriptions for \${callSid} are not in the expected format.</div>\`;
            }
          }).join('');
        };
      </script>
    </body>
    </html>
  `);
});

// Test Endpoint to trigger a transcript update
app.get('/trigger-update', (req, res) => {
  transcriptionEmitter.emit('update', transcriptions);
  res.send('Update triggered');
});

// SSE endpoint to send updates to the client when new transcriptions are added
app.get('/transcription-updates', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  const updateTranscriptions = (data) => {
    const jsonData = JSON.stringify(data);  // Convert the object to a JSON string
    res.write(`data: ${jsonData}\n\n`);  // Send the stringified data
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

app.ws('/connection', (ws) => {
  console.log('~~~/connection -> start');
  
  try {
    ws.on('error', console.error);
    let streamSid;
    let callSid;

    const gptService = new GptService();
    const streamService = new StreamService(ws);
    const transcriptionService = new TranscriptionService();
    const ttsService = new TextToSpeechService({});
  
    let marks = [];
    let interactionCount = 0;
  
    // Incoming from MediaStream
    ws.on('message', function message(data) {
      const msg = JSON.parse(data);
      if (msg.event === 'start') {
        streamSid = msg.start.streamSid;
        callSid = msg.start.callSid;
        
        streamService.setStreamSid(streamSid);
        gptService.setCallSid(callSid);

        // Initialize transcription storage
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
        transcriptionService.send(msg.media.payload);
      } else if (msg.event === 'mark') {
        const label = msg.mark.name;
        console.log(`Twilio -> Audio completed mark (${msg.sequenceNumber}): ${label}`.red);
        marks = marks.filter(m => m !== msg.mark.name);
      } else if (msg.event === 'stop') {
        console.log(`Twilio -> Media stream ${streamSid} ended.`.underline.red);
      }
    });
  
    transcriptionService.on('utterance', async (text) => {
      // This is a bit of a hack to filter out empty utterances
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
  
    transcriptionService.on('transcription', async (text) => {
      if (!text) { return; }
      console.log(`Interaction ${interactionCount} – STT -> GPT: ${text}`.yellow);
      transcriptions[callSid].push(`Customer:  ${text}`);

      // Emit update to notify clients that a new transcription is available
      transcriptionEmitter.emit('update', transcriptions);

      gptService.completion(text, interactionCount);
      interactionCount += 1;
    });
    
    gptService.on('gptreply', async (gptReply, icount) => {
      console.log(`Interaction ${icount}: GPT -> TTS: ${gptReply.partialResponse}`.green );
      transcriptions[callSid].push(`IVR: ${gptReply.partialResponse}`);
      ttsService.generate(gptReply, icount);
    });
  
    ttsService.on('speech', (responseIndex, audio, label, icount) => {
      console.log(`Interaction ${icount}: TTS -> TWILIO: ${label}`.blue);
      streamService.buffer(responseIndex, audio);
    });
  
    streamService.on('audiosent', (markLabel) => {
      marks.push(markLabel);
    });
  } catch (err) {
    console.log(err);
  }
});

app.get('/transcription/:callSid', (req, res) => {
  const callSid = req.params.callSid;

  // Return the stored transcription
  if (transcriptions[callSid]) {
    res.json({ transcription: transcriptions[callSid] });
  } else {
    res.status(404).send('Transcription not found for this callSid');
  }
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
