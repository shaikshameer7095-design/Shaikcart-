export interface UserProfile {
  id: number;
  uid: string;
  email: string;
  fullName: string;
  phone: string;
  avatarUrl: string;
  role: string;
  isAdmin: boolean;
  permissions: string[];
  emailVerified: boolean;
  status: string;
}

export interface Category {
  id: number;
  name: string;
  slug: string;
  description: string;
  imageUrl: string;
  bannerUrl: string;
  iconName: string;
  subcategories: string[];
  sortOrder: number;
  isActive: boolean;
}

export interface Brand {
  id: number;
  name: string;
  slug: string;
  logoUrl: string;
  description: string;
  isActive: boolean;
}

export interface ProductImage {
  id: number;
  url: string;
  altText: string;
  sortOrder: number;
}

export interface Product {
  id: number;
  name: string;
  slug: string;
  sku: string;
  categoryId: number | null;
  categoryName: string;
  categorySlug: string;
  subcategory: string;
  brandId: number | null;
  brandName: string;
  brandSlug: string;
  shortDescription: string;
  description: string;
  specifications: Record<string, string>;
  materials: string;
  dimensions: string;
  highlights: string[];
  regularPrice: number;
  salePrice: number;
  discountPercent: number;
  stockQuantity: number;
  lowStockThreshold: number;
  primaryImage: string;
  images?: ProductImage[];
  colors: string[];
  sizes: string[];
  tags: string[];
  isFeatured: boolean;
  isBestseller: boolean;
  isNewArrival: boolean;
  isTrending: boolean;
  isActive: boolean;
  isDemo: boolean;
  ratingAvg: number;
  reviewCount: number;
  seoTitle?: string;
  seoDescription?: string;
  createdAt: string;
}

export interface CartItem {
  id: number;
  productId: number;
  name: string;
  slug: string;
  sku: string;
  primaryImage: string;
  regularPrice: number;
  salePrice: number;
  stockQuantity: number;
  selectedColor: string;
  selectedSize: string;
  categorySlug: string;
  quantity: number;
  lineTotal: number;
}

export interface CartState {
  items: CartItem[];
  subtotal: number;
  totalMrp: number;
  savings: number;
  itemCount: number;
}

export interface WishlistItem {
  id: number;
  productId: number;
  name: string;
  slug: string;
  primaryImage: string;
  regularPrice: number;
  salePrice: number;
  stockQuantity: number;
  ratingAvg: number;
  reviewCount: number;
  colors: string[];
  sizes: string[];
}

export interface Address {
  id: number;
  label: string;
  fullName: string;
  phone: string;
  addressLine1: string;
  addressLine2: string;
  city: string;
  state: string;
  pincode: string;
  country: string;
  isDefault: boolean;
}

export interface OrderItem {
  id: number;
  productId: number | null;
  productNameSnapshot: string;
  productSkuSnapshot: string;
  productImageSnapshot: string;
  selectedColor: string;
  selectedSize: string;
  unitPriceSnapshot: number;
  quantity: number;
  lineTotal: number;
}

export interface ShipmentEvent {
  status: string;
  label: string;
  location?: string;
  timestamp: string;
  note?: string;
}

export interface Shipment {
  id: number;
  orderId: number;
  courierName: string;
  trackingNumber: string;
  trackingUrl: string;
  status: string;
  estimatedDelivery: string;
  timeline: ShipmentEvent[];
}

export interface Order {
  id: number;
  orderNumber: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  shippingAddress: {
    fullName: string;
    phone: string;
    addressLine1: string;
    addressLine2?: string;
    city: string;
    state: string;
    pincode: string;
    country: string;
  };
  subtotal: number;
  discountAmount: number;
  shippingFee: number;
  taxAmount: number;
  totalAmount: number;
  couponCode: string | null;
  paymentMethod: string;
  paymentStatus: string;
  orderStatus: string;
  notes: string;
  createdAt: string;
  items?: OrderItem[];
  shipment?: Shipment | null;
}

export interface WebsiteBanner {
  id: number;
  slot: string;
  title: string;
  subtitle: string;
  ctaText: string;
  ctaLink: string;
  imageUrl: string;
  badgeText: string;
  sortOrder: number;
  isActive: boolean;
}

export interface ProductReview {
  id: number;
  rating: number;
  title: string;
  comment: string;
  isVerifiedPurchase: boolean;
  createdAt: string;
  userName: string;
}
