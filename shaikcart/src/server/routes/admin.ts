import { Router } from 'express';
import { asc, desc, eq, inArray, lte } from 'drizzle-orm';
import Razorpay from 'razorpay';
import { z } from 'zod';
import { db } from '../../db/index.ts';
import {
  adminActivityLogs,
  brands,
  categories,
  cmsSettings,
  coupons,
  couponUsages,
  emailLogs,
  inventoryLogs,
  notifications,
  orderItems,
  orders,
  payments,
  productImages,
  products,
  refunds,
  reviews,
  shipments,
  shippingZones,
  supportTickets,
  users,
  websiteBanners,
} from '../../db/schema.ts';
import { ensureDatabaseSeeded } from '../../db/seed.ts';
import { AuthRequest, requireAdmin } from '../../middleware/auth.ts';
import { escapeCsvCell, sanitizeUrl } from '../security.ts';
import { sendTransactionalEmail } from '../email.ts';

const router = Router();

router.use(async (_req, res, next) => {
  try {
    await ensureDatabaseSeeded();
    next();
  } catch (error) {
    console.error('Lazy seed error:', error);
    res.status(503).json({ error: 'Database service temporarily unavailable.' });
  }
});

async function logAdminAction(
  req: AuthRequest,
  action: string,
  entityType: string,
  entityId = '',
  details: Record<string, unknown> = {}
) {
  if (!req.dbUser) return;
  try {
    await db.insert(adminActivityLogs).values({
      actorUserId: req.dbUser.id,
      actorEmail: req.dbUser.email,
      action,
      entityType,
      entityId: String(entityId),
      details,
      ipAddress: req.ip || '',
    });
  } catch (err) {
    console.error('Failed to write admin activity log:', err);
  }
}

function getDateRangeStart(range: string, fromParam?: string): Date | null {
  const now = new Date();
  switch (range) {
    case 'today': {
      const d = new Date(now);
      d.setHours(0, 0, 0, 0);
      return d;
    }
    case '7d':
      return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    case '30d':
      return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    case 'month':
      return new Date(now.getFullYear(), now.getMonth(), 1);
    case 'year':
      return new Date(now.getFullYear(), 0, 1);
    case 'custom':
      return fromParam ? new Date(fromParam) : null;
    default:
      return null;
  }
}

// ======================= 1. ADMIN DASHBOARD & ANALYTICS =======================

router.get('/dashboard', requireAdmin('dashboard:view'), async (req, res) => {
  try {
    const range = String(req.query.range || '30d');
    const fromParam = req.query.from ? String(req.query.from) : undefined;
    const toParam = req.query.to ? String(req.query.to) : undefined;
    const startDate = getDateRangeStart(range, fromParam);
    const endDate = toParam ? new Date(`${toParam}T23:59:59.999Z`) : new Date();

    const [
      allOrders,
      allOrderItems,
      allUsers,
      allProducts,
      allCategories,
      allRefunds,
      adminNotifications,
    ] = await Promise.all([
      db.select().from(orders).orderBy(desc(orders.createdAt)),
      db.select().from(orderItems),
      db.select().from(users).orderBy(desc(users.createdAt)),
      db.select().from(products),
      db.select().from(categories),
      db.select().from(refunds).orderBy(desc(refunds.createdAt)),
      db
        .select()
        .from(notifications)
        .where(eq(notifications.audience, 'admin'))
        .orderBy(desc(notifications.createdAt))
        .limit(15),
    ]);

    const filteredOrders = allOrders.filter((o) => {
      const created = new Date(o.createdAt);
      if (startDate && created < startDate) return false;
      if (endDate && created > endDate) return false;
      return true;
    });

    const filteredOrderIds = new Set(filteredOrders.map((o) => o.id));
    const filteredItems = allOrderItems.filter((i) => filteredOrderIds.has(i.orderId));

    const validSalesOrders = filteredOrders.filter(
      (o) => !['cancelled', 'returned'].includes(o.orderStatus)
    );
    const totalRevenue = validSalesOrders.reduce((sum, o) => sum + o.totalAmount, 0);
    const totalOrders = filteredOrders.length;
    const customers = allUsers.filter((u) => u.role === 'customer');
    const pendingOrders = filteredOrders.filter((o) =>
      ['pending', 'confirmed', 'processing', 'packed'].includes(o.orderStatus)
    ).length;
    const deliveredOrders = filteredOrders.filter((o) => o.orderStatus === 'delivered').length;
    const lowStockProducts = allProducts.filter((p) => p.stockQuantity <= p.lowStockThreshold);
    const pendingRefunds = allRefunds.filter((r) => ['requested', 'processing'].includes(r.status)).length;

    // Build Daily Revenue & Order Chart Series
    const dailyMap = new Map<string, { date: string; revenue: number; orders: number }>();
    for (const o of filteredOrders) {
      const key = new Date(o.createdAt).toISOString().slice(0, 10);
      const entry = dailyMap.get(key) || { date: key, revenue: 0, orders: 0 };
      entry.orders += 1;
      if (!['cancelled', 'returned'].includes(o.orderStatus)) {
        entry.revenue += o.totalAmount;
      }
      dailyMap.set(key, entry);
    }
    const salesSeries = Array.from(dailyMap.values()).sort((a, b) => a.date.localeCompare(b.date));

    // Top Selling Products from real order items
    const productSalesMap = new Map<
      string,
      { name: string; sku: string; units: number; revenue: number; image: string }
    >();
    for (const item of filteredItems) {
      const key = item.productSkuSnapshot;
      const existing = productSalesMap.get(key) || {
        name: item.productNameSnapshot,
        sku: key,
        units: 0,
        revenue: 0,
        image: item.productImageSnapshot,
      };
      existing.units += item.quantity;
      existing.revenue += item.lineTotal;
      productSalesMap.set(key, existing);
    }
    const topProducts = Array.from(productSalesMap.values())
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 6);

    // Category Performance
    const catMap = new Map(allCategories.map((c) => [c.id, c.name]));
    const prodCatMap = new Map(allProducts.map((p) => [p.id, p.categoryId]));
    const categoryPerfMap = new Map<string, { name: string; revenue: number; units: number }>();
    for (const item of filteredItems) {
      const catId = item.productId ? prodCatMap.get(item.productId) : null;
      const catName = (catId && catMap.get(catId)) || 'Other';
      const entry = categoryPerfMap.get(catName) || { name: catName, revenue: 0, units: 0 };
      entry.revenue += item.lineTotal;
      entry.units += item.quantity;
      categoryPerfMap.set(catName, entry);
    }
    const categoryPerformance = Array.from(categoryPerfMap.values()).sort(
      (a, b) => b.revenue - a.revenue
    );

    res.json({
      kpis: {
        totalRevenue,
        totalOrders,
        totalCustomers: customers.length,
        totalProducts: allProducts.length,
        pendingOrders,
        deliveredOrders,
        lowStockCount: lowStockProducts.length,
        refundRequests: pendingRefunds,
        averageOrderValue: validSalesOrders.length > 0 ? Math.round(totalRevenue / validSalesOrders.length) : 0,
      },
      salesSeries,
      topProducts,
      categoryPerformance,
      recentOrders: filteredOrders.slice(0, 8),
      recentCustomers: customers.slice(0, 6).map((u) => ({
        id: u.id,
        fullName: u.fullName,
        email: u.email,
        phone: u.phone,
        createdAt: u.createdAt,
        status: u.status,
      })),
      lowStockAlerts: lowStockProducts.slice(0, 8).map((p) => ({
        id: p.id,
        name: p.name,
        sku: p.sku,
        stockQuantity: p.stockQuantity,
        lowStockThreshold: p.lowStockThreshold,
        primaryImage: p.primaryImage,
      })),
      notifications: adminNotifications,
    });
  } catch (error) {
    console.error('Admin dashboard error:', error);
    res.status(500).json({ error: 'Unable to load dashboard analytics.' });
  }
});

