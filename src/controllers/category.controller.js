import { query } from '../config/db.js';

const SELECT = `
  SELECT id,
         sector_id      AS "sectorId",
         name, description,
         hover_title    AS "hoverTitle",
         category_slug  AS "categorySlug",
         card_color     AS "cardColor",
         icon_color     AS "iconColor",
         category_icon  AS "icon",
         display_status AS "displayStatus",
         display_order  AS "order",
         status,
         created_at     AS "createdAt",
         updated_at     AS "updatedAt"
  FROM categories
`;

// GET /api/categories                  → all
// GET /api/categories?sectorId=1       → filtered by sector
export const listCategories = async (req, res, next) => {
  try {
    const { sectorId } = req.query;
    const sql = sectorId
      ? `${SELECT} WHERE sector_id = $1 ORDER BY display_order ASC, id DESC`
      : `${SELECT} ORDER BY display_order ASC, id DESC`;
    const { rows } = await query(sql, sectorId ? [sectorId] : []);
    res.json({ success: true, data: rows });
  } catch (err) {
    next(err);
  }
};

export const getCategory = async (req, res, next) => {
  try {
    const { rows } = await query(`${SELECT} WHERE id = $1`, [req.params.id]);
    if (!rows[0]) return res.status(404).json({ success: false, message: 'Category not found' });
    res.json({ success: true, data: rows[0] });
  } catch (err) {
    next(err);
  }
};

export const createCategory = async (req, res, next) => {
  try {
    const {
      sectorId,
      name,
      description,
      hoverTitle,
      categorySlug,
      cardColor,
      iconColor,
      icon,
      displayStatus = 'show',
      order = 0,
      status = 'active',
    } = req.body;

    if (!sectorId || !name || !categorySlug) {
      return res
        .status(400)
        .json({ success: false, message: 'sectorId, name and categorySlug are required' });
    }

    const { rows } = await query(
      `INSERT INTO categories
         (sector_id, name, description, hover_title, category_slug,
          card_color, icon_color, category_icon, display_status, display_order, status)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
       RETURNING id`,
      [
        sectorId,
        name,
        description,
        hoverTitle,
        categorySlug,
        cardColor,
        iconColor,
        icon,
        displayStatus,
        order,
        status,
      ],
    );

    const created = await query(`${SELECT} WHERE id = $1`, [rows[0].id]);
    res.status(201).json({ success: true, data: created.rows[0] });
  } catch (err) {
    if (err.code === '23503') {
      return res.status(400).json({ success: false, message: 'sectorId does not exist' });
    }
    if (err.code === '23505') {
      return res.status(409).json({ success: false, message: 'categorySlug already exists' });
    }
    next(err);
  }
};

export const updateCategory = async (req, res, next) => {
  try {
    const { id } = req.params;
    const {
      sectorId,
      name,
      description,
      hoverTitle,
      categorySlug,
      cardColor,
      iconColor,
      icon,
      displayStatus,
      order,
      status,
    } = req.body;

    const { rowCount } = await query(
      `UPDATE categories SET
         sector_id      = COALESCE($2, sector_id),
         name           = COALESCE($3, name),
         description    = COALESCE($4, description),
         hover_title    = COALESCE($5, hover_title),
         category_slug  = COALESCE($6, category_slug),
         card_color     = COALESCE($7, card_color),
         icon_color     = COALESCE($8, icon_color),
         category_icon  = COALESCE($9, category_icon),
         display_status = COALESCE($10, display_status),
         display_order  = COALESCE($11, display_order),
         status         = COALESCE($12, status),
         updated_at     = NOW()
       WHERE id = $1`,
      [
        id,
        sectorId,
        name,
        description,
        hoverTitle,
        categorySlug,
        cardColor,
        iconColor,
        icon,
        displayStatus,
        order,
        status,
      ],
    );
    if (!rowCount) return res.status(404).json({ success: false, message: 'Category not found' });

    const { rows } = await query(`${SELECT} WHERE id = $1`, [id]);
    res.json({ success: true, data: rows[0] });
  } catch (err) {
    if (err.code === '23503') {
      return res.status(400).json({ success: false, message: 'sectorId does not exist' });
    }
    if (err.code === '23505') {
      return res.status(409).json({ success: false, message: 'categorySlug already exists' });
    }
    next(err);
  }
};

export const deleteCategory = async (req, res, next) => {
  try {
    const { rowCount } = await query('DELETE FROM categories WHERE id = $1', [req.params.id]);
    if (!rowCount) return res.status(404).json({ success: false, message: 'Category not found' });
    res.json({ success: true, message: 'Category deleted' });
  } catch (err) {
    next(err);
  }
};
