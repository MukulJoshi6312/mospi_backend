import { query } from '../config/db.js';
import { fileUrl } from '../middlewares/upload.js';

const SELECT = `
  SELECT id,
         sector_id      AS "sectorId",
         category_id    AS "categoryId",
         name,
         hover_title    AS "hoverTitle",
         card_color     AS "cardColor",
         icon_color     AS "iconColor",
         indicator_icon AS "indicatorIcon",
         display_order  AS "order",
         status,
         created_at     AS "createdAt",
         updated_at     AS "updatedAt"
  FROM indicators
`;

// GET /api/indicators                              → all
// GET /api/indicators?sectorId=1                   → by sector
// GET /api/indicators?categoryId=11                → by category
// (both → both filters applied)
export const listIndicators = async (req, res, next) => {
  try {
    const { sectorId, categoryId } = req.query;
    const clauses = [];
    const params = [];
    if (sectorId) {
      params.push(sectorId);
      clauses.push(`sector_id = $${params.length}`);
    }
    if (categoryId) {
      params.push(categoryId);
      clauses.push(`category_id = $${params.length}`);
    }
    const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
    const { rows } = await query(
      `${SELECT} ${where} ORDER BY display_order ASC, id DESC`,
      params,
    );
    res.json({ success: true, data: rows });
  } catch (err) {
    next(err);
  }
};

export const getIndicator = async (req, res, next) => {
  try {
    const { rows } = await query(`${SELECT} WHERE id = $1`, [req.params.id]);
    if (!rows[0]) return res.status(404).json({ success: false, message: 'Indicator not found' });
    res.json({ success: true, data: rows[0] });
  } catch (err) {
    next(err);
  }
};

export const createIndicator = async (req, res, next) => {
  try {
    const {
      sectorId,
      categoryId,
      name,
      hoverTitle,
      cardColor,
      iconColor,
      order = 0,
      status = 'active',
    } = req.body;

    if (!sectorId || !categoryId || !name) {
      return res
        .status(400)
        .json({ success: false, message: 'sectorId, categoryId and name are required' });
    }

    const indicatorIcon = fileUrl(req);

    const { rows } = await query(
      `INSERT INTO indicators
         (sector_id, category_id, name, hover_title,
          card_color, icon_color, indicator_icon, display_order, status)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
       RETURNING id`,
      [sectorId, categoryId, name, hoverTitle, cardColor, iconColor, indicatorIcon, order, status],
    );

    const created = await query(`${SELECT} WHERE id = $1`, [rows[0].id]);
    res.status(201).json({ success: true, data: created.rows[0] });
  } catch (err) {
    if (err.code === '23503') {
      return res
        .status(400)
        .json({ success: false, message: 'sectorId or categoryId does not exist' });
    }
    next(err);
  }
};

export const updateIndicator = async (req, res, next) => {
  try {
    const { id } = req.params;
    const {
      sectorId,
      categoryId,
      name,
      hoverTitle,
      cardColor,
      iconColor,
      order,
      status,
    } = req.body;

    const indicatorIcon = fileUrl(req);

    const { rowCount } = await query(
      `UPDATE indicators SET
         sector_id      = COALESCE($2, sector_id),
         category_id    = COALESCE($3, category_id),
         name           = COALESCE($4, name),
         hover_title    = COALESCE($5, hover_title),
         card_color     = COALESCE($6, card_color),
         icon_color     = COALESCE($7, icon_color),
         indicator_icon = COALESCE($8, indicator_icon),
         display_order  = COALESCE($9, display_order),
         status         = COALESCE($10, status),
         updated_at     = NOW()
       WHERE id = $1`,
      [id, sectorId, categoryId, name, hoverTitle, cardColor, iconColor, indicatorIcon, order, status],
    );
    if (!rowCount) return res.status(404).json({ success: false, message: 'Indicator not found' });

    const { rows } = await query(`${SELECT} WHERE id = $1`, [id]);
    res.json({ success: true, data: rows[0] });
  } catch (err) {
    if (err.code === '23503') {
      return res
        .status(400)
        .json({ success: false, message: 'sectorId or categoryId does not exist' });
    }
    next(err);
  }
};

export const deleteIndicator = async (req, res, next) => {
  try {
    const { rowCount } = await query('DELETE FROM indicators WHERE id = $1', [req.params.id]);
    if (!rowCount) return res.status(404).json({ success: false, message: 'Indicator not found' });
    res.json({ success: true, message: 'Indicator deleted' });
  } catch (err) {
    next(err);
  }
};