router.get('/analytics', requireAdmin('analytics:view'), async (req, res) => {
  try {
    const [allOrders, allCoupons, allUsages, allRefunds, allUsers] = await Promise.all([
      db.select().from(orders).orderBy(desc(orders.createdAt)),
      db.select().from(coupons),
      db.select().from(couponUsages),
      db.select().from(refunds),
      db.select().from(users),
    ]);

    const customers = allUsers.filter((u) => u.role === 'customer');
    const ordersByUser = new Map<number, number>();
    for (const o of allOrders) {
      if (o.userId) {
        ordersByUser.set(o.userId, (ordersByUser.get(o.userId) || 0) + 1);
      }
    }
    const repeatCustomers = Array.from(ordersByUser.values()).filter((c) => c > 1).length;
    const repeatRate =
      ordersByUser.size > 0 ? Number(((repeatCustomers / ordersByUser.size) * 100).toFixed(1)) : 0;

    const validOrders = allOrders.filter((o) => !['cancelled', 'returned'].includes(o.orderStatus));
    const totalSales = validOrders.reduce((s, o) => s + o.totalAmount, 0);
    const aov = validOrders.length > 0 ? Math.round(totalSales / validOrders.length) : 0;

    const totalRefundAmount = allRefunds
      .filter((r) => r.status === 'processed')
      .reduce((s, r) => s + r.amount, 0);

    const couponStats = allCoupons.map((c) => {
      const usages = allUsages.filter((u) => u.couponId === c.id);
      return {
        code: c.code,
        usedCount: c.usedCount,
        totalDiscountGiven: usages.reduce((s, u) => s + u.discountApplied, 0),
        status: c.status,
      };
    });

    res.json({
      totalSales,
      totalOrders: allOrders.length,
      averageOrderValue: aov,
      totalCustomers: customers.length,
      repeatCustomers,
      repeatRate,
      conversionTrackingConfigured: false,
      refundSummary: {
        totalCount: allRefunds.length,
        processedAmount: totalRefundAmount,
      },
      couponStats,
    });
  } catch (error) {
    console.error('Admin analytics error:', error);
    res.status(500).json({ error: 'Unable to calculate analytics.' });
  }
});

// CSV Reports Export
router.get('/export/orders.csv', requireAdmin('orders:manage'), async (_req, res) => {
  try {
    const allOrders = await db.select().from(orders).orderBy(desc(orders.createdAt));
    const header = [
      'Order Number',
      'Date',
      'Customer Name',
      'Customer Email',
      'Phone',
      'City',
      'PIN Code',
      'Subtotal (INR)',
      'Discount (INR)',
      'Shipping (INR)',
      'Tax (INR)',
      'Total (INR)',
      'Payment Method',
      'Payment Status',
      'Order Status',
    ];
    const lines = [header.map(escapeCsvCell).join(',')];
    for (const o of allOrders) {
      lines.push(
        [
          o.orderNumber,
          new Date(o.createdAt).toISOString(),
          o.customerName,
          o.customerEmail,
          o.customerPhone,
          o.shippingAddress?.city || '',
          o.shippingAddress?.pincode || '',
          o.subtotal,
          o.discountAmount,
          o.shippingFee,
          o.taxAmount,
          o.totalAmount,
          o.paymentMethod,
          o.paymentStatus,
          o.orderStatus,
        ]
          .map(escapeCsvCell)
          .join(',')
      );
    }
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="shaikcart-orders-report.csv"');
    res.send(lines.join('\n'));
  } catch (error) {
    console.error('Export orders CSV error:', error);
    res.status(500).json({ error: 'Unable to export orders CSV.' });
  }
});

// ======================= 2. PRODUCTS & INVENTORY MANAGEMENT =======================

