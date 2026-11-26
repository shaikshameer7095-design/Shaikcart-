import { Router } from 'express';
import { and, desc, eq, inArray, sql } from 'drizzle-orm';
import Razorpay from 'razorpay';
import { z } from 'zod';
import { db } from '../../db/index.ts';
import {
  addresses,
  cartItems,
  carts,
  categories,
  cmsSettings,
  coupons,
  couponUsages,
  inventoryLogs,
  notifications,
  orderItems,
  orders,
  payments,
  products,
  reviews,
  shipments,
  shippingZones,
  users,
  wishlistItems,
  wishlists,
} from '../../db/schema.ts';
import { ensureDatabaseSeeded } from '../../db/seed.ts';
import { optionalAuth, requireAuth, AuthRequest } from '../../middleware/auth.ts';
import {
  generateOrderNumber,
  isAdminRole,
  sanitizeUrl,
  verifyRazorpaySignature,
  verifyRazorpayWebhookSignature,
} from '../security.ts';
import { sendTransactionalEmail } from '../email.ts';

const router = Router();

router.use(async (_req, res, next) => {
  try {
    await ensureDatabaseSeeded();
    next();
  } catch (error) {
    console.error('Lazy seed error:', error);
    res.status(503).json({ error: 'Service temporarily unavailable.' });
  }
});

function getGuestToken(req: AuthRequest): string | null {
  const token = req.headers['x-guest-token'];
  if (typeof token === 'string' && token.trim().length >= 8 && token.trim().length <= 120) {
    return token.trim();
  }
  return null;
}

async function getOrCreateCart(req: AuthRequest) {
  if (req.dbUser) {
    const existing = await db.select().from(carts).where(eq(carts.userId, req.dbUser.id)).limit(1);
    if (existing[0]) return existing[0];
    const [created] = await db.insert(carts).values({ userId: req.dbUser.id }).returning();
    return created;
  }
  const guestToken = getGuestToken(req);
  if (!guestToken) return null;
  const existing = await db.select().from(carts).where(eq(carts.guestToken, guestToken)).limit(1);
  if (existing[0]) return existing[0];
  const [created] = await db.insert(carts).values({ guestToken }).returning();
  return created;
}

async function loadCartPayload(cartId: number) {
  const items = await db
    .select({
      id: cartItems.id,
      productId: cartItems.productId,
      selectedColor: cartItems.selectedColor,
      selectedSize: cartItems.selectedSize,
      quantity: cartItems.quantity,
      name: products.name,
      slug: products.slug,
      sku: products.sku,
      primaryImage: products.primaryImage,
      regularPrice: products.regularPrice,
      salePrice: products.salePrice,
      stockQuantity: products.stockQuantity,
      categoryId: products.categoryId,
    })
    .from(cartItems)
    .innerJoin(products, eq(cartItems.productId, products.id))
    .where(eq(cartItems.cartId, cartId))
    .orderBy(desc(cartItems.createdAt));

  const allCats = await db.select().from(categories);
  const catMap = new Map(allCats.map((c) => [c.id, c.slug]));

  const subtotal = items.reduce((sum, item) => sum + item.salePrice * item.quantity, 0);
  const totalMrp = items.reduce((sum, item) => sum + item.regularPrice * item.quantity, 0);
  const itemCount = items.reduce((sum, item) => sum + item.quantity, 0);

  return {
    items: items.map((i) => ({
      ...i,
      categorySlug: i.categoryId ? catMap.get(i.categoryId) || '' : '',
      lineTotal: i.salePrice * i.quantity,
    })),
    subtotal,
    totalMrp,
    savings: Math.max(0, totalMrp - subtotal),
    itemCount,
  };
}

// ======================= CART ENDPOINTS =======================

router.get('/cart', optionalAuth, async (req: AuthRequest, res) => {
  try {
    const cart = await getOrCreateCart(req);
    if (!cart) {
      return res.json({ items: [], subtotal: 0, totalMrp: 0, savings: 0, itemCount: 0 });
    }
    const payload = await loadCartPayload(cart.id);
    res.json(payload);
  } catch (error) {
    console.error('Get cart error:', error);
    res.status(500).json({ error: 'Unable to load shopping cart.' });
  }
});

const addCartItemSchema = z.object({
  productId: z.number().int().positive(),
  quantity: z.number().int().min(1).max(20).default(1),
  selectedColor: z.string().max(60).optional().default(''),
  selectedSize: z.string().max(40).optional().default(''),
});

router.post('/cart/items', optionalAuth, async (req: AuthRequest, res) => {
  try {
    const parsed = addCartItemSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Invalid cart item payload.' });
    }

    const cart = await getOrCreateCart(req);
    if (!cart) {
      return res.status(400).json({ error: 'Missing session or guest cart token.' });
    }

    const [prod] = await db
      .select()
      .from(products)
      .where(and(eq(products.id, parsed.data.productId), eq(products.isActive, true)))
      .limit(1);

    if (!prod) {
      return res.status(404).json({ error: 'Product is no longer available.' });
    }
    if (prod.stockQuantity < 1) {
      return res.status(400).json({ error: 'This product is currently out of stock.' });
    }

    const color = parsed.data.selectedColor || prod.colors[0] || '';
    const size = parsed.data.selectedSize || prod.sizes[0] || '';

    const existing = await db
      .select()
      .from(cartItems)
      .where(
        and(
          eq(cartItems.cartId, cart.id),
          eq(cartItems.productId, prod.id),
          eq(cartItems.selectedColor, color),
          eq(cartItems.selectedSize, size)
        )
      )
      .limit(1);

    if (existing[0]) {
      const nextQty = Math.min(prod.stockQuantity, existing[0].quantity + parsed.data.quantity);
      await db.update(cartItems).set({ quantity: nextQty }).where(eq(cartItems.id, existing[0].id));
    } else {
      await db.insert(cartItems).values({
        cartId: cart.id,
        productId: prod.id,
        selectedColor: color,
        selectedSize: size,
        quantity: Math.min(prod.stockQuantity, parsed.data.quantity),
      });
    }

    await db.update(carts).set({ updatedAt: new Date() }).where(eq(carts.id, cart.id));
    const payload = await loadCartPayload(cart.id);
    res.json(payload);
  } catch (error) {
    console.error('Add cart item error:', error);
    res.status(500).json({ error: 'Unable to update cart.' });
  }
});

