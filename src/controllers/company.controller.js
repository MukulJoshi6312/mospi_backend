import { query } from '../config/db.js';

const SELECT = `
  SELECT id, domain,
         company_name      AS "companyName",
         copyright,
         left_logo         AS "leftLogo",
         right_logo        AS "rightLogo",
         meta_title        AS "metaTitle",
         meta_description  AS "metaDescription",
         status,
         created_at        AS "createdAt",
         updated_at        AS "updatedAt"
  FROM companies
`;

// Pluck uploaded S3 URL from multer-s3's req.files (null if the field wasn't sent).
const pickFileUrl = (req, field) => {
  const f = req.files?.[field]?.[0];
  return f ? f.location : null;
};

// GET /api/companies
export const listCompanies = async (_req, res, next) => {
  try {
    const { rows } = await query(`${SELECT} ORDER BY id DESC`);
    res.json({ success: true, data: rows });
  } catch (err) {
    next(err);
  }
};

// GET /api/companies/:id
export const getCompany = async (req, res, next) => {
  try {
    const { rows } = await query(`${SELECT} WHERE id = $1`, [req.params.id]);
    if (!rows[0]) return res.status(404).json({ success: false, message: 'Company not found' });
    res.json({ success: true, data: rows[0] });
  } catch (err) {
    next(err);
  }
};

// POST /api/companies
export const createCompany = async (req, res, next) => {
  try {
    const {
      domain,
      companyName,
      copyright,
      metaTitle,
      metaDescription,
      status = 'active',
    } = req.body;

    if (!domain || !companyName || !copyright || !metaTitle || !metaDescription) {
      return res.status(400).json({
        success: false,
        message: 'domain, companyName, copyright, metaTitle and metaDescription are required',
      });
    }

    const leftLogo = pickFileUrl(req, 'leftLogo');
    const rightLogo = pickFileUrl(req, 'rightLogo');

    const { rows } = await query(
      `INSERT INTO companies
         (domain, company_name, copyright, left_logo, right_logo,
          meta_title, meta_description, status)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
       RETURNING id`,
      [domain, companyName, copyright, leftLogo, rightLogo, metaTitle, metaDescription, status],
    );

    const created = await query(`${SELECT} WHERE id = $1`, [rows[0].id]);
    res.status(201).json({ success: true, data: created.rows[0] });
  } catch (err) {
    next(err);
  }
};

// PUT /api/companies/:id
export const updateCompany = async (req, res, next) => {
  try {
    const { id } = req.params;
    const {
      domain,
      companyName,
      copyright,
      metaTitle,
      metaDescription,
      status,
    } = req.body;

    const leftLogo = pickFileUrl(req, 'leftLogo');
    const rightLogo = pickFileUrl(req, 'rightLogo');

    const { rowCount } = await query(
      `UPDATE companies SET
         domain           = COALESCE($2, domain),
         company_name     = COALESCE($3, company_name),
         copyright        = COALESCE($4, copyright),
         left_logo        = COALESCE($5, left_logo),
         right_logo       = COALESCE($6, right_logo),
         meta_title       = COALESCE($7, meta_title),
         meta_description = COALESCE($8, meta_description),
         status           = COALESCE($9, status),
         updated_at       = NOW()
       WHERE id = $1`,
      [id, domain, companyName, copyright, leftLogo, rightLogo, metaTitle, metaDescription, status],
    );
    if (!rowCount) return res.status(404).json({ success: false, message: 'Company not found' });

    const { rows } = await query(`${SELECT} WHERE id = $1`, [id]);
    res.json({ success: true, data: rows[0] });
  } catch (err) {
    next(err);
  }
};

// DELETE /api/companies/:id
export const deleteCompany = async (req, res, next) => {
  try {
    const { rowCount } = await query('DELETE FROM companies WHERE id = $1', [req.params.id]);
    if (!rowCount) return res.status(404).json({ success: false, message: 'Company not found' });
    res.json({ success: true, message: 'Company deleted' });
  } catch (err) {
    next(err);
  }
};