router.get('/products', requireAdmin('products:manage'), async (req, res) => {
  try {
    const search = String(req.query.search || '').trim().toLowerCase();
    const categoryId = req.query.categoryId ? Number(req.query.categoryId) : null;
    const lowStockOnly = req.query.lowStock === 'true';

    const [allProds, allCats, allBrands] = await Promise.all([
      db.select().from(products).orderBy(desc(products.createdAt)),
      db.select().from(categories).orderBy(asc(categories.sortOrder)),
      db.select().from(brands).orderBy(asc(brands.name)),
    ]);

    const catMap = new Map(allCats.map((c) => [c.id, c.name]));
    const brandMap = new Map(allBrands.map((b) => [b.id, b.name]));

    let list = allProds.map((p) => ({
      ...p,
      ratingAvg: Number(p.ratingAvg),
      categoryName: p.categoryId ? catMap.get(p.categoryId) || '—' : '—',
      brandName: p.brandId ? brandMap.get(p.brandId) || '—' : '—',
    }));

    if (search) {
      list = list.filter(
        (p) =>
          p.name.toLowerCase().includes(search) ||
          p.sku.toLowerCase().includes(search) ||
          p.categoryName.toLowerCase().includes(search)
      );
    }
    if (categoryId) {
      list = list.filter((p) => p.categoryId === categoryId);
    }
    if (lowStockOnly) {
      list = list.filter((p) => p.stockQuantity <= p.lowStockThreshold);
    }

    res.json({ products: list, categories: allCats, brands: allBrands });
  } catch (error) {
    console.error('Admin products list error:', error);
    res.status(500).json({ error: 'Unable to load products.' });
  }
});

const productUpsertSchema = z.object({
  name: z.string().min(2).max(180),
  slug: z.string().min(2).max(200).optional(),
  sku: z.string().min(2).max(60),
  categoryId: z.number().int().nullable().optional(),
  subcategory: z.string().max(100).optional().default(''),
  brandId: z.number().int().nullable().optional(),
  shortDescription: z.string().max(300).optional().default(''),
  description: z.string().min(5),
  materials: z.string().max(200).optional().default(''),
  dimensions: z.string().max(200).optional().default(''),
  regularPrice: z.number().int().positive(),
  salePrice: z.number().int().positive(),
  stockQuantity: z.number().int().min(0).default(0),
  lowStockThreshold: z.number().int().min(1).default(8),
  primaryImage: z.string().min(1),
  colors: z.array(z.string()).optional().default([]),
  sizes: z.array(z.string()).optional().default([]),
  tags: z.array(z.string()).optional().default([]),
  highlights: z.array(z.string()).optional().default([]),
  specifications: z.record(z.string(), z.string()).optional().default({}),
  isFeatured: z.boolean().optional().default(false),
  isBestseller: z.boolean().optional().default(false),
  isNewArrival: z.boolean().optional().default(false),
  isTrending: z.boolean().optional().default(false),
  isActive: z.boolean().optional().default(true),
  isDemo: z.boolean().optional().default(false),
  seoTitle: z.string().max(160).optional().default(''),
  seoDescription: z.string().max(300).optional().default(''),
});

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

router.post('/products', requireAdmin('products:manage'), async (req: AuthRequest, res) => {
  try {
    const parsed = productUpsertSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.issues[0]?.message || 'Invalid product fields.' });
    }
    const data = parsed.data;
    const safeImg = sanitizeUrl(data.primaryImage) || '/src/assets/images/prod_gift_hamper_1795671306831.jpg';
    const slug = data.slug ? slugify(data.slug) : `${slugify(data.name)}-${Date.now().toString(36).slice(-4)}`;

    const [created] = await db
      .insert(products)
      .values({
        ...data,
        slug,
        primaryImage: safeImg,
        isDemo: false,
      })
      .returning();

    await db.insert(productImages).values({
      productId: created.id,
      url: safeImg,
      altText: created.name,
      sortOrder: 0,
    });

    await logAdminAction(req, 'create_product', 'product', String(created.id), {
      name: created.name,
      sku: created.sku,
    });

    res.status(201).json({ product: created });
  } catch (error: any) {
    console.error('Create product error:', error);
    if (error?.code === '23505') {
      return res.status(409).json({ error: 'A product with that SKU or URL slug already exists.' });
    }
    res.status(500).json({ error: 'Unable to create product.' });
  }
});

router.patch('/products/:id', requireAdmin('products:manage'), async (req: AuthRequest, res) => {
  try {
    const id = Number(req.params.id);
    const parsed = productUpsertSchema.partial().safeParse(req.body);
    if (!Number.isInteger(id) || !parsed.success) {
      return res.status(400).json({ error: 'Invalid product update payload.' });
    }

    const updateData: Record<string, unknown> = { ...parsed.data, updatedAt: new Date() };
    if (parsed.data.primaryImage) {
      updateData.primaryImage = sanitizeUrl(parsed.data.primaryImage);
    }

    const [updated] = await db.update(products).set(updateData).where(eq(products.id, id)).returning();
    if (!updated) return res.status(404).json({ error: 'Product not found.' });

    await logAdminAction(req, 'update_product', 'product', String(id), { name: updated.name });
    res.json({ product: updated });
  } catch (error) {
    console.error('Update product error:', error);
    res.status(500).json({ error: 'Unable to update product.' });
  }
});

router.post('/products/:id/stock', requireAdmin('products:manage'), async (req: AuthRequest, res) => {
  try {
    const id = Number(req.params.id);
    const schema = z.object({
      newStock: z.number().int().min(0),
      reason: z.string().min(2).max(200),
    });
    const parsed = schema.safeParse(req.body);
    if (!Number.isInteger(id) || !parsed.success) {
      return res.status(400).json({ error: 'Provide a non-negative stock quantity and reason.' });
    }

    const [existing] = await db.select().from(products).where(eq(products.id, id)).limit(1);
    if (!existing) return res.status(404).json({ error: 'Product not found.' });

    const changeAmount = parsed.data.newStock - existing.stockQuantity;
    const [updated] = await db
      .update(products)
      .set({ stockQuantity: parsed.data.newStock, updatedAt: new Date() })
      .where(eq(products.id, id))
      .returning();

    await db.insert(inventoryLogs).values({
      productId: id,
      changeAmount,
      previousStock: existing.stockQuantity,
      newStock: parsed.data.newStock,
      reason: parsed.data.reason.trim(),
      actorUserId: req.dbUser?.id || null,
    });

    await logAdminAction(req, 'adjust_stock', 'product', String(id), {
      previousStock: existing.stockQuantity,
      newStock: parsed.data.newStock,
      reason: parsed.data.reason,
    });

    res.json({ product: updated });
  } catch (error) {
    console.error('Stock adjustment error:', error);
    res.status(500).json({ error: 'Unable to adjust stock.' });
  }
});

