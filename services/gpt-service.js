/**
 * GptService Class
 *
 * This class extends EventEmitter to handle event-driven operations while interacting with OpenAI's GPT-4 API. 
 * It is designed to facilitate a simulated sales conversation where an AI assistant helps users choose and purchase 
 * Apple AirPods. The assistant has a predefined personality and set of instructions, which guide its interactions 
 * with users.
 *
 * Key Features:
 * - Maintains a user context to track the conversation state and guide the assistant's responses.
 * - Dynamically loads and executes functions defined in a separate manifest, allowing the AI to call these functions 
 *   as part of its responses.
 * - Supports streaming responses from OpenAI, enabling real-time interaction with partial responses that can be 
 *   emitted and processed.
 * - Handles tool calls by the AI, parsing and validating function arguments before executing the relevant function.
 * - Continuously updates the conversation context with both user inputs and assistant responses to maintain a coherent 
 *   dialogue.
 * - Provides support for transferring calls, tracking specific session details (e.g., callSid), and managing multiple 
 *   interactions within a single session.
 */

require('colors'); // Import the colors package for colored console output
const EventEmitter = require('events'); // Import the EventEmitter class for handling events
const OpenAI = require('openai'); // Import the OpenAI library to interact with OpenAI's API
const tools = require('../functions/function-manifest'); // Import custom tools from the function manifest

// Import all functions included in function manifest
// Note: the function name and file name must be the same
const availableFunctions = {};
tools.forEach((tool) => {
  let functionName = tool.function.name;
  availableFunctions[functionName] = require(`../functions/${functionName}`); // Dynamically require each function
});

class GptService extends EventEmitter {
  constructor() {
    super();
    this.openai = new OpenAI(); // Initialize OpenAI instance
    // this.userContext = [
    //   { 'role': 'system', 'content': 'You are an outbound sales representative selling Apple Airpods. You have a youthful and cheery personality. Keep your responses as brief as possible but make every attempt to keep the caller on the phone without being rude. Don\'t ask more than 1 question at a time. Don\'t make assumptions about what values to plug into functions. Ask for clarification if a user request is ambiguous. Speak out all prices to include the currency. Please help them decide between the airpods, airpods pro and airpods max by asking questions like \'Do you prefer headphones that go in your ear or over the ear?\'. If they are trying to choose between the airpods and airpods pro try asking them if they need noise canceling. Once you know which model they would like ask them how many they would like to purchase and try to get them to place an order. You must add a \'•\' symbol every 5 to 10 words at natural pauses where your response can be split for text to speech.' },
    //   { 'role': 'assistant', 'content': 'Hello! I understand you\'re looking for a pair of AirPods, is that correct?' },
    // ],
    // this.partialResponseIndex = 0; 
    this.userContext = [
      { 
        'role': 'system', 
        'content': 'You are an outbound sales representative for Cigna, helping customers with health insurance plans. You have a professional yet empathetic personality. Keep your responses clear and concise, ensuring you address any concerns the customer may have. Don\'t ask more than 1 question at a time. Don\'t make assumptions about what values to plug into functions. Ask for clarification if a user request is ambiguous. Speak out all amounts and coverage details clearly, including the currency. Please help the customer decide on the best health insurance plan by asking relevant questions about their health needs and coverage preferences. Once you know their preferences, explain the plan options available and try to assist them in selecting the best option. You must add a \'•\' symbol every 5 to 10 words at natural pauses where your response can be split for text to speech.' 
      },
      { 
        'role': 'assistant', 
        'content': 'Hello, Rachel! I see that you\'ve received a quote for your health insurance plan. Is there anything you would like to discuss or any questions you have about the coverage options?' 
      },
    ],
    this.partialResponseIndex = 0; // Initialize a counter for partial responses
    
  }

  // Add the callSid to the chat context in case
  // ChatGPT decides to transfer the call.
  setCallSid(callSid) {
    this.userContext.push({ 'role': 'system', 'content': `callSid: ${callSid}` }); // Add callSid to context for potential call transfer
  }

