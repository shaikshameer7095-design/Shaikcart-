import { relations } from 'drizzle-orm';
import {
  boolean,
  index,
  integer,
  jsonb,
  numeric,
  pgTable,
  serial,
  text,
  timestamp,
  uniqueIndex,
} from 'drizzle-orm/pg-core';

// 1. User Roles (RBAC matrix)
export const userRoles = pgTable('user_roles', {
  id: serial('id').primaryKey(),
  name: text('name').notNull().unique(), // super_admin, admin, manager, inventory_manager, order_manager, customer
  label: text('label').notNull(),
  permissions: jsonb('permissions').$type<string[]>().notNull().default([]),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// 2. Users (Customers & Admins linked via Firebase Auth UID or email/password)
export const users = pgTable(
  'users',
  {
    id: serial('id').primaryKey(),
    uid: text('uid').notNull().unique(),
    email: text('email').notNull().unique(),
    passwordHash: text('password_hash'),
    fullName: text('full_name').notNull().default(''),
    phone: text('phone').default(''),
    avatarUrl: text('avatar_url').default(''),
    role: text('role').notNull().default('customer'), // super_admin | admin | manager | inventory_manager | order_manager | customer
    emailVerified: boolean('email_verified').notNull().default(false),
    verificationToken: text('verification_token'),
    resetToken: text('reset_token'),
    resetTokenExpiresAt: timestamp('reset_token_expires_at'),
    status: text('status').notNull().default('active'), // active | suspended
    lastLoginAt: timestamp('last_login_at'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => [index('users_role_idx').on(table.role)]
);

// 3. Categories
export const categories = pgTable(
  'categories',
  {
    id: serial('id').primaryKey(),
    name: text('name').notNull(),
    slug: text('slug').notNull().unique(),
    parentId: integer('parent_id'),
    description: text('description').default(''),
    imageUrl: text('image_url').default(''),
    bannerUrl: text('banner_url').default(''),
    iconName: text('icon_name').default('ShoppingBag'),
    subcategories: jsonb('subcategories').$type<string[]>().notNull().default([]),
    sortOrder: integer('sort_order').notNull().default(0),
    isActive: boolean('is_active').notNull().default(true),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => [index('categories_sort_idx').on(table.sortOrder)]
);

// 4. Brands
export const brands = pgTable('brands', {
  id: serial('id').primaryKey(),
  name: text('name').notNull().unique(),
  slug: text('slug').notNull().unique(),
  logoUrl: text('logo_url').default(''),
  description: text('description').default(''),
  isActive: boolean('is_active').notNull().default(true),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// 5. Products
export const products = pgTable(
  'products',
  {
    id: serial('id').primaryKey(),
    name: text('name').notNull(),
    slug: text('slug').notNull().unique(),
    sku: text('sku').notNull().unique(),
    categoryId: integer('category_id')
      .references(() => categories.id, { onDelete: 'set null' }),
    subcategory: text('subcategory').default(''),
    brandId: integer('brand_id')
      .references(() => brands.id, { onDelete: 'set null' }),
    shortDescription: text('short_description').default(''),
    description: text('description').notNull(),
    specifications: jsonb('specifications').$type<Record<string, string>>().notNull().default({}),
    materials: text('materials').default(''),
    dimensions: text('dimensions').default(''),
    highlights: jsonb('highlights').$type<string[]>().notNull().default([]),
    regularPrice: integer('regular_price').notNull(), // INR whole rupees
    salePrice: integer('sale_price').notNull(), // INR whole rupees
    stockQuantity: integer('stock_quantity').notNull().default(0),
    lowStockThreshold: integer('low_stock_threshold').notNull().default(8),
    primaryImage: text('primary_image').notNull(),
    colors: jsonb('colors').$type<string[]>().notNull().default([]),
    sizes: jsonb('sizes').$type<string[]>().notNull().default([]),
    tags: jsonb('tags').$type<string[]>().notNull().default([]),
    isFeatured: boolean('is_featured').notNull().default(false),
    isBestseller: boolean('is_bestseller').notNull().default(false),
    isNewArrival: boolean('is_new_arrival').notNull().default(false),
    isTrending: boolean('is_trending').notNull().default(false),
    isActive: boolean('is_active').notNull().default(true),
    isDemo: boolean('is_demo').notNull().default(false),
    ratingAvg: numeric('rating_avg', { precision: 3, scale: 2 }).notNull().default('4.50'),
    reviewCount: integer('review_count').notNull().default(0),
    seoTitle: text('seo_title').default(''),
    seoDescription: text('seo_description').default(''),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => [
    index('products_category_idx').on(table.categoryId),
    index('products_brand_idx').on(table.brandId),
    index('products_active_idx').on(table.isActive),
  ]
);

// 6. Product Images
export const productImages = pgTable('product_images', {
  id: serial('id').primaryKey(),
  productId: integer('product_id')
    .references(() => products.id, { onDelete: 'cascade' })
    .notNull(),
  url: text('url').notNull(),
  altText: text('alt_text').default(''),
  sortOrder: integer('sort_order').notNull().default(0),
});

// 7. Product Variants
export const productVariants = pgTable('product_variants', {
  id: serial('id').primaryKey(),
  productId: integer('product_id')
    .references(() => products.id, { onDelete: 'cascade' })
    .notNull(),
  sku: text('sku').notNull().unique(),
  color: text('color').default(''),
  size: text('size').default(''),
  priceOverride: integer('price_override'),
  stockQuantity: integer('stock_quantity').notNull().default(0),
  isActive: boolean('is_active').notNull().default(true),
});

// 8. Inventory Adjustment Logs
export const inventoryLogs = pgTable('inventory_logs', {
  id: serial('id').primaryKey(),
  productId: integer('product_id')
    .references(() => products.id, { onDelete: 'cascade' })
    .notNull(),
  variantId: integer('variant_id').references(() => productVariants.id, { onDelete: 'set null' }),
  changeAmount: integer('change_amount').notNull(),
  previousStock: integer('previous_stock').notNull(),
  newStock: integer('new_stock').notNull(),
  reason: text('reason').notNull(),
  actorUserId: integer('actor_user_id').references(() => users.id, { onDelete: 'set null' }),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// 9. Carts
export const carts = pgTable('carts', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').references(() => users.id, { onDelete: 'cascade' }),
  guestToken: text('guest_token').unique(),
  couponCode: text('coupon_code'),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// 10. Cart Items
export const cartItems = pgTable('cart_items', {
  id: serial('id').primaryKey(),
  cartId: integer('cart_id')
    .references(() => carts.id, { onDelete: 'cascade' })
    .notNull(),
  productId: integer('product_id')
    .references(() => products.id, { onDelete: 'cascade' })
    .notNull(),
  variantId: integer('variant_id').references(() => productVariants.id, { onDelete: 'set null' }),
  selectedColor: text('selected_color').default(''),
  selectedSize: text('selected_size').default(''),
  quantity: integer('quantity').notNull().default(1),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// 11. Wishlists
export const wishlists = pgTable('wishlists', {
  id: serial('id').primaryKey(),
  userId: integer('user_id')
    .references(() => users.id, { onDelete: 'cascade' })
    .notNull()
    .unique(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// 12. Wishlist Items
export const wishlistItems = pgTable(
  'wishlist_items',
  {
    id: serial('id').primaryKey(),
    wishlistId: integer('wishlist_id')
      .references(() => wishlists.id, { onDelete: 'cascade' })
      .notNull(),
    productId: integer('product_id')
      .references(() => products.id, { onDelete: 'cascade' })
      .notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => [uniqueIndex('wishlist_product_uniq').on(table.wishlistId, table.productId)]
);

// 13. Saved Addresses
export const addresses = pgTable('addresses', {
  id: serial('id').primaryKey(),
  userId: integer('user_id')
    .references(() => users.id, { onDelete: 'cascade' })
    .notNull(),
  label: text('label').notNull().default('Home'),
  fullName: text('full_name').notNull(),
  phone: text('phone').notNull(),
  addressLine1: text('address_line1').notNull(),
  addressLine2: text('address_line2').default(''),
  city: text('city').notNull(),
  state: text('state').notNull(),
  pincode: text('pincode').notNull(),
  country: text('country').notNull().default('India'),
  isDefault: boolean('is_default').notNull().default(false),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// 14. Orders
export interface ShippingAddressSnapshot {
  fullName: string;
  phone: string;
  addressLine1: string;
  addressLine2?: string;
  city: string;
  state: string;
  pincode: string;
  country: string;
}

export const orders = pgTable(
  'orders',
  {
    id: serial('id').primaryKey(),
    orderNumber: text('order_number').notNull().unique(),
    userId: integer('user_id').references(() => users.id, { onDelete: 'set null' }),
    customerName: text('customer_name').notNull(),
    customerEmail: text('customer_email').notNull(),
    customerPhone: text('customer_phone').notNull(),
    shippingAddress: jsonb('shipping_address').$type<ShippingAddressSnapshot>().notNull(),
    subtotal: integer('subtotal').notNull(),
    discountAmount: integer('discount_amount').notNull().default(0),
    shippingFee: integer('shipping_fee').notNull().default(0),
    taxAmount: integer('tax_amount').notNull().default(0),
    totalAmount: integer('total_amount').notNull(),
    couponCode: text('coupon_code'),
    paymentMethod: text('payment_method').notNull(), // razorpay | cod
    paymentStatus: text('payment_status').notNull().default('pending'), // pending | paid | failed | refunded | cod_pending
    orderStatus: text('order_status').notNull().default('pending'), // pending | confirmed | processing | packed | shipped | out_for_delivery | delivered | cancelled | returned
    idempotencyKey: text('idempotency_key').unique(),
    notes: text('notes').default(''),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => [
    index('orders_user_idx').on(table.userId),
    index('orders_status_idx').on(table.orderStatus),
    index('orders_created_idx').on(table.createdAt),
  ]
);

// 15. Order Items (preserves original price & snapshot at time of purchase)
export const orderItems = pgTable('order_items', {
  id: serial('id').primaryKey(),
  orderId: integer('order_id')
    .references(() => orders.id, { onDelete: 'cascade' })
    .notNull(),
  productId: integer('product_id').references(() => products.id, { onDelete: 'set null' }),
  productNameSnapshot: text('product_name_snapshot').notNull(),
  productSkuSnapshot: text('product_sku_snapshot').notNull(),
  productImageSnapshot: text('product_image_snapshot').notNull(),
  selectedColor: text('selected_color').default(''),
  selectedSize: text('selected_size').default(''),
  unitPriceSnapshot: integer('unit_price_snapshot').notNull(),
  quantity: integer('quantity').notNull(),
  lineTotal: integer('line_total').notNull(),
});

// 16. Payments
export const payments = pgTable(
  'payments',
  {
    id: serial('id').primaryKey(),
    orderId: integer('order_id')
      .references(() => orders.id, { onDelete: 'cascade' })
      .notNull(),
    gateway: text('gateway').notNull().default('razorpay'), // razorpay | cod
    razorpayOrderId: text('razorpay_order_id'),
    razorpayPaymentId: text('razorpay_payment_id'),
    razorpaySignature: text('razorpay_signature'),
    method: text('method').default(''), // upi | card | netbanking | wallet | cod
    amount: integer('amount').notNull(),
    currency: text('currency').notNull().default('INR'),
    status: text('status').notNull().default('pending'), // pending | captured | failed | refunded
    rawResponse: jsonb('raw_response').$type<Record<string, unknown>>().default({}),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => [index('payments_order_idx').on(table.orderId)]
);

// 17. Refunds
export const refunds = pgTable('refunds', {
  id: serial('id').primaryKey(),
  orderId: integer('order_id')
    .references(() => orders.id, { onDelete: 'cascade' })
    .notNull(),
  paymentId: integer('payment_id').references(() => payments.id, { onDelete: 'set null' }),
  razorpayRefundId: text('razorpay_refund_id'),
  amount: integer('amount').notNull(),
  reason: text('reason').notNull(),
  status: text('status').notNull().default('requested'), // requested | processing | processed | failed
  initiatedByUserId: integer('initiated_by_user_id').references(() => users.id, { onDelete: 'set null' }),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// 18. Coupons
export const coupons = pgTable('coupons', {
  id: serial('id').primaryKey(),
  code: text('code').notNull().unique(),
  description: text('description').default(''),
  discountType: text('discount_type').notNull(), // percentage | fixed
  discountValue: integer('discount_value').notNull(),
  minOrderValue: integer('min_order_value').notNull().default(0),
  maxDiscountLimit: integer('max_discount_limit'),
  usageLimit: integer('usage_limit'),
  perCustomerLimit: integer('per_customer_limit').notNull().default(1),
  usedCount: integer('used_count').notNull().default(0),
  categorySlug: text('category_slug'),
  startsAt: timestamp('starts_at'),
  expiresAt: timestamp('expires_at'),
  status: text('status').notNull().default('active'), // active | scheduled | expired | disabled
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// 19. Coupon Usage
export const couponUsages = pgTable('coupon_usages', {
  id: serial('id').primaryKey(),
  couponId: integer('coupon_id')
    .references(() => coupons.id, { onDelete: 'cascade' })
    .notNull(),
  userId: integer('user_id').references(() => users.id, { onDelete: 'set null' }),
  orderId: integer('order_id').references(() => orders.id, { onDelete: 'cascade' }),
  discountApplied: integer('discount_applied').notNull(),
  usedAt: timestamp('used_at').defaultNow().notNull(),
});

// 20. Reviews
export const reviews = pgTable(
  'reviews',
  {
    id: serial('id').primaryKey(),
    productId: integer('product_id')
      .references(() => products.id, { onDelete: 'cascade' })
      .notNull(),
    userId: integer('user_id')
      .references(() => users.id, { onDelete: 'cascade' })
      .notNull(),
    orderId: integer('order_id').references(() => orders.id, { onDelete: 'set null' }),
    rating: integer('rating').notNull(),
    title: text('title').notNull(),
    comment: text('comment').notNull(),
    isVerifiedPurchase: boolean('is_verified_purchase').notNull().default(false),
    status: text('status').notNull().default('approved'), // pending | approved | rejected
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => [index('reviews_product_idx').on(table.productId)]
);

// 21. Notifications
export const notifications = pgTable(
  'notifications',
  {
    id: serial('id').primaryKey(),
    userId: integer('user_id').references(() => users.id, { onDelete: 'cascade' }),
    audience: text('audience').notNull().default('customer'), // customer | admin
    type: text('type').notNull(), // order | payment | offer | low_stock | support | account
    title: text('title').notNull(),
    message: text('message').notNull(),
    linkUrl: text('link_url').default(''),
    isRead: boolean('is_read').notNull().default(false),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => [index('notifications_user_idx').on(table.userId)]
);

// 22. Shipments
export interface ShipmentEvent {
  status: string;
  label: string;
  location?: string;
  timestamp: string;
  note?: string;
}

export const shipments = pgTable('shipments', {
  id: serial('id').primaryKey(),
  orderId: integer('order_id')
    .references(() => orders.id, { onDelete: 'cascade' })
    .notNull()
    .unique(),
  courierName: text('courier_name').default(''),
  trackingNumber: text('tracking_number').default(''),
  trackingUrl: text('tracking_url').default(''),
  status: text('status').notNull().default('pending'), // pending | confirmed | packed | shipped | out_for_delivery | delivered
  estimatedDelivery: text('estimated_delivery').default(''),
  shippedAt: timestamp('shipped_at'),
  deliveredAt: timestamp('delivered_at'),
  timeline: jsonb('timeline').$type<ShipmentEvent[]>().notNull().default([]),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// 23. Shipping Zones & PIN Code Rules
export const shippingZones = pgTable('shipping_zones', {
  id: serial('id').primaryKey(),
  regionName: text('region_name').notNull(),
  pincodePrefix: text('pincode_prefix').notNull(), // e.g., "56", "40", "11", "*"
  baseCharge: integer('base_charge').notNull().default(99),
  freeShippingThreshold: integer('free_shipping_threshold').notNull().default(1499),
  estimatedDays: text('estimated_days').notNull().default('3-5 business days'),
  codEnabled: boolean('cod_enabled').notNull().default(true),
  isActive: boolean('is_active').notNull().default(true),
});

// 24. Support Tickets
export interface TicketReply {
  senderRole: 'customer' | 'admin';
  senderName: string;
  message: string;
  timestamp: string;
}

export const supportTickets = pgTable('support_tickets', {
  id: serial('id').primaryKey(),
  ticketNumber: text('ticket_number').notNull().unique(),
  userId: integer('user_id').references(() => users.id, { onDelete: 'set null' }),
  name: text('name').notNull(),
  email: text('email').notNull(),
  phone: text('phone').default(''),
  category: text('category').notNull().default('general'), // order | payment | returns | product | general
  priority: text('priority').notNull().default('medium'), // low | medium | high | urgent
  subject: text('subject').notNull(),
  message: text('message').notNull(),
  status: text('status').notNull().default('open'), // open | in_progress | resolved | closed
  assignedToUserId: integer('assigned_to_user_id').references(() => users.id, { onDelete: 'set null' }),
  replies: jsonb('replies').$type<TicketReply[]>().notNull().default([]),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// 25. Website Banners (CMS)
export const websiteBanners = pgTable('website_banners', {
  id: serial('id').primaryKey(),
  slot: text('slot').notNull(), // hero | promo_home | promo_beauty | announcement
  title: text('title').notNull(),
  subtitle: text('subtitle').default(''),
  ctaText: text('cta_text').default('Shop Now'),
  ctaLink: text('cta_link').default('/shop'),
  imageUrl: text('image_url').default(''),
  badgeText: text('badge_text').default(''),
  sortOrder: integer('sort_order').notNull().default(0),
  isActive: boolean('is_active').notNull().default(true),
  startsAt: timestamp('starts_at'),
  endsAt: timestamp('ends_at'),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// 26. CMS Settings (Announcement bar, footer, legal pages, payment config, homepage sections)
export const cmsSettings = pgTable('cms_settings', {
  id: serial('id').primaryKey(),
  key: text('key').notNull().unique(),
  value: jsonb('value').$type<Record<string, unknown>>().notNull().default({}),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// 27. Newsletter Subscribers
export const newsletterSubscribers = pgTable('newsletter_subscribers', {
  id: serial('id').primaryKey(),
  email: text('email').notNull().unique(),
  subscribedAt: timestamp('subscribed_at').defaultNow().notNull(),
});

// 28. Admin Activity Logs
export const adminActivityLogs = pgTable(
  'admin_activity_logs',
  {
    id: serial('id').primaryKey(),
    actorUserId: integer('actor_user_id').references(() => users.id, { onDelete: 'set null' }),
    actorEmail: text('actor_email').notNull(),
    action: text('action').notNull(),
    entityType: text('entity_type').notNull(),
    entityId: text('entity_id').default(''),
    details: jsonb('details').$type<Record<string, unknown>>().default({}),
    ipAddress: text('ip_address').default(''),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => [index('admin_logs_created_idx').on(table.createdAt)]
);

// 29. Email Delivery Logs
export const emailLogs = pgTable('email_logs', {
  id: serial('id').primaryKey(),
  recipient: text('recipient').notNull(),
  subject: text('subject').notNull(),
  template: text('template').notNull(),
  provider: text('provider').notNull().default('unconfigured'),
  status: text('status').notNull().default('not_configured'), // sent | failed | not_configured
  errorMessage: text('error_message').default(''),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// Drizzle Relations
export const categoriesRelations = relations(categories, ({ many }) => ({
  products: many(products),
}));

export const brandsRelations = relations(brands, ({ many }) => ({
  products: many(products),
}));

export const productsRelations = relations(products, ({ one, many }) => ({
  category: one(categories, {
    fields: [products.categoryId],
    references: [categories.id],
  }),
  brand: one(brands, {
    fields: [products.brandId],
    references: [brands.id],
  }),
  images: many(productImages),
  variants: many(productVariants),
  reviews: many(reviews),
}));

export const productImagesRelations = relations(productImages, ({ one }) => ({
  product: one(products, {
    fields: [productImages.productId],
    references: [products.id],
  }),
}));

export const productVariantsRelations = relations(productVariants, ({ one }) => ({
  product: one(products, {
    fields: [productVariants.productId],
    references: [products.id],
  }),
}));

export const ordersRelations = relations(orders, ({ one, many }) => ({
  user: one(users, {
    fields: [orders.userId],
    references: [users.id],
  }),
  items: many(orderItems),
  payments: many(payments),
  shipment: one(shipments, {
    fields: [orders.id],
    references: [shipments.orderId],
  }),
}));

export const orderItemsRelations = relations(orderItems, ({ one }) => ({
  order: one(orders, {
    fields: [orderItems.orderId],
    references: [orders.id],
  }),
  product: one(products, {
    fields: [orderItems.productId],
    references: [products.id],
  }),
}));

export const reviewsRelations = relations(reviews, ({ one }) => ({
  product: one(products, {
    fields: [reviews.productId],
    references: [products.id],
  }),
  user: one(users, {
    fields: [reviews.userId],
    references: [users.id],
  }),
}));