router.delete('/products/:id', requireAdmin('products:manage'), async (req: AuthRequest, res) => {
  try {
    const id = Number(req.params.id);
    const [deleted] = await db.delete(products).where(eq(products.id, id)).returning();
    if (!deleted) return res.status(404).json({ error: 'Product not found.' });
    await logAdminAction(req, 'delete_product', 'product', String(id), { name: deleted.name });
    res.json({ deleted: true });
  } catch (error) {
    console.error('Delete product error:', error);
    res.status(500).json({ error: 'Unable to delete product.' });
  }
});

router.get('/inventory-logs', requireAdmin('products:manage'), async (_req, res) => {
  try {
    const rows = await db
      .select({
        id: inventoryLogs.id,
        productId: inventoryLogs.productId,
        productName: products.name,
        productSku: products.sku,
        changeAmount: inventoryLogs.changeAmount,
        previousStock: inventoryLogs.previousStock,
        newStock: inventoryLogs.newStock,
        reason: inventoryLogs.reason,
        createdAt: inventoryLogs.createdAt,
      })
      .from(inventoryLogs)
      .innerJoin(products, eq(inventoryLogs.productId, products.id))
      .orderBy(desc(inventoryLogs.createdAt))
      .limit(50);
    res.json({ logs: rows });
  } catch (error) {
    console.error('Inventory logs error:', error);
    res.status(500).json({ error: 'Unable to load inventory history.' });
  }
});

// ======================= 3. CATEGORIES & BRANDS MANAGEMENT =======================

router.get('/categories', requireAdmin('categories:manage'), async (_req, res) => {
  const rows = await db.select().from(categories).orderBy(asc(categories.sortOrder));
  res.json({ categories: rows });
});

router.post('/categories', requireAdmin('categories:manage'), async (req: AuthRequest, res) => {
  try {
    const schema = z.object({
      name: z.string().min(2).max(80),
      slug: z.string().optional(),
      description: z.string().optional().default(''),
      imageUrl: z.string().optional().default(''),
      bannerUrl: z.string().optional().default(''),
      subcategories: z.array(z.string()).optional().default([]),
      sortOrder: z.number().int().optional().default(10),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: 'Invalid category payload.' });
    const [created] = await db
      .insert(categories)
      .values({
        name: parsed.data.name.trim(),
        slug: slugify(parsed.data.slug || parsed.data.name),
        description: parsed.data.description,
        imageUrl: sanitizeUrl(parsed.data.imageUrl),
        bannerUrl: sanitizeUrl(parsed.data.bannerUrl),
        subcategories: parsed.data.subcategories,
        sortOrder: parsed.data.sortOrder,
      })
      .returning();
    await logAdminAction(req, 'create_category', 'category', String(created.id), { name: created.name });
    res.status(201).json({ category: created });
  } catch (error) {
    console.error('Create category error:', error);
    res.status(500).json({ error: 'Unable to create category.' });
  }
});

router.patch('/categories/:id', requireAdmin('categories:manage'), async (req: AuthRequest, res) => {
  try {
    const id = Number(req.params.id);
    const [updated] = await db
      .update(categories)
      .set({
        ...(req.body.name ? { name: String(req.body.name).trim() } : {}),
        ...(req.body.description !== undefined ? { description: String(req.body.description) } : {}),
        ...(req.body.imageUrl !== undefined ? { imageUrl: sanitizeUrl(req.body.imageUrl) } : {}),
        ...(req.body.bannerUrl !== undefined ? { bannerUrl: sanitizeUrl(req.body.bannerUrl) } : {}),
        ...(req.body.sortOrder !== undefined ? { sortOrder: Number(req.body.sortOrder) } : {}),
        ...(req.body.isActive !== undefined ? { isActive: Boolean(req.body.isActive) } : {}),
      })
      .where(eq(categories.id, id))
      .returning();
    if (!updated) return res.status(404).json({ error: 'Category not found.' });
    await logAdminAction(req, 'update_category', 'category', String(id), { name: updated.name });
    res.json({ category: updated });
  } catch (error) {
    console.error('Update category error:', error);
    res.status(500).json({ error: 'Unable to update category.' });
  }
});

router.delete('/categories/:id', requireAdmin('categories:manage'), async (req: AuthRequest, res) => {
  const id = Number(req.params.id);
  await db.delete(categories).where(eq(categories.id, id));
  await logAdminAction(req, 'delete_category', 'category', String(id));
  res.json({ deleted: true });
});

router.get('/brands', requireAdmin('categories:manage'), async (_req, res) => {
  const rows = await db.select().from(brands).orderBy(asc(brands.name));
  res.json({ brands: rows });
});

router.post('/brands', requireAdmin('categories:manage'), async (req: AuthRequest, res) => {
  try {
    const schema = z.object({
      name: z.string().min(2).max(80),
      description: z.string().optional().default(''),
      logoUrl: z.string().optional().default(''),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: 'Invalid brand payload.' });
    const [created] = await db
      .insert(brands)
      .values({
        name: parsed.data.name.trim(),
        slug: slugify(parsed.data.name),
        description: parsed.data.description,
        logoUrl: sanitizeUrl(parsed.data.logoUrl),
      })
      .returning();
    await logAdminAction(req, 'create_brand', 'brand', String(created.id), { name: created.name });
    res.status(201).json({ brand: created });
  } catch (error) {
    console.error('Create brand error:', error);
    res.status(500).json({ error: 'Unable to create brand.' });
  }
});

