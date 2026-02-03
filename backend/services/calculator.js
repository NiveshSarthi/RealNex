class CalculatorService {
  // EMI Calculator
  calculateEMI(principal, annualInterestRate, tenureYears) {
    const monthlyRate = annualInterestRate / 12 / 100;
    const numberOfPayments = tenureYears * 12;

    if (monthlyRate === 0) {
      return {
        monthlyEMI: principal / numberOfPayments,
        totalAmount: principal,
        totalInterest: 0
      };
    }

    const emi = principal * monthlyRate * Math.pow(1 + monthlyRate, numberOfPayments) /
                (Math.pow(1 + monthlyRate, numberOfPayments) - 1);

    const totalAmount = emi * numberOfPayments;
    const totalInterest = totalAmount - principal;

    return {
      monthlyEMI: Math.round(emi),
      totalAmount: Math.round(totalAmount),
      totalInterest: Math.round(totalInterest),
      principal: principal,
      interestRate: annualInterestRate,
      tenureYears: tenureYears,
      numberOfPayments: numberOfPayments
    };
  }

  // EMI Calculator with down payment
  calculateEMIWithDownPayment(propertyPrice, downPaymentPercent, annualInterestRate, tenureYears) {
    const downPayment = (propertyPrice * downPaymentPercent) / 100;
    const loanAmount = propertyPrice - downPayment;

    const emiResult = this.calculateEMI(loanAmount, annualInterestRate, tenureYears);

    return {
      ...emiResult,
      propertyPrice: propertyPrice,
      downPayment: downPayment,
      downPaymentPercent: downPaymentPercent,
      loanAmount: loanAmount
    };
  }

  // Affordability Calculator
  calculateAffordability(monthlyIncome, existingEMIs, otherObligations, preferredEMIIncomePercent = 40) {
    const totalMonthlyObligations = existingEMIs + otherObligations;
    const availableForEMI = (monthlyIncome * preferredEMIIncomePercent) / 100;
    const maxEMI = availableForEMI - totalMonthlyObligations;

    // Assuming 8.5% interest and 20 year tenure
    const maxLoanAmount = this.getLoanAmountFromEMI(maxEMI, 8.5, 20);

    // Assuming 20% down payment
    const maxPropertyValue = maxLoanAmount / 0.8;

    return {
      monthlyIncome: monthlyIncome,
      existingEMIs: existingEMIs,
      otherObligations: otherObligations,
      totalMonthlyObligations: totalMonthlyObligations,
      availableForEMI: availableForEMI,
      maxMonthlyEMI: Math.max(0, maxEMI),
      maxLoanAmount: Math.max(0, maxLoanAmount),
      maxPropertyValue: Math.max(0, maxPropertyValue),
      recommendedDownPayment: maxPropertyValue * 0.2,
      assumptions: {
        interestRate: 8.5,
        tenureYears: 20,
        downPaymentPercent: 20,
        emiIncomePercent: preferredEMIIncomePercent
      }
    };
  }

  // Get loan amount from EMI
  getLoanAmountFromEMI(monthlyEMI, annualInterestRate, tenureYears) {
    if (monthlyEMI <= 0) return 0;

    const monthlyRate = annualInterestRate / 12 / 100;
    const numberOfPayments = tenureYears * 12;

    if (monthlyRate === 0) {
      return monthlyEMI * numberOfPayments;
    }

    const loanAmount = monthlyEMI * (Math.pow(1 + monthlyRate, numberOfPayments) - 1) /
                      (monthlyRate * Math.pow(1 + monthlyRate, numberOfPayments));

    return Math.round(loanAmount);
  }

  // Property Valuation Calculator (Basic)
  calculatePropertyValuation(propertySpecs, locationFactors, marketData) {
    const { type, areaSqft, bedrooms, bathrooms, age, floor, totalFloors } = propertySpecs;

    // Base price per sqft based on location and type
    let basePricePerSqft = 5000; // Default

    // Adjust for location
    if (locationFactors.city === 'Mumbai') {
      basePricePerSqft = locationFactors.area === 'South Mumbai' ? 25000 :
                        locationFactors.area === 'Bandra' ? 18000 :
                        locationFactors.area === 'Andheri' ? 12000 : 8000;
    }

    // Adjust for property type
    const typeMultipliers = {
      'apartment': 1.0,
      'villa': 1.5,
      'plot': 0.7,
      'penthouse': 1.3
    };

    basePricePerSqft *= typeMultipliers[type] || 1.0;

    // Calculate base value
    let propertyValue = basePricePerSqft * areaSqft;

    // Bedroom adjustment
    if (bedrooms >= 3) propertyValue *= 1.1;
    else if (bedrooms === 1) propertyValue *= 0.9;

    // Age depreciation (2% per year)
    const ageDepreciation = Math.min(age * 0.02, 0.4); // Max 40% depreciation
    propertyValue *= (1 - ageDepreciation);

    // Floor adjustment
    if (floor && totalFloors) {
      const floorRatio = floor / totalFloors;
      if (floorRatio > 0.8) propertyValue *= 1.1; // Top floors premium
      else if (floorRatio < 0.2) propertyValue *= 0.95; // Lower floors discount
    }

    // Market trends adjustment
    if (marketData.appreciationRate) {
      // Future value projection
    }

    const finalValue = Math.round(propertyValue);
    const pricePerSqft = Math.round(finalValue / areaSqft);

    return {
      estimatedValue: finalValue,
      pricePerSqft: pricePerSqft,
      basePricePerSqft: Math.round(basePricePerSqft),
      adjustments: {
        typeMultiplier: typeMultipliers[type] || 1.0,
        bedroomAdjustment: bedrooms >= 3 ? 1.1 : bedrooms === 1 ? 0.9 : 1.0,
        ageDepreciation: 1 - ageDepreciation,
        floorAdjustment: floor && totalFloors ?
          (floor / totalFloors > 0.8 ? 1.1 : floor / totalFloors < 0.2 ? 0.95 : 1.0) : 1.0
      },
      assumptions: {
        location: locationFactors,
        marketData: marketData
      }
    };
  }

  // Rental Yield Calculator
  calculateRentalYield(propertyValue, monthlyRent, annualExpenses = 0) {
    const annualRent = monthlyRent * 12;
    const netAnnualRent = annualRent - annualExpenses;
    const grossYield = (annualRent / propertyValue) * 100;
    const netYield = (netAnnualRent / propertyValue) * 100;

    return {
      propertyValue: propertyValue,
      monthlyRent: monthlyRent,
      annualRent: annualRent,
      annualExpenses: annualExpenses,
      netAnnualRent: netAnnualRent,
      grossRentalYield: Math.round(grossYield * 100) / 100,
      netRentalYield: Math.round(netYield * 100) / 100,
      monthlyCashFlow: netAnnualRent / 12,
      breakEvenYears: annualExpenses > 0 ? propertyValue / netAnnualRent : 0
    };
  }

  // Stamp Duty Calculator (India)
  calculateStampDuty(propertyValue, state = 'Maharashtra', isFirstTimeBuyer = false) {
    let stampDutyRate = 0;

    // Maharashtra rates (example)
    if (state === 'Maharashtra') {
      if (propertyValue <= 3000000) {
        stampDutyRate = isFirstTimeBuyer ? 2.5 : 3;
      } else if (propertyValue <= 5000000) {
        stampDutyRate = 3.5;
      } else if (propertyValue <= 10000000) {
        stampDutyRate = 4;
      } else {
        stampDutyRate = 4.5;
      }
    }

    const stampDuty = (propertyValue * stampDutyRate) / 100;
    const registrationCharges = (propertyValue * 1) / 100; // 1% typically
    const totalCharges = stampDuty + registrationCharges;

    return {
      propertyValue: propertyValue,
      state: state,
      isFirstTimeBuyer: isFirstTimeBuyer,
      stampDutyRate: stampDutyRate,
      stampDuty: Math.round(stampDuty),
      registrationCharges: Math.round(registrationCharges),
      totalRegistrationCharges: Math.round(totalCharges),
      effectiveRate: Math.round((totalCharges / propertyValue) * 10000) / 100
    };
  }

  // ROI Calculator
  calculateROI(initialInvestment, annualRentalIncome, annualExpenses, holdingPeriod, appreciationRate = 0) {
    const totalRentalIncome = annualRentalIncome * holdingPeriod;
    const totalExpenses = annualExpenses * holdingPeriod;
    const netIncome = totalRentalIncome - totalExpenses;

    // Future value with appreciation
    const futureValue = initialInvestment * Math.pow(1 + appreciationRate / 100, holdingPeriod);
    const capitalGains = futureValue - initialInvestment;

    const totalReturns = netIncome + capitalGains;
    const totalROI = (totalReturns / initialInvestment) * 100;
    const annualizedROI = Math.pow(1 + totalReturns / initialInvestment, 1 / holdingPeriod) - 1;
    const annualizedROIPercent = annualizedROI * 100;

    return {
      initialInvestment: initialInvestment,
      holdingPeriod: holdingPeriod,
      annualRentalIncome: annualRentalIncome,
      annualExpenses: annualExpenses,
      totalRentalIncome: totalRentalIncome,
      totalExpenses: totalExpenses,
      netIncome: netIncome,
      capitalGains: capitalGains,
      totalReturns: totalReturns,
      totalROI: Math.round(totalROI * 100) / 100,
      annualizedROI: Math.round(annualizedROIPercent * 100) / 100,
      monthlyCashFlow: (annualRentalIncome - annualExpenses) / 12,
      assumptions: {
        appreciationRate: appreciationRate
      }
    };
  }

  // Compare multiple loan options
  compareLoans(propertyPrice, downPaymentPercent, loanOptions) {
    const downPayment = (propertyPrice * downPaymentPercent) / 100;
    const loanAmount = propertyPrice - downPayment;

    const comparisons = loanOptions.map(option => {
      const emi = this.calculateEMI(loanAmount, option.interestRate, option.tenureYears);
      return {
        bankName: option.bankName,
        interestRate: option.interestRate,
        tenureYears: option.tenureYears,
        processingFee: option.processingFee || 0,
        ...emi,
        totalCost: emi.totalAmount + (option.processingFee || 0)
      };
    });

    // Sort by total cost
    comparisons.sort((a, b) => a.totalCost - b.totalCost);

    return {
      propertyPrice: propertyPrice,
      downPayment: downPayment,
      downPaymentPercent: downPaymentPercent,
      loanAmount: loanAmount,
      comparisons: comparisons,
      bestOption: comparisons[0],
      savingsVsWorst: comparisons[comparisons.length - 1].totalCost - comparisons[0].totalCost
    };
  }

  // Generate amortization schedule
  generateAmortizationSchedule(principal, annualInterestRate, tenureYears) {
    const monthlyRate = annualInterestRate / 12 / 100;
    const numberOfPayments = tenureYears * 12;
    const monthlyEMI = this.calculateEMI(principal, annualInterestRate, tenureYears).monthlyEMI;

    const schedule = [];
    let remainingBalance = principal;

    for (let month = 1; month <= numberOfPayments; month++) {
      const interestPayment = remainingBalance * monthlyRate;
      const principalPayment = monthlyEMI - interestPayment;
      remainingBalance -= principalPayment;

      schedule.push({
        month: month,
        emi: monthlyEMI,
        principalPayment: Math.round(principalPayment),
        interestPayment: Math.round(interestPayment),
        remainingBalance: Math.max(0, Math.round(remainingBalance))
      });

      if (remainingBalance <= 0) break;
    }

    return {
      principal: principal,
      interestRate: annualInterestRate,
      tenureYears: tenureYears,
      monthlyEMI: monthlyEMI,
      totalPayments: schedule.length,
      schedule: schedule
    };
  }
}

module.exports = new CalculatorService();