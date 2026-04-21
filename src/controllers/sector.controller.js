import { query } from '../config/db.js';

const SELECT = `
  SELECT id, name, title, subtitle,
         hover_title   AS "hoverTitle",
         sector_slug   AS "sectorSlug",
         card_color    AS "cardColor",
         icon_color    AS "iconColor",
         icon,
         display_order AS "order",
         status,
         created_at    AS "createdAt",
         updated_at    AS "updatedAt"
  FROM sectors
`;

export const listSectors = async (_req, res, next) => {
  try {
    const { rows } = await query(`${SELECT} ORDER BY display_order ASC, id DESC`);
    res.json({ success: true, data: rows });
  } catch (err) {
    next(err);
  }
};

export const getSector = async (req, res, next) => {
  try {
    const { rows } = await query(`${SELECT} WHERE id = $1`, [req.params.id]);
    if (!rows[0]) return res.status(404).json({ success: false, message: 'Sector not found' });
    res.json({ success: true, data: rows[0] });
  } catch (err) {
    next(err);
  }
};

export const createSector = async (req, res, next) => {
  try {
    const {
      name,
      title,
      subtitle,
      hoverTitle,
      sectorSlug,
      cardColor,
      iconColor,
      icon,
      order = 0,
      status = 'active',
    } = req.body;

    if (!name || !sectorSlug) {
      return res
        .status(400)
        .json({ success: false, message: 'name and sectorSlug are required' });
    }

    const { rows } = await query(
      `INSERT INTO sectors
         (name, title, subtitle, hover_title, sector_slug,
          card_color, icon_color, icon, display_order, status)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
       RETURNING id`,
      [name, title, subtitle, hoverTitle, sectorSlug, cardColor, iconColor, icon, order, status],
    );

    const created = await query(`${SELECT} WHERE id = $1`, [rows[0].id]);
    res.status(201).json({ success: true, data: created.rows[0] });
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({ success: false, message: 'sectorSlug already exists' });
    }
    next(err);
  }
};

export const updateSector = async (req, res, next) => {
  try {
    const { id } = req.params;
    const {
      name,
      title,
      subtitle,
      hoverTitle,
      sectorSlug,
      cardColor,
      icon,
      iconColor,
      order,
      status,
    } = req.body;

    const { rowCount } = await query(
      `UPDATE sectors SET
         name          = COALESCE($2, name),
         title         = COALESCE($3, title),
         subtitle      = COALESCE($4, subtitle),
         hover_title   = COALESCE($5, hover_title),
         sector_slug   = COALESCE($6, sector_slug),
         card_color    = COALESCE($7, card_color),
         icon_color    = COALESCE($8, icon_color),
         icon          = COALESCE($9, icon),
         display_order = COALESCE($10, display_order),
         status        = COALESCE($11, status),
         updated_at    = NOW()
       WHERE id = $1`,
      [id, name, title, subtitle, hoverTitle, sectorSlug, cardColor, iconColor, icon, order, status],
    );
    if (!rowCount) return res.status(404).json({ success: false, message: 'Sector not found' });

    const { rows } = await query(`${SELECT} WHERE id = $1`, [id]);
    res.json({ success: true, data: rows[0] });
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({ success: false, message: 'sectorSlug already exists' });
    }
    next(err);
  }
};

export const deleteSector = async (req, res, next) => {
  try {
    const { rowCount } = await query('DELETE FROM sectors WHERE id = $1', [req.params.id]);
    if (!rowCount) return res.status(404).json({ success: false, message: 'Sector not found' });
    res.json({ success: true, message: 'Sector deleted' });
  } catch (err) {
    next(err);
  }
};
