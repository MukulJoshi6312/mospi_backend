import { query } from '../config/db.js';

export const getDashboard = async (req, res, next) => {
  try {
    const { sectorSlug } = req.params;

    // 1. Fetch sector
    const sectorResult = await query(
      `SELECT id,
              name,
              title,
              subtitle,
              hover_title   AS "hoverTitle",
              sector_slug   AS "sectorSlug",
              card_color    AS "cardColor",
              icon_color    AS "iconColor",
              icon,
              display_order AS "order"
       FROM sectors
       WHERE sector_slug = $1 AND status = 'active'`,
      [sectorSlug],
    );

    if (!sectorResult.rows[0]) {
      return res.status(404).json({ success: false, message: 'Sector not found' });
    }

    const sector = sectorResult.rows[0];
    const sectorId = sector.id;

    // 2. Fetch categories, indicators and KPIs in parallel
    const [catResult, indResult, kpiResult] = await Promise.all([
      query(
        `SELECT id,
                name,
                description,
                hover_title    AS "hoverTitle",
                category_slug  AS "categorySlug",
                card_color     AS "cardColor",
                icon_color     AS "iconColor",
                category_icon  AS "icon",
                display_status AS "displayStatus",
                display_order  AS "order"
         FROM categories
         WHERE sector_id = $1 AND status = 'active'
         ORDER BY display_order ASC, id ASC`,
        [sectorId],
      ),
      query(
        `SELECT id,
                category_id    AS "categoryId",
                name,
                hover_title    AS "hoverTitle",
                card_color     AS "cardColor",
                icon_color     AS "iconColor",
                indicator_icon AS "icon",
                display_order  AS "order"
         FROM indicators
         WHERE sector_id = $1 AND status = 'active'
         ORDER BY display_order ASC, id ASC`,
        [sectorId],
      ),
      query(
        `SELECT id,
                indicator_id      AS "indicatorId",
                name,
                kpi_slug          AS "kpiSlug",
                description,
                note,
                hover_title       AS "hoverTitle",
                data_source       AS "dataSource",
                visualization_url AS "visualizationUrl",
                card_color        AS "cardColor",
                icon_color        AS "iconColor",
                kpi_icon          AS "icon",
                value1,
                value2,
                value3,
                show_value1       AS "showValue1",
                show_value2       AS "showValue2",
                show_value3       AS "showValue3",
                display_status    AS "displayStatus",
                display_order     AS "order"
         FROM kpis
         WHERE sector_id = $1
           AND status = 'active'
           AND display_status = 'show'
         ORDER BY display_order ASC, id ASC`,
        [sectorId],
      ),
    ]);

    // 3. Group KPIs under their indicator
    const kpisByIndicator = new Map();
    for (const kpi of kpiResult.rows) {
      const indId = kpi.indicatorId;
      if (!kpisByIndicator.has(indId)) kpisByIndicator.set(indId, []);
      kpisByIndicator.get(indId).push(kpi);
    }

    // 4. Group indicators (with nested KPIs) under their category
    const indsByCategory = new Map();
    for (const ind of indResult.rows) {
      const catId = ind.categoryId;
      const kpis = kpisByIndicator.get(ind.id) || [];
      const indicator = {
        ...ind,
        metricsCount: kpis.length,
        kpis,
      };
      delete indicator.categoryId;
      if (!indsByCategory.has(catId)) indsByCategory.set(catId, []);
      indsByCategory.get(catId).push(indicator);
    }

    // 5. Build categories array with nested indicators
    const categories = catResult.rows.map((cat) => ({
      ...cat,
      indicators: indsByCategory.get(cat.id) || [],
    }));

    // 6. Compose final response
    const data = { ...sector, categories };
    delete data.id; // sector id not needed at top level — sectorSlug is the identifier

    res.json({
      success: true,
      message: 'Sector hierarchy fetched successfully',
      data,
    });
  } catch (err) {
    next(err);
  }
};
