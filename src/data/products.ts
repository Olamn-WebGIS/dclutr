export type Product = {
  id: string;
  name: string;
  category: string;
  price: number;
  originalPrice: number;
  condition: "Like New" | "Good Condition" | "Fairly Used" | "Used";
  location: string;
  seller: string;
  initials: string;
  color: string;
  icon: string;
  featured?: boolean;
  negotiable?: boolean;
  sellerVerified?: boolean;
  sellerId?: string;
  description?: string;
  imageUrl?: string | null;
};

export const categories = ["Everything", "Campus essentials", "Furniture", "Home appliances"];
