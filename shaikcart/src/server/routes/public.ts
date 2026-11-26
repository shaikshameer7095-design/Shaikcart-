import { Router } from 'express';
import { and, asc, desc, eq, gte, ilike, lte, or, sql } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '../../db/index.ts';
import {
  brands,
  categories,
  cmsSettings,
  coupons,
  newsletterSubscribers,
  notifications,
  productImages,
  products,
  productVariants,
  reviews,
  shippingZones,
  supportTickets,
  users,
  websiteBanners,
} from '../../db/schema.ts';
import { ensureDatabaseSeeded } from '../../db/seed.ts';
import { optionalAuth, AuthRequest } from '../../middleware/auth.ts';
import { generateTicketNumber } from '../security.ts';

const router = Router();

// Ensure initial catalog exists lazily on first storefront hit
router.use(async (_req, res, next) => {
  try {
    await ensureDatabaseSeeded();
    next();
  } catch (error) {
    console.error('Lazy seed error:', error);
    res.status(503).json({ error: 'Catalog service is temporarily unavailable. Please retry.' });
  }
});

// Helper to enrich product list with category & brand info
async function enrichProducts(productList: (typeof products.$inferSelect)[]) {
  if (productList.length === 0) return [];
  const allCats = await db.select().from(categories);
  const allBrands = await db.select().from(brands);
  const catMap = new Map(allCats.map((c) => [c.id, c]));
  const brandMap = new Map(allBrands.map((b) => [b.id, b]));

  return productList.map((p) => {
    const cat = p.categoryId ? catMap.get(p.categoryId) : null;
    const brand = p.brandId ? brandMap.get(p.brandId) : null;
    const discountPercent =
      p.regularPrice > p.salePrice
        ? Math.round(((p.regularPrice - p.salePrice) / p.regularPrice) * 100)
        : 0;
    return {
      ...p,
      ratingAvg: Number(p.ratingAvg),
      discountPercent,
      categoryName: cat?.name || 'Uncategorized',
      categorySlug: cat?.slug || '',
      brandName: brand?.name || 'SHAIKCART',
      brandSlug: brand?.slug || '',
    };
  });
}

// 1. Homepage aggregated payload
router.get('/storefront/home', async (_req, res) => {
  try {
    const [
      activeCategories,
      activeBanners,
      allActiveProducts,
      settingsRows,
      recentApprovedReviews,
    ] = await Promise.all([
      db.select().from(categories).where(eq(categories.isActive, true)).orderBy(asc(categories.sortOrder)),
      db.select().from(websiteBanners).where(eq(websiteBanners.isActive, true)).orderBy(asc(websiteBanners.sortOrder)),
      db.select().from(products).where(eq(products.isActive, true)).orderBy(desc(products.createdAt)),
      db.select().from(cmsSettings),
      db
        .select({
          id: reviews.id,
          rating: reviews.rating,
          title: reviews.title,
          comment: reviews.comment,
          createdAt: reviews.createdAt,
          userName: users.fullName,
          productName: products.name,
        })
        .from(reviews)
        .innerJoin(users, eq(reviews.userId, users.id))
        .innerJoin(products, eq(reviews.productId, products.id))
        .where(eq(reviews.status, 'approved'))
        .orderBy(desc(reviews.createdAt))
        .limit(6),
    ]);

    const enriched = await enrichProducts(allActiveProducts);
    const settingsMap: Record<string, unknown> = {};
    for (const s of settingsRows) {
      settingsMap[s.key] = s.value;
    }

    res.json({
      categories: activeCategories,
      banners: activeBanners,
      featured: enriched.filter((p) => p.isFeatured).slice(0, 12),
      newArrivals: enriched.filter((p) => p.isNewArrival).slice(0, 12),
      bestSellers: enriched.filter((p) => p.isBestseller).slice(0, 12),
      trending: enriched.filter((p) => p.isTrending).slice(0, 12),
      deals: enriched
        .filter((p) => p.discountPercent >= 20)
        .sort((a, b) => b.discountPercent - a.discountPercent)
        .slice(0, 8),
      recommended: enriched.slice(0, 8),
      cms: settingsMap,
      reviews: recentApprovedReviews,
    });
  } catch (error) {
    console.error('Failed to load storefront home:', error);
    res.status(500).json({ error: 'Unable to load storefront data.' });
  }
});

