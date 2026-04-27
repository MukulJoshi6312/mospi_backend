import { query } from '../config/db.js';

export const getOverview = async (req, res, next) => {
  try {
    const { sectorSlug } = req.params;

    // Resolve sector id from slug
    const sectorResult = await query(
      `SELECT id FROM sectors WHERE sector_slug = $1 AND status = 'active'`,
      [sectorSlug],
    );

    if (!sectorResult.rows[0]) {
      return res.status(404).json({ success: false, message: 'Sector not found' });
    }

    // Fetch active KPIs for this sector (flat array)
    const { rows } = await query(
      `SELECT k.id,
              k.name,
              k.kpi_slug          AS "kpiSlug",
              k.description,
              k.note,
              k.hover_title       AS "hoverTitle",
              k.data_source       AS "dataSource",
              k.visualization_url AS "visualizationUrl",
              k.card_color        AS "cardColor",
              k.icon_color        AS "iconColor",
              k.kpi_icon          AS "icon",
              k.value1,
              k.value2,
              k.value3,
              k.show_value1       AS "showValue1",
              k.show_value2       AS "showValue2",
              k.show_value3       AS "showValue3",
              k.display_status    AS "displayStatus",
              k.display_order     AS "order"
       FROM kpis k
       WHERE k.sector_id = $1
         AND k.status = 'active'
         AND k.display_status = 'show'
       ORDER BY k.display_order ASC, k.id ASC`,
      [sectorResult.rows[0].id],
    );

    res.json({
      success: true,
      message: 'Sector overview fetched successfully',
      data: rows,
    });
  } catch (err) {
    next(err);
  }
};
