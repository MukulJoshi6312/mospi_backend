import { query } from '../config/db.js';
import { fileUrl } from '../middlewares/upload.js';

// SELECT clause that maps DB (snake_case) → API (camelCase).
// Dates are formatted in SQL as "20 July 2026" — no time portion.
const SELECT = `
  SELECT id, title, subtitle,
         banner_type                                AS "bannerType",
         banner_for                                 AS "bannerFor",
         redirect_url                               AS "redirectUrl",
         image,
         TO_CHAR(start_date, 'FMDD Month YYYY')     AS "startDate",
         TO_CHAR(end_date,   'FMDD Month YYYY')     AS "endDate",
         display_order                              AS "order",
         status,
         TO_CHAR(created_at, 'FMDD Month YYYY')     AS "createdAt",
         TO_CHAR(updated_at, 'FMDD Month YYYY')     AS "updatedAt"
  FROM banners
`;

export const listBanners = async (_req, res, next) => {
  try {
    const { rows } = await query(`${SELECT} ORDER BY display_order ASC, id DESC`);
    res.json({ success: true, data: rows });
  } catch (err) {
    next(err);
  }
};

export const getBanner = async (req, res, next) => {
  try {
    const { rows } = await query(`${SELECT} WHERE id = $1`, [req.params.id]);
    if (!rows[0]) return res.status(404).json({ success: false, message: 'Banner not found' });
    res.json({ success: true, data: rows[0] });
  } catch (err) {
    next(err);
  }
};

export const createBanner = async (req, res, next) => {
  try {
    const {
      title,
      subtitle,
      bannerType,
      bannerFor,
      redirectUrl,
      startDate,
      endDate,
      order = 0,
      status = 'active',
    } = req.body;

    if (!title) return res.status(400).json({ success: false, message: 'title is required' });

    const image = fileUrl(req);

    const { rows } = await query(
      `INSERT INTO banners
         (title, subtitle, banner_type, banner_for, redirect_url,
          image, start_date, end_date, display_order, status)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
       RETURNING id`,
      [title, subtitle, bannerType, bannerFor, redirectUrl, image, startDate, endDate, order, status],
    );
    const created = await query(`${SELECT} WHERE id = $1`, [rows[0].id]);
    res.status(201).json({ success: true, data: created.rows[0] });
  } catch (err) {
    next(err);
  }
};

export const updateBanner = async (req, res, next) => {
  try {
    const { id } = req.params;
    const {
      title,
      subtitle,
      bannerType,
      bannerFor,
      redirectUrl,
      startDate,
      endDate,
      order,
      status,
    } = req.body;

    const image = fileUrl(req);

    const { rowCount } = await query(
      `UPDATE banners SET
         title         = COALESCE($2, title),
         subtitle      = COALESCE($3, subtitle),
         banner_type   = COALESCE($4, banner_type),
         banner_for    = COALESCE($5, banner_for),
         redirect_url  = COALESCE($6, redirect_url),
         image         = COALESCE($7, image),
         start_date    = COALESCE($8, start_date),
         end_date      = COALESCE($9, end_date),
         display_order = COALESCE($10, display_order),
         status        = COALESCE($11, status),
         updated_at    = NOW()
       WHERE id = $1`,
      [id, title, subtitle, bannerType, bannerFor, redirectUrl, image, startDate, endDate, order, status],
    );
    if (!rowCount) return res.status(404).json({ success: false, message: 'Banner not found' });

    const { rows } = await query(`${SELECT} WHERE id = $1`, [id]);
    res.json({ success: true, data: rows[0] });
  } catch (err) {
    next(err);
  }
};

export const deleteBanner = async (req, res, next) => {
  try {
    const { rowCount } = await query('DELETE FROM banners WHERE id = $1', [req.params.id]);
    if (!rowCount) return res.status(404).json({ success: false, message: 'Banner not found' });
    res.json({ success: true, message: 'Banner deleted' });
  } catch (err) {
    next(err);
  }
};
