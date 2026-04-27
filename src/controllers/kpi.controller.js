import { query } from '../config/db.js';

const SELECT = `
  SELECT id,
         sector_id         AS "sectorId",
         category_id       AS "categoryId",
         indicator_id      AS "indicatorId",
         name,
         kpi_slug          AS "kpiSlug",
         description, note,
         hover_title       AS "hoverTitle",
         data_source       AS "dataSource",
         visualization_url AS "visualizationUrl",
         card_color        AS "cardColor",
         icon_color        AS "iconColor",
         kpi_icon          AS "icon",
         value1, value2, value3,
         show_value1       AS "showValue1",
         show_value2       AS "showValue2",
         show_value3       AS "showValue3",
         display_status    AS "displayStatus",
         display_order     AS "order",
         status,
         created_at        AS "createdAt",
         updated_at        AS "updatedAt"
  FROM kpis
`;

// Multipart/form-data sends every value as a string, so coerce booleans.
const toBool = (v) => {
  if (v === undefined || v === null || v === '') return undefined;
  if (typeof v === 'boolean') return v;
  return ['true', '1', 'yes', 'on'].includes(String(v).toLowerCase());
};

// GET /api/kpis                    → all
// GET /api/kpis?indicatorId=11     → by indicator
// (categoryId / sectorId also accepted)
export const listKpis = async (req, res, next) => {
  try {
    const { sectorId, categoryId, indicatorId } = req.query;
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
    if (indicatorId) {
      params.push(indicatorId);
      clauses.push(`indicator_id = $${params.length}`);
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

export const getKpi = async (req, res, next) => {
  try {
    const { rows } = await query(`${SELECT} WHERE id = $1`, [req.params.id]);
    if (!rows[0]) return res.status(404).json({ success: false, message: 'KPI not found' });
    res.json({ success: true, data: rows[0] });
  } catch (err) {
    next(err);
  }
};

export const createKpi = async (req, res, next) => {
  try {
    const {
      sectorId,
      categoryId,
      indicatorId,
      name,
      kpiSlug,
      description,
      note,
      hoverTitle,
      dataSource,
      visualizationUrl,
      cardColor,
      iconColor,
      value1,
      value2,
      value3,
      showValue1,
      showValue2,
      showValue3,
      displayStatus = 'show',
      icon,
      order = 0,
      status = 'active',
    } = req.body;

    if (!sectorId || !categoryId || !indicatorId || !name || !kpiSlug) {
      return res.status(400).json({
        success: false,
        message: 'sectorId, categoryId, indicatorId, name and kpiSlug are required',
      });
    }

    const { rows } = await query(
      `INSERT INTO kpis
         (sector_id, category_id, indicator_id, name, kpi_slug,
          description, note, hover_title, data_source, visualization_url,
          card_color, icon_color, kpi_icon,
          value1, value2, value3,
          show_value1, show_value2, show_value3,
          display_status, display_order, status)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22)
       RETURNING id`,
      [
        sectorId,
        categoryId,
        indicatorId,
        name,
        kpiSlug,
        description,
        note,
        hoverTitle,
        dataSource,
        visualizationUrl,
        cardColor,
        iconColor,
        icon,
        value1,
        value2,
        value3,
        toBool(showValue1) ?? false,
        toBool(showValue2) ?? false,
        toBool(showValue3) ?? false,
        displayStatus,
        order,
        status,
      ],
    );

    const created = await query(`${SELECT} WHERE id = $1`, [rows[0].id]);
    res.status(201).json({ success: true, data: created.rows[0] });
  } catch (err) {
    if (err.code === '23503') {
      return res.status(400).json({
        success: false,
        message: 'sectorId, categoryId or indicatorId does not exist',
      });
    }
    if (err.code === '23505') {
      return res.status(409).json({ success: false, message: 'kpiSlug already exists' });
    }
    next(err);
  }
};

export const updateKpi = async (req, res, next) => {
  try {
    const { id } = req.params;
    const {
      sectorId,
      categoryId,
      indicatorId,
      name,
      kpiSlug,
      description,
      note,
      hoverTitle,
      dataSource,
      visualizationUrl,
      cardColor,
      iconColor,
      value1,
      value2,
      value3,
      showValue1,
      showValue2,
      showValue3,
      icon,
      displayStatus,
      order,
      status,
    } = req.body;

    const { rowCount } = await query(
      `UPDATE kpis SET
         sector_id         = COALESCE($2, sector_id),
         category_id       = COALESCE($3, category_id),
         indicator_id      = COALESCE($4, indicator_id),
         name              = COALESCE($5, name),
         kpi_slug          = COALESCE($6, kpi_slug),
         description       = COALESCE($7, description),
         note              = COALESCE($8, note),
         hover_title       = COALESCE($9, hover_title),
         data_source       = COALESCE($10, data_source),
         visualization_url = COALESCE($11, visualization_url),
         card_color        = COALESCE($12, card_color),
         icon_color        = COALESCE($13, icon_color),
         kpi_icon          = COALESCE($14, kpi_icon),
         value1            = COALESCE($15, value1),
         value2            = COALESCE($16, value2),
         value3            = COALESCE($17, value3),
         show_value1       = COALESCE($18, show_value1),
         show_value2       = COALESCE($19, show_value2),
         show_value3       = COALESCE($20, show_value3),
         display_status    = COALESCE($21, display_status),
         display_order     = COALESCE($22, display_order),
         status            = COALESCE($23, status),
         updated_at        = NOW()
       WHERE id = $1`,
      [
        id,
        sectorId,
        categoryId,
        indicatorId,
        name,
        kpiSlug,
        description,
        note,
        hoverTitle,
        dataSource,
        visualizationUrl,
        cardColor,
        iconColor,
        icon,
        value1,
        value2,
        value3,
        toBool(showValue1),
        toBool(showValue2),
        toBool(showValue3),
        displayStatus,
        order,
        status,
      ],
    );
    if (!rowCount) return res.status(404).json({ success: false, message: 'KPI not found' });

    const { rows } = await query(`${SELECT} WHERE id = $1`, [id]);
    res.json({ success: true, data: rows[0] });
  } catch (err) {
    if (err.code === '23503') {
      return res.status(400).json({
        success: false,
        message: 'sectorId, categoryId or indicatorId does not exist',
      });
    }
    if (err.code === '23505') {
      return res.status(409).json({ success: false, message: 'kpiSlug already exists' });
    }
    next(err);
  }
};

export const deleteKpi = async (req, res, next) => {
  try {
    const { rowCount } = await query('DELETE FROM kpis WHERE id = $1', [req.params.id]);
    if (!rowCount) return res.status(404).json({ success: false, message: 'KPI not found' });
    res.json({ success: true, message: 'KPI deleted' });
  } catch (err) {
    next(err);
  }
};