router.patch('/cart/items/:id', optionalAuth, async (req: AuthRequest, res) => {
  try {
    const itemId = Number(req.params.id);
    const quantity = Number(req.body?.quantity);
    if (!Number.isInteger(itemId) || !Number.isInteger(quantity)) {
      return res.status(400).json({ error: 'Invalid cart item update.' });
    }

    const cart = await getOrCreateCart(req);
    if (!cart) return res.status(400).json({ error: 'Cart session missing.' });

    const [item] = await db
      .select()
      .from(cartItems)
      .where(and(eq(cartItems.id, itemId), eq(cartItems.cartId, cart.id)))
      .limit(1);

    if (!item) return res.status(404).json({ error: 'Cart item not found.' });

    if (quantity <= 0) {
      await db.delete(cartItems).where(eq(cartItems.id, item.id));
    } else {
      const [prod] = await db.select().from(products).where(eq(products.id, item.productId)).limit(1);
      const maxAllowed = prod ? Math.max(1, prod.stockQuantity) : 10;
      await db
        .update(cartItems)
        .set({ quantity: Math.min(quantity, maxAllowed) })
        .where(eq(cartItems.id, item.id));
    }

    const payload = await loadCartPayload(cart.id);
    res.json(payload);
  } catch (error) {
    console.error('Update cart item error:', error);
    res.status(500).json({ error: 'Unable to update cart item quantity.' });
  }
});

router.delete('/cart/items/:id', optionalAuth, async (req: AuthRequest, res) => {
  try {
    const itemId = Number(req.params.id);
    const cart = await getOrCreateCart(req);
    if (!cart || !Number.isInteger(itemId)) {
      return res.status(400).json({ error: 'Invalid request.' });
    }
    await db
      .delete(cartItems)
      .where(and(eq(cartItems.id, itemId), eq(cartItems.cartId, cart.id)));
    const payload = await loadCartPayload(cart.id);
    res.json(payload);
  } catch (error) {
    console.error('Delete cart item error:', error);
    res.status(500).json({ error: 'Unable to remove cart item.' });
  }
});

router.post('/cart/merge', requireAuth, async (req: AuthRequest, res) => {
  try {
    const guestToken = String(req.body?.guestToken || '').trim();
    if (!guestToken || !req.dbUser) {
      return res.json({ merged: false });
    }
    const [guestCart] = await db.select().from(carts).where(eq(carts.guestToken, guestToken)).limit(1);
    if (!guestCart) return res.json({ merged: false });

    const userCart = await getOrCreateCart(req);
    if (!userCart) return res.json({ merged: false });

    const gItems = await db.select().from(cartItems).where(eq(cartItems.cartId, guestCart.id));
    for (const gi of gItems) {
      const existing = await db
        .select()
        .from(cartItems)
        .where(
          and(
            eq(cartItems.cartId, userCart.id),
            eq(cartItems.productId, gi.productId),
            eq(cartItems.selectedColor, gi.selectedColor || ''),
            eq(cartItems.selectedSize, gi.selectedSize || '')
          )
        )
        .limit(1);

      if (existing[0]) {
        await db
          .update(cartItems)
          .set({ quantity: existing[0].quantity + gi.quantity })
          .where(eq(cartItems.id, existing[0].id));
      } else {
        await db.insert(cartItems).values({
          cartId: userCart.id,
          productId: gi.productId,
          selectedColor: gi.selectedColor,
          selectedSize: gi.selectedSize,
          quantity: gi.quantity,
        });
      }
    }
    await db.delete(carts).where(eq(carts.id, guestCart.id));
    const payload = await loadCartPayload(userCart.id);
    res.json({ merged: true, ...payload });
  } catch (error) {
    console.error('Cart merge error:', error);
    res.status(500).json({ error: 'Unable to merge guest cart.' });
  }
});

// ======================= WISHLIST ENDPOINTS =======================

async function getOrCreateWishlist(userId: number) {
  const existing = await db.select().from(wishlists).where(eq(wishlists.userId, userId)).limit(1);
  if (existing[0]) return existing[0];
  const [created] = await db.insert(wishlists).values({ userId }).returning();
  return created;
}

router.get('/wishlist', requireAuth, async (req: AuthRequest, res) => {
  try {
    const wl = await getOrCreateWishlist(req.dbUser!.id);
    const rows = await db
      .select({
        id: wishlistItems.id,
        productId: products.id,
        name: products.name,
        slug: products.slug,
        primaryImage: products.primaryImage,
        regularPrice: products.regularPrice,
        salePrice: products.salePrice,
        stockQuantity: products.stockQuantity,
        ratingAvg: products.ratingAvg,
        reviewCount: products.reviewCount,
        colors: products.colors,
        sizes: products.sizes,
      })
      .from(wishlistItems)
      .innerJoin(products, eq(wishlistItems.productId, products.id))
      .where(eq(wishlistItems.wishlistId, wl.id))
      .orderBy(desc(wishlistItems.createdAt));

    res.json({
      items: rows.map((r) => ({ ...r, ratingAvg: Number(r.ratingAvg) })),
      productIds: rows.map((r) => r.productId),
    });
  } catch (error) {
    console.error('Wishlist load error:', error);
    res.status(500).json({ error: 'Unable to load wishlist.' });
  }
});