// 2. Categories & Brands
router.get('/categories', async (_req, res) => {
  try {
    const rows = await db
      .select()
      .from(categories)
      .where(eq(categories.isActive, true))
      .orderBy(asc(categories.sortOrder));
    res.json({ categories: rows });
  } catch (error) {
    console.error('Failed to fetch categories:', error);
    res.status(500).json({ error: 'Unable to load categories.' });
  }
});

router.get('/categories/:slug', async (req, res) => {
  try {
    const [cat] = await db
      .select()
      .from(categories)
      .where(and(eq(categories.slug, req.params.slug), eq(categories.isActive, true)))
      .limit(1);
    if (!cat) {
      return res.status(404).json({ error: 'Category not found.' });
    }
    res.json({ category: cat });
  } catch (error) {
    console.error('Failed to fetch category:', error);
    res.status(500).json({ error: 'Unable to load category.' });
  }
});

router.get('/brands', async (_req, res) => {
  try {
    const rows = await db
      .select()
      .from(brands)
      .where(eq(brands.isActive, true))
      .orderBy(asc(brands.name));
    res.json({ brands: rows });
  } catch (error) {
    console.error('Failed to fetch brands:', error);
    res.status(500).json({ error: 'Unable to load brands.' });
  }
});

// 3. Full Product Listing with Filtering, Sorting & Pagination
router.get('/products', async (req, res) => {
  try {
    const {
      category,
      subcategory,
      brand,
      search,
      minPrice,
      maxPrice,
      color,
      size,
      minRating,
      inStock,
      minDiscount,
      featured,
      bestseller,
      newArrival,
      deals,
      sort = 'featured',
      page = '1',
      limit = '12',
    } = req.query as Record<string, string | undefined>;

    const conditions = [eq(products.isActive, true)];

    if (category) {
      const [catRow] = await db.select().from(categories).where(eq(categories.slug, category)).limit(1);
      if (catRow) {
        conditions.push(eq(products.categoryId, catRow.id));
      } else {
        return res.json({ products: [], total: 0, page: 1, totalPages: 0, facets: { colors: [], sizes: [] } });
      }
    }

    if (subcategory) {
      conditions.push(ilike(products.subcategory, subcategory));
    }

    if (brand) {
      const brandSlugs = brand.split(',').filter(Boolean);
      const brandRows = await db.select().from(brands);
      const matchedBrandIds = brandRows.filter((b) => brandSlugs.includes(b.slug)).map((b) => b.id);
      if (matchedBrandIds.length > 0) {
        conditions.push(or(...matchedBrandIds.map((id) => eq(products.brandId, id)))!);
      } else {
        return res.json({ products: [], total: 0, page: 1, totalPages: 0, facets: { colors: [], sizes: [] } });
      }
    }

    if (minPrice && !Number.isNaN(Number(minPrice))) {
      conditions.push(gte(products.salePrice, Number(minPrice)));
    }
    if (maxPrice && !Number.isNaN(Number(maxPrice))) {
      conditions.push(lte(products.salePrice, Number(maxPrice)));
    }
    if (inStock === 'true') {
      conditions.push(gte(products.stockQuantity, 1));
    }
    if (featured === 'true') {
      conditions.push(eq(products.isFeatured, true));
    }
    if (bestseller === 'true') {
      conditions.push(eq(products.isBestseller, true));
    }
    if (newArrival === 'true') {
      conditions.push(eq(products.isNewArrival, true));
    }

    const baseRows = await db.select().from(products).where(and(...conditions));
    let enriched = await enrichProducts(baseRows);

    // Search across product name, short description, brand, category, tags, SKU
    if (search && search.trim()) {
      const q = search.trim().toLowerCase();
      enriched = enriched.filter((p) => {
        const hay = [
          p.name,
          p.shortDescription || '',
          p.description,
          p.categoryName,
          p.subcategory || '',
          p.brandName,
          p.sku,
          ...(p.tags || []),
        ]
          .join(' ')
          .toLowerCase();
        return hay.includes(q);
      });
    }

    // Collect available facets before color/size/rating narrowing
    const colorSet = new Set<string>();
    const sizeSet = new Set<string>();
    for (const p of enriched) {
      (p.colors || []).forEach((c) => colorSet.add(c));
      (p.sizes || []).forEach((s) => sizeSet.add(s));
    }

    if (color) {
      const targetColor = color.toLowerCase();
      enriched = enriched.filter((p) =>
        (p.colors || []).some((c) => c.toLowerCase().includes(targetColor))
      );
    }

    if (size) {
      const targetSize = size.toLowerCase();
      enriched = enriched.filter((p) =>
        (p.sizes || []).some((s) => s.toLowerCase() === targetSize)
      );
    }

    if (minRating && !Number.isNaN(Number(minRating))) {
      enriched = enriched.filter((p) => p.ratingAvg >= Number(minRating));
    }

    if (minDiscount && !Number.isNaN(Number(minDiscount))) {
      enriched = enriched.filter((p) => p.discountPercent >= Number(minDiscount));
    }

    if (deals === 'true') {
      enriched = enriched.filter((p) => p.discountPercent >= 20);
    }

    // Sorting
    switch (sort) {
      case 'newest':
        enriched.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        break;
      case 'price_asc':
        enriched.sort((a, b) => a.salePrice - b.salePrice);
        break;
      case 'price_desc':
        enriched.sort((a, b) => b.salePrice - a.salePrice);
        break;
      case 'top_rated':
        enriched.sort((a, b) => b.ratingAvg - a.ratingAvg || b.reviewCount - a.reviewCount);
        break;
      case 'best_selling':
        enriched.sort((a, b) => Number(b.isBestseller) - Number(a.isBestseller) || b.reviewCount - a.reviewCount);
        break;
      default:
        enriched.sort((a, b) => Number(b.isFeatured) - Number(a.isFeatured) || b.ratingAvg - a.ratingAvg);
        break;
    }

    const pageNum = Math.max(1, Number(page) || 1);
    const limitNum = Math.min(48, Math.max(1, Number(limit) || 12));
    const total = enriched.length;
    const totalPages = Math.ceil(total / limitNum);
    const paged = enriched.slice((pageNum - 1) * limitNum, pageNum * limitNum);

    res.json({
      products: paged,
      total,
      page: pageNum,
      limit: limitNum,
      totalPages,
      facets: {
        colors: Array.from(colorSet).sort(),
        sizes: Array.from(sizeSet),
      },
    });
  } catch (error) {
    console.error('Failed to query products:', error);
    res.status(500).json({ error: 'Unable to load products.' });
  }
});

