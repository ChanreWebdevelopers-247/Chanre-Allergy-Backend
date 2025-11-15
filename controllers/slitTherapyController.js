import SlitTherapyRequest, { SLIT_PRODUCT_CATALOG } from '../models/SlitTherapyRequest.js';
import Patient from '../models/Patient.js';
import Center from '../models/Center.js';

const DEFAULT_COURIER_FEE = 100;

const getUserId = (user) => user?._id?.toString() || user?.id?.toString() || null;

const canModifyRequest = (user, request) => {
  if (!user || !request) return false;

  const role = user.role || '';
  if (role === 'superadmin' || role === 'centeradmin') {
    return true;
  }

  const userCenterId = user.centerId?.toString?.();
  const requestCenterId = request.centerId?.toString?.();
  const isSameCenter = userCenterId && requestCenterId && userCenterId === requestCenterId;
  const isCreator = request.createdBy?.toString() === getUserId(user);

  if (isSameCenter) {
    return true;
  }

  return isCreator;
};

const requireReceptionistAccess = (req, res) => {
  const allowedRoles = ['receptionist', 'centeradmin', 'superadmin'];
  if (!req.user || !allowedRoles.includes(req.user.role)) {
    res.status(403).json({ message: 'Access denied. Receptionist privileges required.' });
    return false;
  }
  return true;
};

const requireLabAccess = (req, res) => {
  const allowedRoles = ['lab', 'superadmin', 'Lab Technician', 'Lab Assistant', 'Lab Manager', 'lab technician', 'lab assistant', 'lab manager', 'slitlab'];
  if (!req.user || !allowedRoles.includes(req.user.role)) {
    res.status(403).json({ message: 'Access denied. Lab staff privileges required.' });
    return false;
  }
  return true;
};

const ensureCenterContext = async (user) => {
  if (!user?.centerId) {
    return {
      centerId: null,
      centerName: null,
      centerCode: null,
      centerDetails: null
    };
  }

  const center = await Center.findById(user.centerId)
    .select('name code address location phone email website fax missCallNumber mobileNumber');

  return {
    centerId: user.centerId,
    centerName: center?.name || '',
    centerCode: center?.code || '',
    centerDetails: center ? {
      name: center.name || '',
      code: center.code || '',
      address: center.address || center.location || '',
      location: center.location || '',
      phone: center.phone || '',
      email: center.email || '',
      website: center.website || '',
      fax: center.fax || '',
      missCallNumber: center.missCallNumber || '',
      mobileNumber: center.mobileNumber || ''
    } : null
  };
};

const appendHistory = (doc, { status, labStatus, billingStatus, remarks }, user) => {
  doc.statusHistory = doc.statusHistory || [];
  doc.statusHistory.push({
    status: status || doc.status,
    labStatus: labStatus || doc.labStatus,
    billingStatus: billingStatus || doc.billing?.status,
    remarks: remarks || '',
    updatedBy: user?._id || user?.id || null,
    updatedByName: user?.name || ''
  });
};

const buildBillingItems = ({ product, quantity, courierRequired, courierFee }) => {
  const items = [{
    name: product.name,
    code: product.code,
    quantity,
    unitPrice: product.price,
    total: product.price * quantity
  }];

  if (courierRequired) {
    items.push({
      name: 'Courier Fee',
      code: 'COURIER',
      quantity: 1,
      unitPrice: courierFee,
      total: courierFee
    });
  }

  return items;
};