router.post('/wishlist/:productId', requireAuth, async (req: AuthRequest, res) => {
  try {
    const productId = Number(req.params.productId);
    if (!Number.isInteger(productId)) return res.status(400).json({ error: 'Invalid product.' });
    const wl = await getOrCreateWishlist(req.dbUser!.id);
    await db
      .insert(wishlistItems)
      .values({ wishlistId: wl.id, productId })
      .onConflictDoNothing();
    res.json({ saved: true });
  } catch (error) {
    console.error('Wishlist add error:', error);
    res.status(500).json({ error: 'Unable to add to wishlist.' });
  }
});

router.delete('/wishlist/:productId', requireAuth, async (req: AuthRequest, res) => {
  try {
    const productId = Number(req.params.productId);
    const wl = await getOrCreateWishlist(req.dbUser!.id);
    await db
      .delete(wishlistItems)
      .where(and(eq(wishlistItems.wishlistId, wl.id), eq(wishlistItems.productId, productId)));
    res.json({ removed: true });
  } catch (error) {
    console.error('Wishlist delete error:', error);
    res.status(500).json({ error: 'Unable to remove from wishlist.' });
  }
});

// ======================= CUSTOMER ACCOUNT DASHBOARD =======================

router.get('/account/overview', requireAuth, async (req: AuthRequest, res) => {
  try {
    const userId = req.dbUser!.id;
    const [userOrders, wl, userAddresses, userNotifications, userReviews] = await Promise.all([
      db.select().from(orders).where(eq(orders.userId, userId)).orderBy(desc(orders.createdAt)),
      getOrCreateWishlist(userId),
      db.select().from(addresses).where(eq(addresses.userId, userId)).orderBy(desc(addresses.isDefault)),
      db.select().from(notifications).where(eq(notifications.userId, userId)).orderBy(desc(notifications.createdAt)).limit(20),
      db
        .select({
          id: reviews.id,
          productId: reviews.productId,
          productName: products.name,
          productSlug: products.slug,
          productImage: products.primaryImage,
          rating: reviews.rating,
          title: reviews.title,
          comment: reviews.comment,
          status: reviews.status,
          createdAt: reviews.createdAt,
        })
        .from(reviews)
        .innerJoin(products, eq(reviews.productId, products.id))
        .where(eq(reviews.userId, userId))
        .orderBy(desc(reviews.createdAt)),
    ]);

    const wlItems = await db.select().from(wishlistItems).where(eq(wishlistItems.wishlistId, wl.id));

    const orderIds = userOrders.map((o) => o.id);
    const paymentRows =
      orderIds.length > 0
        ? await db.select().from(payments).where(inArray(payments.orderId, orderIds)).orderBy(desc(payments.createdAt))
        : [];

    res.json({
      stats: {
        totalOrders: userOrders.length,
        pendingOrders: userOrders.filter((o) => !['delivered', 'cancelled', 'returned'].includes(o.orderStatus)).length,
        deliveredOrders: userOrders.filter((o) => o.orderStatus === 'delivered').length,
        wishlistCount: wlItems.length,
        unreadNotifications: userNotifications.filter((n) => !n.isRead).length,
      },
      recentOrders: userOrders.slice(0, 5),
      addresses: userAddresses,
      notifications: userNotifications,
      reviews: userReviews,
      payments: paymentRows.slice(0, 20),
    });
  } catch (error) {
    console.error('Account overview error:', error);
    res.status(500).json({ error: 'Unable to load account dashboard.' });
  }
});

router.patch('/account/profile', requireAuth, async (req: AuthRequest, res) => {
  try {
    const schema = z.object({
      fullName: z.string().min(2).max(120),
      phone: z.string().max(24).optional().default(''),
      avatarUrl: z.string().max(500).optional().default(''),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Please provide valid profile information.' });
    }

    const safeAvatar = sanitizeUrl(parsed.data.avatarUrl);
    const [updated] = await db
      .update(users)
      .set({
        fullName: parsed.data.fullName.trim(),
        phone: parsed.data.phone.trim(),
        avatarUrl: safeAvatar,
        updatedAt: new Date(),
      })
      .where(eq(users.id, req.dbUser!.id))
      .returning();

    res.json({
      user: {
        id: updated.id,
        uid: updated.uid,
        email: updated.email,
        fullName: updated.fullName,
        phone: updated.phone || '',
        avatarUrl: updated.avatarUrl || '',
        role: updated.role,
        isAdmin: isAdminRole(updated.role),
        emailVerified: updated.emailVerified,
        status: updated.status,
      },
    });
  } catch (error) {
    console.error('Profile update error:', error);
    res.status(500).json({ error: 'Unable to update profile.' });
  }
});

// Saved Addresses CRUD
const addressSchema = z.object({
  label: z.string().min(1).max(40).default('Home'),
  fullName: z.string().min(2).max(120),
  phone: z.string().min(8).max(24),
  addressLine1: z.string().min(4).max(200),
  addressLine2: z.string().max(200).optional().default(''),
  city: z.string().min(2).max(100),
  state: z.string().min(2).max(100),
  pincode: z.string().regex(/^[1-9][0-9]{5}$/, 'Valid 6-digit Indian PIN code required'),
  country: z.string().default('India'),
  isDefault: z.boolean().optional().default(false),
});

router.get('/account/addresses', requireAuth, async (req: AuthRequest, res) => {
  try {
    const rows = await db
      .select()
      .from(addresses)
      .where(eq(addresses.userId, req.dbUser!.id))
      .orderBy(desc(addresses.isDefault), desc(addresses.createdAt));
    res.json({ addresses: rows });
  } catch (error) {
    console.error('Addresses load error:', error);
    res.status(500).json({ error: 'Unable to load addresses.' });
  }
});

router.post('/account/addresses', requireAuth, async (req: AuthRequest, res) => {
  try {
    const parsed = addressSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.issues[0]?.message || 'Invalid address fields.' });
    }
    if (parsed.data.isDefault) {
      await db.update(addresses).set({ isDefault: false }).where(eq(addresses.userId, req.dbUser!.id));
    }
    const [created] = await db
      .insert(addresses)
      .values({ ...parsed.data, userId: req.dbUser!.id })
      .returning();
    res.status(201).json({ address: created });
  } catch (error) {
    console.error('Create address error:', error);
    res.status(500).json({ error: 'Unable to save address.' });
  }
});

