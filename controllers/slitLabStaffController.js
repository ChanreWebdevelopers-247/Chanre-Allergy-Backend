import User from '../models/User.js';

const sanitizeUser = (user) => {
  if (!user) return null;
  const obj = user.toObject();
  delete obj.password;
  return obj;
};

export const getAllSlitLabStaff = async (req, res) => {
  try {
    const staff = await User.find({
      role: 'slitlab',
      isDeleted: { $ne: true }
    })
      .select('-password')
      .sort({ createdAt: -1 });

    res.status(200).json(staff);
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch SLIT lab staff', error: error.message });
  }
};

export const getSlitLabStaffById = async (req, res) => {
  try {
    const staff = await User.findOne({
      _id: req.params.id,
      role: 'slitlab',
      isDeleted: { $ne: true }
    }).select('-password');

    if (!staff) {
      return res.status(404).json({ message: 'SLIT lab staff not found' });
    }

    res.status(200).json(staff);
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch SLIT lab staff', error: error.message });
  }
};

export const createSlitLabStaff = async (req, res) => {
  try {
    const { name, email, phone, username, password } = req.body;

    if (!name || !email || !phone || !password) {
      return res.status(400).json({ message: 'Name, email, phone, and password are required' });
    }

    const normalizedEmail = email.trim().toLowerCase();

    const existingEmail = await User.findOne({ email: normalizedEmail, isDeleted: { $ne: true } });
    if (existingEmail) {
      return res.status(400).json({ message: 'Email already in use' });
    }

    if (username) {
      const existingUsername = await User.findOne({ username: username.trim(), isDeleted: { $ne: true } });
      if (existingUsername) {
        return res.status(400).json({ message: 'Username already in use' });
      }
    }

    const newUser = new User({
      name: name.trim(),
      email: normalizedEmail,
      phone: phone.trim(),
      username: username?.trim() || normalizedEmail,
      role: 'slitlab',
      password: password,
      status: 'active'
    });

    await newUser.save();

    res.status(201).json({
      message: 'SLIT lab staff created successfully',
      staff: sanitizeUser(newUser)
    });
  } catch (error) {
    res.status(500).json({ message: 'Failed to create SLIT lab staff', error: error.message });
  }
};

export const updateSlitLabStaff = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, email, phone, username, password } = req.body;

    const staff = await User.findOne({
      _id: id,
      role: 'slitlab',
      isDeleted: { $ne: true }
    });

    if (!staff) {
      return res.status(404).json({ message: 'SLIT lab staff not found' });
    }

    if (email && email.trim().toLowerCase() !== staff.email) {
      const normalizedEmail = email.trim().toLowerCase();
      const existingEmail = await User.findOne({ email: normalizedEmail, isDeleted: { $ne: true }, _id: { $ne: id } });
      if (existingEmail) {
        return res.status(400).json({ message: 'Email already in use' });
      }
      staff.email = normalizedEmail;
    }

    if (username && username.trim() !== staff.username) {
      const existingUsername = await User.findOne({ username: username.trim(), isDeleted: { $ne: true }, _id: { $ne: id } });
      if (existingUsername) {
        return res.status(400).json({ message: 'Username already in use' });
      }
      staff.username = username.trim();
    }

    if (name) staff.name = name.trim();
    if (phone) staff.phone = phone.trim();

    if (password && password.trim().length > 0) {
      staff.password = password;
    }

    await staff.save();

    res.status(200).json({
      message: 'SLIT lab staff updated successfully',
      staff: sanitizeUser(staff)
    });
  } catch (error) {
    res.status(500).json({ message: 'Failed to update SLIT lab staff', error: error.message });
  }
};

export const deleteSlitLabStaff = async (req, res) => {
  try {
    const { id } = req.params;

    const staff = await User.findOne({
      _id: id,
      role: 'slitlab',
      isDeleted: { $ne: true }
    });

    if (!staff) {
      return res.status(404).json({ message: 'SLIT lab staff not found' });
    }

    const timestamp = Date.now();
    staff.isDeleted = true;
    staff.status = 'inactive';
    staff.email = `deleted-${timestamp}-${staff.email}`;
    if (staff.username) {
      staff.username = `deleted-${timestamp}-${staff.username}`;
    }

    await staff.save();

    res.status(200).json({ message: 'SLIT lab staff removed successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Failed to delete SLIT lab staff', error: error.message });
  }
};

