const express = require('express');
const calculatorService = require('../services/calculator');
const { authenticate } = require('../middleware/auth');

const router = express.Router();

// @route   POST /api/calculator/emi
// @desc    Calculate EMI
// @access  Public
router.post('/emi', async (req, res) => {
  try {
    const { principal, interestRate, tenureYears } = req.body;

    if (!principal || !interestRate || !tenureYears) {
      return res.status(400).json({
        success: false,
        message: 'Principal, interest rate, and tenure are required'
      });
    }

    const result = calculatorService.calculateEMI(
      parseFloat(principal),
      parseFloat(interestRate),
      parseInt(tenureYears)
    );

    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    console.error('EMI calculation error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @route   POST /api/calculator/emi-with-down-payment
// @desc    Calculate EMI with down payment
// @access  Public
router.post('/emi-with-down-payment', async (req, res) => {
  try {
    const { propertyPrice, downPaymentPercent, interestRate, tenureYears } = req.body;

    if (!propertyPrice || !downPaymentPercent || !interestRate || !tenureYears) {
      return res.status(400).json({
        success: false,
        message: 'Property price, down payment percent, interest rate, and tenure are required'
      });
    }

    const result = calculatorService.calculateEMIWithDownPayment(
      parseFloat(propertyPrice),
      parseFloat(downPaymentPercent),
      parseFloat(interestRate),
      parseInt(tenureYears)
    );

    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    console.error('EMI with down payment calculation error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @route   POST /api/calculator/affordability
// @desc    Calculate affordability
// @access  Public
router.post('/affordability', async (req, res) => {
  try {
    const { monthlyIncome, existingEMIs, otherObligations, preferredEMIIncomePercent } = req.body;

    if (!monthlyIncome) {
      return res.status(400).json({
        success: false,
        message: 'Monthly income is required'
      });
    }

    const result = calculatorService.calculateAffordability(
      parseFloat(monthlyIncome),
      parseFloat(existingEMIs || 0),
      parseFloat(otherObligations || 0),
      parseFloat(preferredEMIIncomePercent || 40)
    );

    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    console.error('Affordability calculation error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @route   POST /api/calculator/property-valuation
// @desc    Calculate property valuation
// @access  Public
router.post('/property-valuation', async (req, res) => {
  try {
    const { propertySpecs, locationFactors, marketData } = req.body;

    if (!propertySpecs || !locationFactors) {
      return res.status(400).json({
        success: false,
        message: 'Property specs and location factors are required'
      });
    }

    const result = calculatorService.calculatePropertyValuation(
      propertySpecs,
      locationFactors,
      marketData || {}
    );

    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    console.error('Property valuation error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @route   POST /api/calculator/rental-yield
// @desc    Calculate rental yield
// @access  Public
router.post('/rental-yield', async (req, res) => {
  try {
    const { propertyValue, monthlyRent, annualExpenses } = req.body;

    if (!propertyValue || !monthlyRent) {
      return res.status(400).json({
        success: false,
        message: 'Property value and monthly rent are required'
      });
    }

    const result = calculatorService.calculateRentalYield(
      parseFloat(propertyValue),
      parseFloat(monthlyRent),
      parseFloat(annualExpenses || 0)
    );

    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    console.error('Rental yield calculation error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @route   POST /api/calculator/stamp-duty
// @desc    Calculate stamp duty
// @access  Public
router.post('/stamp-duty', async (req, res) => {
  try {
    const { propertyValue, state, isFirstTimeBuyer } = req.body;

    if (!propertyValue) {
      return res.status(400).json({
        success: false,
        message: 'Property value is required'
      });
    }

    const result = calculatorService.calculateStampDuty(
      parseFloat(propertyValue),
      state || 'Maharashtra',
      isFirstTimeBuyer || false
    );

    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    console.error('Stamp duty calculation error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @route   POST /api/calculator/roi
// @desc    Calculate ROI
// @access  Public
router.post('/roi', async (req, res) => {
  try {
    const { initialInvestment, annualRentalIncome, annualExpenses, holdingPeriod, appreciationRate } = req.body;

    if (!initialInvestment || !annualRentalIncome || !holdingPeriod) {
      return res.status(400).json({
        success: false,
        message: 'Initial investment, annual rental income, and holding period are required'
      });
    }

    const result = calculatorService.calculateROI(
      parseFloat(initialInvestment),
      parseFloat(annualRentalIncome),
      parseFloat(annualExpenses || 0),
      parseInt(holdingPeriod),
      parseFloat(appreciationRate || 0)
    );

    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    console.error('ROI calculation error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @route   POST /api/calculator/compare-loans
// @desc    Compare multiple loan options
// @access  Public
router.post('/compare-loans', async (req, res) => {
  try {
    const { propertyPrice, downPaymentPercent, loanOptions } = req.body;

    if (!propertyPrice || !downPaymentPercent || !loanOptions || !Array.isArray(loanOptions)) {
      return res.status(400).json({
        success: false,
        message: 'Property price, down payment percent, and loan options array are required'
      });
    }

    const result = calculatorService.compareLoans(
      parseFloat(propertyPrice),
      parseFloat(downPaymentPercent),
      loanOptions
    );

    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    console.error('Loan comparison error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @route   POST /api/calculator/amortization-schedule
// @desc    Generate amortization schedule
// @access  Public
router.post('/amortization-schedule', async (req, res) => {
  try {
    const { principal, interestRate, tenureYears } = req.body;

    if (!principal || !interestRate || !tenureYears) {
      return res.status(400).json({
        success: false,
        message: 'Principal, interest rate, and tenure are required'
      });
    }

    const result = calculatorService.generateAmortizationSchedule(
      parseFloat(principal),
      parseFloat(interestRate),
      parseInt(tenureYears)
    );

    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    console.error('Amortization schedule error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

module.exports = router;