export const createSlitTherapyRequest = async (req, res) => {
  try {
    if (!requireReceptionistAccess(req, res)) return;

    const {
      patientId,
      patientName,
      patientPhone,
      patientEmail,
      patientCode,
      productCode,
      quantity = 1,
      courierRequired = false,
      courierFee,
      deliveryMethod,
      notes
    } = req.body;

    const product = SLIT_PRODUCT_CATALOG[productCode];
    if (!product) {
      return res.status(400).json({
        message: 'Invalid SLIT therapy product code',
        productCode
      });
    }

    const normalizedQuantity = Number(quantity) > 0 ? Number(quantity) : 1;
    const useCourier = Boolean(courierRequired);
    const computedCourierFee = useCourier ? Number(courierFee ?? DEFAULT_COURIER_FEE) : 0;

    let resolvedPatient = null;
    if (patientId) {
      resolvedPatient = await Patient.findById(patientId).select('name phone email patientCode centerId');
      if (!resolvedPatient) {
        return res.status(404).json({ message: 'Patient not found', patientId });
      }
    }

    const patientDisplayName = patientName || resolvedPatient?.name;
    if (!patientDisplayName) {
      return res.status(400).json({ message: 'Patient name is required' });
    }

    const patientPhoneNumber = patientPhone || resolvedPatient?.phone || '';
    const patientEmailAddress = patientEmail || resolvedPatient?.email || '';
    const patientDisplayCode = patientCode || resolvedPatient?.patientCode || '';

    const { centerId, centerName, centerCode, centerDetails } = await ensureCenterContext(req.user);
    if (!centerId) {
      return res.status(400).json({ message: 'Unable to determine center for receptionist user' });
    }

    const items = buildBillingItems({
      product,
      quantity: normalizedQuantity,
      courierRequired: useCourier,
      courierFee: computedCourierFee
    });

    const subtotal = items.reduce((sum, item) => sum + item.total, 0);

    const invoiceNumber = `${centerCode || 'SLIT'}-${new Date().toISOString().replace(/[-:T.Z]/g, '').slice(0, 14)}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;

    const newRequest = new SlitTherapyRequest({
      patientId: resolvedPatient?._id || null,
      patientName: patientDisplayName,
      patientPhone: patientPhoneNumber,
      patientEmail: patientEmailAddress,
      patientCode: patientDisplayCode,
      centerId,
      centerName,
      productCode: product.code,
      productName: product.name,
      productPrice: product.price,
      quantity: normalizedQuantity,
      courierRequired: useCourier,
      courierFee: computedCourierFee,
      deliveryMethod: deliveryMethod || (useCourier ? 'courier' : 'pickup'),
      billing: {
        status: 'generated',
        amount: subtotal,
        paidAmount: 0,
        items,
        invoiceNumber,
        generatedAt: new Date(),
        generatedBy: req.user._id || req.user.id,
        paymentNotes: notes || ''
      },
      centerDetails,
      notes,
      createdBy: req.user._id || req.user.id,
      createdByName: req.user.name || '',
      status: 'Billing_Generated',
      labStatus: 'pending'
    });

    appendHistory(newRequest, {
      status: 'Billing_Generated',
      billingStatus: 'generated',
      remarks: 'SLIT therapy billing generated by reception'
    }, req.user);

    await newRequest.save();

    res.status(201).json({
      success: true,
      message: 'SLIT therapy request created',
      request: newRequest
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to create SLIT therapy request',
      error: error.message
    });
  }
};

export const listReceptionistSlitTherapyRequests = async (req, res) => {
  try {
    if (!requireReceptionistAccess(req, res)) return;

    const { status, labStatus } = req.query;
    const { centerId } = await ensureCenterContext(req.user);
    if (!centerId) {
      return res.status(400).json({ message: 'Unable to determine center for receptionist user' });
    }

    const query = { centerId };
    if (status) query.status = status;
    if (labStatus) query.labStatus = labStatus;

    const requests = await SlitTherapyRequest.find(query)
      .sort({ createdAt: -1 });

    res.json({
      success: true,
      requests
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to fetch SLIT therapy requests',
      error: error.message
    });
  }
};

export const markSlitTherapyBillPaid = async (req, res) => {
  try {
    if (!requireReceptionistAccess(req, res)) return;

    const { id } = req.params;
    const {
      paymentMethod,
      transactionId,
      paymentNotes,
      paymentAmount
    } = req.body;

    const request = await SlitTherapyRequest.findById(id);
    if (!request) {
      return res.status(404).json({ message: 'SLIT therapy request not found' });
    }

    if (!canModifyRequest(req.user, request)) {
      return res.status(403).json({ message: 'You are not authorized to modify this request' });
    }

    if (request.billing.status === 'paid' && request.status !== 'Cancelled') {
      return res.status(400).json({ message: 'Bill is already marked as paid' });
    }

    const amountDue = request.billing.amount || 0;
    const amountPaid = Number(paymentAmount ?? amountDue);

    request.billing.status = amountPaid >= amountDue ? 'paid' : 'partially_paid';
    request.billing.paidAmount = amountPaid;
    request.billing.paidAt = new Date();
    request.billing.paidBy = req.user._id || req.user.id;
    request.billing.paymentMethod = paymentMethod || 'cash';
    request.billing.transactionId = transactionId || `SLITPAY-${Date.now()}`;
    request.billing.paymentNotes = paymentNotes || '';

    request.status = 'Billing_Paid';
    request.labStatus = 'pending';
    request.updatedBy = req.user._id || req.user.id;
    request.updatedByName = req.user.name || '';

    appendHistory(request, {
      status: 'Billing_Paid',
      billingStatus: request.billing.status,
      remarks: 'Payment received at reception'
    }, req.user);

    await request.save();

    res.json({
      success: true,
      message: 'Payment recorded successfully',
      request
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to mark SLIT therapy bill as paid',
      error: error.message
    });
  }
};

export const listLabSlitTherapyRequests = async (req, res) => {
  try {
    if (!requireLabAccess(req, res)) return;

    const { status, labStatus } = req.query;
    const query = {};
    const allowedStatuses = ['Billing_Paid', 'Lab_Received', 'Ready', 'Delivered', 'Closed'];

    if (req.user.centerId) {
      query.centerId = req.user.centerId;
    }

    if (status) {
      query.status = status;
    } else {
      query.status = { $in: allowedStatuses };
    }

    if (labStatus) {
      query.labStatus = labStatus;
    }

    const requests = await SlitTherapyRequest.find(query)
      .sort({ updatedAt: -1 });

    res.json({
      success: true,
      requests
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to fetch SLIT therapy requests for lab',
      error: error.message
    });
  }
};

export const updateSlitTherapyStatus = async (req, res) => {
  try {
    if (!requireLabAccess(req, res)) return;

    const { id } = req.params;
    const { status, labNotes, courierTrackingNumber } = req.body;

    const request = await SlitTherapyRequest.findById(id);
    if (!request) {
      return res.status(404).json({ message: 'SLIT therapy request not found' });
    }

    if (!['Billing_Paid', 'Lab_Received', 'Ready', 'Delivered'].includes(request.status)) {
      return res.status(400).json({
        message: 'Request is not ready for lab processing',
        currentStatus: request.status
      });
    }

    const validStatusTransitions = {
      Billing_Paid: ['Lab_Received', 'Ready'],
      Lab_Received: ['Ready', 'Delivered'],
      Ready: ['Delivered'],
      Delivered: []
    };

    if (!validStatusTransitions[request.status]?.includes(status)) {
      return res.status(400).json({
        message: `Invalid status transition from ${request.status} to ${status}`
      });
    }

    request.status = status;
    request.labNotes = labNotes || request.labNotes;
    request.updatedBy = req.user._id || req.user.id;
    request.updatedByName = req.user.name || '';

    switch (status) {
      case 'Lab_Received':
        request.labStatus = 'received';
        break;
      case 'Ready':
        request.labStatus = 'ready';
        break;
      case 'Delivered':
        request.labStatus = 'delivered';
        break;
      default:
        break;
    }

    if (courierTrackingNumber) {
      request.courierTrackingNumber = courierTrackingNumber;
    }

    appendHistory(request, {
      status,
      labStatus: request.labStatus,
      remarks: labNotes || `Status updated to ${status}`
    }, req.user);

    await request.save();

    res.json({
      success: true,
      message: 'SLIT therapy status updated',
      request
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to update SLIT therapy status',
      error: error.message
    });
  }
};

export const closeSlitTherapyRequest = async (req, res) => {
  try {
    if (!requireReceptionistAccess(req, res)) return;

    const { id } = req.params;
    const { remarks } = req.body;

    const request = await SlitTherapyRequest.findById(id);
    if (!request) {
      return res.status(404).json({ message: 'SLIT therapy request not found' });
    }

    if (!canModifyRequest(req.user, request)) {
      return res.status(403).json({ message: 'You are not authorized to close this request' });
    }

    if (request.status !== 'Delivered') {
      return res.status(400).json({
        message: 'Request must be marked as Delivered by lab before closing',
        currentStatus: request.status
      });
    }

    request.status = 'Closed';
    request.labStatus = 'closed';
    request.updatedBy = req.user._id || req.user.id;
    request.updatedByName = req.user.name || '';

    appendHistory(request, {
      status: 'Closed',
      labStatus: 'closed',
      remarks: remarks || 'Closed by reception after delivery confirmation'
    }, req.user);

    await request.save();

    res.json({
      success: true,
      message: 'SLIT therapy request closed',
      request
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to close SLIT therapy request',
      error: error.message
    });
  }
};

export const cancelSlitTherapyRequest = async (req, res) => {
  try {
    if (!requireReceptionistAccess(req, res)) return;

    const { id } = req.params;
    const { reason } = req.body;

    const request = await SlitTherapyRequest.findById(id);
    if (!request) {
      return res.status(404).json({ message: 'SLIT therapy request not found' });
    }

    if (request.status === 'Cancelled') {
      return res.status(400).json({ message: 'Request is already cancelled' });
    }

    if (!canModifyRequest(req.user, request)) {
      return res.status(403).json({ message: 'You are not authorized to cancel this request' });
    }

    request.status = 'Cancelled';
    request.labStatus = 'pending';
    request.billing.status = 'cancelled';
    request.billing.cancellationReason = reason || '';
    request.billing.cancelledAt = new Date();
    request.updatedBy = req.user._id || req.user.id;
    request.updatedByName = req.user.name || '';

    appendHistory(request, {
      status: 'Cancelled',
      billingStatus: 'cancelled',
      remarks: reason || 'Cancelled by reception'
    }, req.user);

    await request.save();

    res.json({
      success: true,
      message: 'SLIT therapy request cancelled',
      request
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to cancel SLIT therapy request',
      error: error.message
    });
  }
};

export const refundSlitTherapyRequest = async (req, res) => {
  try {
    if (!requireReceptionistAccess(req, res)) return;

    const { id } = req.params;
    const { amount, method, notes } = req.body;

    const request = await SlitTherapyRequest.findById(id);
    if (!request) {
      return res.status(404).json({ message: 'SLIT therapy request not found' });
    }

    if (!canModifyRequest(req.user, request)) {
      return res.status(403).json({ message: 'You are not authorized to refund this request' });
    }

    const refundAmount = Number(amount) || 0;
    if (!refundAmount || refundAmount <= 0) {
      return res.status(400).json({ message: 'Refund amount must be greater than zero' });
    }

    const paidAmount = request.billing.paidAmount || 0;
    if (refundAmount > paidAmount) {
      return res.status(400).json({ message: 'Refund amount cannot exceed paid amount' });
    }

    request.billing.refundAmount = refundAmount;
    request.billing.refundMethod = method || 'cash';
    request.billing.refundNotes = notes || '';
    request.billing.refundedAt = new Date();
    request.billing.refundedBy = req.user._id || req.user.id;
    request.billing.status = 'refunded';
    request.billing.paidAmount = Math.max(0, paidAmount - refundAmount);
    request.updatedBy = req.user._id || req.user.id;
    request.updatedByName = req.user.name || '';

    appendHistory(request, {
      status: request.status,
      billingStatus: 'refunded',
      remarks: `Refund processed for ₹${refundAmount}${notes ? ` - ${notes}` : ''}`
    }, req.user);

    await request.save();

    res.json({
      success: true,
      message: 'Refund processed successfully',
      request
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to process refund',
      error: error.message
    });
  }
};