router.patch('/account/addresses/:id', requireAuth, async (req: AuthRequest, res) => {
  try {
    const id = Number(req.params.id);
    const parsed = addressSchema.partial().safeParse(req.body);
    if (!Number.isInteger(id) || !parsed.success) {
      return res.status(400).json({ error: 'Invalid address update.' });
    }
    if (parsed.data.isDefault) {
      await db.update(addresses).set({ isDefault: false }).where(eq(addresses.userId, req.dbUser!.id));
    }
    const [updated] = await db
      .update(addresses)
      .set(parsed.data)
      .where(and(eq(addresses.id, id), eq(addresses.userId, req.dbUser!.id)))
      .returning();
    if (!updated) return res.status(404).json({ error: 'Address not found.' });
    res.json({ address: updated });
  } catch (error) {
    console.error('Update address error:', error);
    res.status(500).json({ error: 'Unable to update address.' });
  }
});

router.delete('/account/addresses/:id', requireAuth, async (req: AuthRequest, res) => {
  try {
    const id = Number(req.params.id);
    await db.delete(addresses).where(and(eq(addresses.id, id), eq(addresses.userId, req.dbUser!.id)));
    res.json({ deleted: true });
  } catch (error) {
    console.error('Delete address error:', error);
    res.status(500).json({ error: 'Unable to delete address.' });
  }
});

router.patch('/account/notifications/:id/read', requireAuth, async (req: AuthRequest, res) => {
  try {
    const id = Number(req.params.id);
    await db
      .update(notifications)
      .set({ isRead: true })
      .where(and(eq(notifications.id, id), eq(notifications.userId, req.dbUser!.id)));
    res.json({ updated: true });
  } catch (error) {
    console.error('Notification read error:', error);
    res.status(500).json({ error: 'Unable to update notification.' });
  }
});

// ======================= PRODUCT REVIEW SUBMISSION (VERIFIED PURCHASE CHECK) =======================

const createReviewSchema = z.object({
  rating: z.number().int().min(1).max(5),
  title: z.string().min(3).max(120),
  comment: z.string().min(10).max(1500),
});

router.post('/products/:id/reviews', requireAuth, async (req: AuthRequest, res) => {
  try {
    const productId = Number(req.params.id);
    const parsed = createReviewSchema.safeParse(req.body);
    if (!Number.isInteger(productId) || !parsed.success) {
      return res.status(400).json({ error: 'Please provide a rating (1–5), title, and review comment.' });
    }

    // Verify customer has purchased this product in a non-cancelled order
    const purchased = await db
      .select({ orderId: orders.id })
      .from(orders)
      .innerJoin(orderItems, eq(orderItems.orderId, orders.id))
      .where(
        and(
          eq(orders.userId, req.dbUser!.id),
          eq(orderItems.productId, productId),
          sql`${orders.orderStatus} NOT IN ('cancelled', 'returned')`
        )
      )
      .limit(1);

    if (!purchased[0]) {
      return res.status(403).json({
        error: 'Only customers who have purchased this product on SHAIKCART can submit a verified review.',
      });
    }

    const [created] = await db
      .insert(reviews)
      .values({
        productId,
        userId: req.dbUser!.id,
        orderId: purchased[0].orderId,
        rating: parsed.data.rating,
        title: parsed.data.title.trim(),
        comment: parsed.data.comment.trim(),
        isVerifiedPurchase: true,
        status: 'approved',
      })
      .returning();

    // Recalculate product rating summary
    const allApproved = await db
      .select({ rating: reviews.rating })
      .from(reviews)
      .where(and(eq(reviews.productId, productId), eq(reviews.status, 'approved')));

    if (allApproved.length > 0) {
      const avg = (allApproved.reduce((s, r) => s + r.rating, 0) / allApproved.length).toFixed(2);
      await db
        .update(products)
        .set({ ratingAvg: avg, reviewCount: allApproved.length })
        .where(eq(products.id, productId));
    }

    res.status(201).json({ review: created });
  } catch (error) {
    console.error('Review submission error:', error);
    res.status(500).json({ error: 'Unable to submit review.' });
  }
});

// ======================= CHECKOUT, ORDERS & RAZORPAY =======================

const createOrderSchema = z.object({
  customerName: z.string().min(2).max(120),
  customerEmail: z.string().email(),
  customerPhone: z.string().min(8).max(24),
  addressLine1: z.string().min(4).max(200),
  addressLine2: z.string().max(200).optional().default(''),
  city: z.string().min(2).max(100),
  state: z.string().min(2).max(100),
  pincode: z.string().regex(/^[1-9][0-9]{5}$/, 'Please enter a valid 6-digit Indian PIN code'),
  country: z.string().default('India'),
  paymentMethod: z.enum(['razorpay', 'cod']),
  couponCode: z.string().max(40).optional().nullable(),
  idempotencyKey: z.string().min(8).max(120),
  notes: z.string().max(500).optional().default(''),
  acceptedTerms: z.literal(true),
});