// 4. Single Product Detail (by slug)
router.get('/products/:slug', async (req, res) => {
  try {
    const [prod] = await db
      .select()
      .from(products)
      .where(and(eq(products.slug, req.params.slug), eq(products.isActive, true)))
      .limit(1);

    if (!prod) {
      return res.status(404).json({ error: 'Product not found.' });
    }

    const [enriched] = await enrichProducts([prod]);
    const [gallery, variants, productReviews, allOther] = await Promise.all([
      db
        .select()
        .from(productImages)
        .where(eq(productImages.productId, prod.id))
        .orderBy(asc(productImages.sortOrder)),
      db
        .select()
        .from(productVariants)
        .where(and(eq(productVariants.productId, prod.id), eq(productVariants.isActive, true))),
      db
        .select({
          id: reviews.id,
          rating: reviews.rating,
          title: reviews.title,
          comment: reviews.comment,
          isVerifiedPurchase: reviews.isVerifiedPurchase,
          createdAt: reviews.createdAt,
          userName: users.fullName,
        })
        .from(reviews)
        .innerJoin(users, eq(reviews.userId, users.id))
        .where(and(eq(reviews.productId, prod.id), eq(reviews.status, 'approved')))
        .orderBy(desc(reviews.createdAt)),
      db
        .select()
        .from(products)
        .where(and(eq(products.isActive, true), sql`${products.id} != ${prod.id}`))
        .limit(16),
    ]);

    const otherEnriched = await enrichProducts(allOther);
    const related = otherEnriched
      .filter((p) => p.categoryId === prod.categoryId)
      .slice(0, 4);
    const frequentlyBoughtTogether = otherEnriched
      .filter((p) => p.categoryId !== prod.categoryId)
      .slice(0, 3);

    res.json({
      product: {
        ...enriched,
        images: gallery.length > 0 ? gallery : [{ id: 0, url: prod.primaryImage, altText: prod.name, sortOrder: 0 }],
        variants,
      },
      reviews: productReviews,
      related: related.length > 0 ? related : otherEnriched.slice(0, 4),
      frequentlyBoughtTogether,
    });
  } catch (error) {
    console.error('Failed to fetch product detail:', error);
    res.status(500).json({ error: 'Unable to load product details.' });
  }
});

