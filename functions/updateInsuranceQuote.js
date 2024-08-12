async function updateInsuranceQuote(functionArgs) {
  const {dentalCoverageType } = functionArgs;
  console.log('GPT -> called updateInsuranceQuote function');
  
  // Set base monthly premium (example value)
  const basePremium = 354;

  // Set monthly premiums for different dental coverage types
  const basicDentalPremium = 20; // Monthly premium for basic dental coverage
  const comprehensiveDentalPremium = 40; // Monthly premium for comprehensive dental coverage
  
  // Calculate the updated monthly premium based on the type of dental coverage
  let updatedMonthlyPremium = basePremium;

  if (dentalCoverageType === 'basic') {
    updatedMonthlyPremium += basicDentalPremium;
  } else if (dentalCoverageType === 'comprehensive') {
    updatedMonthlyPremium += comprehensiveDentalPremium;
  }
  
  return JSON.stringify({ 
    updatedMonthlyPremium: Math.floor(updatedMonthlyPremium) // Applying 7.9% tax 
  });
}

module.exports = updateInsuranceQuote;
