async function findDentalCoverageOptions(functionArgs) {
  const { currentCoverageOptions } = functionArgs;
  console.log('GPT -> called findDentalCoverageOptions function');
  
  // Define potential dental coverage options
  const dentalCoverageOptions = [
    {
      optionName: 'Basic Dental Coverage',
      benefits: 'Covers preventive care, basic procedures such as fillings and simple extractions.',
      priceIncrease: 20 // Example price increase
    },
    {
      optionName: 'Comprehensive Dental Coverage',
      benefits: 'Includes basic coverage plus major procedures like crowns, bridges, and orthodontics.',
      priceIncrease: 40 // Example price increase
    },
    {
      optionName: 'Enhanced Dental & Vision Coverage',
      benefits: 'Covers comprehensive dental care and adds vision benefits including exams, glasses, and contact lenses.',
      priceIncrease: 55 // Example price increase
    }
  ];

  // Filter options based on the customer's current coverage
  const availableOptions = dentalCoverageOptions.filter(option => {
    if (currentCoverageOptions.dentalCoverage === 'Yes') {
      // If they already have dental coverage, show upgrades only
      return option.optionName !== 'Basic Dental Coverage';
    }
    // If they don't have any dental coverage, show all options
    return true;
  });

  return JSON.stringify({
    dentalOptions: availableOptions
  });
}

module.exports = findDentalCoverageOptions;
