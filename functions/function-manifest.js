const tools = [
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
      name: 'addDentalInsurance',
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
  },
  {
    type: 'function',
    function: {
      name: 'findDentalCoverageOptions',
      say: 'Let me find the dental coverage options available to you.',
      description: 'Provides a list of dental coverage options along with associated benefits and price increases.',
      parameters: {
        type: 'object',
        properties: {
          currentCoverageOptions: {
            type: 'object',
            properties: {
              planType: {
                type: 'string',
                description: 'The type of insurance plan, such as PPO or HMO.',
              },
              dentalCoverage: {
                type: 'string',
                description: 'Indicates if the current plan includes dental coverage (Yes/No).',
              }
            },
            required: ['planType', 'dentalCoverage'],
          }
        },
        required: ['currentCoverageOptions'],
      },
      returns: {
        type: 'object',
        properties: {
          dentalOptions: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                optionName: {
                  type: 'string',
                  description: 'The name of the dental coverage option.',
                },
                benefits: {
                  type: 'string',
                  description: 'A brief description of the benefits provided by this dental coverage option.',
                },
                priceIncrease: {
                  type: 'number',
                  description: 'The increase in monthly premium if this dental coverage is selected.',
                }
              }
            }
          }
        }
      }
    },
  }
];

module.exports = tools;