router.delete('/brands/:id', requireAdmin('categories:manage'), async (req: AuthRequest, res) => {
  const id = Number(req.params.id);
  await db.delete(brands).where(eq(brands.id, id));
  await logAdminAction(req, 'delete_brand', 'brand', String(id));
  res.json({ deleted: true });
});

// ======================= 4. ORDER & SHIPMENT MANAGEMENT =======================

router.get('/orders', requireAdmin('orders:manage'), async (req, res) => {
  try {
    const statusFilter = String(req.query.status || '').trim();
    const allOrders = await db.select().from(orders).orderBy(desc(orders.createdAt));
    const filtered = statusFilter ? allOrders.filter((o) => o.orderStatus === statusFilter) : allOrders;

    const orderIds = filtered.map((o) => o.id);
    const [items, shipRows, payRows] =
      orderIds.length > 0
        ? await Promise.all([
            db.select().from(orderItems).where(inArray(orderItems.orderId, orderIds)),
            db.select().from(shipments).where(inArray(shipments.orderId, orderIds)),
            db.select().from(payments).where(inArray(payments.orderId, orderIds)),
          ])
        : [[], [], []];

    const itemsMap = new Map<number, typeof items>();
    for (const i of items) {
      const list = itemsMap.get(i.orderId) || [];
      list.push(i);
      itemsMap.set(i.orderId, list);
    }
    const shipMap = new Map(shipRows.map((s) => [s.orderId, s]));
    const payMap = new Map(payRows.map((p) => [p.orderId, p]));

    res.json({
      orders: filtered.map((o) => ({
        ...o,
        items: itemsMap.get(o.id) || [],
        shipment: shipMap.get(o.id) || null,
        payment: payMap.get(o.id) || null,
      })),
    });
  } catch (error) {
    console.error('Admin orders error:', error);
    res.status(500).json({ error: 'Unable to load orders.' });
  }
});

const updateOrderStatusSchema = z.object({
  orderStatus: z.enum([
    'pending',
    'confirmed',
    'processing',
    'packed',
    'shipped',
    'out_for_delivery',
    'delivered',
    'cancelled',
    'returned',
  ]),
  courierName: z.string().max(120).optional(),
  trackingNumber: z.string().max(120).optional(),
  trackingUrl: z.string().max(300).optional(),
  estimatedDelivery: z.string().max(80).optional(),
  note: z.string().max(300).optional(),
});

const STATUS_LABELS: Record<string, string> = {
  pending: 'Order Placed',
  confirmed: 'Order Confirmed',
  processing: 'Processing',
  packed: 'Packed & Ready',
  shipped: 'Shipped',
  out_for_delivery: 'Out for Delivery',
  delivered: 'Delivered',
  cancelled: 'Cancelled',
  returned: 'Returned',
};

router.patch('/orders/:id/status', requireAdmin('orders:manage'), async (req: AuthRequest, res) => {
  try {
    const id = Number(req.params.id);
    const parsed = updateOrderStatusSchema.safeParse(req.body);
    if (!Number.isInteger(id) || !parsed.success) {
      return res.status(400).json({ error: 'Invalid order status update.' });
    }

    const [existing] = await db.select().from(orders).where(eq(orders.id, id)).limit(1);
    if (!existing) return res.status(404).json({ error: 'Order not found.' });

    const nextPaymentStatus =
      parsed.data.orderStatus === 'delivered' && existing.paymentMethod === 'cod'
        ? 'paid'
        : existing.paymentStatus;

    const [updatedOrder] = await db
      .update(orders)
      .set({
        orderStatus: parsed.data.orderStatus,
        paymentStatus: nextPaymentStatus,
        updatedAt: new Date(),
      })
      .where(eq(orders.id, id))
      .returning();

    const [ship] = await db.select().from(shipments).where(eq(shipments.orderId, id)).limit(1);
    const timeline = [
      ...(ship?.timeline || []),
      {
        status: parsed.data.orderStatus,
        label: STATUS_LABELS[parsed.data.orderStatus] || parsed.data.orderStatus,
        timestamp: new Date().toISOString(),
        note:
          parsed.data.note ||
          (parsed.data.trackingNumber
            ? `Dispatched via ${parsed.data.courierName || 'Courier'} (${parsed.data.trackingNumber})`
            : `Status updated to ${STATUS_LABELS[parsed.data.orderStatus]}`),
      },
    ];

    if (ship) {
      await db
        .update(shipments)
        .set({
          status: parsed.data.orderStatus,
          courierName: parsed.data.courierName ?? ship.courierName,
          trackingNumber: parsed.data.trackingNumber ?? ship.trackingNumber,
          trackingUrl:
            parsed.data.trackingUrl !== undefined
              ? sanitizeUrl(parsed.data.trackingUrl)
              : ship.trackingUrl,
          estimatedDelivery: parsed.data.estimatedDelivery ?? ship.estimatedDelivery,
          shippedAt: parsed.data.orderStatus === 'shipped' ? new Date() : ship.shippedAt,
          deliveredAt: parsed.data.orderStatus === 'delivered' ? new Date() : ship.deliveredAt,
          timeline,
          updatedAt: new Date(),
        })
        .where(eq(shipments.id, ship.id));
    }

    if (existing.userId) {
      await db.insert(notifications).values({
        userId: existing.userId,
        audience: 'customer',
        type: 'order',
        title: `Order ${existing.orderNumber}: ${STATUS_LABELS[parsed.data.orderStatus]}`,
        message: parsed.data.trackingNumber
          ? `Your order has been updated to ${STATUS_LABELS[parsed.data.orderStatus]}. Tracking #: ${parsed.data.trackingNumber}`
          : `Your order status is now ${STATUS_LABELS[parsed.data.orderStatus]}.`,
        linkUrl: `/track-order?orderNumber=${existing.orderNumber}`,
      });
    }

    if (['shipped', 'delivered'].includes(parsed.data.orderStatus)) {
      await sendTransactionalEmail({
        to: existing.customerEmail,
        subject: `SHAIKCART Order ${existing.orderNumber} — ${STATUS_LABELS[parsed.data.orderStatus]}`,
        template: `order_${parsed.data.orderStatus}`,
        html: `<p>Your order <strong>${existing.orderNumber}</strong> is now <strong>${STATUS_LABELS[parsed.data.orderStatus]}</strong>.</p>`,
      });
    }

    await logAdminAction(req, 'update_order_status', 'order', existing.orderNumber, {
      from: existing.orderStatus,
      to: parsed.data.orderStatus,
      trackingNumber: parsed.data.trackingNumber || '',
    });

    res.json({ order: updatedOrder });
  } catch (error) {
    console.error('Update order status error:', error);
    res.status(500).json({ error: 'Unable to update order status.' });
  }
});

