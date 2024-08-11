const tools = [
  /*{
    type: 'function',
    function: {
      name: 'checkInventory',
      say: 'Let me check our inventory right now.',
      description: 'Check the inventory of AirPods, AirPods Pro, or AirPods Max.',
      parameters: {
        type: 'object',
        properties: {
          model: {
            type: 'string',
            'enum': ['airpods', 'airpods pro', 'airpods max'],
            description: 'The model of AirPods, either the AirPods, AirPods Pro, or AirPods Max',
          },
        },
        required: ['model'],
      },
      returns: {
        type: 'object',
        properties: {
          stock: {
            type: 'integer',
            description: 'An integer containing how many of the model are currently in stock.'
          }
        }
      }
    },
  },
  {
    type: 'function',
    function: {
      name: 'checkPrice',
      say: 'Let me check the price, one moment.',
      description: 'Check the price of a given model of AirPods, AirPods Pro, or AirPods Max.',
      parameters: {
        type: 'object',
        properties: {
          model: {
            type: 'string',
            'enum': ['airpods', 'airpods pro', 'airpods max'],
            description: 'The model of AirPods, either the AirPods, AirPods Pro, or AirPods Max',
          },
        },
        required: ['model'],
      },
      returns: {
        type: 'object',
        properties: {
          price: {
            type: 'integer',
            description: 'The price of the model'
          }
        }
      }
    },
  },
  {
    type: 'function',
    function: {
      name: 'placeOrder',
      say: 'All right, I\'m just going to ring that up in our system.',
      description: 'Places an order for a set of AirPods.',
      parameters: {
        type: 'object',
        properties: {
          model: {
            type: 'string',
            'enum': ['airpods', 'airpods pro'],
            description: 'The model of AirPods, either the regular or Pro',
          },
          quantity: {
            type: 'integer',
            description: 'The number of AirPods they want to order',
          },
        },
        required: ['model', 'quantity'],
      },
      returns: {
        type: 'object',
        properties: {
          price: {
            type: 'integer',
            description: 'The total price of the order including tax'
          },
          orderNumber: {
            type: 'integer',
            description: 'The order number associated with the order.'
          }
        }
      }
    },
  }, */
  {
    type: 'function',
    function: {
      name: 'transferCall',
      say: 'One moment while I transfer your call.',
      description: 'Transfers the customer to a live agent in case they request help from a real person.',
      parameters: {
        type: 'object',
        properties: {
          callSid: {
            type: 'string',
            description: 'The unique identifier for the active phone call.',
          },
        },
        required: ['callSid'],
      },
      returns: {
        type: 'object',
        properties: {
          status: {
            type: 'string',
            description: 'Whether or not the customer call was successfully transferred'
          },
        }
      }
    },
  },
  {
    type: 'function',
    function: {
      name: 'updateInsuranceQuote',
      say: 'Let me update your insurance quote based on your selected dental coverage.',
      description: 'Updates the customer\'s insurance quote by adding either basic or comprehensive dental coverage and calculating the updated monthly premium.',
      parameters: {
        type: 'object',
        properties: {
          dentalCoverageType: {
            type: 'string',
            enum: ['basic', 'comprehensive'],
            description: 'The type of dental coverage to add to the insurance quote.',
          },
        },
        required: ['dentalCoverageType'],
      },
      returns: {
        type: 'object',
        properties: {
          updatedMonthlyPremium: {
            type: 'number',
            description: 'The updated monthly premium including the selected dental coverage and applicable tax.'
          }
        }
      }
    },
  }
];

module.exports = tools;
