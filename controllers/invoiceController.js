import PDFDocument from 'pdfkit';
import fs from 'fs';
import path from 'path';

// Helper function to convert numbers to words
function numberToWords(num) {
  if (num === 0) return 'Zero';
  
  const ones = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine'];
  const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
  const teens = ['Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
  
  function convertHundreds(n) {
    let result = '';
    if (n > 100) {
      result += ones[Math.floor(n / 100)] + ' Hundred ';
      n %= 100;
    }
    if (n > 19) {
      result += tens[Math.floor(n / 10)] + ' ';
      n %= 10;
    } else if (n > 9) {
      result += teens[n - 10] + ' ';
      return result;
    }
    if (n > 0) {
      result += ones[n] + ' ';
    }
    return result;
  }
  
  let result = '';
  if (num >= 10000000) {
    result += convertHundreds(Math.floor(num / 10000000)) + 'Crore ';
    num %= 10000000;
  }
  if (num >= 100000) {
    result += convertHundreds(Math.floor(num / 100000)) + 'Lakh ';
    num %= 100000;
  }
  if (num >= 1000) {
    result += convertHundreds(Math.floor(num / 1000)) + 'Thousand ';
    num %= 1000;
  }
  if (num >= 100) {
    result += convertHundreds(Math.floor(num / 100)) + 'Hundred ';
    num %= 100;
  }
  if (num > 0) {
    result += convertHundreds(num);
  }
  
  return result.trim();
}

// Generate PDF invoice with professional design matching the image
export const generateInvoicePDF = async (req, res) => {
  try {
    const { id, billingId } = req.params;
    
    // Use either id or billingId parameter
    const testRequestId = id || billingId;
    
    if (!testRequestId) {
      return res.status(400).json({ message: 'Test request ID is required' });
    }
    
    // Find the test request with billing information
    const TestRequest = (await import('../models/TestRequest.js')).default;
    const testRequest = await TestRequest.findById(testRequestId)
      .populate('patientId', 'name phone address age gender')
      .populate('doctorId', 'name specializations email phone')
      .populate('centerId', 'name code address phone fax website missCallNumber mobileNumber');
    
    if (!testRequest) {
      return res.status(404).json({ message: 'Test request not found' });
    }
    
    if (!testRequest.billing) {
      return res.status(400).json({ message: 'No billing information found for this test request' });
    }
    
    // Create PDF document with professional layout
    const doc = new PDFDocument({ 
      size: 'A4', 
      margin: 20,
      info: {
        Title: `Invoice - ${testRequest.billing.invoiceNumber || testRequest._id}`,
        Author: 'Chanre Hospital',
        Subject: `Medical Invoice for ${testRequest.patientName}`,
        Creator: 'Hospital Management System'
      }
    });
    
    // Set response headers for PDF download
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=invoice-${testRequest.billing.invoiceNumber || testRequest._id}.pdf`);
    
    // Pipe PDF to response
    doc.pipe(res);
    
    // ===== HEADER SECTION =====
    // "Invoice" text on top left
    doc.fillColor('#000000')
       .fontSize(14)
       .font('Helvetica')
       .text('Invoice', 20, 20);
    
    // Hospital Information (Left) - Use centerId data first, then fallback to testRequest fields, then defaults
    const hospitalName = testRequest.centerId?.name || testRequest.centerName || 'Chanre Hospital';
    const hospitalAddress = testRequest.centerId?.address || testRequest.centerId?.location || 'Rajajinagar, Bengaluru';
    const hospitalPhone = testRequest.centerId?.phone || '08040810611';
    const hospitalFax = testRequest.centerId?.fax || '080-42516600';
    const hospitalWebsite = testRequest.centerId?.website || 'www.chanreallergy.com';
    
    doc.fillColor('#000000')
       .fontSize(26)
       .font('Helvetica-Bold')
       .text(hospitalName, 20, 40);
    
    doc.fillColor('#000000')
       .fontSize(11)
       .font('Helvetica')
       .text(hospitalAddress, 20, 72)
       .text(`Phone: ${hospitalPhone} | Fax: ${hospitalFax}`, 20, 87)
       .text(`Website: ${hospitalWebsite}`, 20, 102);
    
    // Bill Details (Top Right)
    const billNumber = testRequest.billing.invoiceNumber || `BILL-${Date.now()}`;
    const billDate = testRequest.billing.generatedAt ? 
      new Date(testRequest.billing.generatedAt).toLocaleDateString('en-GB') : 
      new Date().toLocaleDateString('en-GB');
    const billTime = testRequest.billing.generatedAt ? 
      new Date(testRequest.billing.generatedAt).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: true }) : 
      new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: true });
    
    doc.fillColor('#000000')
       .fontSize(10)
       .font('Helvetica-Bold')
       .text(`Bill No: ${billNumber}`, 400, 20, { align: 'right', width: 170 });
    
    doc.fillColor('#000000')
       .fontSize(10)
       .font('Helvetica')
       .text(`BILL Date: ${billDate}, ${billTime}`, 400, 42, { align: 'right', width: 170 });
    
    // ===== PATIENT & CONSULTANT INFORMATION =====
    const infoY = 125;
    
    // Patient Information (Left)
    doc.fillColor('#000000')
       .fontSize(12)
       .font('Helvetica-Bold')
       .text('Patient Information', 20, infoY);
    
    const patientName = testRequest.patientName || testRequest.patientId?.name || 'N/A';
    const patientAge = testRequest.patientId?.age || 'N/A';
    const patientGender = testRequest.patientId?.gender || 'N/A';
    const patientPhone = testRequest.patientId?.phone || 'N/A';
    const fileNumber = testRequest._id.toString().slice(-7);
    
    doc.fillColor('#000000')
       .fontSize(10)
       .font('Helvetica')
       .text(`Name: ${patientName}`, 20, infoY + 16)
       .text(`Age: ${patientAge} | Gender: ${patientGender}`, 20, infoY + 29)
       .text(`Contact: ${patientPhone}`, 20, infoY + 42)
       .text(`File No: ${fileNumber}`, 20, infoY + 55);
    
    // Consultant Information (Right)
    doc.fillColor('#000000')
       .fontSize(12)
       .font('Helvetica-Bold')
       .text('Consultant Information', 300, infoY);
    
    const doctorName = testRequest.doctorName || testRequest.doctorId?.name || 'Dr. Doctor';
    const department = testRequest.doctorId?.specializations?.[0] || 'General Medicine';
    const userId = testRequest.doctorId?._id?.toString().slice(-7) || '09485dd';
    
    doc.fillColor('#000000')
       .fontSize(10)
       .font('Helvetica')
       .text(`Doctor: ${doctorName}`, 300, infoY + 16)
       .text(`Department: ${department}`, 300, infoY + 29)
       .text(`User ID: ${userId}`, 300, infoY + 42)
       .text(`Ref. Doctor: N/A`, 300, infoY + 55);
    
    // ===== CURRENT SERVICES BILLED SECTION =====
    const servicesY = infoY + 70;
    
    // Centered bold heading for Investigations Billing (with top and bottom space)
    const investigationsHeadingY = servicesY + 10;
    doc.fillColor('#000000')
       .fontSize(14)
       .font('Helvetica-Bold')
       .text('Investigations Billing', 20, investigationsHeadingY, { align: 'center', width: 550 });
    
    // Table header for Current Services Billed (added bottom space after heading)
    const tableHeadingY = investigationsHeadingY + 25;
    doc.fillColor('#000000')
       .fontSize(11)
       .font('Helvetica-Bold')
       .text('Current Services Billed', 20, tableHeadingY);
    
    // Calculate totals - use subTotal if available, otherwise calculate from items
    const subtotal = testRequest.billing.subTotal || (testRequest.billing.items ? 
      testRequest.billing.items.reduce((sum, item) => sum + ((item.quantity || 1) * (item.unitPrice || 0)), 0) :
      (testRequest.billing.amount || 0));
    
    const taxes = testRequest.billing.taxes || 0;
    const discounts = testRequest.billing.discounts || 0;
    const grandTotal = testRequest.billing.amount || (subtotal + taxes - discounts);
    const paidAmount = testRequest.billing.paidAmount || 0;
    const remainingAmount = grandTotal - paidAmount;
    
    // Services Table Header
    const tableY = tableHeadingY + 15;
    doc.rect(20, tableY, 550, 25).fill('#f3f4f6').stroke('#000000');
    
    doc.fillColor('#000000')
       .fontSize(9)
       .font('Helvetica-Bold')
       .text('S.NO', 30, tableY + 8)
       .text('SERVICE NAME', 70, tableY + 8)
       .text('QTY', 200, tableY + 8)
       .text('CHARGES', 250, tableY + 8)
       .text('PAID', 350, tableY + 8)
       .text('BAL', 420, tableY + 8)
       .text('STATUS', 480, tableY + 8);
    
    let currentRowY = tableY + 25;
    
    // Add service items
    if (testRequest.billing.items && testRequest.billing.items.length > 0) {
      testRequest.billing.items.forEach((item, index) => {
        const itemTotal = (item.quantity || 1) * (item.unitPrice || 0);
        const itemPaymentRatio = itemTotal / grandTotal;
        const itemPaidAmount = paidAmount * itemPaymentRatio;
        const itemBalance = itemTotal - itemPaidAmount;
        
        const status = testRequest.billing.status === 'paid' || testRequest.billing.status === 'payment_received' ? 'Paid' : 
                      testRequest.billing.status === 'refunded' ? 'Refunded' : 'Pending';
        
        // Calculate text height for service name (allow wrapping, max 3 lines)
        const serviceName = item.name || 'Lab Test';
        const maxNameWidth = 120;
        const lineHeight = 12;
        
        // Calculate how many lines the service name will take
        doc.fontSize(9).font('Helvetica');
        const textHeight = doc.heightOfString(serviceName, { width: maxNameWidth });
        const numLines = Math.ceil(textHeight / lineHeight);
        const rowHeight = Math.max(20, (numLines * lineHeight) + 8); // Minimum 20, add padding
        
        // Service row with dynamic height
        doc.rect(20, currentRowY, 550, rowHeight).stroke('#000000');
        
        // Vertical center position for other columns
        const textY = currentRowY + (rowHeight / 2) - 4;
        
        doc.fillColor('#000000')
           .fontSize(9)
           .font('Helvetica')
           .text((index + 1).toString(), 30, textY)
           .text(serviceName, 70, currentRowY + 6, { width: maxNameWidth, lineGap: 2 }) // Allow wrapping
           .text((item.quantity || 1).toString(), 200, textY)
           .text(`₹${itemTotal.toFixed(2)}`, 250, textY)
           .text(`₹${itemPaidAmount.toFixed(2)}`, 350, textY)
           .text(`₹${itemBalance.toFixed(2)}`, 420, textY);
        
        // Status with color coding
        if (status === 'Paid') {
          doc.fillColor('#059669').text(status, 480, textY);
        } else if (status === 'Pending') {
          doc.fillColor('#d97706').text(status, 480, textY);
        } else {
          doc.fillColor('#dc2626').text(status, 480, textY);
        }
        
        currentRowY += rowHeight;
      });
    } else {
      // Single service
      const totalAmount = testRequest.billing.amount || 0;
      const balance = totalAmount - paidAmount;
      const status = testRequest.billing.status === 'paid' || testRequest.billing.status === 'payment_received' ? 'Paid' : 
                    testRequest.billing.status === 'refunded' ? 'Refunded' : 'Pending';
      
      // Calculate text height for test type (allow wrapping)
      const testTypeName = testRequest.testType || 'Lab Test';
      const maxNameWidth = 120;
      const lineHeight = 12;
      
      doc.fontSize(9).font('Helvetica');
      const textHeight = doc.heightOfString(testTypeName, { width: maxNameWidth });
      const numLines = Math.ceil(textHeight / lineHeight);
      const rowHeight = Math.max(20, (numLines * lineHeight) + 8);
      
      doc.rect(20, currentRowY, 550, rowHeight).stroke('#000000');
      
      const textY = currentRowY + (rowHeight / 2) - 4;
      
      doc.fillColor('#000000')
         .fontSize(9)
         .font('Helvetica')
         .text('1', 30, textY)
         .text(testTypeName, 70, currentRowY + 6, { width: maxNameWidth, lineGap: 2 })
         .text('1', 200, textY)
         .text(`₹${totalAmount.toFixed(2)}`, 250, textY)
         .text(`₹${paidAmount.toFixed(2)}`, 350, textY)
         .text(`₹${balance.toFixed(2)}`, 420, textY);
      
      if (status === 'Paid') {
        doc.fillColor('#059669').text(status, 480, textY);
      } else if (status === 'Pending') {
        doc.fillColor('#d97706').text(status, 480, textY);
      } else {
        doc.fillColor('#dc2626').text(status, 480, textY);
      }
      
      currentRowY += rowHeight;
    }
    
    // ===== BILL SUMMARY SECTIONS =====
    const summaryY = currentRowY + 10;
    
    // Determine bill status
    let billStatus = 'PENDING';
    if (testRequest.billing.status === 'paid' || testRequest.billing.status === 'payment_received') {
      billStatus = 'PAID';
    } else if (testRequest.billing.status === 'refunded') {
      billStatus = 'REFUNDED';
    } else if (testRequest.billing.status === 'cancelled') {
      billStatus = 'CANCELLED';
    } else if (paidAmount > 0 && paidAmount < grandTotal) {
      billStatus = 'PARTIAL';
    }
    
    // Calculate refunded amount
    const refundedAmount = testRequest.billing.refundAmount || 0;
    const penalty = paidAmount - refundedAmount;
    
    // Left Column - Bill Status and Amount in Words
    let wordY = summaryY;
    
    // Show Bill Status and Amount in Words
    if (billStatus === 'CANCELLED') {
      doc.fillColor('#000000')
         .fontSize(10)
         .font('Helvetica-Bold')
         .text('Bill Status: CANCELLED', 20, wordY);
      wordY += 12;
    }
    
    if (paidAmount > 0) {
      doc.fillColor('#000000')
         .fontSize(10)
         .font('Helvetica')
         .text(`Amount Paid: (Rs.) ${numberToWords(paidAmount)} Only`, 20, wordY);
      wordY += 12;
    }
    
    if (refundedAmount > 0) {
      doc.fillColor('#000000')
         .fontSize(10)
         .font('Helvetica')
         .text(`Amount Refunded: (Rs.) ${numberToWords(refundedAmount)} Only`, 20, wordY);
    }
    
    // Right Column - Numeric Summary
    let summaryRightY = summaryY;
    
    doc.fillColor('#000000')
       .fontSize(10)
       .font('Helvetica')
       .text(`Total Amount: ₹${subtotal.toFixed(2)}`, 300, summaryRightY);
    summaryRightY += 12;
    
    if (discounts > 0) {
      doc.text(`Discount(-): ₹${discounts.toFixed(2)}`, 300, summaryRightY);
      summaryRightY += 12;
    }
    
    doc.text(`Tax Amount: ₹${taxes.toFixed(2)}`, 300, summaryRightY);
    summaryRightY += 12;
    
    doc.font('Helvetica-Bold')
       .text(`Grand Total: ₹${grandTotal.toFixed(2)}`, 300, summaryRightY);
    summaryRightY += 12;
    
    doc.font('Helvetica-Bold')
       .text(`Amount Paid: ₹${paidAmount.toFixed(2)}`, 300, summaryRightY);
    summaryRightY += 12;
    
    if (refundedAmount > 0) {
      doc.font('Helvetica-Bold')
         .text(`Amount Refunded: ₹${refundedAmount.toFixed(2)}`, 300, summaryRightY);
      summaryRightY += 12;
      
      if (penalty > 0 && billStatus === 'CANCELLED') {
        doc.font('Helvetica-Bold')
           .fillColor('#dc2626')
           .text(`Penalty Deducted: ₹${penalty.toFixed(2)}`, 300, summaryRightY);
        summaryRightY += 10;
        
        doc.font('Helvetica')
           .fillColor('#000000')
           .fontSize(8)
           .text('Penalty Reason: Registration Fee (₹150) held as penalty', 300, summaryRightY);
        summaryRightY += 10;
      }
    }
    
    const paymentMethod = testRequest.billing.paymentMethod || 'cash';
    const refundMethod = testRequest.billing.refundMethod || 'Cash';
    
    doc.font('Helvetica')
       .fillColor('#000000')
       .fontSize(9)
       .text(`Payment Method: ${paymentMethod}`, 300, summaryRightY);
    summaryRightY += 12;
    
    if (refundedAmount > 0) {
      doc.text(`Refund Method: ${refundMethod}`, 300, summaryRightY);
      summaryRightY += 12;
    }
    
    if (billStatus === 'CANCELLED') {
      doc.font('Helvetica-Bold')
         .fillColor('#dc2626')
         .fontSize(10)
         .text(`Status: BILL CANCELLED`, 300, summaryRightY);
    } else if (billStatus === 'PAID') {
      doc.font('Helvetica-Bold')
         .fillColor('#059669')
         .fontSize(10)
         .text(`Status: ${billStatus}`, 300, summaryRightY);
    } else if (billStatus === 'REFUNDED') {
      doc.font('Helvetica-Bold')
         .fillColor('#d97706')
         .fontSize(10)
         .text(`Status: ${billStatus}`, 300, summaryRightY);
    }
    
    // ===== TRANSACTION HISTORY SECTION =====
    // Add more margin at the top (increased from 70 to 100)
    const transactionHistoryY = summaryY + 100;
    
    doc.fillColor('#000000')
       .fontSize(11)
       .font('Helvetica-Bold')
       .text('Transaction History', 20, transactionHistoryY);
    
    // Transaction History Table Header
    const paymentTableY = transactionHistoryY + 20;
    doc.rect(20, paymentTableY, 550, 25).fill('#f3f4f6').stroke('#000000');
    
    doc.fillColor('#000000')
       .fontSize(9)
       .font('Helvetica-Bold')
       .text('DATE & TIME', 30, paymentTableY + 8)
       .text('TYPE', 140, paymentTableY + 8)
       .text('DESCRIPTION', 200, paymentTableY + 8)
       .text('AMOUNT', 350, paymentTableY + 8)
       .text('METHOD', 480, paymentTableY + 8);
    
    let paymentRowY = paymentTableY + 25;
    
    // Import PaymentLog model to fetch payment history
    const PaymentLog = (await import('../models/PaymentLog.js')).default;
    
    try {
      // Fetch payment logs for this test request - include all statuses
      // Also check by invoiceNumber in case testRequestId doesn't match
      const invoiceNumber = testRequest.billing?.invoiceNumber;
      const mongoose = (await import('mongoose')).default;
      
      // Build query to find payment logs - try both testRequestId and invoiceNumber
      const query = {
        $or: [
          { testRequestId: new mongoose.Types.ObjectId(testRequestId) },
          ...(invoiceNumber ? [{ invoiceNumber: invoiceNumber }] : [])
        ],
        status: { $in: ['completed', 'refunded', 'cancelled'] }
      };
      
      const paymentLogs = await PaymentLog.find(query).sort({ createdAt: -1 });
      
      console.log(`📋 Found ${paymentLogs.length} payment log(s) for test request ${testRequestId}, invoice ${invoiceNumber || 'N/A'}`);
      
      if (paymentLogs.length > 0) {
        // Show individual payment transactions
        paymentLogs.forEach((payment, index) => {
          const paymentDate = new Date(payment.createdAt).toLocaleDateString('en-GB');
          const paymentTime = new Date(payment.createdAt).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
          const paymentMethod = payment.paymentMethod || 'Cash';
          
          // Transaction row
          doc.rect(20, paymentRowY, 550, 20).stroke('#000000');
          
          const isRefund = payment.status === 'refunded';
          const isCancelled = payment.status === 'cancelled';
          let transactionType = 'Payment';
          if (isRefund) {
            transactionType = 'Refund';
          } else if (isCancelled) {
            transactionType = 'Cancelled';
          }
          
          doc.fillColor('#000000')
             .fontSize(9)
             .font('Helvetica')
             .text(`${paymentDate} ${paymentTime}`, 30, paymentRowY + 6)
             .text(transactionType, 140, paymentRowY + 6);
          
          // Get description - use payment.description if available, otherwise infer from payment type
          let description = payment.description || 'Lab Test Payment';
          if (!payment.description) {
            if (payment.paymentType === 'consultation') description = 'Doctor Consultation Fee';
            else if (payment.paymentType === 'registration') description = 'Registration Fee';
            else if (payment.paymentType === 'service') description = 'Service Charges';
            else if (payment.paymentType === 'lab_test' || payment.paymentType === 'test') description = 'Lab Test';
          }
          
          // Add status info to description for cancelled/refunded
          if (isCancelled) {
            description = `Cancelled: ${description}`;
          } else if (isRefund) {
            description = `Refund: ${description}`;
          }
          
          doc.text(description, 200, paymentRowY + 6, { width: 130, ellipsis: true });
          
          // Show amount with appropriate sign and color
          const amountSign = (isRefund || isCancelled) ? '-' : '+';
          if (isCancelled) {
            doc.fillColor('#dc2626'); // Red for cancelled
          } else if (isRefund) {
            doc.fillColor('#d97706'); // Orange for refund
          } else {
            doc.fillColor('#000000'); // Black for payment
          }
          doc.text(`${amountSign}₹${payment.amount.toFixed(2)}`, 350, paymentRowY + 6);
          
          // Payment method
          doc.fillColor('#000000')
             .text(paymentMethod, 480, paymentRowY + 6, { width: 70, ellipsis: true });
          
          paymentRowY += 20;
        });
      } else {
        // No payment history found - show a message
        doc.rect(20, paymentRowY, 550, 20).stroke('#000000');
        
        doc.fillColor('#000000')
           .fontSize(9)
           .font('Helvetica')
           .text('No payment transactions found', 30, paymentRowY + 6);
        
        paymentRowY += 20;
      }
    } catch (error) {
      // Error fetching payment logs - show a message
      doc.rect(20, paymentRowY, 550, 20).stroke('#000000');
      
      doc.fillColor('#000000')
         .fontSize(9)
         .font('Helvetica')
         .text('Payment history unavailable', 30, paymentRowY + 6);
      
      paymentRowY += 20;
    }
    
    // ===== FOOTER SECTION =====
    const footerY = paymentRowY + 20;
    
    // Generation Details (Left)
    const generatedBy = testRequest.generatedBy || 'Receptionist';
    
    doc.fillColor('#000000')
       .fontSize(10)
       .font('Helvetica')
       .text(`Generated By: ${generatedBy}`, 20, footerY)
       .text(`Date: ${billDate}`, 20, footerY + 13)
       .text(`Time: ${billTime}`, 20, footerY + 26);
    
    // Invoice Terms Box (Right)
    const invoiceBoxY = footerY;
    const invoiceBoxHeight = 85;
    
    // Draw box
    doc.rect(340, invoiceBoxY, 230, invoiceBoxHeight).stroke('#000000');
    
    doc.fillColor('#000000')
       .fontSize(11)
       .font('Helvetica-Bold')
       .text('Invoice Terms', 350, invoiceBoxY + 8);
    
    doc.fillColor('#000000')
       .fontSize(9)
       .font('Helvetica')
       .text('• Original invoice document', 350, invoiceBoxY + 22)
       .text('• Payment due upon receipt', 350, invoiceBoxY + 34)
       .text('• Keep for your records', 350, invoiceBoxY + 46)
       .text('• No refunds after 7 days', 350, invoiceBoxY + 58);
    
    // Signature Area (Below Invoice Terms Box)
    doc.fillColor('#000000')
       .fontSize(9)
       .font('Helvetica')
       .text('Signature:', 350, invoiceBoxY + invoiceBoxHeight + 8)
       .moveTo(350, invoiceBoxY + invoiceBoxHeight + 20)
       .lineTo(550, invoiceBoxY + invoiceBoxHeight + 20)
       .stroke('#000000')
       .text('For Chanre Hospital', 350, invoiceBoxY + invoiceBoxHeight + 25);
    
    // Home Sample Collection info (Bottom Center)
    const homeSampleY = invoiceBoxY + invoiceBoxHeight + 50;
    doc.fillColor('#000000')
       .fontSize(10)
       .font('Helvetica-Bold')
       .text('"For Home Sample Collection"', 20, homeSampleY, { align: 'center', width: 550 })
       .font('Helvetica')
       .text(`Miss Call: ${testRequest.centerId?.missCallNumber || '080-42516666'} | Mobile: ${testRequest.centerId?.mobileNumber || '9686197153'}`, 20, homeSampleY + 15, { align: 'center', width: 550 });
    
    // Finalize PDF
    doc.end();
    
  } catch (error) {
    res.status(500).json({ message: 'Error generating invoice PDF', error: error.message });
  }
};

// Generate consultation fee invoice with professional design
export const generateConsultationInvoicePDF = async (req, res) => {
  try {
    const { patientId } = req.params;
    
    if (!patientId) {
      return res.status(400).json({ message: 'Patient ID is required' });
    }
    
    // Find the patient with billing information
    const Patient = (await import('../models/Patient.js')).default;
    const patient = await Patient.findById(patientId)
      .populate('centerId', 'name code address phone email')
      .populate('currentDoctor', 'name specializations')
      .populate('assignedDoctor', 'name specializations');
    
    if (!patient) {
      return res.status(404).json({ message: 'Patient not found' });
    }
    
    if (!patient.billing || patient.billing.length === 0) {
      return res.status(400).json({ message: 'No billing information found for this patient' });
    }
    
    // CRITICAL: Filter billing to get latest invoice only (same logic as frontend)
    // Exclude superconsultant billing - only show regular consultation billing
    const regularConsultationBills = patient.billing.filter(bill => {
      // Exclude superconsultant billing
      if (bill.type === 'consultation' && bill.consultationType?.startsWith('superconsultant_')) {
        return false;
      }
      return true;
    });

    if (regularConsultationBills.length === 0) {
      return res.status(400).json({ message: 'No regular consultation billing found for this patient' });
    }

    // Get the latest invoice number from regular consultation bills
    // Group by invoice number and get the most recent one
    const invoicesByNumber = {};
    regularConsultationBills.forEach(bill => {
      const invNum = bill.invoiceNumber;
      if (invNum) {
        if (!invoicesByNumber[invNum]) {
          invoicesByNumber[invNum] = [];
        }
        invoicesByNumber[invNum].push(bill);
      }
    });

    // Find the most recent invoice (by creation date)
    let latestInvoiceNumber = null;
    let latestInvoiceDate = null;
    Object.keys(invoicesByNumber).forEach(invNum => {
      const bills = invoicesByNumber[invNum];
      const firstBill = bills[0];
      const billDate = new Date(firstBill.createdAt || 0);
      if (!latestInvoiceDate || billDate > latestInvoiceDate) {
        latestInvoiceDate = billDate;
        latestInvoiceNumber = invNum;
      }
    });

    // If no invoice number found, use the first bill's invoice number
    if (!latestInvoiceNumber) {
      latestInvoiceNumber = regularConsultationBills[0]?.invoiceNumber;
    }

    // Filter billing records to ONLY include bills from the selected invoice (and exclude superconsultant)
    const invoiceBills = patient.billing.filter(bill => {
      // Must match invoice number
      if (bill.invoiceNumber !== latestInvoiceNumber) {
        return false;
      }
      // Exclude superconsultant billing
      if (bill.type === 'consultation' && bill.consultationType?.startsWith('superconsultant_')) {
        return false;
      }
      return true;
    });

    if (invoiceBills.length === 0) {
      return res.status(400).json({ message: 'No billing records found for invoice' });
    }
    
    console.log(`📋 Generating invoice for patient ${patient.name}: Invoice ${latestInvoiceNumber}, Found ${invoiceBills.length} billing records:`);
    invoiceBills.forEach((bill, idx) => {
      console.log(`  ${idx + 1}. ${bill.type} - ${bill.description}: ₹${bill.amount}`);
    });
    
    // Create PDF document with professional layout
    const doc = new PDFDocument({ 
      size: 'A4', 
      margin: 20,
      info: {
        Title: `Consultation Invoice - ${patient.name}`,
        Author: 'Chanre Hospital',
        Subject: `Consultation Invoice for ${patient.name}`,
        Creator: 'Hospital Management System'
      }
    });
    
    // Set response headers for PDF download
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=consultation-invoice-${patient._id}.pdf`);
    
    // Pipe PDF to response
    doc.pipe(res);
    
    // ===== HEADER SECTION =====
    // Hospital Information (Top Left)
    const hospitalName = patient.centerId?.name || 'Chanre Hospital';
    const hospitalAddress = patient.centerId?.address || 'Rajajinagar, Bengaluru';
    const hospitalPhone = patient.centerId?.phone || '1234567890';
    const hospitalEmail = patient.centerId?.email || 'chanrehospital@gmail.com';
    
    doc.fillColor('#000000')
       .fontSize(24)
       .font('Helvetica-Bold')
       .text(hospitalName, 20, 20);
    
    doc.fillColor('#000000')
       .fontSize(10)
       .font('Helvetica')
       .text(hospitalAddress, 20, 45)
       .text(`Phone: ${hospitalPhone}`, 20, 58)
       .text(`Email: ${hospitalEmail}`, 20, 71);
    
    // Bill Details (Top Right) - Use actual invoice data from database
    const billNumber = latestInvoiceNumber || `CONSULT-${Date.now()}`;
    const billDate = invoiceBills[0]?.createdAt ? 
      new Date(invoiceBills[0].createdAt).toLocaleDateString('en-GB') : 
      new Date().toLocaleDateString('en-GB');
    const billTime = invoiceBills[0]?.createdAt ? 
      new Date(invoiceBills[0].createdAt).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: true }) : 
      new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: true });
    
    doc.fillColor('#000000')
       .fontSize(10)
       .font('Helvetica')
       .text(`Bill No: ${billNumber}`, 400, 20, { align: 'right', width: 170 })
       .text(`BILL Date: ${billDate}, ${billTime}`, 400, 33, { align: 'right', width: 170 });
    
    // ===== PATIENT & CONSULTANT INFORMATION =====
    const infoY = 100;
    
    // Patient Information (Left)
    doc.fillColor('#000000')
       .fontSize(12)
       .font('Helvetica-Bold')
       .text('Patient Information', 20, infoY);
    
    const patientName = patient.name || 'N/A';
    const patientAge = patient.age || 'N/A';
    const patientGender = patient.gender || 'N/A';
    const patientPhone = patient.phone || 'N/A';
    const fileNumber = patient.uhId || patient._id.toString().slice(-7);
    
    doc.fillColor('#000000')
       .fontSize(10)
       .font('Helvetica')
       .text(`Name: ${patientName}`, 20, infoY + 20)
       .text(`Age: ${patientAge} | Gender: ${patientGender}`, 20, infoY + 35)
       .text(`Contact: ${patientPhone}`, 20, infoY + 50)
       .text(`File No: ${fileNumber}`, 20, infoY + 65);
    
    // Consultant Information (Right)
    doc.fillColor('#000000')
       .fontSize(12)
       .font('Helvetica-Bold')
       .text('Consultant Information', 300, infoY);
    
    const doctorName = patient.currentDoctor?.name || patient.assignedDoctor?.name || 'Dr. Doctor';
    const department = patient.currentDoctor?.specializations?.[0] || patient.assignedDoctor?.specializations?.[0] || 'General Medicine';
    const userId = patient.currentDoctor?._id?.toString().slice(-7) || patient.assignedDoctor?._id?.toString().slice(-7) || '09485dd';
    
    doc.fillColor('#000000')
       .fontSize(10)
       .font('Helvetica')
       .text(`Doctor: ${doctorName}`, 300, infoY + 20)
       .text(`Department: ${department}`, 300, infoY + 35)
       .text(`User ID: ${userId}`, 300, infoY + 50)
       .text(`Ref. Doctor: N/A`, 300, infoY + 65);
    
    // ===== CURRENT SERVICES BILLED SECTION =====
    const servicesY = infoY + 100;
    
    doc.fillColor('#000000')
       .fontSize(12)
       .font('Helvetica-Bold')
       .text('Current Services Billed', 20, servicesY);
    
    // Calculate totals from FILTERED billing records only
    let grandTotal = 0;
    let totalPaid = 0;
    
    invoiceBills.forEach(bill => {
      grandTotal += bill.amount || 0;
      if (bill.status === 'paid' || bill.status === 'payment_received') {
        totalPaid += bill.amount || 0;
      }
    });
    
    const remainingAmount = grandTotal - totalPaid;
    
    // Services Table Header
    const tableY = servicesY + 20;
    doc.rect(20, tableY, 550, 25).fill('#f3f4f6').stroke('#000000');
    
    doc.fillColor('#000000')
       .fontSize(9)
       .font('Helvetica-Bold')
       .text('S.NO', 30, tableY + 8)
       .text('SERVICE NAME', 70, tableY + 8)
       .text('QTY', 200, tableY + 8)
       .text('CHARGES', 250, tableY + 8)
       .text('PAID', 350, tableY + 8)
       .text('BAL', 420, tableY + 8)
       .text('STATUS', 480, tableY + 8);
    
    let currentRowY = tableY + 25;
    
    // Add billing items - only from the filtered invoiceBills
    invoiceBills.forEach((bill, index) => {
      const amount = bill.amount || 0;
      const isPaid = bill.status === 'paid' || bill.status === 'payment_received';
      const paidAmount = isPaid ? amount : 0;
      const balance = amount - paidAmount;
      const status = isPaid ? 'Paid' : 'Pending';
      
      // Service row
      doc.rect(20, currentRowY, 550, 20).stroke('#000000');
      
      doc.fillColor('#000000')
         .fontSize(9)
         .font('Helvetica')
         .text((index + 1).toString(), 30, currentRowY + 6)
         .text(bill.description || bill.type || 'Consultation', 70, currentRowY + 6, { width: 120, ellipsis: true })
         .text('1', 200, currentRowY + 6)
         .text(`₹${amount.toFixed(2)}`, 250, currentRowY + 6)
         .text(`₹${paidAmount.toFixed(2)}`, 350, currentRowY + 6)
         .text(`₹${balance.toFixed(2)}`, 420, currentRowY + 6);
      
      // Status with color coding
      if (status === 'Paid') {
        doc.fillColor('#059669').text(status, 480, currentRowY + 6);
      } else {
        doc.fillColor('#d97706').text(status, 480, currentRowY + 6);
      }
      
      currentRowY += 20;
    });
    
    // ===== BILL SUMMARY SECTIONS =====
    const summaryY = currentRowY + 20;
    
    // Current Bill Summary (Left)
    doc.fillColor('#000000')
       .fontSize(12)
       .font('Helvetica-Bold')
       .text('Current Bill Summary', 20, summaryY);
    
    doc.fillColor('#000000')
       .fontSize(10)
       .font('Helvetica')
       .text(`Total Amount: ₹${grandTotal.toFixed(2)}`, 20, summaryY + 20)
       .text(`Discount(-): ₹0.00`, 20, summaryY + 35)
       .text(`Tax Amount: ₹0.00`, 20, summaryY + 50)
       .text(`Grand Total: ₹${grandTotal.toFixed(2)}`, 20, summaryY + 65)
       .font('Helvetica-Bold')
       .text(`Amount Paid: ₹${totalPaid.toFixed(2)}`, 20, summaryY + 80);
    
    // Determine bill status
    let billStatus = 'PENDING';
    if (totalPaid >= grandTotal) {
      billStatus = 'PAID';
    } else if (totalPaid > 0) {
      billStatus = 'PARTIAL';
    }
    
    // Status with color coding
    if (billStatus === 'PAID') {
      doc.fillColor('#059669').text(`Status: ${billStatus}`, 20, summaryY + 95);
    } else {
      doc.fillColor('#d97706').text(`Status: ${billStatus}`, 20, summaryY + 95);
    }
    
    // Payment Summary (Right)
    doc.fillColor('#000000')
       .fontSize(12)
       .font('Helvetica-Bold')
       .text('Payment Summary', 300, summaryY);
    
    doc.fillColor('#000000')
       .fontSize(10)
       .font('Helvetica')
       .text(`Total Bill Amount: ₹${grandTotal.toFixed(2)}`, 300, summaryY + 20)
       .text(`Bill Status: ${billStatus}`, 300, summaryY + 35)
       .text(`Amount Paid: ₹${totalPaid.toFixed(2)}`, 300, summaryY + 50);
    
    // Generation Details
    doc.fillColor('#000000')
       .fontSize(12)
       .font('Helvetica-Bold')
       .text('Generation Details', 300, summaryY + 80);
    
    const generatedBy = patient.centerId?.name || 'Receptionist 01';
    const generatedDate = new Date().toLocaleDateString('en-GB');
    const generatedTime = new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true });
    
    doc.fillColor('#000000')
       .fontSize(10)
       .font('Helvetica')
       .text(`Generated By: ${generatedBy}`, 300, summaryY + 100)
       .text(`Date: ${generatedDate}`, 300, summaryY + 115)
       .text(`Time: ${generatedTime}`, 300, summaryY + 130);
    
    // Paid Amount in Words
    doc.fillColor('#000000')
       .fontSize(10)
       .font('Helvetica')
       .text(`Paid Amount (in words): (Rs.) ${numberToWords(totalPaid)} Only`, 20, summaryY + 150);
    
    // ===== PAYMENT HISTORY SECTION =====
    const paymentHistoryY = summaryY + 180;
    
    doc.fillColor('#000000')
       .fontSize(12)
       .font('Helvetica-Bold')
       .text('Transaction History', 20, paymentHistoryY);
    
    // Transaction History Table Header
    const paymentTableY = paymentHistoryY + 20;
    doc.rect(20, paymentTableY, 550, 25).fill('#f3f4f6').stroke('#000000');
    
    doc.fillColor('#000000')
       .fontSize(10)
       .font('Helvetica-Bold')
       .text('DATE & TIME', 30, paymentTableY + 8)
       .text('TYPE', 140, paymentTableY + 8)
       .text('DESCRIPTION', 200, paymentTableY + 8)
       .text('AMOUNT', 350, paymentTableY + 8)
       .text('METHOD', 480, paymentTableY + 8);
    
    let paymentRowY = paymentTableY + 25;
    
    // Import PaymentLog model to fetch payment history
    const PaymentLog = (await import('../models/PaymentLog.js')).default;
    
    try {
      // Fetch payment logs for this patient
      const paymentLogs = await PaymentLog.find({ 
        patientId: patientId,
        status: 'completed'
      }).sort({ createdAt: -1 });
      
      if (paymentLogs.length > 0) {
        // Show individual payment transactions
        paymentLogs.forEach((payment, index) => {
          const paymentDate = new Date(payment.createdAt).toLocaleDateString('en-GB');
          const paymentTime = new Date(payment.createdAt).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: true });
          const paymentMethod = payment.paymentMethod || 'Cash';
          
          // Transaction row
          doc.rect(20, paymentRowY, 550, 20).stroke('#000000');
          
          doc.fillColor('#000000')
             .fontSize(9)
             .font('Helvetica')
             .text(`${paymentDate} ${paymentTime}`, 30, paymentRowY + 6)
             .text('Payment', 140, paymentRowY + 6)
             .text(payment.description || 'Lab Test Payment', 200, paymentRowY + 6, { width: 130, ellipsis: true })
             .text(`+₹${payment.amount.toFixed(2)}`, 350, paymentRowY + 6);
          
          // Payment method
          doc.fillColor('#000000')
             .text(paymentMethod, 480, paymentRowY + 6, { width: 70, ellipsis: true });
          
          paymentRowY += 20;
        });
      } else {
        // No payment history found - show a message
        doc.rect(20, paymentRowY, 550, 20).stroke('#000000');
        
        doc.fillColor('#000000')
           .fontSize(9)
           .font('Helvetica')
           .text('No payment transactions found', 30, paymentRowY + 6);
        
        paymentRowY += 20;
      }
    } catch (error) {
      // Error fetching payment logs - show a message
      doc.rect(20, paymentRowY, 550, 20).stroke('#000000');
      
      doc.fillColor('#000000')
         .fontSize(9)
         .font('Helvetica')
         .text('Payment history unavailable', 30, paymentRowY + 6);
      
      paymentRowY += 20;
    }
    
    // ===== FOOTER SECTION =====
    const footerY = paymentRowY + 30;
    
    // Invoice Terms (Bottom Left)
    doc.fillColor('#000000')
       .fontSize(12)
       .font('Helvetica-Bold')
       .text('Invoice Terms', 20, footerY);
    
    doc.fillColor('#000000')
       .fontSize(10)
       .font('Helvetica')
       .text('• Original invoice document', 20, footerY + 20)
       .text('• Payment due upon receipt', 20, footerY + 35)
       .text('• Keep for your records', 20, footerY + 50)
       .text('• No refunds after 7 days', 20, footerY + 65);
    
    // Signature Area (Bottom Right)
    doc.fillColor('#000000')
       .fontSize(10)
       .font('Helvetica')
       .text('For Chanre Hospital', 400, footerY + 50, { align: 'right', width: 170 })
       .text('Authorized Signature', 400, footerY + 70, { align: 'right', width: 170 });
    
    // Finalize PDF
    doc.end();
    
  } catch (error) {
    res.status(500).json({ message: 'Error generating consultation invoice PDF', error: error.message });
  }
};