// ======================= 5. CUSTOMER & ROLE MANAGEMENT =======================

router.get('/customers', requireAdmin('customers:view'), async (_req, res) => {
  try {
    const [allUsers, allOrders] = await Promise.all([
      db.select().from(users).orderBy(desc(users.createdAt)),
      db.select().from(orders),
    ]);

    const orderStats = new Map<number, { count: number; totalSpent: number }>();
    for (const o of allOrders) {
      if (o.userId) {
        const cur = orderStats.get(o.userId) || { count: 0, totalSpent: 0 };
        cur.count += 1;
        if (!['cancelled', 'returned'].includes(o.orderStatus)) {
          cur.totalSpent += o.totalAmount;
        }
        orderStats.set(o.userId, cur);
      }
    }

    res.json({
      customers: allUsers.map((u) => {
        const st = orderStats.get(u.id) || { count: 0, totalSpent: 0 };
        return {
          id: u.id,
          fullName: u.fullName,
          email: u.email,
          phone: u.phone || '',
          role: u.role,
          status: u.status,
          emailVerified: u.emailVerified,
          orderCount: st.count,
          totalSpent: st.totalSpent,
          lastLoginAt: u.lastLoginAt,
          createdAt: u.createdAt,
        };
      }),
    });
  } catch (error) {
    console.error('Admin customers error:', error);
    res.status(500).json({ error: 'Unable to load customers.' });
  }
});

router.patch('/customers/:id/status', requireAdmin('customers:manage'), async (req: AuthRequest, res) => {
  try {
    const id = Number(req.params.id);
    const status = req.body?.status === 'suspended' ? 'suspended' : 'active';
    if (id === req.dbUser?.id) {
      return res.status(400).json({ error: 'You cannot suspend your own account.' });
    }
    const [updated] = await db
      .update(users)
      .set({ status, updatedAt: new Date() })
      .where(eq(users.id, id))
      .returning();
    if (!updated) return res.status(404).json({ error: 'User not found.' });
    await logAdminAction(req, 'update_user_status', 'user', String(id), { status });
    res.json({ updated: true, status: updated.status });
  } catch (error) {
    console.error('Update user status error:', error);
    res.status(500).json({ error: 'Unable to update user status.' });
  }
});

router.patch('/customers/:id/role', requireAdmin('*'), async (req: AuthRequest, res) => {
  try {
    const id = Number(req.params.id);
    const allowed = ['customer', 'order_manager', 'inventory_manager', 'manager', 'admin', 'super_admin'];
    const role = String(req.body?.role || '');
    if (!allowed.includes(role)) {
      return res.status(400).json({ error: 'Invalid role selected.' });
    }
    const [updated] = await db
      .update(users)
      .set({ role, updatedAt: new Date() })
      .where(eq(users.id, id))
      .returning();
    if (!updated) return res.status(404).json({ error: 'User not found.' });
    await logAdminAction(req, 'update_user_role', 'user', String(id), { role });
    res.json({ updated: true, role: updated.role });
  } catch (error) {
    console.error('Update user role error:', error);
    res.status(500).json({ error: 'Unable to update user role.' });
  }
});

// ======================= 6. COUPONS MANAGEMENT =======================

router.get('/coupons', requireAdmin('coupons:manage'), async (_req, res) => {
  const rows = await db.select().from(coupons).orderBy(desc(coupons.createdAt));
  res.json({ coupons: rows });
});

router.post('/coupons', requireAdmin('coupons:manage'), async (req: AuthRequest, res) => {
  try {
    const schema = z.object({
      code: z.string().min(3).max(32),
      description: z.string().max(240).optional().default(''),
      discountType: z.enum(['percentage', 'fixed']),
      discountValue: z.number().int().positive(),
      minOrderValue: z.number().int().min(0).default(0),
      maxDiscountLimit: z.number().int().positive().nullable().optional(),
      usageLimit: z.number().int().positive().nullable().optional(),
      perCustomerLimit: z.number().int().positive().default(1),
      categorySlug: z.string().nullable().optional(),
      status: z.enum(['active', 'scheduled', 'expired', 'disabled']).default('active'),
      expiresAt: z.string().nullable().optional(),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: 'Invalid coupon parameters.' });

    const [created] = await db
      .insert(coupons)
      .values({
        code: parsed.data.code.trim().toUpperCase(),
        description: parsed.data.description,
        discountType: parsed.data.discountType,
        discountValue: parsed.data.discountValue,
        minOrderValue: parsed.data.minOrderValue,
        maxDiscountLimit: parsed.data.maxDiscountLimit || null,
        usageLimit: parsed.data.usageLimit || null,
        perCustomerLimit: parsed.data.perCustomerLimit,
        categorySlug: parsed.data.categorySlug || null,
        status: parsed.data.status,
        expiresAt: parsed.data.expiresAt ? new Date(parsed.data.expiresAt) : null,
      })
      .returning();

    await logAdminAction(req, 'create_coupon', 'coupon', created.code);
    res.status(201).json({ coupon: created });
  } catch (error: any) {
    if (error?.code === '23505') {
      return res.status(409).json({ error: 'A coupon with this code already exists.' });
    }
    console.error('Create coupon error:', error);
    res.status(500).json({ error: 'Unable to create coupon.' });
  }
});