router.post('/orders', optionalAuth, async (req: AuthRequest, res) => {
  try {
    const parsed = createOrderSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        error: parsed.error.issues[0]?.message || 'Please complete all required checkout fields.',
      });
    }

    const input = parsed.data;

    // 1. Prevent duplicate order submission via idempotency key
    const existingOrder = await db
      .select()
      .from(orders)
      .where(eq(orders.idempotencyKey, input.idempotencyKey))
      .limit(1);

    if (existingOrder[0]) {
      const [existingPayment] = await db
        .select()
        .from(payments)
        .where(eq(payments.orderId, existingOrder[0].id))
        .limit(1);
      return res.json({
        order: existingOrder[0],
        payment: existingPayment || null,
        razorpayOrder: existingPayment?.razorpayOrderId
          ? {
              id: existingPayment.razorpayOrderId,
              amount: existingOrder[0].totalAmount * 100,
              currency: 'INR',
              keyId: process.env.RAZORPAY_KEY_ID || null,
            }
          : null,
      });
    }

    // 2. Load active cart and verify stock on backend
    const cart = await getOrCreateCart(req);
    if (!cart) {
      return res.status(400).json({ error: 'Your shopping cart is empty.' });
    }
    const cartData = await loadCartPayload(cart.id);
    if (cartData.items.length === 0) {
      return res.status(400).json({ error: 'Your shopping cart is empty.' });
    }

    for (const item of cartData.items) {
      if (item.stockQuantity < item.quantity) {
        return res.status(400).json({
          error: `Insufficient stock for ${item.name} (only ${item.stockQuantity} available).`,
        });
      }
    }

    // 3. Load payment & shipping rules strictly on backend
    const [settingsRow] = await db
      .select()
      .from(cmsSettings)
      .where(eq(cmsSettings.key, 'payment_settings'))
      .limit(1);
    const paymentSettings = (settingsRow?.value || {}) as Record<string, unknown>;
    const gstRate = Number(paymentSettings.gstRatePercent ?? 12);
    const codEnabledGlobal = paymentSettings.codEnabled !== false;
    const codMaxAmount = Number(paymentSettings.codMaxOrderAmount || 25000);

    const zones = await db.select().from(shippingZones).where(eq(shippingZones.isActive, true));
    const matchedZone =
      zones.find((z) => z.pincodePrefix !== '*' && input.pincode.startsWith(z.pincodePrefix)) ||
      zones.find((z) => z.pincodePrefix === '*');

    if (!matchedZone) {
      return res.status(400).json({ error: `PIN code ${input.pincode} is not currently serviceable.` });
    }

    // 4. Calculate Coupon Discount securely on backend
    let discountAmount = 0;
    let appliedCoupon: typeof coupons.$inferSelect | null = null;
    if (input.couponCode && input.couponCode.trim()) {
      const code = input.couponCode.trim().toUpperCase();
      const [c] = await db.select().from(coupons).where(eq(coupons.code, code)).limit(1);
      const now = new Date();
      if (
        c &&
        c.status === 'active' &&
        (!c.startsAt || new Date(c.startsAt) <= now) &&
        (!c.expiresAt || new Date(c.expiresAt) >= now) &&
        (!c.usageLimit || c.usedCount < c.usageLimit) &&
        cartData.subtotal >= c.minOrderValue &&
        (!c.categorySlug || cartData.items.some((i) => i.categorySlug === c.categorySlug))
      ) {
        appliedCoupon = c;
        discountAmount =
          c.discountType === 'percentage'
            ? Math.round((cartData.subtotal * c.discountValue) / 100)
            : c.discountValue;
        if (c.maxDiscountLimit && discountAmount > c.maxDiscountLimit) {
          discountAmount = c.maxDiscountLimit;
        }
        discountAmount = Math.min(discountAmount, cartData.subtotal);
      }
    }

    const discountedSubtotal = Math.max(0, cartData.subtotal - discountAmount);
    const shippingFee =
      discountedSubtotal >= matchedZone.freeShippingThreshold ? 0 : matchedZone.baseCharge;
    const taxAmount = Math.round((discountedSubtotal * gstRate) / 100);
    const totalAmount = discountedSubtotal + shippingFee + taxAmount;

    if (input.paymentMethod === 'cod') {
      if (!codEnabledGlobal || !matchedZone.codEnabled) {
        return res.status(400).json({ error: 'Cash on Delivery is unavailable for this PIN code or currently disabled.' });
      }
      if (totalAmount > codMaxAmount) {
        return res.status(400).json({
          error: `Cash on Delivery is limited to orders up to ₹${codMaxAmount.toLocaleString('en-IN')}. Please use Razorpay.`,
        });
      }
    }

    // 5. If Razorpay selected, require real server credentials (never fake a gateway order/confirmation!)
    const razorpayKeyId = process.env.RAZORPAY_KEY_ID?.trim() || '';
    const razorpayKeySecret = process.env.RAZORPAY_KEY_SECRET?.trim() || '';

    let razorpayOrderPayload: { id: string; amount: number; currency: string; keyId: string } | null = null;
    if (input.paymentMethod === 'razorpay') {
      if (!razorpayKeyId || !razorpayKeySecret) {
        return res.status(503).json({
          error:
            'Razorpay gateway keys (RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET) are not configured on the server yet. Add your Razorpay Test Mode keys in environment secrets or choose Cash on Delivery.',
          code: 'RAZORPAY_UNCONFIGURED',
        });
      }
    }

    const orderNumber = generateOrderNumber();

    // Create Razorpay Order server-side first if Razorpay
    if (input.paymentMethod === 'razorpay') {
      try {
        const rzp = new Razorpay({ key_id: razorpayKeyId, key_secret: razorpayKeySecret });
        const createdRzp = await rzp.orders.create({
          amount: totalAmount * 100, // paise
          currency: 'INR',
          receipt: orderNumber,
          notes: {
            customerEmail: input.customerEmail,
            orderNumber,
          },
        });
        razorpayOrderPayload = {
          id: createdRzp.id,
          amount: Number(createdRzp.amount),
          currency: createdRzp.currency,
          keyId: razorpayKeyId,
        };
      } catch (rzpError: any) {
        console.error('Razorpay order creation failed:', rzpError);
        return res.status(502).json({
          error: 'Unable to initialize Razorpay payment order. Please verify your Razorpay credentials or try Cash on Delivery.',
        });
      }
    }

    const isCod = input.paymentMethod === 'cod';
    const [createdOrder] = await db
      .insert(orders)
      .values({
        orderNumber,
        userId: req.dbUser?.id || null,
        customerName: input.customerName.trim(),
        customerEmail: input.customerEmail.trim().toLowerCase(),
        customerPhone: input.customerPhone.trim(),
        shippingAddress: {
          fullName: input.customerName.trim(),
          phone: input.customerPhone.trim(),
          addressLine1: input.addressLine1.trim(),
          addressLine2: input.addressLine2.trim(),
          city: input.city.trim(),
          state: input.state.trim(),
          pincode: input.pincode.trim(),
          country: input.country.trim(),
        },
        subtotal: cartData.subtotal,
        discountAmount,
        shippingFee,
        taxAmount,
        totalAmount,
        couponCode: appliedCoupon?.code || null,
        paymentMethod: input.paymentMethod,
        paymentStatus: isCod ? 'cod_pending' : 'pending',
        orderStatus: isCod ? 'confirmed' : 'pending',
        idempotencyKey: input.idempotencyKey,
        notes: input.notes,
      })
      .returning();

    // Preserve exact item price & product snapshot at time of purchase
    for (const item of cartData.items) {
      await db.insert(orderItems).values({
        orderId: createdOrder.id,
        productId: item.productId,
        productNameSnapshot: item.name,
        productSkuSnapshot: item.sku,
        productImageSnapshot: item.primaryImage,
        selectedColor: item.selectedColor || '',
        selectedSize: item.selectedSize || '',
        unitPriceSnapshot: item.salePrice,
        quantity: item.quantity,
        lineTotal: item.salePrice * item.quantity,
      });

      // Decrement stock & log inventory adjustment
      const newStock = Math.max(0, item.stockQuantity - item.quantity);
      await db
        .update(products)
        .set({ stockQuantity: newStock, updatedAt: new Date() })
        .where(eq(products.id, item.productId));

      await db.insert(inventoryLogs).values({
        productId: item.productId,
        changeAmount: -item.quantity,
        previousStock: item.stockQuantity,
        newStock,
        reason: `Order ${orderNumber}`,
        actorUserId: req.dbUser?.id || null,
      });

      if (newStock <= 8) {
        await db.insert(notifications).values({
          audience: 'admin',
          type: 'low_stock',
          title: `Low Stock Alert: ${item.name}`,
          message: `Only ${newStock} unit(s) remaining after Order ${orderNumber}.`,
          linkUrl: '/admin/products',
        });
      }
    }

    // Create Payment record
    const [createdPayment] = await db
      .insert(payments)
      .values({
        orderId: createdOrder.id,
        gateway: isCod ? 'cod' : 'razorpay',
        razorpayOrderId: razorpayOrderPayload?.id || null,
        method: isCod ? 'cod' : 'razorpay',
        amount: totalAmount,
        currency: 'INR',
        status: 'pending',
      })
      .returning();

    // Create Initial Shipment record with honest timeline (no fabricated courier tracking!)
    const nowIso = new Date().toISOString();
    const initialTimeline = isCod
      ? [
          { status: 'pending', label: 'Order Placed', timestamp: nowIso, note: 'Order received via Cash on Delivery.' },
          { status: 'confirmed', label: 'Order Confirmed', timestamp: nowIso, note: 'Confirmed and queued for packing.' },
        ]
      : [
          { status: 'pending', label: 'Order Placed', timestamp: nowIso, note: 'Awaiting Razorpay payment confirmation.' },
        ];

    await db.insert(shipments).values({
      orderId: createdOrder.id,
      status: isCod ? 'confirmed' : 'pending',
      estimatedDelivery: matchedZone.estimatedDays,
      timeline: initialTimeline,
    });

    // Record Coupon usage
    if (appliedCoupon) {
      await db.insert(couponUsages).values({
        couponId: appliedCoupon.id,
        userId: req.dbUser?.id || null,
        orderId: createdOrder.id,
        discountApplied: discountAmount,
      });
      await db
        .update(coupons)
        .set({ usedCount: appliedCoupon.usedCount + 1 })
        .where(eq(coupons.id, appliedCoupon.id));
    }

    // Clear cart on COD immediately (for Razorpay, clear upon verification)
    if (isCod) {
      await db.delete(cartItems).where(eq(cartItems.cartId, cart.id));

      if (req.dbUser) {
        await db.insert(notifications).values({
          userId: req.dbUser.id,
          audience: 'customer',
          type: 'order',
          title: `Order ${orderNumber} Confirmed`,
          message: `Your Cash on Delivery order of ₹${totalAmount.toLocaleString('en-IN')} has been confirmed.`,
          linkUrl: `/track-order?orderNumber=${orderNumber}`,
        });
      }

      await db.insert(notifications).values({
        audience: 'admin',
        type: 'order',
        title: `New COD Order ${orderNumber}`,
        message: `${createdOrder.customerName} placed an order worth ₹${totalAmount.toLocaleString('en-IN')}.`,
        linkUrl: '/admin/orders',
      });

      await sendTransactionalEmail({
        to: createdOrder.customerEmail,
        subject: `SHAIKCART Order Confirmed — ${orderNumber}`,
        template: 'order_confirmation',
        html: `<h2>Thank you for shopping with SHAIKCART!</h2><p>Your Cash on Delivery order <strong>${orderNumber}</strong> for <strong>₹${totalAmount.toLocaleString('en-IN')}</strong> is confirmed.</p>`,
      });
    }

    res.status(201).json({
      order: createdOrder,
      payment: createdPayment,
      razorpayOrder: razorpayOrderPayload,
    });
  } catch (error) {
    console.error('Create order error:', error);
    res.status(500).json({ error: 'Unable to create order right now. Please try again.' });
  }
});