// 5. Global Search Suggestions
router.get('/search/suggestions', async (req, res) => {
  try {
    const q = String(req.query.q || '').trim().toLowerCase();
    const [allProds, allCats] = await Promise.all([
      db.select().from(products).where(eq(products.isActive, true)),
      db.select().from(categories).where(eq(categories.isActive, true)).orderBy(asc(categories.sortOrder)),
    ]);

    const popularSearches = ['Silk Linen Dress', 'Vitamin C Serum', 'ANC Headphones', 'Leather Tote', 'Stoneware Lamp', 'Gift Hamper'];

    if (!q) {
      return res.json({
        products: [],
        categories: allCats.slice(0, 6),
        popularSearches,
      });
    }

    const matchedCategories = allCats
      .filter((c) => c.name.toLowerCase().includes(q) || (c.description || '').toLowerCase().includes(q))
      .slice(0, 4);

    const matchedProducts = allProds
      .filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          (p.shortDescription || '').toLowerCase().includes(q) ||
          (p.tags || []).some((t) => t.toLowerCase().includes(q))
      )
      .slice(0, 6)
      .map((p) => ({
        id: p.id,
        name: p.name,
        slug: p.slug,
        salePrice: p.salePrice,
        regularPrice: p.regularPrice,
        primaryImage: p.primaryImage,
      }));

    res.json({
      products: matchedProducts,
      categories: matchedCategories,
      popularSearches,
    });
  } catch (error) {
    console.error('Search suggestions error:', error);
    res.status(500).json({ error: 'Unable to fetch search suggestions.' });
  }
});

// 6. Delivery Availability Checker by Indian 6-digit PIN Code
router.get('/shipping/check-pincode', async (req, res) => {
  try {
    const pincode = String(req.query.pincode || '').trim();
    if (!/^[1-9][0-9]{5}$/.test(pincode)) {
      return res.status(400).json({ error: 'Please enter a valid 6-digit Indian PIN code.' });
    }

    const zones = await db.select().from(shippingZones).where(eq(shippingZones.isActive, true));
    const matched =
      zones.find((z) => z.pincodePrefix !== '*' && pincode.startsWith(z.pincodePrefix)) ||
      zones.find((z) => z.pincodePrefix === '*');

    if (!matched) {
      return res.json({
        serviceable: false,
        pincode,
        message: 'Delivery is currently unavailable for this PIN code.',
      });
    }

    res.json({
      serviceable: true,
      pincode,
      regionName: matched.regionName,
      shippingCharge: matched.baseCharge,
      freeShippingThreshold: matched.freeShippingThreshold,
      estimatedDays: matched.estimatedDays,
      codEnabled: matched.codEnabled,
    });
  } catch (error) {
    console.error('PIN code check failed:', error);
    res.status(500).json({ error: 'Unable to check PIN code serviceability.' });
  }
});

// 7. Coupon Validation
const validateCouponSchema = z.object({
  code: z.string().min(2).max(40),
  subtotal: z.number().nonnegative(),
  categorySlugs: z.array(z.string()).optional(),
});

router.post('/coupons/validate', async (req, res) => {
  try {
    const parsed = validateCouponSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Please provide a valid coupon code and subtotal.' });
    }
    const code = parsed.data.code.trim().toUpperCase();
    const [coupon] = await db.select().from(coupons).where(eq(coupons.code, code)).limit(1);

    if (!coupon || coupon.status !== 'active') {
      return res.status(404).json({ error: 'Invalid or inactive coupon code.' });
    }
    const now = new Date();
    if (coupon.startsAt && new Date(coupon.startsAt) > now) {
      return res.status(400).json({ error: 'This coupon promotion has not started yet.' });
    }
    if (coupon.expiresAt && new Date(coupon.expiresAt) < now) {
      return res.status(400).json({ error: 'This coupon code has expired.' });
    }
    if (coupon.usageLimit && coupon.usedCount >= coupon.usageLimit) {
      return res.status(400).json({ error: 'This coupon has reached its redemption limit.' });
    }
    if (parsed.data.subtotal < coupon.minOrderValue) {
      return res.status(400).json({
        error: `Minimum order value of ₹${coupon.minOrderValue.toLocaleString('en-IN')} is required for ${coupon.code}.`,
      });
    }
    if (
      coupon.categorySlug &&
      parsed.data.categorySlugs &&
      !parsed.data.categorySlugs.includes(coupon.categorySlug)
    ) {
      return res.status(400).json({
        error: `Coupon ${coupon.code} applies only to ${coupon.categorySlug.replace('-', ' & ')} products.`,
      });
    }

    let discountAmount =
      coupon.discountType === 'percentage'
        ? Math.round((parsed.data.subtotal * coupon.discountValue) / 100)
        : coupon.discountValue;

    if (coupon.maxDiscountLimit && discountAmount > coupon.maxDiscountLimit) {
      discountAmount = coupon.maxDiscountLimit;
    }
    discountAmount = Math.min(discountAmount, parsed.data.subtotal);

    res.json({
      valid: true,
      code: coupon.code,
      description: coupon.description,
      discountAmount,
    });
  } catch (error) {
    console.error('Coupon validation error:', error);
    res.status(500).json({ error: 'Unable to validate coupon right now.' });
  }
});