router.patch('/coupons/:id', requireAdmin('coupons:manage'), async (req: AuthRequest, res) => {
  const id = Number(req.params.id);
  const status = String(req.body?.status || 'active');
  const [updated] = await db.update(coupons).set({ status }).where(eq(coupons.id, id)).returning();
  if (!updated) return res.status(404).json({ error: 'Coupon not found.' });
  await logAdminAction(req, 'update_coupon', 'coupon', updated.code, { status });
  res.json({ coupon: updated });
});

router.delete('/coupons/:id', requireAdmin('coupons:manage'), async (req: AuthRequest, res) => {
  const id = Number(req.params.id);
  await db.delete(coupons).where(eq(coupons.id, id));
  await logAdminAction(req, 'delete_coupon', 'coupon', String(id));
  res.json({ deleted: true });
});

// ======================= 7. SHIPPING ZONES =======================

router.get('/shipping-zones', requireAdmin('shipping:manage'), async (_req, res) => {
  const rows = await db.select().from(shippingZones).orderBy(asc(shippingZones.id));
  res.json({ zones: rows });
});

router.post('/shipping-zones', requireAdmin('shipping:manage'), async (req: AuthRequest, res) => {
  try {
    const schema = z.object({
      regionName: z.string().min(2).max(120),
      pincodePrefix: z.string().min(1).max(6),
      baseCharge: z.number().int().min(0),
      freeShippingThreshold: z.number().int().min(0),
      estimatedDays: z.string().min(2).max(60),
      codEnabled: z.boolean().default(true),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: 'Invalid shipping zone details.' });
    const [created] = await db.insert(shippingZones).values(parsed.data).returning();
    await logAdminAction(req, 'create_shipping_zone', 'shipping_zone', String(created.id));
    res.status(201).json({ zone: created });
  } catch (error) {
    console.error('Create shipping zone error:', error);
    res.status(500).json({ error: 'Unable to save shipping zone.' });
  }
});

router.delete('/shipping-zones/:id', requireAdmin('shipping:manage'), async (req: AuthRequest, res) => {
  const id = Number(req.params.id);
  await db.delete(shippingZones).where(eq(shippingZones.id, id));
  res.json({ deleted: true });
});

// ======================= 8. PAYMENTS & RAZORPAY REFUNDS =======================

router.get('/payments', requireAdmin('payments:manage'), async (_req, res) => {
  try {
    const rows = await db
      .select({
        id: payments.id,
        orderId: payments.orderId,
        orderNumber: orders.orderNumber,
        customerName: orders.customerName,
        customerEmail: orders.customerEmail,
        gateway: payments.gateway,
        razorpayOrderId: payments.razorpayOrderId,
        razorpayPaymentId: payments.razorpayPaymentId,
        method: payments.method,
        amount: payments.amount,
        currency: payments.currency,
        status: payments.status,
        createdAt: payments.createdAt,
      })
      .from(payments)
      .innerJoin(orders, eq(payments.orderId, orders.id))
      .orderBy(desc(payments.createdAt));

    const refundRows = await db.select().from(refunds).orderBy(desc(refunds.createdAt));
    res.json({ payments: rows, refunds: refundRows });
  } catch (error) {
    console.error('Admin payments error:', error);
    res.status(500).json({ error: 'Unable to load payment records.' });
  }
});

router.post('/payments/:id/refund', requireAdmin('payments:manage'), async (req: AuthRequest, res) => {
  try {
    const paymentId = Number(req.params.id);
    const reason = String(req.body?.reason || 'Customer refund approved by administrator').trim();

    const [payRow] = await db.select().from(payments).where(eq(payments.id, paymentId)).limit(1);
    if (!payRow) return res.status(404).json({ error: 'Payment transaction not found.' });
    if (payRow.status !== 'captured') {
      return res.status(400).json({ error: 'Only captured/paid transactions are eligible for gateway refund.' });
    }

    const keyId = process.env.RAZORPAY_KEY_ID?.trim();
    const keySecret = process.env.RAZORPAY_KEY_SECRET?.trim();

    if (payRow.gateway === 'razorpay') {
      if (!keyId || !keySecret || !payRow.razorpayPaymentId) {
        return res.status(503).json({
          error: 'Razorpay API credentials and captured Razorpay Payment ID are required to execute a gateway refund.',
        });
      }

      const rzp = new Razorpay({ key_id: keyId, key_secret: keySecret });
      const rzpRefund = await rzp.payments.refund(payRow.razorpayPaymentId, {
        amount: payRow.amount * 100,
        notes: { reason, initiatedBy: req.dbUser?.email || 'admin' },
      });

      const [createdRefund] = await db
        .insert(refunds)
        .values({
          orderId: payRow.orderId,
          paymentId: payRow.id,
          razorpayRefundId: rzpRefund.id,
          amount: payRow.amount,
          reason,
          status: 'processed',
          initiatedByUserId: req.dbUser?.id || null,
        })
        .returning();

      await db.update(payments).set({ status: 'refunded', updatedAt: new Date() }).where(eq(payments.id, payRow.id));
      await db
        .update(orders)
        .set({ paymentStatus: 'refunded', orderStatus: 'returned', updatedAt: new Date() })
        .where(eq(orders.id, payRow.orderId));

      await logAdminAction(req, 'initiate_razorpay_refund', 'payment', String(payRow.id), {
        razorpayRefundId: rzpRefund.id,
        amount: payRow.amount,
      });

      return res.json({ refund: createdRefund });
    }

    return res.status(400).json({ error: 'Non-Razorpay transactions must be refunded manually via bank transfer.' });
  } catch (error) {
    console.error('Refund error:', error);
    res.status(500).json({ error: 'Unable to initiate Razorpay refund.' });
  }
});

// ======================= 9. CMS (BANNERS & SITE SETTINGS) =======================

router.get('/banners', requireAdmin('cms:manage'), async (_req, res) => {
  const rows = await db.select().from(websiteBanners).orderBy(asc(websiteBanners.sortOrder));
  res.json({ banners: rows });
});