// Verify Razorpay Payment Signature strictly on server
const verifyPaymentSchema = z.object({
  orderNumber: z.string().min(4),
  razorpay_order_id: z.string().min(4),
  razorpay_payment_id: z.string().min(4),
  razorpay_signature: z.string().min(10),
});

router.post('/payments/razorpay/verify', optionalAuth, async (req: AuthRequest, res) => {
  try {
    const parsed = verifyPaymentSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Incomplete payment verification payload.' });
    }

    const secret = process.env.RAZORPAY_KEY_SECRET?.trim();
    if (!secret) {
      return res.status(503).json({ error: 'Razorpay secret is not configured on the server.' });
    }

    const isValid = verifyRazorpaySignature(
      parsed.data.razorpay_order_id,
      parsed.data.razorpay_payment_id,
      parsed.data.razorpay_signature,
      secret
    );

    const [orderRow] = await db
      .select()
      .from(orders)
      .where(eq(orders.orderNumber, parsed.data.orderNumber))
      .limit(1);

    if (!orderRow) {
      return res.status(404).json({ error: 'Order not found.' });
    }

    if (!isValid) {
      await db
        .update(payments)
        .set({ status: 'failed', updatedAt: new Date() })
        .where(eq(payments.orderId, orderRow.id));
      await db
        .update(orders)
        .set({ paymentStatus: 'failed', updatedAt: new Date() })
        .where(eq(orders.id, orderRow.id));

      return res.status(400).json({ verified: false, error: 'Razorpay payment signature verification failed.' });
    }

    await db
      .update(payments)
      .set({
        razorpayPaymentId: parsed.data.razorpay_payment_id,
        razorpaySignature: parsed.data.razorpay_signature,
        status: 'captured',
        updatedAt: new Date(),
      })
      .where(eq(payments.orderId, orderRow.id));

    await db
      .update(orders)
      .set({ paymentStatus: 'paid', orderStatus: 'confirmed', updatedAt: new Date() })
      .where(eq(orders.id, orderRow.id));

    const [ship] = await db.select().from(shipments).where(eq(shipments.orderId, orderRow.id)).limit(1);
    const nextTimeline = [
      ...(ship?.timeline || []),
      {
        status: 'confirmed',
        label: 'Payment Verified & Order Confirmed',
        timestamp: new Date().toISOString(),
        note: `Razorpay payment ${parsed.data.razorpay_payment_id} verified.`,
      },
    ];
    await db
      .update(shipments)
      .set({ status: 'confirmed', timeline: nextTimeline, updatedAt: new Date() })
      .where(eq(shipments.orderId, orderRow.id));

    // Clear user/guest cart after confirmed payment
    const cart = await getOrCreateCart(req);
    if (cart) {
      await db.delete(cartItems).where(eq(cartItems.cartId, cart.id));
    }

    if (orderRow.userId) {
      await db.insert(notifications).values({
        userId: orderRow.userId,
        audience: 'customer',
        type: 'payment',
        title: `Payment Received for ${orderRow.orderNumber}`,
        message: `₹${orderRow.totalAmount.toLocaleString('en-IN')} verified via Razorpay.`,
        linkUrl: `/track-order?orderNumber=${orderRow.orderNumber}`,
      });
    }

    await db.insert(notifications).values({
      audience: 'admin',
      type: 'order',
      title: `New Paid Order ${orderRow.orderNumber}`,
      message: `${orderRow.customerName} completed payment of ₹${orderRow.totalAmount.toLocaleString('en-IN')}.`,
      linkUrl: '/admin/orders',
    });

    await sendTransactionalEmail({
      to: orderRow.customerEmail,
      subject: `Payment Confirmed — SHAIKCART Order ${orderRow.orderNumber}`,
      template: 'payment_confirmation',
      html: `<h2>Payment Successful</h2><p>We received ₹${orderRow.totalAmount.toLocaleString('en-IN')} for Order <strong>${orderRow.orderNumber}</strong> (Transaction: ${parsed.data.razorpay_payment_id}).</p>`,
    });

    res.json({ verified: true, orderNumber: orderRow.orderNumber, paymentId: parsed.data.razorpay_payment_id });
  } catch (error) {
    console.error('Razorpay verify error:', error);
    res.status(500).json({ error: 'Unable to verify payment.' });
  }
});