// 8. Newsletter Subscription
router.post('/newsletter', async (req, res) => {
  try {
    const schema = z.object({ email: z.string().email() });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Please enter a valid email address.' });
    }
    const email = parsed.data.email.trim().toLowerCase();
    await db.insert(newsletterSubscribers).values({ email }).onConflictDoNothing();
    res.json({ subscribed: true, message: 'Thank you for subscribing to SHAIKCART updates.' });
  } catch (error) {
    console.error('Newsletter subscribe error:', error);
    res.status(500).json({ error: 'Unable to subscribe right now.' });
  }
});

// 9. Public Contact / Support Ticket Submission
const ticketSchema = z.object({
  name: z.string().min(2).max(120),
  email: z.string().email(),
  phone: z.string().max(24).optional(),
  category: z.enum(['order', 'payment', 'returns', 'product', 'general']).default('general'),
  subject: z.string().min(3).max(200),
  message: z.string().min(10).max(3000),
});

router.post('/support/tickets', optionalAuth, async (req: AuthRequest, res) => {
  try {
    const parsed = ticketSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Please complete all required fields cleanly.' });
    }

    const ticketNumber = generateTicketNumber();
    const [created] = await db
      .insert(supportTickets)
      .values({
        ticketNumber,
        userId: req.dbUser?.id || null,
        name: parsed.data.name.trim(),
        email: parsed.data.email.trim().toLowerCase(),
        phone: parsed.data.phone?.trim() || '',
        category: parsed.data.category,
        priority: parsed.data.category === 'payment' ? 'high' : 'medium',
        subject: parsed.data.subject.trim(),
        message: parsed.data.message.trim(),
        status: 'open',
      })
      .returning();

    await db.insert(notifications).values({
      audience: 'admin',
      type: 'support',
      title: `New Support Enquiry ${ticketNumber}`,
      message: `${created.name} submitted "${created.subject}" (${created.category}).`,
      linkUrl: '/admin/support',
    });

    res.status(201).json({
      ticketNumber: created.ticketNumber,
      message: `Support ticket ${created.ticketNumber} created. Our team will respond shortly.`,
    });
  } catch (error) {
    console.error('Support ticket submission error:', error);
    res.status(500).json({ error: 'Unable to submit your enquiry right now.' });
  }
});

// 10. CMS Public Settings
router.get('/cms/:key', async (req, res) => {
  try {
    const [row] = await db.select().from(cmsSettings).where(eq(cmsSettings.key, req.params.key)).limit(1);
    if (!row) {
      return res.status(404).json({ error: 'Content block not found.' });
    }
    res.json({ key: row.key, value: row.value });
  } catch (error) {
    console.error('CMS fetch error:', error);
    res.status(500).json({ error: 'Unable to load content.' });
  }
});

// 11. Public Payment Config (never exposes secrets!)
router.get('/payments/config', async (_req, res) => {
  try {
    const keyId = process.env.RAZORPAY_KEY_ID?.trim() || '';
    const keySecret = process.env.RAZORPAY_KEY_SECRET?.trim() || '';
    const razorpayConfigured = Boolean(keyId && keySecret);
    const razorpayMode = keyId.startsWith('rzp_live_') ? 'live' : 'test';

    const [settingsRow] = await db
      .select()
      .from(cmsSettings)
      .where(eq(cmsSettings.key, 'payment_settings'))
      .limit(1);

    const settings = (settingsRow?.value || {}) as Record<string, unknown>;

    res.json({
      razorpayConfigured,
      razorpayMode,
      razorpayKeyId: razorpayConfigured ? keyId : null,
      razorpayEnabled: settings.razorpayEnabled !== false,
      codEnabled: settings.codEnabled !== false,
      codMaxOrderAmount: Number(settings.codMaxOrderAmount || 25000),
      gstRatePercent: Number(settings.gstRatePercent ?? 12),
      freeShippingThreshold: Number(settings.freeShippingThreshold ?? 1499),
    });
  } catch (error) {
    console.error('Payment config error:', error);
    res.status(500).json({ error: 'Unable to load payment configuration.' });
  }
});

export default router;
