import { Router } from 'express';
import healthRoutes from './health.routes.js';
import authRoutes from './auth.routes.js';
import bannerRoutes from './banner.routes.js';
import companyRoutes from './company.routes.js';
import sectorRoutes from './sector.routes.js';
import categoryRoutes from './category.routes.js';
import indicatorRoutes from './indicator.routes.js';
import kpiRoutes from './kpi.routes.js';
import overviewRoutes from './overview.routes.js';
import dashboardRoutes from './dashboard.routes.js';

const router = Router();

router.use('/health', healthRoutes);
router.use('/auth', authRoutes);
router.use('/banners', bannerRoutes);
router.use('/companies', companyRoutes);
router.use('/sectors', sectorRoutes);
router.use('/categories', categoryRoutes);
router.use('/indicators', indicatorRoutes);
router.use('/kpis', kpiRoutes);
router.use('/overview', overviewRoutes);
router.use('/dashboard', dashboardRoutes);

export default router;