// Mark Failed Payment Attempt
router.post('/payments/razorpay/failed', optionalAuth, async (req: AuthRequest, res) => {
  try {
    const orderNumber = String(req.body?.orderNumber || '').trim();
    const reason = String(req.body?.reason || 'Payment cancelled or failed at gateway');
    if (!orderNumber) return res.status(400).json({ error: 'Order number required.' });

    const [orderRow] = await db.select().from(orders).where(eq(orders.orderNumber, orderNumber)).limit(1);
    if (!orderRow) return res.status(404).json({ error: 'Order not found.' });

    await db
      .update(payments)
      .set({ status: 'failed', rawResponse: { reason }, updatedAt: new Date() })
      .where(eq(payments.orderId, orderRow.id));

    await db
      .update(orders)
      .set({ paymentStatus: 'failed', updatedAt: new Date() })
      .where(eq(orders.id, orderRow.id));

    await db.insert(notifications).values({
      audience: 'admin',
      type: 'payment',
      title: `Payment Failed for ${orderNumber}`,
      message: `${orderRow.customerName}'s payment failed: ${reason}`,
      linkUrl: '/admin/payments',
    });

    res.json({ recorded: true });
  } catch (error) {
    console.error('Record failed payment error:', error);
    res.status(500).json({ error: 'Unable to update payment status.' });
  }
});

