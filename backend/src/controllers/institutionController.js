const { Institution, User, Student, Exam } = require('../models');
const { recordAuditLog } = require('../middleware/auditLogger');

/**
 * List all institutions (Super Admin only)
 */
const getAllInstitutions = async (req, res, next) => {
  try {
    const institutions = await Institution.findAll({
      order: [['name', 'ASC']]
    });

    return res.status(200).json({
      success: true,
      data: institutions
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get single institution details
 */
const getInstitutionById = async (req, res, next) => {
  try {
    const id = req.params.id || req.institutionId;
    const institution = await Institution.findByPk(id);

    if (!institution) {
      return res.status(404).json({
        success: false,
        message: 'Institution not found.'
      });
    }

    return res.status(200).json({
      success: true,
      data: institution
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Create a new institution (Super Admin only)
 */
const createInstitution = async (req, res, next) => {
  try {
    const { name, code, email, phone, address, logo_url } = req.body;

    if (!name || !code) {
      return res.status(400).json({
        success: false,
        message: 'Institution name and unique code are required.'
      });
    }

    const existing = await Institution.findOne({ where: { code } });
    if (existing) {
      return res.status(400).json({
        success: false,
        message: 'An institution with this code already exists.'
      });
    }

    const institution = await Institution.create({
      name,
      code,
      email,
      phone,
      address,
      logo_url,
      is_active: true
    });

    await recordAuditLog({
      req,
      action: 'CREATE_INSTITUTION',
      entity_type: 'Institution',
      entity_id: institution.id,
      details: { name, code }
    });

    return res.status(201).json({
      success: true,
      message: 'Institution created successfully.',
      data: institution
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Update institution
 */
const updateInstitution = async (req, res, next) => {
  try {
    const id = req.params.id;
    const institution = await Institution.findByPk(id);

    if (!institution) {
      return res.status(404).json({
        success: false,
        message: 'Institution not found.'
      });
    }

    const { name, email, phone, address, logo_url, is_active } = req.body;
    await institution.update({
      name: name ?? institution.name,
      email: email ?? institution.email,
      phone: phone ?? institution.phone,
      address: address ?? institution.address,
      logo_url: logo_url ?? institution.logo_url,
      is_active: is_active !== undefined ? is_active : institution.is_active
    });

    await recordAuditLog({
      req,
      action: 'UPDATE_INSTITUTION',
      entity_type: 'Institution',
      entity_id: institution.id,
      details: { name: institution.name }
    });

    return res.status(200).json({
      success: true,
      message: 'Institution updated successfully.',
      data: institution
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getAllInstitutions,
  getInstitutionById,
  createInstitution,
  updateInstitution
};