  validateFunctionArgs(args) {
    try {
      return JSON.parse(args); // Attempt to parse arguments as JSON
    } catch (error) {
      console.log('Warning: Double function arguments returned by OpenAI:', args);
      // Handle a specific error where arguments might contain duplicated JSON data
      if (args.indexOf('{') != args.lastIndexOf('{')) {
        return JSON.parse(args.substring(args.indexOf(''), args.indexOf('}') + 1));
      }
    }
  }

  updateUserContext(name, role, text) {
    // Update the user context with the latest interaction
    if (name !== 'user') {
      this.userContext.push({ 'role': role, 'name': name, 'content': text });
    } else {
      this.userContext.push({ 'role': role, 'content': text });
    }
  }

  async completion(text, interactionCount, role = 'user', name = 'user') {
    // Update context with the latest user interaction
    this.updateUserContext(name, role, text);

    // Step 1: Send user transcription to ChatGPT
    const stream = await this.openai.chat.completions.create({
      model: 'gpt-4-1106-preview', // Specify the model version
      messages: this.userContext, // Send the current context
      tools: tools, // Include any tools that can be used
      stream: true, // Enable streaming of the response
    });

    let completeResponse = ''; // Variable to store the complete response
    let partialResponse = ''; // Variable to store partial responses for TTS
    let functionName = ''; // Store function name if GPT calls a function
    let functionArgs = ''; // Store function arguments if GPT calls a function
    let finishReason = ''; // Store the reason for the response completion

    function collectToolInformation(deltas) {
      // Function to collect tool information from the stream
      let name = deltas.tool_calls[0]?.function?.name || '';
      if (name != '') {
        functionName = name;
      }
      let args = deltas.tool_calls[0]?.function?.arguments || '';
      if (args != '') {
        // Concatenate arguments if they are streamed in chunks
        functionArgs += args;
      }
    }

    for await (const chunk of stream) {
      let content = chunk.choices[0]?.delta?.content || ''; // Get the content of the current chunk
      let deltas = chunk.choices[0].delta;
      finishReason = chunk.choices[0].finish_reason; // Check why the stream finished

      // Step 2: Check if GPT wanted to call a function
      if (deltas.tool_calls) {
        // Step 3: Collect the tokens containing function data
        collectToolInformation(deltas);
      }

      // Need to call function on behalf of ChatGPT with the arguments it parsed from the conversation
      if (finishReason === 'tool_calls') {
        // Parse JSON string of args into JSON object
        const functionToCall = availableFunctions[functionName];
        const validatedArgs = this.validateFunctionArgs(functionArgs);
        
        // Say a pre-configured message from the function manifest
        // before running the function.
        const toolData = tools.find(tool => tool.function.name === functionName);
        const say = toolData.function.say;

        this.emit('gptreply', {
          partialResponseIndex: null,
          partialResponse: say
        }, interactionCount);

        let functionResponse = await functionToCall(validatedArgs);

        // Step 4: Send the info on the function call and function response to GPT
        this.updateUserContext(functionName, 'function', functionResponse);
        
        // Call the completion function again but pass in the function response to have OpenAI generate a new assistant response
        await this.completion(functionResponse, interactionCount, 'function', functionName);
      } else {
        // We use completeResponse for userContext
        completeResponse += content;
        // We use partialResponse to provide a chunk for TTS
        partialResponse += content;
        // Emit last partial response and add complete response to userContext
        if (content.trim().slice(-1) === '•' || finishReason === 'stop') {
          const gptReply = { 
            partialResponseIndex: this.partialResponseIndex,
            partialResponse
          };

          this.emit('gptreply', gptReply, interactionCount);
          this.partialResponseIndex++;
          partialResponse = '';
        }
      }
    }
    this.userContext.push({'role': 'assistant', 'content': completeResponse}); // Update the context with the complete response
    console.log(`GPT -> user context length: ${this.userContext.length}`.green); // Log the length of the user context with green color
  }
}

module.exports = { GptService }; // Export the GptService class