// Secure Razorpay Webhook Endpoint (validates x-razorpay-signature against raw body)
router.post('/payments/razorpay/webhook', async (req: any, res) => {
  try {
    const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET?.trim();
    const signature = String(req.headers['x-razorpay-signature'] || '');
    if (!webhookSecret || !signature || !req.rawBody) {
      return res.status(400).json({ error: 'Webhook verification configuration missing.' });
    }

    const valid = verifyRazorpayWebhookSignature(req.rawBody, signature, webhookSecret);
    if (!valid) {
      return res.status(401).json({ error: 'Invalid Razorpay webhook signature.' });
    }

    const event = req.body?.event;
    const entity = req.body?.payload?.payment?.entity;

    if (entity?.order_id) {
      const [payRow] = await db
        .select()
        .from(payments)
        .where(eq(payments.razorpayOrderId, entity.order_id))
        .limit(1);

      if (payRow) {
        if (event === 'payment.captured') {
          await db
            .update(payments)
            .set({
              razorpayPaymentId: entity.id,
              method: entity.method || payRow.method,
              status: 'captured',
              rawResponse: entity,
              updatedAt: new Date(),
            })
            .where(eq(payments.id, payRow.id));

          await db
            .update(orders)
            .set({ paymentStatus: 'paid', orderStatus: 'confirmed', updatedAt: new Date() })
            .where(eq(orders.id, payRow.orderId));
        } else if (event === 'payment.failed') {
          await db
            .update(payments)
            .set({ status: 'failed', rawResponse: entity, updatedAt: new Date() })
            .where(eq(payments.id, payRow.id));
          await db
            .update(orders)
            .set({ paymentStatus: 'failed', updatedAt: new Date() })
            .where(eq(orders.id, payRow.orderId));
        }
      }
    }

    res.json({ received: true });
  } catch (error) {
    console.error('Razorpay webhook error:', error);
    res.status(500).json({ error: 'Webhook handler error.' });
  }
});

// ======================= CUSTOMER ORDERS & PUBLIC TRACKING =======================

router.get('/orders', requireAuth, async (req: AuthRequest, res) => {
  try {
    const userOrders = await db
      .select()
      .from(orders)
      .where(eq(orders.userId, req.dbUser!.id))
      .orderBy(desc(orders.createdAt));

    const orderIds = userOrders.map((o) => o.id);
    const items =
      orderIds.length > 0
        ? await db.select().from(orderItems).where(inArray(orderItems.orderId, orderIds))
        : [];
    const shipRows =
      orderIds.length > 0
        ? await db.select().from(shipments).where(inArray(shipments.orderId, orderIds))
        : [];

    const itemsByOrder = new Map<number, typeof items>();
    for (const item of items) {
      const list = itemsByOrder.get(item.orderId) || [];
      list.push(item);
      itemsByOrder.set(item.orderId, list);
    }
    const shipMap = new Map(shipRows.map((s) => [s.orderId, s]));

    res.json({
      orders: userOrders.map((o) => ({
        ...o,
        items: itemsByOrder.get(o.id) || [],
        shipment: shipMap.get(o.id) || null,
      })),
    });
  } catch (error) {
    console.error('Get orders error:', error);
    res.status(500).json({ error: 'Unable to load your orders.' });
  }
});

// Public / Authenticated Order Tracking (never fabricates tracking numbers)
router.get('/orders/track', optionalAuth, async (req: AuthRequest, res) => {
  try {
    const orderNumber = String(req.query.orderNumber || '').trim().toUpperCase();
    const email = String(req.query.email || '').trim().toLowerCase();

    if (!orderNumber) {
      return res.status(400).json({ error: 'Please enter an Order Number.' });
    }

    const [orderRow] = await db
      .select()
      .from(orders)
      .where(eq(orders.orderNumber, orderNumber))
      .limit(1);

    if (!orderRow) {
      return res.status(404).json({ error: 'No order found with that Order Number.' });
    }

    const isOwner = req.dbUser && (orderRow.userId === req.dbUser.id || isAdminRole(req.dbUser.role));
    if (!isOwner) {
      if (!email || orderRow.customerEmail.toLowerCase() !== email) {
        return res.status(403).json({
          error: 'Please enter the exact email address used when placing this order.',
        });
      }
    }

    const [items, shipmentRows, paymentRows] = await Promise.all([
      db.select().from(orderItems).where(eq(orderItems.orderId, orderRow.id)),
      db.select().from(shipments).where(eq(shipments.orderId, orderRow.id)).limit(1),
      db.select().from(payments).where(eq(payments.orderId, orderRow.id)).orderBy(desc(payments.createdAt)),
    ]);

    res.json({
      order: orderRow,
      items,
      shipment: shipmentRows[0] || null,
      payment: paymentRows[0] || null,
    });
  } catch (error) {
    console.error('Order track error:', error);
    res.status(500).json({ error: 'Unable to track order right now.' });
  }
});

router.get('/orders/:orderNumber', requireAuth, async (req: AuthRequest, res) => {
  try {
    const [orderRow] = await db
      .select()
      .from(orders)
      .where(eq(orders.orderNumber, req.params.orderNumber))
      .limit(1);

    if (!orderRow) return res.status(404).json({ error: 'Order not found.' });
    if (orderRow.userId !== req.dbUser!.id && !isAdminRole(req.dbUser!.role)) {
      return res.status(403).json({ error: 'You do not have permission to view this order.' });
    }

    const [items, shipRows, paymentRows] = await Promise.all([
      db.select().from(orderItems).where(eq(orderItems.orderId, orderRow.id)),
      db.select().from(shipments).where(eq(shipments.orderId, orderRow.id)).limit(1),
      db.select().from(payments).where(eq(payments.orderId, orderRow.id)).orderBy(desc(payments.createdAt)),
    ]);

    res.json({
      order: orderRow,
      items,
      shipment: shipRows[0] || null,
      payment: paymentRows[0] || null,
    });
  } catch (error) {
    console.error('Order detail error:', error);
    res.status(500).json({ error: 'Unable to load order details.' });
  }
});

export default router;