router.patch('/banners/:id', requireAdmin('cms:manage'), async (req: AuthRequest, res) => {
  try {
    const id = Number(req.params.id);
    const [updated] = await db
      .update(websiteBanners)
      .set({
        ...(req.body.title !== undefined ? { title: String(req.body.title) } : {}),
        ...(req.body.subtitle !== undefined ? { subtitle: String(req.body.subtitle) } : {}),
        ...(req.body.ctaText !== undefined ? { ctaText: String(req.body.ctaText) } : {}),
        ...(req.body.ctaLink !== undefined ? { ctaLink: sanitizeUrl(req.body.ctaLink) || '/shop' } : {}),
        ...(req.body.imageUrl !== undefined ? { imageUrl: sanitizeUrl(req.body.imageUrl) } : {}),
        ...(req.body.badgeText !== undefined ? { badgeText: String(req.body.badgeText) } : {}),
        ...(req.body.isActive !== undefined ? { isActive: Boolean(req.body.isActive) } : {}),
        updatedAt: new Date(),
      })
      .where(eq(websiteBanners.id, id))
      .returning();
    if (!updated) return res.status(404).json({ error: 'Banner not found.' });
    await logAdminAction(req, 'update_banner', 'website_banner', String(id), { title: updated.title });
    res.json({ banner: updated });
  } catch (error) {
    console.error('Update banner error:', error);
    res.status(500).json({ error: 'Unable to update banner.' });
  }
});

router.get('/cms', requireAdmin('cms:manage'), async (_req, res) => {
  const rows = await db.select().from(cmsSettings);
  const map: Record<string, unknown> = {};
  for (const r of rows) map[r.key] = r.value;
  res.json({ settings: map });
});

router.put('/cms/:key', requireAdmin('cms:manage'), async (req: AuthRequest, res) => {
  try {
    const key = req.params.key;
    const value = req.body?.value;
    if (!value || typeof value !== 'object') {
      return res.status(400).json({ error: 'CMS value must be a JSON object.' });
    }
    await db
      .insert(cmsSettings)
      .values({ key, value, updatedAt: new Date() })
      .onConflictDoUpdate({
        target: cmsSettings.key,
        set: { value, updatedAt: new Date() },
      });
    await logAdminAction(req, 'update_cms', 'cms_setting', key);
    res.json({ saved: true, key, value });
  } catch (error) {
    console.error('Save CMS error:', error);
    res.status(500).json({ error: 'Unable to save CMS settings.' });
  }
});

// ======================= 10. REVIEWS MODERATION & SUPPORT TICKETS =======================

router.get('/reviews', requireAdmin('reviews:manage'), async (_req, res) => {
  const rows = await db
    .select({
      id: reviews.id,
      productId: reviews.productId,
      productName: products.name,
      userName: users.fullName,
      userEmail: users.email,
      rating: reviews.rating,
      title: reviews.title,
      comment: reviews.comment,
      isVerifiedPurchase: reviews.isVerifiedPurchase,
      status: reviews.status,
      createdAt: reviews.createdAt,
    })
    .from(reviews)
    .innerJoin(products, eq(reviews.productId, products.id))
    .innerJoin(users, eq(reviews.userId, users.id))
    .orderBy(desc(reviews.createdAt));
  res.json({ reviews: rows });
});

router.patch('/reviews/:id', requireAdmin('reviews:manage'), async (req: AuthRequest, res) => {
  const id = Number(req.params.id);
  const status = ['approved', 'rejected', 'pending'].includes(req.body?.status)
    ? req.body.status
    : 'approved';
  const [updated] = await db.update(reviews).set({ status }).where(eq(reviews.id, id)).returning();
  if (!updated) return res.status(404).json({ error: 'Review not found.' });
  await logAdminAction(req, 'moderate_review', 'review', String(id), { status });
  res.json({ review: updated });
});

router.get('/tickets', requireAdmin('support:manage'), async (_req, res) => {
  const rows = await db.select().from(supportTickets).orderBy(desc(supportTickets.createdAt));
  res.json({ tickets: rows });
});

router.post('/tickets/:id/reply', requireAdmin('support:manage'), async (req: AuthRequest, res) => {
  try {
    const id = Number(req.params.id);
    const message = String(req.body?.message || '').trim();
    const status = String(req.body?.status || 'in_progress');
    if (!message) return res.status(400).json({ error: 'Reply message is required.' });

    const [ticket] = await db.select().from(supportTickets).where(eq(supportTickets.id, id)).limit(1);
    if (!ticket) return res.status(404).json({ error: 'Support ticket not found.' });

    const nextReplies = [
      ...(ticket.replies || []),
      {
        senderRole: 'admin' as const,
        senderName: req.dbUser?.fullName || 'SHAIKCART Support',
        message,
        timestamp: new Date().toISOString(),
      },
    ];

    const [updated] = await db
      .update(supportTickets)
      .set({
        replies: nextReplies,
        status,
        assignedToUserId: req.dbUser?.id || null,
        updatedAt: new Date(),
      })
      .where(eq(supportTickets.id, id))
      .returning();

    if (ticket.userId) {
      await db.insert(notifications).values({
        userId: ticket.userId,
        audience: 'customer',
        type: 'support',
        title: `Update on Ticket ${ticket.ticketNumber}`,
        message: message.slice(0, 140),
        linkUrl: '/account',
      });
    }

    await logAdminAction(req, 'reply_support_ticket', 'support_ticket', ticket.ticketNumber, { status });
    res.json({ ticket: updated });
  } catch (error) {
    console.error('Ticket reply error:', error);
    res.status(500).json({ error: 'Unable to reply to ticket.' });
  }
});

// ======================= 11. AUDIT LOGS & EMAIL LOGS =======================

router.get('/activity-logs', requireAdmin('logs:view'), async (_req, res) => {
  const [logs, emails] = await Promise.all([
    db.select().from(adminActivityLogs).orderBy(desc(adminActivityLogs.createdAt)).limit(60),
    db.select().from(emailLogs).orderBy(desc(emailLogs.createdAt)).limit(40),
  ]);
  res.json({ activityLogs: logs, emailLogs: emails });
});

export default router;
