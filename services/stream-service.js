const EventEmitter = require('events'); // Import EventEmitter for handling events
const uuid = require('uuid'); // Import uuid for generating unique identifiers

/**
 * StreamService Class
 *
 * This class extends EventEmitter to manage the buffering and streaming of audio data over a WebSocket connection. 
 * It is designed to handle out-of-order audio packets, ensuring that audio is sent in the correct sequence to a 
 * connected client. The class also manages stream identifiers and emits events when audio is successfully sent.
 *
 * Key Features:
 * - Buffers out-of-order audio packets and sends them in the correct sequence.
 * - Manages a WebSocket connection for streaming audio and other media events.
 * - Generates and sends unique markers after each audio packet to track the progress of the stream.
 * - Emits events when audio is sent, allowing for tracking and further processing of the stream.
 *
 * @param {Object} websocket - The WebSocket connection used for sending audio and media events.
 */

class StreamService extends EventEmitter {
  constructor(websocket) {
    super();
    this.ws = websocket; // Initialize WebSocket connection
    this.expectedAudioIndex = 0; // Initialize the expected index for the next audio packet
    this.audioBuffer = {}; // Buffer to store out-of-order audio packets
    this.streamSid = ''; // Stream identifier
  }

  /**
   * Sets the stream identifier for the current stream session.
   *
   * @param {string} streamSid - The unique stream identifier.
   */
  setStreamSid(streamSid) {
    this.streamSid = streamSid; // Set the streamSid for the session
  }

  /**
   * Buffers or sends audio data depending on the packet index.
   * 
   * @param {number|null} index - The index of the audio packet, or null for unindexed packets.
   * @param {string} audio - The base64-encoded audio data.
   */
  buffer(index, audio) {
    // Handle audio packets without an index (e.g., intro message)
    if (index === null) {
      this.sendAudio(audio); // Send audio immediately if no index is provided
    } else if (index === this.expectedAudioIndex) {
      // Send audio if it matches the expected index
      this.sendAudio(audio);
      this.expectedAudioIndex++;

      // Check the buffer for any out-of-order packets that can now be sent
      while (Object.prototype.hasOwnProperty.call(this.audioBuffer, this.expectedAudioIndex)) {
        const bufferedAudio = this.audioBuffer[this.expectedAudioIndex];
        this.sendAudio(bufferedAudio);
        this.expectedAudioIndex++;
      }
    } else {
      // Store the audio packet in the buffer if it arrives out of order
      this.audioBuffer[index] = audio;
    }
  }

  /**
   * Sends the audio data over the WebSocket connection and marks the event.
   *
   * @param {string} audio - The base64-encoded audio data to be sent.
   */
  sendAudio(audio) {
    // Send the audio data as a 'media' event
    this.ws.send(
      JSON.stringify({
        streamSid: this.streamSid,
        event: 'media',
        media: {
          payload: audio,
        },
      })
    );

    // Generate a unique marker label to track the audio packet
    const markLabel = uuid.v4();
    
    // Send the marker as a 'mark' event
    this.ws.send(
      JSON.stringify({
        streamSid: this.streamSid,
        event: 'mark',
        mark: {
          name: markLabel,
        },
      })
    );

    // Emit an event indicating that the audio has been sent, with the marker label
    this.emit('audiosent', markLabel);
  }
}

module.exports = { StreamService }; // Export the StreamService class