// Generate reassignment invoice with professional design
export const generateReassignmentInvoicePDF = async (req, res) => {
  try {
    const { patientId } = req.params;
    
    if (!patientId) {
      return res.status(400).json({ message: 'Patient ID is required' });
    }
    
    // Find the patient with reassigned billing information
    const Patient = (await import('../models/Patient.js')).default;
    const patient = await Patient.findById(patientId)
      .populate('centerId', 'name code address phone email')
      .populate('currentDoctor', 'name specializations')
      .populate('assignedDoctor', 'name specializations');
    
    if (!patient) {
      return res.status(404).json({ message: 'Patient not found' });
    }
    
    if (!patient.reassignedBilling || patient.reassignedBilling.length === 0) {
      return res.status(400).json({ message: 'No reassigned billing information found for this patient' });
    }
    
    // Create PDF document with professional layout
    const doc = new PDFDocument({ 
      size: 'A4', 
      margin: 20,
      info: {
        Title: `Reassignment Invoice - ${patient.name}`,
        Author: 'Chanre Hospital',
        Subject: `Reassignment Invoice for ${patient.name}`,
        Creator: 'Hospital Management System'
      }
    });
    
    // Set response headers for PDF download
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=reassignment-invoice-${patient._id}.pdf`);
    
    // Pipe PDF to response
    doc.pipe(res);
    
    // ===== HEADER SECTION =====
    // Hospital Information (Top Left)
    const hospitalName = patient.centerId?.name || 'Chanre Hospital';
    const hospitalAddress = patient.centerId?.address || 'Rajajinagar, Bengaluru';
    const hospitalPhone = patient.centerId?.phone || '1234567890';
    const hospitalEmail = patient.centerId?.email || 'chanrehospital@gmail.com';
    
    doc.fillColor('#000000')
       .fontSize(24)
       .font('Helvetica-Bold')
       .text(hospitalName, 20, 20);
    
    doc.fillColor('#000000')
       .fontSize(10)
       .font('Helvetica')
       .text(hospitalAddress, 20, 45)
       .text(`Phone: ${hospitalPhone}`, 20, 58)
       .text(`Email: ${hospitalEmail}`, 20, 71);
    
    // Bill Details (Top Right)
    const billNumber = `REASSIGN-${Date.now()}`;
    const billDate = new Date().toLocaleDateString('en-GB');
    const billTime = new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: true });
    
    doc.fillColor('#000000')
       .fontSize(10)
       .font('Helvetica')
       .text(`Bill No: ${billNumber}`, 400, 20, { align: 'right', width: 170 })
       .text(`BILL Date: ${billDate}, ${billTime}`, 400, 33, { align: 'right', width: 170 });
    
    // ===== PATIENT & CONSULTANT INFORMATION =====
    const infoY = 100;
    
    // Patient Information (Left)
    doc.fillColor('#000000')
       .fontSize(12)
       .font('Helvetica-Bold')
       .text('Patient Information', 20, infoY);
    
    const patientName = patient.name || 'N/A';
    const patientAge = patient.age || 'N/A';
    const patientGender = patient.gender || 'N/A';
    const patientPhone = patient.phone || 'N/A';
    const fileNumber = patient.uhId || patient._id.toString().slice(-7);
    
    doc.fillColor('#000000')
       .fontSize(10)
       .font('Helvetica')
       .text(`Name: ${patientName}`, 20, infoY + 20)
       .text(`Age: ${patientAge} | Gender: ${patientGender}`, 20, infoY + 35)
       .text(`Contact: ${patientPhone}`, 20, infoY + 50)
       .text(`File No: ${fileNumber}`, 20, infoY + 65);
    
    // Consultant Information (Right)
    doc.fillColor('#000000')
       .fontSize(12)
       .font('Helvetica-Bold')
       .text('Consultant Information', 300, infoY);
    
    const doctorName = patient.currentDoctor?.name || patient.assignedDoctor?.name || 'Dr. Doctor';
    const department = patient.currentDoctor?.specializations?.[0] || patient.assignedDoctor?.specializations?.[0] || 'General Medicine';
    const userId = patient.currentDoctor?._id?.toString().slice(-7) || patient.assignedDoctor?._id?.toString().slice(-7) || '09485dd';
    
    doc.fillColor('#000000')
       .fontSize(10)
       .font('Helvetica')
       .text(`Doctor: ${doctorName}`, 300, infoY + 20)
       .text(`Department: ${department}`, 300, infoY + 35)
       .text(`User ID: ${userId}`, 300, infoY + 50)
       .text(`Ref. Doctor: N/A`, 300, infoY + 65);
    
    // ===== CURRENT SERVICES BILLED SECTION =====
    const servicesY = infoY + 100;
    
    doc.fillColor('#000000')
       .fontSize(12)
       .font('Helvetica-Bold')
       .text('Current Services Billed', 20, servicesY);
    
    // Calculate totals from reassigned billing records
    let grandTotal = 0;
    let totalPaid = 0;
    
    patient.reassignedBilling.forEach(bill => {
      grandTotal += bill.amount || 0;
      if (bill.status === 'paid' || bill.status === 'payment_received') {
        totalPaid += bill.amount || 0;
      }
    });
    
    const remainingAmount = grandTotal - totalPaid;
    
    // Services Table Header
    const tableY = servicesY + 20;
    doc.rect(20, tableY, 550, 25).fill('#f3f4f6').stroke('#000000');
    
    doc.fillColor('#000000')
       .fontSize(9)
       .font('Helvetica-Bold')
       .text('S.NO', 30, tableY + 8)
       .text('SERVICE NAME', 70, tableY + 8)
       .text('QTY', 200, tableY + 8)
       .text('CHARGES', 250, tableY + 8)
       .text('PAID', 350, tableY + 8)
       .text('BAL', 420, tableY + 8)
       .text('STATUS', 480, tableY + 8);
    
    let currentRowY = tableY + 25;
    
    // Add reassigned billing items
    patient.reassignedBilling.forEach((bill, index) => {
      const amount = bill.amount || 0;
      const isPaid = bill.status === 'paid' || bill.status === 'payment_received';
      const paidAmount = isPaid ? amount : 0;
      const balance = amount - paidAmount;
      const status = isPaid ? 'Paid' : 'Pending';
      
      // Service row
      doc.rect(20, currentRowY, 550, 20).stroke('#000000');
      
      doc.fillColor('#000000')
         .fontSize(9)
         .font('Helvetica')
         .text((index + 1).toString(), 30, currentRowY + 6)
         .text(bill.description || bill.type || 'Reassignment Service', 70, currentRowY + 6, { width: 120, ellipsis: true })
         .text('1', 200, currentRowY + 6)
         .text(`₹${amount.toFixed(2)}`, 250, currentRowY + 6)
         .text(`₹${paidAmount.toFixed(2)}`, 350, currentRowY + 6)
         .text(`₹${balance.toFixed(2)}`, 420, currentRowY + 6);
      
      // Status with color coding
      if (status === 'Paid') {
        doc.fillColor('#059669').text(status, 480, currentRowY + 6);
      } else {
        doc.fillColor('#d97706').text(status, 480, currentRowY + 6);
      }
      
      currentRowY += 20;
    });
    
    // ===== BILL SUMMARY SECTIONS =====
    const summaryY = currentRowY + 20;
    
    // Current Bill Summary (Left)
    doc.fillColor('#000000')
       .fontSize(12)
       .font('Helvetica-Bold')
       .text('Current Bill Summary', 20, summaryY);
    
    doc.fillColor('#000000')
       .fontSize(10)
       .font('Helvetica')
       .text(`Total Amount: ₹${grandTotal.toFixed(2)}`, 20, summaryY + 20)
       .text(`Discount(-): ₹0.00`, 20, summaryY + 35)
       .text(`Tax Amount: ₹0.00`, 20, summaryY + 50)
       .text(`Grand Total: ₹${grandTotal.toFixed(2)}`, 20, summaryY + 65)
       .font('Helvetica-Bold')
       .text(`Amount Paid: ₹${totalPaid.toFixed(2)}`, 20, summaryY + 80);
    
    // Determine bill status
    let billStatus = 'PENDING';
    if (totalPaid >= grandTotal) {
      billStatus = 'PAID';
    } else if (totalPaid > 0) {
      billStatus = 'PARTIAL';
    }
    
    // Status with color coding
    if (billStatus === 'PAID') {
      doc.fillColor('#059669').text(`Status: ${billStatus}`, 20, summaryY + 95);
    } else {
      doc.fillColor('#d97706').text(`Status: ${billStatus}`, 20, summaryY + 95);
    }
    
    // Payment Summary (Right)
    doc.fillColor('#000000')
       .fontSize(12)
       .font('Helvetica-Bold')
       .text('Payment Summary', 300, summaryY);
    
    doc.fillColor('#000000')
       .fontSize(10)
       .font('Helvetica')
       .text(`Total Bill Amount: ₹${grandTotal.toFixed(2)}`, 300, summaryY + 20)
       .text(`Bill Status: ${billStatus}`, 300, summaryY + 35)
       .text(`Amount Paid: ₹${totalPaid.toFixed(2)}`, 300, summaryY + 50);
    
    // Generation Details
    doc.fillColor('#000000')
       .fontSize(12)
       .font('Helvetica-Bold')
       .text('Generation Details', 300, summaryY + 80);
    
    const generatedBy = patient.centerId?.name || 'Receptionist 01';
    const generatedDate = new Date().toLocaleDateString('en-GB');
    const generatedTime = new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true });
    
    doc.fillColor('#000000')
       .fontSize(10)
       .font('Helvetica')
       .text(`Generated By: ${generatedBy}`, 300, summaryY + 100)
       .text(`Date: ${generatedDate}`, 300, summaryY + 115)
       .text(`Time: ${generatedTime}`, 300, summaryY + 130);
    
    // Paid Amount in Words
    doc.fillColor('#000000')
       .fontSize(10)
       .font('Helvetica')
       .text(`Paid Amount (in words): (Rs.) ${numberToWords(totalPaid)} Only`, 20, summaryY + 150);
    
    // ===== PAYMENT HISTORY SECTION =====
    const paymentHistoryY = summaryY + 180;
    
    doc.fillColor('#000000')
       .fontSize(12)
       .font('Helvetica-Bold')
       .text('Transaction History', 20, paymentHistoryY);
    
    // Transaction History Table Header
    const paymentTableY = paymentHistoryY + 20;
    doc.rect(20, paymentTableY, 550, 25).fill('#f3f4f6').stroke('#000000');
    
    doc.fillColor('#000000')
       .fontSize(10)
       .font('Helvetica-Bold')
       .text('DATE & TIME', 30, paymentTableY + 8)
       .text('TYPE', 140, paymentTableY + 8)
       .text('DESCRIPTION', 200, paymentTableY + 8)
       .text('AMOUNT', 350, paymentTableY + 8)
       .text('METHOD', 480, paymentTableY + 8);
    
    let paymentRowY = paymentTableY + 25;
    
    // Import PaymentLog model to fetch payment history
    const PaymentLog = (await import('../models/PaymentLog.js')).default;
    
    try {
      // Fetch payment logs for this patient
      const paymentLogs = await PaymentLog.find({ 
        patientId: patientId,
        status: 'completed'
      }).sort({ createdAt: -1 });
      
      if (paymentLogs.length > 0) {
        // Show individual payment transactions
        paymentLogs.forEach((payment, index) => {
          const paymentDate = new Date(payment.createdAt).toLocaleDateString('en-GB');
          const paymentTime = new Date(payment.createdAt).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: true });
          const paymentMethod = payment.paymentMethod || 'Cash';
          
          // Transaction row
          doc.rect(20, paymentRowY, 550, 20).stroke('#000000');
          
          doc.fillColor('#000000')
             .fontSize(9)
             .font('Helvetica')
             .text(`${paymentDate} ${paymentTime}`, 30, paymentRowY + 6)
             .text('Payment', 140, paymentRowY + 6)
             .text(payment.description || 'Lab Test Payment', 200, paymentRowY + 6, { width: 130, ellipsis: true })
             .text(`+₹${payment.amount.toFixed(2)}`, 350, paymentRowY + 6);
          
          // Payment method
          doc.fillColor('#000000')
             .text(paymentMethod, 480, paymentRowY + 6, { width: 70, ellipsis: true });
          
          paymentRowY += 20;
        });
      } else {
        // No payment history found - show a message
        doc.rect(20, paymentRowY, 550, 20).stroke('#000000');
        
        doc.fillColor('#000000')
           .fontSize(9)
           .font('Helvetica')
           .text('No payment transactions found', 30, paymentRowY + 6);
        
        paymentRowY += 20;
      }
    } catch (error) {
      // Error fetching payment logs - show a message
      doc.rect(20, paymentRowY, 550, 20).stroke('#000000');
      
      doc.fillColor('#000000')
         .fontSize(9)
         .font('Helvetica')
         .text('Payment history unavailable', 30, paymentRowY + 6);
      
      paymentRowY += 20;
    }
    
    // ===== FOOTER SECTION =====
    const footerY = paymentRowY + 30;
    
    // Invoice Terms (Bottom Left)
    doc.fillColor('#000000')
       .fontSize(12)
       .font('Helvetica-Bold')
       .text('Invoice Terms', 20, footerY);
    
    doc.fillColor('#000000')
       .fontSize(10)
       .font('Helvetica')
       .text('• Original invoice document', 20, footerY + 20)
       .text('• Payment due upon receipt', 20, footerY + 35)
       .text('• Keep for your records', 20, footerY + 50)
       .text('• No refunds after 7 days', 20, footerY + 65);
    
    // Signature Area (Bottom Right)
    doc.fillColor('#000000')
       .fontSize(10)
       .font('Helvetica')
       .text('For Chanre Hospital', 400, footerY + 50, { align: 'right', width: 170 })
       .text('Authorized Signature', 400, footerY + 70, { align: 'right', width: 170 });
    
    // Finalize PDF
    doc.end();
    
  } catch (error) {
    res.status(500).json({ message: 'Error generating reassignment invoice PDF', error: error.message });
  }
};


