import User from '../models/User.js';
import Center from '../models/Center.js';
import Patient from '../models/Patient.js';
import TestRequest from '../models/TestRequest.js';
import PaymentLog from '../models/PaymentLog.js';
import SlitTherapyRequest from '../models/SlitTherapyRequest.js';
import bcrypt from 'bcryptjs';

// Get all accountants for a center
export const getAccountants = async (req, res) => {
  try {
    const { centerId } = req.params;
    const { page = 1, limit = 10, search = '' } = req.query;

    // Build query
    const query = {
      role: 'accountant',
      isDeleted: false
    };

    // Add center filter if not superadmin
    if (req.user.role !== 'superadmin') {
      query.centerId = req.user.centerId;
    } else if (centerId) {
      query.centerId = centerId;
    }

    // Add search filter
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
        { username: { $regex: search, $options: 'i' } }
      ];
    }

    const accountants = await User.find(query)
      .populate('centerId', 'name code')
      .select('-password')
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await User.countDocuments(query);

    res.json({
      accountants,
      totalPages: Math.ceil(total / limit),
      currentPage: page,
      total
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// Get single accountant
export const getAccountant = async (req, res) => {
  try {
    const { id } = req.params;

    const accountant = await User.findOne({
      _id: id,
      role: 'accountant',
      isDeleted: false
    }).populate('centerId', 'name code').select('-password');

    if (!accountant) {
      return res.status(404).json({ message: 'Accountant not found' });
    }

    // Check center access
    if (req.user.role !== 'superadmin' && accountant.centerId.toString() !== req.user.centerId.toString()) {
      return res.status(403).json({ message: 'Access denied' });
    }

    res.json(accountant);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// Create new accountant
export const createAccountant = async (req, res) => {
  try {
    const {
      name,
      email,
      username,
      password,
      phone,
      mobile,
      address,
      emergencyContact,
      emergencyContactName,
      centerId
    } = req.body;

    // Validate required fields
    if (!name || !email || !password) {
      return res.status(400).json({ message: 'Name, email, and password are required' });
    }

    // Check if user already exists
    const existingUser = await User.findOne({
      $or: [{ email }, { username: username || email }]
    });

    if (existingUser) {
      return res.status(400).json({ message: 'User already exists with this email or username' });
    }

    // Determine centerId - ensure accountants are always assigned to a center
    let assignedCenterId = centerId;
    if (req.user.role !== 'superadmin') {
      assignedCenterId = req.user.centerId;
    }

    // For non-superadmin users, centerId is required
    if (req.user.role !== 'superadmin' && !assignedCenterId) {
      return res.status(400).json({ 
        message: 'Accountant must be assigned to a center. Please ensure the user creating the accountant has a valid center assignment.' 
      });
    }

    // Validate center exists
    if (assignedCenterId) {
      const center = await Center.findById(assignedCenterId);
      if (!center) {
        return res.status(400).json({ message: 'Invalid center' });
      }
    }

    // Create accountant
    const accountant = await User.create({
      name,
      email,
      username: username || email,
      password,
      role: 'accountant',
      centerId: assignedCenterId,
      phone,
      mobile,
      address,
      emergencyContact,
      emergencyContactName
    });

    // Return accountant without password
    const createdAccountant = await User.findById(accountant._id)
      .populate('centerId', 'name code')
      .select('-password');

    res.status(201).json(createdAccountant);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// Update accountant
export const updateAccountant = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      name,
      email,
      username,
      phone,
      mobile,
      address,
      emergencyContact,
      emergencyContactName,
      status,
      centerId
    } = req.body;

    const accountant = await User.findOne({
      _id: id,
      role: 'accountant',
      isDeleted: false
    });

    if (!accountant) {
      return res.status(404).json({ message: 'Accountant not found' });
    }

    // Check center access
    if (req.user.role !== 'superadmin' && accountant.centerId.toString() !== req.user.centerId.toString()) {
      return res.status(403).json({ message: 'Access denied' });
    }

    // Check if email/username already exists for another user
    if (email || username) {
      const existingUser = await User.findOne({
        _id: { $ne: id },
        $or: [
          ...(email ? [{ email }] : []),
          ...(username ? [{ username }] : [])
        ]
      });

      if (existingUser) {
        return res.status(400).json({ message: 'Email or username already exists' });
      }
    }

    // Update fields
    if (name) accountant.name = name;
    if (email) accountant.email = email;
    if (username) accountant.username = username;
    if (phone !== undefined) accountant.phone = phone;
    if (mobile !== undefined) accountant.mobile = mobile;
    if (address !== undefined) accountant.address = address;
    if (emergencyContact !== undefined) accountant.emergencyContact = emergencyContact;
    if (emergencyContactName !== undefined) accountant.emergencyContactName = emergencyContactName;
    if (status) accountant.status = status;

    // Only superadmin can change centerId
    if (req.user.role === 'superadmin' && centerId) {
      const center = await Center.findById(centerId);
      if (!center) {
        return res.status(400).json({ message: 'Invalid center' });
      }
      accountant.centerId = centerId;
    }

    await accountant.save();

    // Return updated accountant without password
    const updatedAccountant = await User.findById(accountant._id)
      .populate('centerId', 'name code')
      .select('-password');

    res.json(updatedAccountant);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// Delete accountant (soft delete)
export const deleteAccountant = async (req, res) => {
  try {
    const { id } = req.params;

    const accountant = await User.findOne({
      _id: id,
      role: 'accountant',
      isDeleted: false
    });

    if (!accountant) {
      return res.status(404).json({ message: 'Accountant not found' });
    }

    // Check center access
    if (req.user.role !== 'superadmin' && accountant.centerId.toString() !== req.user.centerId.toString()) {
      return res.status(403).json({ message: 'Access denied' });
    }

    // Soft delete
    accountant.isDeleted = true;
    accountant.status = 'inactive';
    await accountant.save();

    res.json({ message: 'Accountant deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// Reset accountant password
export const resetAccountantPassword = async (req, res) => {
  try {
    const { id } = req.params;
    const { newPassword } = req.body;

    if (!newPassword) {
      return res.status(400).json({ message: 'New password is required' });
    }

    const accountant = await User.findOne({
      _id: id,
      role: 'accountant',
      isDeleted: false
    });

    if (!accountant) {
      return res.status(404).json({ message: 'Accountant not found' });
    }

    // Check center access
    if (req.user.role !== 'superadmin' && accountant.centerId.toString() !== req.user.centerId.toString()) {
      return res.status(403).json({ message: 'Access denied' });
    }

    // Hash new password
    const salt = await bcrypt.genSalt(10);
    accountant.password = await bcrypt.hash(newPassword, salt);
    await accountant.save();

    res.json({ message: 'Password reset successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// Get accountant dashboard data
export const getAccountantDashboard = async (req, res) => {
  try {
    const centerId = req.user.centerId;

    // Get basic counts
    const totalPatients = await User.countDocuments({
      role: 'patient',
      centerId,
      isDeleted: false
    });

    const totalDoctors = await User.countDocuments({
      role: 'doctor',
      centerId,
      isDeleted: false
    });

    const totalReceptionists = await User.countDocuments({
      role: 'receptionist',
      centerId,
      isDeleted: false
    });

    // Get recent activity (last 7 days)
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const recentPatients = await User.countDocuments({
      role: 'patient',
      centerId,
      isDeleted: false,
      createdAt: { $gte: sevenDaysAgo }
    });

    res.json({
      totalPatients,
      totalDoctors,
      totalReceptionists,
      recentPatients,
      centerId
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// Get accountant statistics
export const getAccountantStats = async (req, res) => {
  try {
    const centerId = req.user.centerId;

    const total = await User.countDocuments({
      role: 'accountant',
      centerId,
      isDeleted: false
    });

    const active = await User.countDocuments({
      role: 'accountant',
      centerId,
      isDeleted: false,
      status: 'active'
    });

    const inactive = await User.countDocuments({
      role: 'accountant',
      centerId,
      isDeleted: false,
      status: 'inactive'
    });

    res.json({
      total,
      active,
      inactive
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// Get all bills and transactions for accountant
export const getAllBillsAndTransactions = async (req, res) => {
  try {
    // Superadmin can access all centers, others need centerId
    let centerId = null;
    if (req.user.role !== 'superadmin') {
      // Check if user has centerId assigned (for centeradmin, accountant, receptionist)
      if (!req.user || !req.user.centerId) {
        return res.status(400).json({ 
          message: 'User must be assigned to a center to access billing data. Please contact administrator to assign a center.',
          error: 'MISSING_CENTER_ASSIGNMENT'
        });
      }
      centerId = req.user.centerId;
    }
    // For superadmin, centerId remains null to access all centers (unless specified in query)

    const { startDate, endDate, billType, status, consultationType, centerId: queryCenterId, page = 1, limit = 50 } = req.query;
    
    console.log('📥 Received query parameters:', { startDate, endDate, consultationType, queryCenterId, role: req.user.role });
    
    // If superadmin provides centerId in query, use it to filter
    if (req.user.role === 'superadmin' && queryCenterId) {
      // Mongoose will automatically convert string ObjectIds, but we validate it
      try {
        // Validate ObjectId format
        const mongoose = (await import('mongoose')).default;
        if (mongoose.Types.ObjectId.isValid(queryCenterId)) {
          centerId = queryCenterId; // Mongoose will handle conversion
          console.log(`✅ Center filter applied: ${centerId} (will be converted to ObjectId by Mongoose)`);
        } else {
          console.error('❌ Invalid centerId format:', queryCenterId);
          return res.status(400).json({
            message: 'Invalid centerId format',
            error: 'INVALID_CENTER_ID'
          });
        }
      } catch (error) {
        console.error('❌ Error validating centerId:', error);
        return res.status(400).json({
          message: 'Invalid centerId format',
          error: 'INVALID_CENTER_ID'
        });
      }
    }
    
    console.log(`📋 Fetching bills for ${req.user.role === 'superadmin' ? (centerId ? `center: ${centerId}` : 'all centers') : `center: ${centerId}`}`);


    // Build date filter
    const dateFilter = {};
    if (startDate) {
      dateFilter.$gte = new Date(startDate);
    }
    if (endDate) {
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);
      dateFilter.$lte = end;
    }
    
    // Only apply date filter if it has values
    const hasDateFilter = Object.keys(dateFilter).length > 0;

    // 1. Get ALL patients and group their billing by invoice number
    const patientQuery = centerId ? { centerId } : {};
    console.log(`🔍 Patient query:`, JSON.stringify(patientQuery));
    let patients = [];
    try {
      patients = await Patient.find(patientQuery)
        .populate('assignedDoctor', 'name')
        .populate('currentDoctor', 'name')
        .select('name uhId age gender contact billing reassignedBilling createdAt');
    } catch (patientError) {
      console.error('Error fetching patients:', patientError);
      return res.status(500).json({ 
        message: 'Error fetching patient data', 
        error: patientError.message 
      });
    }
    
    // Debug: Check specific patient's reassignment billing
    const rahulPatient = patients.find(p => p.name === 'Rahul' && p.uhId === '2345002');
    if (rahulPatient) {
      console.log(`🔍 DEBUG: Rahul patient found with ${rahulPatient.reassignedBilling?.length || 0} reassignment bills`);
      console.log(`🔍 DEBUG: Rahul reassignment billing:`, rahulPatient.reassignedBilling);
    }

    const invoiceMap = new Map(); // Group by patient and date (to combine all services in one visit)
    
    console.log(`🔍 Processing ${patients.length} patients for billing data`);
    
    patients.forEach(patient => {
      console.log(`🔍 Patient: ${patient.name} (${patient.uhId}) - Reassignment billing count: ${patient.reassignedBilling?.length || 0}`);
      if (patient.reassignedBilling && patient.reassignedBilling.length > 0) {
        console.log(`🔍 Raw reassignment billing data for ${patient.name}:`, JSON.stringify(patient.reassignedBilling, null, 2));
      }
      // Process regular consultation bills - GROUP BY PATIENT AND DATE (not just invoice number)
      if (patient.billing && patient.billing.length > 0) {
        // Group bills by date (within 1 day) to combine all services from same visit
        const billsByDate = {};
        
        patient.billing.forEach(bill => {
          const billDate = new Date(bill.createdAt || patient.createdAt);
          const refundDate = bill.refundedAt ? new Date(bill.refundedAt) : null;
          
          // For refund reports, include bills if either:
          // 1. Bill date is within range, OR
          // 2. Refund date is within range
          const billDateMatches = !hasDateFilter || 
                                 ((!dateFilter.$gte || billDate >= dateFilter.$gte) && 
                                  (!dateFilter.$lte || billDate <= dateFilter.$lte));
          const refundDateMatches = refundDate && hasDateFilter &&
                                    ((!dateFilter.$gte || refundDate >= dateFilter.$gte) && 
                                     (!dateFilter.$lte || refundDate <= dateFilter.$lte));
          
          const matchesDateFilter = !hasDateFilter || billDateMatches || refundDateMatches;
          
          if (matchesDateFilter) {
            // Group by date (YYYY-MM-DD) to combine all services from same day
            const dateKey = billDate.toISOString().split('T')[0];
            
            if (!billsByDate[dateKey]) {
              billsByDate[dateKey] = [];
            }
            billsByDate[dateKey].push(bill);
          }
        });
        
        // Create one invoice per date (combining all services)
        Object.entries(billsByDate).forEach(([dateKey, bills]) => {
          // Use the first bill's invoice number, or generate one
          const primaryBill = bills[0];
          const invoiceNum = primaryBill.invoiceNumber || `INV-${patient.uhId}-${dateKey}`;
          const billDate = new Date(primaryBill.createdAt || patient.createdAt);
          
          // Check if this is a superconsultant consultation
          const isSuperconsultant = bills.some(bill => 
            bill.consultationType && 
            bill.consultationType.startsWith('superconsultant_')
          );
          
          // Find creator user ID from any bill in the array (check all bills, not just primary)
          let creatorUserId = null;
          for (const bill of bills) {
            // Log first bill structure for debugging
            if (bill === bills[0]) {
              console.log(`🔍 Checking bill structure for invoice ${invoiceNum}:`, {
                hasGeneratedBy: !!bill.generatedBy,
                hasCreatedBy: !!bill.createdBy,
                hasUserId: !!bill.userId,
                generatedBy: bill.generatedBy,
                createdBy: bill.createdBy,
                userId: bill.userId,
                paymentHistoryCount: bill.paymentHistory?.length || 0,
                billKeys: Object.keys(bill).slice(0, 20)
              });
            }
            
            if (bill.generatedBy) {
              creatorUserId = bill.generatedBy;
              console.log(`✅ Found creatorUserId from bill.generatedBy: ${creatorUserId}`);
              break;
            } else if (bill.createdBy) {
              creatorUserId = bill.createdBy;
              console.log(`✅ Found creatorUserId from bill.createdBy: ${creatorUserId}`);
              break;
            } else if (bill.userId) {
              creatorUserId = bill.userId;
              console.log(`✅ Found creatorUserId from bill.userId: ${creatorUserId}`);
              break;
            }
            // Also check paymentHistory for creator - check all entries
            if (bill.paymentHistory && bill.paymentHistory.length > 0) {
              console.log(`🔍 Checking paymentHistory for bill, found ${bill.paymentHistory.length} entries`);
              for (const payment of bill.paymentHistory) {
                if (payment.processedBy) {
                  creatorUserId = payment.processedBy;
                  console.log(`✅ Found creatorUserId from paymentHistory.processedBy: ${creatorUserId}`);
                  break;
                } else if (payment.createdBy) {
                  creatorUserId = payment.createdBy;
                  console.log(`✅ Found creatorUserId from paymentHistory.createdBy: ${creatorUserId}`);
                  break;
                }
              }
              if (creatorUserId) break;
            }
          }
          // If still not found, try primaryBill with all possible fields
          if (!creatorUserId) {
            creatorUserId = primaryBill.generatedBy || primaryBill.createdBy || primaryBill.userId || null;
            console.log(`🔍 After checking all bills, creatorUserId: ${creatorUserId}`);
            // Also check paymentHistory from primaryBill - check all entries
            if (!creatorUserId && primaryBill.paymentHistory && primaryBill.paymentHistory.length > 0) {
              console.log(`🔍 Checking primaryBill paymentHistory, found ${primaryBill.paymentHistory.length} entries`);
              for (const payment of primaryBill.paymentHistory) {
                if (payment.processedBy) {
                  creatorUserId = payment.processedBy;
                  console.log(`✅ Found creatorUserId from primaryBill paymentHistory.processedBy: ${creatorUserId}`);
                  break;
                } else if (payment.createdBy) {
                  creatorUserId = payment.createdBy;
                  console.log(`✅ Found creatorUserId from primaryBill paymentHistory.createdBy: ${creatorUserId}`);
                  break;
                }
              }
            }
          }
          
          // Log final result
          if (!creatorUserId) {
            console.log(`⚠️ No creatorUserId found for invoice ${invoiceNum} from bills or paymentHistory`);
          } else {
            console.log(`✅ Final creatorUserId for invoice ${invoiceNum}: ${creatorUserId}`);
          }
          
          // Extract discount information from primary bill or first bill with discount
          let totalDiscountAmount = 0;
          let discountPercentage = 0;
          let discountReason = '';
          
          // First, try to get discount from primary bill
          if (primaryBill.discountAmount || primaryBill.discount) {
            totalDiscountAmount = primaryBill.discountAmount || primaryBill.discount || 0;
            discountPercentage = primaryBill.discountPercentage || 0;
            discountReason = primaryBill.discountReason || '';
          }
          
          // Also check customData for discount (for superconsultant)
          if (!totalDiscountAmount && primaryBill.customData) {
            totalDiscountAmount = primaryBill.customData.discountAmount || primaryBill.customData.discount || 0;
            discountPercentage = primaryBill.customData.discountPercentage || discountPercentage || 0;
            discountReason = primaryBill.customData.discountReason || primaryBill.customData.discountNotes || discountReason || '';
          }
          
          // Create invoice with all services
          const invoice = {
            _id: primaryBill._id,
            patientId: patient._id,
            patientName: patient.name,
            patientAge: patient.age,
            patientGender: patient.gender,
            patientContact: patient.contact,
            uhId: patient.uhId,
            billType: isSuperconsultant ? 'Superconsultant' : 'Consultation',
            billNo: primaryBill.billNo || invoiceNum,
            invoiceNumber: invoiceNum,
            date: billDate,
            doctor: patient.assignedDoctor?.name || 'N/A',
            status: 'paid', // Will be updated based on bills
            services: [],
            amount: 0,
            paidAmount: 0,
            balance: 0,
            discount: discountPercentage || 0,
            discountAmount: totalDiscountAmount, // Will be accumulated from bills
            discountPercentage: discountPercentage,
            discountReason: discountReason,
            tax: primaryBill.tax || 0,
            paymentHistory: [],
            paymentMethod: primaryBill.paymentMethod,
            refunds: [],
            refundedAmount: 0,
            customData: {
              ...primaryBill.customData,
              discountAmount: totalDiscountAmount,
              discountPercentage: discountPercentage,
              discountReason: discountReason
            },
            notes: primaryBill.notes,
            generatedBy: creatorUserId,
            generatedAt: primaryBill.createdAt,
            createdAt: primaryBill.createdAt,
            // Cancellation fields
            cancelledAt: null,
            cancelledBy: null,
            cancellationReason: null,
            consultationType: primaryBill.consultationType || 'OP'
          };
          
          // Add all bills as service line items
          bills.forEach(bill => {
            invoice.services.push({
              name: bill.description || bill.type,
              serviceName: bill.description || bill.type,
              quantity: 1,
              charges: bill.amount || 0,
              amount: bill.amount || 0,
              paid: bill.paidAmount || 0,
              paidAmount: bill.paidAmount || 0,
              balance: (bill.amount || 0) - (bill.paidAmount || 0),
              status: bill.status
            });
            
            // Accumulate totals
            invoice.amount += bill.amount || 0;
            invoice.paidAmount += bill.paidAmount || 0;
            invoice.balance += (bill.amount || 0) - (bill.paidAmount || 0);
            
            // Accumulate discountAmount from individual bills
            const billDiscountAmount = bill.discountAmount || bill.discount || 0;
            invoice.discountAmount += billDiscountAmount;
            
            // If discountPercentage is not set yet, try to get it from individual bills
            if (!invoice.discountPercentage && bill.discountPercentage) {
              invoice.discountPercentage = bill.discountPercentage;
            }
            
            // If discountReason is not set yet, try to get it from individual bills
            if (!invoice.discountReason && bill.discountReason) {
              invoice.discountReason = bill.discountReason;
            }
            
            // Also check customData from individual bills
            if (bill.customData) {
              // Accumulate discountAmount from customData
              const customDiscountAmount = bill.customData.discountAmount || bill.customData.discount || 0;
              invoice.discountAmount += customDiscountAmount;
              
              // If discountPercentage is not set yet, try to get it from customData
              if (!invoice.discountPercentage && bill.customData.discountPercentage) {
                invoice.discountPercentage = bill.customData.discountPercentage;
              }
              
              // If discountReason is not set yet, try to get it from customData
              if (!invoice.discountReason && bill.customData.discountReason) {
                invoice.discountReason = bill.customData.discountReason || bill.customData.discountNotes || '';
              }
            }
            
            // Update status (worst case)
            if (bill.status === 'refunded') invoice.status = 'refunded';
            else if (bill.status === 'cancelled' && invoice.status !== 'refunded') {
              invoice.status = 'cancelled';
              // Set cancellation details from the latest cancelled bill
              if (bill.cancelledAt) invoice.cancelledAt = bill.cancelledAt;
              if (bill.cancelledBy) invoice.cancelledBy = bill.cancelledBy;
              if (bill.cancellationReason) invoice.cancellationReason = bill.cancellationReason;
            }
            else if (bill.status === 'pending' && !['refunded', 'cancelled'].includes(invoice.status)) invoice.status = 'pending';
            else if (bill.status === 'partially_paid' && !['refunded', 'cancelled', 'pending'].includes(invoice.status)) invoice.status = 'partially_paid';
            
            // Merge payment histories
            if (bill.paymentHistory && bill.paymentHistory.length > 0) {
              invoice.paymentHistory.push(...bill.paymentHistory);
            }
            
            // Merge refunds
            if (bill.refunds && bill.refunds.length > 0) {
              invoice.refunds.push(...bill.refunds);
              invoice.refundedAmount += bill.refunds.reduce((sum, r) => sum + (r.amount || 0), 0);
            }
          });
          
          // Apply filters
          // If billType is not specified, include all bills
          // If billType is 'consultation', include only regular consultation bills (not superconsultant)
          // If billType is 'superconsultant', include only superconsultant bills
          const shouldInclude = !billType || 
                               (billType === 'consultation' && !isSuperconsultant) ||
                               (billType === 'superconsultant' && isSuperconsultant);
          
          // Filter by consultation type if specified
          const matchesConsultationType = !consultationType || 
                                         invoice.consultationType === consultationType ||
                                         (consultationType === 'OP' && !invoice.consultationType);
          
          if (shouldInclude && matchesConsultationType) {
            if (!status || invoice.status === status) {
              invoiceMap.set(invoiceNum, invoice);
            }
          }
        });
      }

      // Process reassignment bills - GROUP BY INVOICE NUMBER
      if (patient.reassignedBilling && patient.reassignedBilling.length > 0) {
        console.log(`🔍 Processing ${patient.reassignedBilling.length} reassignment bills for patient ${patient.name}:`, 
          patient.reassignedBilling.map(b => ({ 
            invoiceNumber: b.invoiceNumber, 
            amount: b.amount, 
            status: b.status,
            createdAt: b.createdAt 
          }))
        );
        
        patient.reassignedBilling.forEach(bill => {
          const billDate = new Date(bill.createdAt || patient.createdAt);
          const refundDate = bill.refundedAt ? new Date(bill.refundedAt) : null;
          
          // For refund reports, include bills if either:
          // 1. Bill date is within range, OR
          // 2. Refund date is within range
          const billDateMatches = !hasDateFilter || 
                                 ((!dateFilter.$gte || billDate >= dateFilter.$gte) && 
                                  (!dateFilter.$lte || billDate <= dateFilter.$lte));
          const refundDateMatches = refundDate && hasDateFilter &&
                                    ((!dateFilter.$gte || refundDate >= dateFilter.$gte) && 
                                     (!dateFilter.$lte || refundDate <= dateFilter.$lte));
          
          const matchesDateFilter = !hasDateFilter || billDateMatches || refundDateMatches;
          
          if (matchesDateFilter) {
            const invoiceNum = bill.invoiceNumber || `REASSIGN-${bill._id}`;
            
            console.log(`🔍 Processing reassignment bill: ${invoiceNum} for patient ${patient.name}`);
            
            // Extract discount information from reassignment billing
            const reassignmentDiscountAmount = bill.discountAmount || 
                                              bill.customData?.discountAmount || 
                                              bill.customData?.discount || 
                                              0;
            const reassignmentDiscountPercentage = bill.discountPercentage || 
                                                   bill.customData?.discountPercentage || 
                                                   0;
            const reassignmentDiscountReason = bill.discountReason || 
                                              bill.customData?.discountReason || 
                                              bill.customData?.discountNotes || 
                                              '';
            
            // Get or create invoice entry
            if (!invoiceMap.has(invoiceNum)) {
              console.log(`📝 Creating new invoice entry for reassignment: ${invoiceNum}`);
              invoiceMap.set(invoiceNum, {
                _id: bill._id,
                patientId: patient._id,
                patientName: patient.name,
                patientAge: patient.age,
                patientGender: patient.gender,
                patientContact: patient.contact,
                uhId: patient.uhId,
                billType: 'Reassignment',
                billNo: bill.billNo || bill.invoiceNumber,
                invoiceNumber: invoiceNum,
                date: billDate,
                doctor: patient.currentDoctor?.name || 'N/A',
                status: bill.status || 'pending',
                services: bill.customData?.services || [],
                amount: bill.amount || 0,
                paidAmount: bill.paidAmount || 0,
                balance: (bill.amount || 0) - (bill.paidAmount || 0),
                discount: reassignmentDiscountPercentage || 0,
                discountAmount: reassignmentDiscountAmount,
                discountPercentage: reassignmentDiscountPercentage,
                discountReason: reassignmentDiscountReason,
                tax: bill.customData?.taxPercentage || 0,
                paymentHistory: bill.paymentHistory || [],
                paymentMethod: bill.paymentMethod,
                refunds: bill.refunds || [],
                refundedAmount: bill.refunds?.reduce((sum, r) => sum + (r.amount || 0), 0) || 0,
                customData: {
                  ...bill.customData,
                  discountAmount: reassignmentDiscountAmount,
                  discountPercentage: reassignmentDiscountPercentage,
                  discountReason: reassignmentDiscountReason
                },
                notes: bill.notes,
                generatedBy: bill.generatedBy,
                generatedAt: bill.createdAt
              });
            } else {
              console.log(`⚠️ Invoice ${invoiceNum} already exists, skipping duplicate`);
            }
          }
        });
      }
    });

    const consultationBills = Array.from(invoiceMap.values());
    console.log(`📊 Total invoices created: ${consultationBills.length}`);
    console.log(`📊 Reassignment invoices:`, consultationBills.filter(b => b.billType === 'Reassignment').map(b => ({
      invoiceNumber: b.invoiceNumber,
      patientName: b.patientName,
      amount: b.amount,
      status: b.status
    })));

      // 2. Get test/lab bills from TestRequest
    const testQuery = {};
    if (hasDateFilter) {
      // For refund reports, include test requests if either:
      // 1. Created within date range, OR
      // 2. Has refund within date range
      if (centerId) {
        // Combine centerId with date filters using $and
        testQuery.$and = [
          { centerId: centerId },
          {
            $or: [
              { createdAt: dateFilter },
              { 'billing.refundedAt': dateFilter }
            ]
          }
        ];
      } else {
        testQuery.$or = [
          { createdAt: dateFilter },
          { 'billing.refundedAt': dateFilter }
        ];
      }
    } else if (centerId) {
      // No date filter, just filter by centerId
      testQuery.centerId = centerId;
    }
    
    console.log(`🔍 TestRequest query:`, JSON.stringify(testQuery));

    let testRequests = [];
    try {
      testRequests = await TestRequest.find(testQuery)
        .populate({
          path: 'patientId',
          select: 'name uhId',
          model: 'Patient'
        })
        .populate({
          path: 'doctorId',
          select: 'name',
          model: 'User'
        })
        .select('patientId doctorId billing status createdAt patientName');
    } catch (testError) {
      console.error('Error fetching test requests:', testError);
      return res.status(500).json({ 
        message: 'Error fetching test request data', 
        error: testError.message 
      });
    }


    const testBills = [];
    
    // Process each test request and manually fetch patient data if needed
    for (const testReq of testRequests) {
      if (testReq.billing && (!billType || billType === 'lab')) {
        if (!status || testReq.billing.status === status) {
          // Try to get patient info from populated field, stored field, or fetch manually
          let patientName = 'Unknown Patient';
          let patientUhId = 'N/A';
          let patientIdValue = null;

          if (testReq.patientId) {
            if (typeof testReq.patientId === 'object' && testReq.patientId._id) {
              // Already populated
              patientName = testReq.patientId.name || testReq.patientName || 'Unknown Patient';
              patientUhId = testReq.patientId.uhId || 'N/A';
              patientIdValue = testReq.patientId._id;
            } else {
              // Just an ID - fetch patient manually
              patientIdValue = testReq.patientId;
              try {
                const patient = await Patient.findById(testReq.patientId).select('name uhId');
                if (patient) {
                  patientName = patient.name || testReq.patientName || 'Unknown Patient';
                  patientUhId = patient.uhId || 'N/A';
                }
              } catch (err) {
                console.error(`Failed to fetch patient ${testReq.patientId}:`, err.message);
                patientName = testReq.patientName || 'Unknown Patient';
              }
            }
          }

          // Extract discount information from TestRequest billing
          let discountAmount = testReq.billing.discounts || 0;
          
          // Convert billing.items to services format
          const services = (testReq.billing.items || []).map(item => ({
            name: item.name || 'Test',
            serviceName: item.name || 'Test',
            quantity: item.quantity || 1,
            charges: item.unitPrice || item.total || 0,
            amount: item.total || (item.unitPrice || 0) * (item.quantity || 1),
            unitPrice: item.unitPrice || 0
          }));
          
          // Calculate services total from items (this is the subtotal before discount)
          const servicesTotal = services.reduce((sum, service) => {
            const serviceTotal = service.amount || (service.charges || service.unitPrice || 0) * (service.quantity || 1);
            return sum + serviceTotal;
          }, 0);
          
          // Use billing.subTotal if available, otherwise calculate from services
          const subTotal = testReq.billing.subTotal || servicesTotal || testReq.billing.amount || 0;
          const finalAmount = testReq.billing.amount || 0;
          
          // If discountAmount is 0 but servicesTotal > finalAmount, calculate implied discount
          if (discountAmount === 0 && servicesTotal > finalAmount && finalAmount > 0 && servicesTotal > 0) {
            discountAmount = servicesTotal - finalAmount;
          }
          
          // Calculate discount percentage if discount exists
          let discountPercentage = 0;
          if (discountAmount > 0 && subTotal > 0) {
            discountPercentage = (discountAmount / subTotal) * 100;
          }
          
          testBills.push({
            _id: testReq._id,
            patientId: patientIdValue,
            patientName: patientName,
            uhId: patientUhId,
            billType: 'Lab/Test',
            description: testReq.billing.description || 'Laboratory Test',
            amount: finalAmount, // Final amount after discount
            paidAmount: testReq.billing.paidAmount || 0,
            balance: finalAmount - (testReq.billing.paidAmount || 0),
            status: testReq.billing.status || 'pending',
            paymentMethod: testReq.billing.paymentMethod,
            date: testReq.createdAt,
            doctor: testReq.doctorId?.name || testReq.doctorName || 'N/A',
            invoiceNumber: testReq.billing.invoiceNumber || `${testReq._id}`,
            // Discount fields
            discountAmount: discountAmount,
            discount: discountAmount, // Alias for compatibility
            discountPercentage: discountPercentage > 0 ? discountPercentage : null,
            discountReason: testReq.billing.discountReason || testReq.billing.notes || '', // Use discountReason if available, otherwise notes
            // Services array for discount calculation
            services: services,
            // CustomData for additional discount information
            customData: {
              subTotal: subTotal,
              grandTotal: finalAmount,
              discountAmount: discountAmount,
              discountPercentage: discountPercentage > 0 ? discountPercentage : null,
              discountReason: testReq.billing.discountReason || testReq.billing.notes || '', // Include discount reason in customData
              servicesTotal: servicesTotal,
              notes: testReq.billing.notes || ''
            },
            // User tracking
            generatedBy: testReq.billing.generatedBy || null,
            createdAt: testReq.createdAt,
            // Refund information
            refundedBy: testReq.billing.refundedBy || null,
            refundedByName: null, // Will be populated later from userMap
            refundedAt: testReq.billing.refundedAt || null,
            refundAmount: testReq.billing.refundAmount || 0,
            refundMethod: testReq.billing.refundMethod || null,
            refundReason: testReq.billing.refundReason || null,
            refundNotes: testReq.billing.refundNotes || null,
            // Refunds array if available
            refunds: testReq.billing.refunds || []
          });
        }
      }
    }


    // 3. Get payment logs
    const paymentQuery = centerId ? { centerId } : {};
    if (hasDateFilter) {
      paymentQuery.createdAt = dateFilter;
    }

    let paymentLogs = [];
    
    // Create a map of invoice number to creator user ID from payment logs
    const invoiceCreatorMap = new Map();
    try {
      paymentLogs = await PaymentLog.find(paymentQuery)
        .populate('patientId', 'name uhId')
        .populate('processedBy', 'name')
        .populate('createdBy', 'name')
        .sort({ createdAt: -1 });
      
      // Manually populate refund.refundedBy for documents that have refunds
      // Note: Mongoose doesn't support populating nested paths directly, so we do it manually
      const refundedByIds = new Set();
      paymentLogs.forEach(log => {
        if (log.refund && log.refund.refundedBy) {
          // Handle both ObjectId and populated object cases
          let refundedById = null;
          if (log.refund.refundedBy._id) {
            refundedById = log.refund.refundedBy._id.toString();
          } else if (typeof log.refund.refundedBy === 'object' && log.refund.refundedBy.toString) {
            refundedById = log.refund.refundedBy.toString();
          } else if (typeof log.refund.refundedBy === 'string') {
            refundedById = log.refund.refundedBy;
          }
          if (refundedById) {
            refundedByIds.add(refundedById);
          }
        }
      });
      
      if (refundedByIds.size > 0) {
        try {
          const refundedByUsers = await User.find({ _id: { $in: Array.from(refundedByIds) } }).select('name');
          const refundedByUserMap = new Map();
          refundedByUsers.forEach(user => {
            refundedByUserMap.set(user._id.toString(), user.name);
          });
          
          // Attach names to refund.refundedBy
          paymentLogs.forEach(log => {
            if (log.refund && log.refund.refundedBy) {
              let refundedById = null;
              if (log.refund.refundedBy._id) {
                refundedById = log.refund.refundedBy._id.toString();
              } else if (typeof log.refund.refundedBy === 'object' && log.refund.refundedBy.toString) {
                refundedById = log.refund.refundedBy.toString();
              } else if (typeof log.refund.refundedBy === 'string') {
                refundedById = log.refund.refundedBy;
              }
              
              if (refundedById && refundedByUserMap.has(refundedById)) {
                const userName = refundedByUserMap.get(refundedById);
                // Ensure refund.refundedBy is an object with name
                if (log.refund.refundedBy._id || (typeof log.refund.refundedBy === 'object' && !log.refund.refundedBy.name)) {
                  log.refund.refundedBy = {
                    _id: log.refund.refundedBy._id || log.refund.refundedBy,
                    name: userName
                  };
                } else if (typeof log.refund.refundedBy === 'string') {
                  log.refund.refundedBy = {
                    _id: log.refund.refundedBy,
                    name: userName
                  };
                } else {
                  log.refund.refundedBy.name = userName;
                }
              }
            }
          });
        } catch (populateError) {
          console.error('Error populating refund.refundedBy:', populateError);
          // Continue without populating - not critical
        }
      }
      
      // Build map of invoice number to creator user ID
      paymentLogs.forEach(log => {
        if (log.invoiceNumber) {
          // Use createdBy first, then processedBy as fallback
          // Handle both populated and non-populated cases
          let creatorId = null;
          if (log.createdBy) {
            creatorId = typeof log.createdBy === 'object' ? log.createdBy._id : log.createdBy;
          } else if (log.processedBy) {
            creatorId = typeof log.processedBy === 'object' ? log.processedBy._id : log.processedBy;
          }
          
          if (creatorId && !invoiceCreatorMap.has(log.invoiceNumber)) {
            invoiceCreatorMap.set(log.invoiceNumber, creatorId.toString());
            console.log(`✅ Mapped invoice ${log.invoiceNumber} to creator ${creatorId.toString()}`);
          }
        }
      });
      console.log(`📊 Invoice creator map size: ${invoiceCreatorMap.size}`);
    } catch (paymentError) {
      console.error('Error fetching payment logs:', paymentError);
      return res.status(500).json({ 
        message: 'Error fetching payment log data', 
        error: paymentError.message 
      });
    }

    const transactions = paymentLogs.map(log => ({
      _id: log._id,
      patientId: log.patientId?._id,
      patientName: log.patientId?.name || 'N/A',
      uhId: log.patientId?.uhId || 'N/A',
      transactionType: log.paymentType || 'payment',
      description: log.description || 'Payment',
      amount: log.amount || 0,
      paymentMethod: log.paymentMethod,
      date: log.createdAt,
      doctor: log.processedBy?.name || 'N/A',
      invoiceNumber: log.invoiceNumber,
      status: log.status || 'completed',
      // Include refund information if available
      refund: log.refund ? {
        refundedAmount: log.refund.refundedAmount || 0,
        refundedAt: log.refund.refundedAt,
        refundedBy: log.refund.refundedBy,
        refundMethod: log.refund.refundMethod || log.paymentMethod,
        externalRefundId: log.refund.externalRefundId,
        refundReason: log.refund.refundReason
      } : null,
      // Include refundedBy at top level for easier access (from refund object, not top level)
      refundedBy: log.refund?.refundedBy || null,
      processedBy: log.processedBy
    }));

    // Combine all bills (already complete invoice structures)
    // 4. Get SLIT therapy bills
    const slitQuery = {};
    if (hasDateFilter) {
      // For refund reports, include SLIT therapy requests if either:
      // 1. Created within date range, OR
      // 2. Billing generated within date range, OR
      // 3. Has refund within date range
      if (centerId) {
        // Combine centerId with date filters using $and
        slitQuery.$and = [
          { centerId: centerId },
          {
            $or: [
              { 'billing.generatedAt': dateFilter },
              { createdAt: dateFilter },
              { 'billing.refundedAt': dateFilter }
            ]
          }
        ];
      } else {
        slitQuery.$or = [
          { 'billing.generatedAt': dateFilter },
          { createdAt: dateFilter },
          { 'billing.refundedAt': dateFilter }
        ];
      }
    } else if (centerId) {
      // No date filter, just filter by centerId
      slitQuery.centerId = centerId;
    }
    
    console.log(`🔍 SlitTherapyRequest query:`, JSON.stringify(slitQuery));

    let slitTherapyRequests = [];
    const slitBills = [];
    
    try {
      slitTherapyRequests = await SlitTherapyRequest.find(slitQuery)
        .populate('patientId', 'name uhId')
        .populate('createdBy', 'name')
        .sort({ createdAt: -1 });

      for (const slitReq of slitTherapyRequests) {
        // Only process if billing exists
        if (!slitReq.billing) continue;
        
        if (!billType || billType === 'slit_therapy' || billType === 'Slit Therapy') {
          if (!status || slitReq.billing.status === status) {
            // Get patient info
            let patientName = 'Unknown Patient';
            let patientUhId = 'N/A';
            let patientIdValue = null;

            if (slitReq.patientId) {
              if (typeof slitReq.patientId === 'object' && slitReq.patientId._id) {
                patientName = slitReq.patientId.name || slitReq.patientName || 'Unknown Patient';
                patientUhId = slitReq.patientId.uhId || 'N/A';
                patientIdValue = slitReq.patientId._id;
              } else {
                patientIdValue = slitReq.patientId;
                try {
                  const patient = await Patient.findById(slitReq.patientId).select('name uhId');
                  if (patient) {
                    patientName = patient.name || slitReq.patientName || 'Unknown Patient';
                    patientUhId = patient.uhId || 'N/A';
                  }
                } catch (err) {
                  console.error(`Failed to fetch patient ${slitReq.patientId}:`, err.message);
                  patientName = slitReq.patientName || 'Unknown Patient';
                }
              }
            } else {
              patientName = slitReq.patientName || 'Unknown Patient';
            }

            // Convert billing.items to services format
            const services = (slitReq.billing.items || []).map(item => ({
              name: item.name || 'SLIT Therapy',
              serviceName: item.name || 'SLIT Therapy',
              quantity: item.quantity || 1,
              charges: item.unitPrice || item.total || 0,
              amount: item.total || (item.unitPrice || 0) * (item.quantity || 1),
              unitPrice: item.unitPrice || 0
            }));

            // Calculate services total
            const servicesTotal = services.reduce((sum, service) => {
              const serviceTotal = service.amount || (service.charges || service.unitPrice || 0) * (service.quantity || 1);
              return sum + serviceTotal;
            }, 0);

            const finalAmount = slitReq.billing.amount || 0;
            const paidAmount = slitReq.billing.paidAmount || 0;

            slitBills.push({
              _id: slitReq._id,
              patientId: patientIdValue,
              patientName: patientName,
              uhId: patientUhId,
              billType: 'Slit Therapy',
              description: `SLIT Therapy - ${slitReq.productName || slitReq.productCode || 'Product'}`,
              amount: finalAmount,
              paidAmount: paidAmount,
              balance: finalAmount - paidAmount,
              status: slitReq.billing.status || 'generated',
              paymentMethod: slitReq.billing.paymentMethod,
              date: slitReq.billing.generatedAt || slitReq.createdAt,
              invoiceNumber: slitReq.billing.invoiceNumber || `SLIT-${slitReq._id}`,
              // Services array
              services: services,
              // User tracking
              generatedBy: slitReq.billing.generatedBy || slitReq.createdBy || null,
              createdAt: slitReq.billing.generatedAt || slitReq.createdAt,
              // Payment tracking
              paidAt: slitReq.billing.paidAt,
              paidBy: slitReq.billing.paidBy || null,
              // Refund tracking
              refundedAmount: slitReq.billing.refundAmount || 0,
              refundMethod: slitReq.billing.refundMethod,
              refundedAt: slitReq.billing.refundedAt,
              // Cancellation tracking
              cancelledAt: slitReq.billing.cancelledAt,
              cancellationReason: slitReq.billing.cancellationReason,
              // Custom data
              customData: {
                productCode: slitReq.productCode,
                productName: slitReq.productName,
                quantity: slitReq.quantity,
                courierRequired: slitReq.courierRequired,
                courierFee: slitReq.courierFee,
                deliveryMethod: slitReq.deliveryMethod,
                transactionId: slitReq.billing.transactionId,
                notes: slitReq.billing.paymentNotes || slitReq.notes || ''
              }
            });
          }
        }
      }
      console.log(`📊 SLIT Therapy bills: ${slitBills.length}`);
    } catch (slitError) {
      console.error('Error fetching SLIT therapy requests:', slitError);
      // Don't return error, just log it and continue
    }

    const allInvoices = [...consultationBills, ...testBills, ...slitBills];
    
    // Collect all invoice numbers from bills for PaymentLog lookup
    const allInvoiceNumbers = new Set();
    allInvoices.forEach(inv => {
      if (inv.invoiceNumber) allInvoiceNumbers.add(inv.invoiceNumber);
      if (inv.billNo) allInvoiceNumbers.add(inv.billNo);
    });
    
    // Query payment logs again if needed, using invoice numbers to find creators
    // This ensures we get payment logs for invoices even if they're outside the date filter
    if (allInvoiceNumbers.size > 0) {
      try {
        console.log(`🔍 Querying PaymentLogs for ${allInvoiceNumbers.size} invoice numbers:`, Array.from(allInvoiceNumbers).slice(0, 5));
        const additionalPaymentLogs = await PaymentLog.find({
          ...(centerId ? { centerId } : {}),
          invoiceNumber: { $in: Array.from(allInvoiceNumbers) }
        })
          .populate('createdBy', 'name')
          .populate('processedBy', 'name')
          .select('invoiceNumber createdBy processedBy transactionId status refund refundedBy');
        
        console.log(`📊 Found ${additionalPaymentLogs.length} PaymentLogs for invoices`);
        
        additionalPaymentLogs.forEach(log => {
          if (log.invoiceNumber && !invoiceCreatorMap.has(log.invoiceNumber)) {
            let creatorId = null;
            if (log.createdBy) {
              creatorId = typeof log.createdBy === 'object' ? log.createdBy._id : log.createdBy;
            } else if (log.processedBy) {
              creatorId = typeof log.processedBy === 'object' ? log.processedBy._id : log.processedBy;
            }
            if (creatorId) {
              invoiceCreatorMap.set(log.invoiceNumber, creatorId.toString());
              console.log(`✅ Additional mapping: invoice ${log.invoiceNumber} to creator ${creatorId.toString()}`);
            } else {
              console.log(`⚠️ PaymentLog found for ${log.invoiceNumber} but no creator ID`);
            }
          }
        });
        
        // Also check if any invoices have transactionId that matches PaymentLogs
        const transactionIds = new Set();
        allInvoices.forEach(inv => {
          if (inv.customData?.transactionId) {
            transactionIds.add(inv.customData.transactionId);
          }
        });
        
        if (transactionIds.size > 0) {
          console.log(`🔍 Also checking PaymentLogs by transactionId: ${transactionIds.size} transaction IDs`);
          const transactionPaymentLogs = await PaymentLog.find({
            ...(centerId ? { centerId } : {}),
            transactionId: { $in: Array.from(transactionIds) }
          })
            .populate('createdBy', 'name')
            .populate('processedBy', 'name')
            .select('invoiceNumber createdBy processedBy transactionId status refund refundedBy');
          
          transactionPaymentLogs.forEach(log => {
            if (log.invoiceNumber && !invoiceCreatorMap.has(log.invoiceNumber)) {
              let creatorId = null;
              if (log.createdBy) {
                creatorId = typeof log.createdBy === 'object' ? log.createdBy._id : log.createdBy;
              } else if (log.processedBy) {
                creatorId = typeof log.processedBy === 'object' ? log.processedBy._id : log.processedBy;
              }
              if (creatorId) {
                invoiceCreatorMap.set(log.invoiceNumber, creatorId.toString());
                console.log(`✅ Additional mapping via transactionId: invoice ${log.invoiceNumber} to creator ${creatorId.toString()}`);
              }
            }
          });
        }
      } catch (err) {
        console.error('Error fetching additional payment logs:', err);
      }
    }
    
    // Match refunded PaymentLog entries to bills and add refund information
    const refundMap = new Map(); // Map invoice number to refund information
    const refundedPaymentLogs = paymentLogs.filter(log => {
      const logStatus = log.status?.toLowerCase() || '';
      return logStatus === 'refunded' || (log.refund && log.refund.refundedAmount > 0);
    });

    refundedPaymentLogs.forEach(log => {
      if (log.invoiceNumber) {
        // Extract refundedBy ID (could be ObjectId or populated object)
        let refundedById = null;
        if (log.refund?.refundedBy) {
          refundedById = typeof log.refund.refundedBy === 'object' ? log.refund.refundedBy._id : log.refund.refundedBy;
        } else if (log.refundedBy) {
          refundedById = typeof log.refundedBy === 'object' ? log.refundedBy._id : log.refundedBy;
        } else if (log.processedBy) {
          refundedById = typeof log.processedBy === 'object' ? log.processedBy._id : log.processedBy;
        }

        // Extract refundedBy name (if populated)
        let refundedByName = null;
        if (log.refund?.refundedBy?.name) {
          refundedByName = log.refund.refundedBy.name;
        } else if (log.refundedBy?.name) {
          refundedByName = log.refundedBy.name;
        } else if (log.processedBy?.name) {
          refundedByName = log.processedBy.name;
        }

        const refundInfo = {
          refundedAmount: log.refund?.refundedAmount || log.amount || 0,
          refundedAt: log.refund?.refundedAt || log.updatedAt || log.createdAt,
          refundedBy: refundedById,
          refundedByName: refundedByName, // Will be populated later from userMap if null
          refundMethod: log.refund?.refundMethod || log.paymentMethod || 'cash',
          externalRefundId: log.refund?.externalRefundId || log.transactionId || '',
          invoiceNumber: log.invoiceNumber,
          transactionId: log.transactionId
        };
        
        // Store refund info keyed by invoice number
        if (!refundMap.has(log.invoiceNumber)) {
          refundMap.set(log.invoiceNumber, []);
        }
        refundMap.get(log.invoiceNumber).push(refundInfo);
      }
    });

    // Add refund information to bills (before populating user names)
    // We'll populate refundedByName after we query users
    allInvoices.forEach(inv => {
      const invoiceNumber = inv.invoiceNumber || inv.billNo;
      if (invoiceNumber && refundMap.has(invoiceNumber)) {
        const refunds = refundMap.get(invoiceNumber);
        if (!inv.refunds || !Array.isArray(inv.refunds)) {
          inv.refunds = [];
        }
        // Add refunds from PaymentLog entries
        refunds.forEach(refundInfo => {
          inv.refunds.push({
            amount: refundInfo.refundedAmount,
            refundAmount: refundInfo.refundedAmount,
            refundedAt: refundInfo.refundedAt,
            processedAt: refundInfo.refundedAt,
            refundedBy: refundInfo.refundedBy,
            refundedByName: refundInfo.refundedByName, // Will be populated later from userMap
            processedByName: refundInfo.refundedByName, // Will be populated later from userMap
            refundMethod: refundInfo.refundMethod,
            paymentMethod: refundInfo.refundMethod,
            transactionId: refundInfo.externalRefundId || refundInfo.transactionId,
            receiptNumber: refundInfo.invoiceNumber
          });
        });
        
        // Also update bill-level refund information if not already set
        if (refunds.length > 0) {
          const latestRefund = refunds[0]; // Use first refund (most recent)
          if (!inv.refundedAmount || inv.refundedAmount === 0) {
            inv.refundedAmount = latestRefund.refundedAmount;
          }
          if (!inv.refundedAt) {
            inv.refundedAt = latestRefund.refundedAt;
          }
          if (!inv.refundedBy) {
            inv.refundedBy = latestRefund.refundedBy;
          }
          if (!inv.refundedByName) {
            inv.refundedByName = latestRefund.refundedByName; // Will be populated later from userMap
          }
          if (!inv.refundMethod) {
            inv.refundMethod = latestRefund.refundMethod;
          }
        }
      }

      // Update invoices with generatedBy from PaymentLogs if not already set
      if (!inv.generatedBy && !inv.createdBy && !inv.userId) {
        if (invoiceNumber && invoiceCreatorMap.has(invoiceNumber)) {
          const creatorId = invoiceCreatorMap.get(invoiceNumber);
          inv.generatedBy = creatorId;
          console.log(`✅ Set generatedBy from PaymentLog for invoice ${invoiceNumber}: ${creatorId}`);
        } else {
          // If still not found, try to query PaymentLogs by patientId and date as fallback
          console.log(`⚠️ No PaymentLog found for invoice ${invoiceNumber}, trying patientId fallback...`);
          // Note: This would require an async operation, so we'll handle it after the loop
        }
      }
    });
    
    // Final fallback: Query PaymentLogs by patientId and date for invoices without generatedBy
    const invoicesWithoutCreator = allInvoices.filter(inv => !inv.generatedBy && !inv.createdBy && !inv.userId);
    if (invoicesWithoutCreator.length > 0) {
      console.log(`🔍 Final fallback: Checking PaymentLogs for ${invoicesWithoutCreator.length} invoices without creator`);
      try {
        const patientIds = [...new Set(invoicesWithoutCreator.map(inv => inv.patientId.toString()))];
        const fallbackPaymentLogs = await PaymentLog.find({
          ...(centerId ? { centerId } : {}),
          patientId: { $in: patientIds }
        })
          .populate('createdBy', 'name')
          .populate('processedBy', 'name')
          .select('invoiceNumber createdBy processedBy patientId createdAt')
          .sort({ createdAt: -1 });
        
        console.log(`📊 Found ${fallbackPaymentLogs.length} PaymentLogs for patient fallback`);
        
        // Try to match by invoice number and date proximity
        invoicesWithoutCreator.forEach(inv => {
          const invoiceDate = new Date(inv.date || inv.createdAt);
          const matchingLogs = fallbackPaymentLogs.filter(log => {
            const logDate = new Date(log.createdAt);
            const dateDiff = Math.abs(invoiceDate - logDate);
            const isSameDay = dateDiff < 24 * 60 * 60 * 1000; // Within 24 hours
            const matchesPatient = log.patientId?.toString() === inv.patientId?.toString();
            const matchesInvoice = log.invoiceNumber === inv.invoiceNumber || log.invoiceNumber === inv.billNo;
            return matchesPatient && (matchesInvoice || isSameDay);
          });
          
          if (matchingLogs.length > 0) {
            const log = matchingLogs[0]; // Use first matching log
            let creatorId = null;
            if (log.createdBy) {
              creatorId = typeof log.createdBy === 'object' ? log.createdBy._id : log.createdBy;
            } else if (log.processedBy) {
              creatorId = typeof log.processedBy === 'object' ? log.processedBy._id : log.processedBy;
            }
            if (creatorId) {
              inv.generatedBy = creatorId.toString();
              if (log.invoiceNumber) {
                invoiceCreatorMap.set(log.invoiceNumber, creatorId.toString());
              }
              console.log(`✅ Fallback: Set generatedBy for invoice ${inv.invoiceNumber} from PaymentLog: ${creatorId.toString()}`);
            }
          }
        });
      } catch (err) {
        console.error('Error in fallback PaymentLog query:', err);
      }
    }

    // Populate user names for generatedBy, cancelledBy, and refund users
    const userIds = new Set();
    
    // First, collect user IDs from invoiceCreatorMap (from PaymentLogs)
    invoiceCreatorMap.forEach((creatorId) => {
      userIds.add(creatorId.toString());
    });
    
    // Collect refundedBy IDs from test requests
    testBills.forEach(inv => {
      if (inv.refundedBy) {
        const refundedById = typeof inv.refundedBy === 'object' ? inv.refundedBy._id?.toString() : inv.refundedBy?.toString();
        if (refundedById) userIds.add(refundedById);
      }
      if (inv.refunds && Array.isArray(inv.refunds)) {
        inv.refunds.forEach(refund => {
          if (refund.refundedBy) {
            const refundedById = typeof refund.refundedBy === 'object' ? refund.refundedBy._id?.toString() : refund.refundedBy?.toString();
            if (refundedById) userIds.add(refundedById);
          }
        });
      }
    });
    
    // Collect user IDs from refundMap (refundedBy IDs from PaymentLogs)
    refundMap.forEach((refunds) => {
      refunds.forEach(refundInfo => {
        if (refundInfo.refundedBy) {
          userIds.add(refundInfo.refundedBy.toString());
        }
      });
    });
    
    allInvoices.forEach(inv => {
      // Collect creator user IDs from multiple possible fields
      if (inv.generatedBy) userIds.add(inv.generatedBy.toString());
      if (inv.createdBy) userIds.add(inv.createdBy.toString());
      if (inv.userId) userIds.add(inv.userId.toString());
      if (inv.cancelledBy) userIds.add(inv.cancelledBy.toString());
      if (inv.refundedBy) {
        const refundedById = typeof inv.refundedBy === 'object' ? inv.refundedBy._id : inv.refundedBy;
        userIds.add(refundedById.toString());
      }
      // Also collect user IDs from refunds array
      if (inv.refunds && Array.isArray(inv.refunds)) {
        inv.refunds.forEach(refund => {
          if (refund.refundedBy) {
            const refundedById = typeof refund.refundedBy === 'object' ? refund.refundedBy._id : refund.refundedBy;
            userIds.add(refundedById.toString());
          }
          if (refund.approvedBy) {
            const approvedById = typeof refund.approvedBy === 'object' ? refund.approvedBy._id : refund.approvedBy;
            userIds.add(approvedById.toString());
          }
        });
      }
      // Also collect user IDs from payment history
      if (inv.paymentHistory && Array.isArray(inv.paymentHistory)) {
        inv.paymentHistory.forEach(payment => {
          if (payment.processedBy) userIds.add(payment.processedBy.toString());
          if (payment.createdBy) userIds.add(payment.createdBy.toString());
        });
      }
    });
    
    // After fallback, collect any new generatedBy IDs that were set
    allInvoices.forEach(inv => {
      if (inv.generatedBy) userIds.add(inv.generatedBy.toString());
    });
    
    console.log(`📊 Total user IDs collected: ${userIds.size}`);
    
    const users = await User.find({ _id: { $in: Array.from(userIds) } }).select('name username');
    const userMap = new Map();
    users.forEach(user => {
      userMap.set(user._id.toString(), user.name || user.username);
    });
    
    // Add user names to invoices
    allInvoices.forEach(inv => {
      // Try to populate createdByName from generatedBy, createdBy, userId, or payment logs
      if (inv.generatedBy) {
        inv.createdByName = userMap.get(inv.generatedBy.toString()) || 'N/A';
        inv.generatedByName = inv.createdByName; // Add alias
      } else if (inv.createdBy) {
        inv.createdByName = userMap.get(inv.createdBy.toString()) || 'N/A';
        inv.generatedByName = inv.createdByName; // Add alias
      } else if (inv.userId) {
        inv.createdByName = userMap.get(inv.userId.toString()) || 'N/A';
        inv.generatedByName = inv.createdByName; // Add alias
      } else {
        // Try to find creator from payment logs using invoice number
        const invoiceNumber = inv.invoiceNumber || inv.billNo;
        console.log(`🔍 Looking for creator for invoice ${invoiceNumber}:`, {
          hasInMap: invoiceCreatorMap.has(invoiceNumber),
          invoiceNumber,
          paymentHistory: inv.paymentHistory?.length || 0,
          mapKeys: Array.from(invoiceCreatorMap.keys()).slice(0, 5)
        });
        if (invoiceNumber && invoiceCreatorMap.has(invoiceNumber)) {
          const creatorId = invoiceCreatorMap.get(invoiceNumber);
          inv.generatedBy = creatorId; // Set it for consistency
          inv.createdByName = userMap.get(creatorId) || 'N/A';
          inv.generatedByName = inv.createdByName; // Add alias
          console.log(`✅ Found creator from PaymentLog: ${creatorId} -> ${inv.createdByName}`);
        } else {
          // Try to find creator from payment history
          if (inv.paymentHistory && inv.paymentHistory.length > 0) {
            const firstPayment = inv.paymentHistory[0];
            const creatorId = firstPayment.processedBy || firstPayment.createdBy;
            if (creatorId) {
              inv.generatedBy = creatorId.toString();
              inv.createdByName = userMap.get(creatorId.toString()) || 'N/A';
              inv.generatedByName = inv.createdByName; // Add alias
              console.log(`✅ Found creator from payment history: ${creatorId} -> ${inv.createdByName}`);
            } else {
              inv.createdByName = 'N/A';
              inv.generatedByName = 'N/A'; // Add alias
              console.log(`❌ No creator found in payment history`);
            }
          } else {
            // If no creator field found, set to N/A
            inv.createdByName = 'N/A';
            inv.generatedByName = 'N/A'; // Add alias
            console.log(`❌ No payment history found for invoice ${invoiceNumber}`);
          }
        }
      }
      
      // Add user names to paymentHistory array BEFORE we try to use them
      if (inv.paymentHistory && Array.isArray(inv.paymentHistory)) {
        inv.paymentHistory.forEach(payment => {
          if (payment.processedBy) {
            payment.processedByName = userMap.get(payment.processedBy.toString()) || 'N/A';
          }
          if (payment.createdBy) {
            payment.createdByName = userMap.get(payment.createdBy.toString()) || 'N/A';
          }
        });
        
        // If createdByName is still 'N/A', try to get it from paymentHistory (after populating names)
        if (inv.createdByName === 'N/A' && inv.paymentHistory.length > 0) {
          // Check all payment history entries, not just first
          for (const payment of inv.paymentHistory) {
            if (payment.processedByName && payment.processedByName !== 'N/A') {
              inv.createdByName = payment.processedByName;
              inv.generatedByName = payment.processedByName;
              inv.generatedBy = payment.processedBy; // Also set the ID for consistency
              console.log(`✅ Found creator from paymentHistory (after populate): ${payment.processedByName} (ID: ${payment.processedBy})`);
              break;
            } else if (payment.createdByName && payment.createdByName !== 'N/A') {
              inv.createdByName = payment.createdByName;
              inv.generatedByName = payment.createdByName;
              inv.generatedBy = payment.createdBy; // Also set the ID for consistency
              console.log(`✅ Found creator from paymentHistory createdByName: ${payment.createdByName} (ID: ${payment.createdBy})`);
              break;
            } else if (payment.processedBy && !inv.generatedBy) {
              // If we have an ID but no name in userMap, try to get name from userMap
              const paymentUserId = payment.processedBy.toString();
              const userName = userMap.get(paymentUserId);
              if (userName && userName !== 'N/A') {
                inv.createdByName = userName;
                inv.generatedByName = userName;
                inv.generatedBy = payment.processedBy;
                console.log(`✅ Found creator from paymentHistory processedBy ID: ${userName} (ID: ${paymentUserId})`);
                break;
              }
            } else if (payment.createdBy && !inv.generatedBy) {
              // If we have an ID but no name in userMap, try to get name from userMap
              const paymentUserId = payment.createdBy.toString();
              const userName = userMap.get(paymentUserId);
              if (userName && userName !== 'N/A') {
                inv.createdByName = userName;
                inv.generatedByName = userName;
                inv.generatedBy = payment.createdBy;
                console.log(`✅ Found creator from paymentHistory createdBy ID: ${userName} (ID: ${paymentUserId})`);
                break;
              }
            }
          }
        }
      }
      
      if (inv.cancelledBy) {
        const cancelledById = typeof inv.cancelledBy === 'object' ? inv.cancelledBy.toString() : inv.cancelledBy.toString();
        inv.cancelledByName = userMap.get(cancelledById) || 'N/A';
      }
      if (inv.refundedBy) {
        const refundedById = typeof inv.refundedBy === 'object' ? inv.refundedBy._id?.toString() : inv.refundedBy?.toString();
        inv.refundedByName = refundedById ? (userMap.get(refundedById) || inv.refundedByName || 'N/A') : (inv.refundedByName || 'N/A');
      }
      // Add user names to refunds array
      if (inv.refunds && Array.isArray(inv.refunds)) {
        inv.refunds.forEach(refund => {
          if (refund.refundedBy) {
            const refundedById = typeof refund.refundedBy === 'object' ? refund.refundedBy._id?.toString() : refund.refundedBy?.toString();
            refund.refundedByName = refundedById ? (userMap.get(refundedById) || refund.refundedByName || 'N/A') : (refund.refundedByName || 'N/A');
            refund.processedByName = refund.refundedByName; // Also set processedByName for consistency
          }
          if (refund.approvedBy) {
            const approvedById = typeof refund.approvedBy === 'object' ? refund.approvedBy._id?.toString() : refund.approvedBy?.toString();
            refund.approvedByName = approvedById ? (userMap.get(approvedById) || refund.approvedByName || 'N/A') : (refund.approvedByName || 'N/A');
          }
        });
      }
    });

    // Sort by date (newest first)
    allInvoices.sort((a, b) => new Date(b.date) - new Date(a.date));
    
    // Pagination
    const startIndex = (page - 1) * limit;
    const endIndex = page * limit;
    const paginatedInvoices = allInvoices.slice(startIndex, endIndex);

    // Calculate totals (excluding refunded and cancelled bills)
    const activeInvoices = allInvoices.filter(inv => 
      inv.status !== 'refunded' && inv.status !== 'cancelled'
    );
    const cancelledInvoices = allInvoices.filter(inv => inv.status === 'cancelled');
    const refundedInvoices = allInvoices.filter(inv => inv.status === 'refunded');
    
    const totalAmount = activeInvoices.reduce((sum, inv) => sum + (inv.amount || 0), 0);
    const totalPaid = activeInvoices.reduce((sum, inv) => sum + (inv.paidAmount || 0), 0);
    const totalBalance = activeInvoices.reduce((sum, inv) => sum + (inv.balance || 0), 0);
    
    const cancelledAmount = cancelledInvoices.reduce((sum, inv) => sum + (inv.amount || 0), 0);
    const refundedAmount = refundedInvoices.reduce((sum, inv) => sum + (inv.paidAmount || 0), 0);


    res.json({
      bills: paginatedInvoices,
      transactions: transactions.slice(0, limit),
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(allInvoices.length / limit),
        totalRecords: allInvoices.length,
        limit: parseInt(limit)
      },
      summary: {
        totalAmount,
        totalPaid,
        totalBalance,
        totalTransactions: transactions.length,
        cancelledCount: cancelledInvoices.length,
        cancelledAmount: cancelledAmount,
        refundedCount: refundedInvoices.length,
        refundedAmount: refundedAmount,
        activeInvoicesCount: activeInvoices.length
      }
    });
  } catch (error) {
    console.error('Error in getAllBillsAndTransactions:', error);
    res.status(500).json({ 
      message: 'Server error while fetching billing data', 
      error: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
};

// Fix accountants without proper center assignment
export const fixAccountantCenterAssignment = async (req, res) => {
  try {
    // Only superadmin can run this fix
    if (req.user.role !== 'superadmin') {
      return res.status(403).json({ message: 'Access denied. Superadmin only.' });
    }

    // Find accountants without centerId
    const accountantsWithoutCenter = await User.find({
      role: 'accountant',
      isDeleted: false,
      $or: [
        { centerId: { $exists: false } },
        { centerId: null },
        { centerId: '' }
      ]
    });

    if (accountantsWithoutCenter.length === 0) {
      return res.json({ 
        message: 'All accountants have proper center assignments.',
        fixedCount: 0 
      });
    }

    // Get all centers
    const centers = await Center.find({ isDeleted: false });
    if (centers.length === 0) {
      return res.status(400).json({ 
        message: 'No centers found. Cannot assign accountants to centers.' 
      });
    }

    // Assign accountants to the first available center (or distribute them)
    const fixedAccountants = [];
    for (let i = 0; i < accountantsWithoutCenter.length; i++) {
      const accountant = accountantsWithoutCenter[i];
      const centerIndex = i % centers.length; // Distribute across centers
      const assignedCenter = centers[centerIndex];
      
      accountant.centerId = assignedCenter._id;
      await accountant.save();
      
      fixedAccountants.push({
        accountantId: accountant._id,
        accountantName: accountant.name,
        assignedCenterId: assignedCenter._id,
        assignedCenterName: assignedCenter.name
      });
    }

    res.json({
      message: `Fixed ${fixedAccountants.length} accountants without center assignment.`,
      fixedCount: fixedAccountants.length,
      fixedAccountants
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// Get financial reports (daily, weekly, monthly, yearly) with detailed transactions
export const getFinancialReports = async (req, res) => {
  try {
    // Check if user has centerId assigned
    if (!req.user || !req.user.centerId) {
      return res.status(400).json({ 
        message: 'Accountant must be assigned to a center to access financial reports. Please contact administrator to assign a center.',
        error: 'MISSING_CENTER_ASSIGNMENT'
      });
    }

    const centerId = req.user.centerId;
    const { reportType = 'daily', startDate, endDate } = req.query;

    console.log(`📊 Fetching ${reportType} financial report for center: ${centerId}`);

    const now = new Date();
    let dateFilter = {};

    // Set date range based on report type
    switch (reportType) {
      case 'daily':
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        dateFilter = { $gte: today, $lte: new Date(today.getTime() + 24 * 60 * 60 * 1000) };
        break;
      case 'weekly':
        const weekStart = new Date(now);
        weekStart.setDate(now.getDate() - 7);
        dateFilter = { $gte: weekStart, $lte: now };
        break;
      case 'monthly':
        const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
        dateFilter = { $gte: monthStart, $lte: now };
        break;
      case 'yearly':
        const yearStart = new Date(now.getFullYear(), 0, 1);
        dateFilter = { $gte: yearStart, $lte: now };
        break;
      case 'custom':
        if (startDate && endDate) {
          const start = new Date(startDate);
          const end = new Date(endDate);
          end.setHours(23, 59, 59, 999);
          dateFilter = { $gte: start, $lte: end };
        }
        break;
    }
    
    // Only apply date filter if it has values
    const hasDateFilter = Object.keys(dateFilter).length > 0;

    // Fetch all patients and their bills
    const patients = await Patient.find({ centerId })
      .populate('assignedDoctor', 'name')
      .populate('currentDoctor', 'name')
      .select('name uhId age gender contact billing reassignedBilling createdAt');

    // Fetch test requests
    const testRequestsQuery = { centerId };
    if (hasDateFilter) {
      testRequestsQuery.createdAt = dateFilter;
    }
    const testRequests = await TestRequest.find(testRequestsQuery)
      .populate('patientId', 'name uhId')
      .populate('doctorId', 'name')
      .select('billing createdAt patientId doctorId');

    // Detailed transaction list
    const detailedTransactions = [];
    
    // Calculate consultation revenue and collect transactions
    let consultationRevenue = 0;
    let consultationCount = 0;
    let superconsultantRevenue = 0;
    let superconsultantCount = 0;
    let reassignmentRevenue = 0;
    let reassignmentCount = 0;

    patients.forEach(patient => {
      if (patient.billing) {
        patient.billing.forEach(bill => {
          const billDate = new Date(bill.createdAt || patient.createdAt);
          const matchesDateFilter = !hasDateFilter || 
                                   ((!dateFilter.$gte || billDate >= dateFilter.$gte) &&
                                    (!dateFilter.$lte || billDate <= dateFilter.$lte));
          
          if (matchesDateFilter) {
            // Check if this is a superconsultant consultation
            const isSuperconsultant = bill.consultationType && 
                                     bill.consultationType.startsWith('superconsultant_');
            
            // Add to detailed transactions
            detailedTransactions.push({
              date: billDate,
              invoiceNumber: bill.invoiceNumber || 'N/A',
              patientName: patient.name,
              uhId: patient.uhId,
              age: patient.age,
              gender: patient.gender,
              billType: isSuperconsultant ? 'Superconsultant' : 'Consultation',
              service: bill.description || bill.type,
              doctor: patient.assignedDoctor?.name || 'N/A',
              amount: bill.amount || 0,
              paidAmount: bill.paidAmount || 0,
              balance: (bill.amount || 0) - (bill.paidAmount || 0),
              status: bill.status,
              paymentMethod: bill.paymentMethod || 'N/A'
            });
            
            if (bill.status === 'paid' || bill.status === 'completed') {
              if (isSuperconsultant) {
                superconsultantRevenue += bill.paidAmount || bill.amount || 0;
                superconsultantCount++;
              } else {
                consultationRevenue += bill.paidAmount || bill.amount || 0;
                consultationCount++;
              }
            }
          }
        });
      }

      if (patient.reassignedBilling) {
        patient.reassignedBilling.forEach(bill => {
          const billDate = new Date(bill.createdAt || patient.createdAt);
          const matchesDateFilter = !hasDateFilter || 
                                   ((!dateFilter.$gte || billDate >= dateFilter.$gte) &&
                                    (!dateFilter.$lte || billDate <= dateFilter.$lte));
          
          if (matchesDateFilter) {
            // Add to detailed transactions
            detailedTransactions.push({
              date: billDate,
              invoiceNumber: bill.invoiceNumber || 'N/A',
              patientName: patient.name,
              uhId: patient.uhId,
              age: patient.age,
              gender: patient.gender,
              billType: 'Reassignment',
              service: 'Patient Reassignment',
              doctor: patient.currentDoctor?.name || 'N/A',
              amount: bill.amount || 0,
              paidAmount: bill.paidAmount || 0,
              balance: (bill.amount || 0) - (bill.paidAmount || 0),
              status: bill.status,
              paymentMethod: bill.paymentMethod || 'N/A'
            });
            
            if (bill.status === 'paid' || bill.status === 'completed') {
              reassignmentRevenue += bill.paidAmount || bill.amount || 0;
              reassignmentCount++;
            }
          }
        });
      }
    });

    // Calculate lab revenue and collect transactions
    let labRevenue = 0;
    let labCount = 0;

    testRequests.forEach(test => {
      if (test.billing) {
        detailedTransactions.push({
          date: test.createdAt,
          invoiceNumber: test.billing.invoiceNumber || 'N/A',
          patientName: test.patientId?.name || 'N/A',
          uhId: test.patientId?.uhId || 'N/A',
          age: 'N/A',
          gender: 'N/A',
          billType: 'Lab/Test',
          service: test.billing.description || 'Laboratory Test',
          doctor: test.doctorId?.name || 'N/A',
          amount: test.billing.amount || 0,
          paidAmount: test.billing.paidAmount || 0,
          balance: (test.billing.amount || 0) - (test.billing.paidAmount || 0),
          status: test.billing.status,
          paymentMethod: test.billing.paymentMethod || 'N/A'
        });
        
        if (test.billing.status === 'paid' || test.billing.status === 'completed') {
          labRevenue += test.billing.paidAmount || test.billing.amount || 0;
          labCount++;
        }
      }
    });

    // Sort transactions by date
    detailedTransactions.sort((a, b) => new Date(b.date) - new Date(a.date));

    const totalRevenue = consultationRevenue + superconsultantRevenue + reassignmentRevenue + labRevenue;
    const totalTransactions = consultationCount + superconsultantCount + reassignmentCount + labCount;

    res.json({
      reportType,
      dateRange: dateFilter,
      summary: {
        totalRevenue,
        totalTransactions,
        consultationRevenue,
        consultationCount,
        superconsultantRevenue,
        superconsultantCount,
        reassignmentRevenue,
        reassignmentCount,
        labRevenue,
        labCount
      },
      breakdown: {
        consultation: {
          revenue: consultationRevenue,
          count: consultationCount,
          percentage: totalRevenue > 0 ? ((consultationRevenue / totalRevenue) * 100).toFixed(2) : 0
        },
        superconsultant: {
          revenue: superconsultantRevenue,
          count: superconsultantCount,
          percentage: totalRevenue > 0 ? ((superconsultantRevenue / totalRevenue) * 100).toFixed(2) : 0
        },
        reassignment: {
          revenue: reassignmentRevenue,
          count: reassignmentCount,
          percentage: totalRevenue > 0 ? ((reassignmentRevenue / totalRevenue) * 100).toFixed(2) : 0
        },
        lab: {
          revenue: labRevenue,
          count: labCount,
          percentage: totalRevenue > 0 ? ((labRevenue / totalRevenue) * 100).toFixed(2) : 0
        }
      },
      transactions: detailedTransactions
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};
