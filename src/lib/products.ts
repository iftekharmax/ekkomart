import img1 from "@/assets/products/mutton.jpg";
import img2 from "@/assets/products/p2.jpg";
import img3 from "@/assets/products/vermicelli.jpg";
import img4 from "@/assets/products/p4.png";
import img5 from "@/assets/products/p5.jpg";
import img6 from "@/assets/products/p6.jpeg";
import img7 from "@/assets/products/p7.png";

const IMAGES = [img1, img2, img3, img4, img5, img6, img7];
const pick = (i: number) => IMAGES[i % IMAGES.length];

export type Product = {
  id: string;
  name: string;
  unit: string;
  price: number;
  old: number | null;
  rating: number;
  reviews: number;
  tag: string;
  img: string;
  category: string;
  brand: string;
  inStock: boolean;
};

export const CATEGORIES = [
  "Fruits",
  "Vegetables",
  "Dairy & Eggs",
  "Meat",
  "Seafood",
  "Bakery",
  "Snacks",
  "Beverages",
] as const;

export const BRANDS = ["Nestlé", "Kellogg's", "Coca-Cola", "Heinz", "Kraft", "Danone", "Barilla", "Local Farm"] as const;

export const PRODUCTS: Product[] = [
  { id: "p1", name: "Organic Hass Avocado", unit: "1 pc", price: 1.99, old: 2.49, rating: 4.8, reviews: 120, tag: "Organic", img: pick(0), category: "Fruits", brand: "Local Farm", inStock: true },
  { id: "p2", name: "Fresh Whole Milk", unit: "1 L", price: 2.49, old: 2.99, rating: 4.7, reviews: 210, tag: "Bestseller", img: pick(1), category: "Dairy & Eggs", brand: "Danone", inStock: true },
  { id: "p3", name: "Free-Range Eggs", unit: "12 pcs", price: 4.29, old: 5.49, rating: 4.9, reviews: 340, tag: "Farm Fresh", img: pick(2), category: "Dairy & Eggs", brand: "Local Farm", inStock: true },
  { id: "p4", name: "Roma Tomatoes", unit: "500 g", price: 1.29, old: 1.79, rating: 4.6, reviews: 88, tag: "Fresh", img: pick(3), category: "Vegetables", brand: "Local Farm", inStock: true },
  { id: "p5", name: "Sourdough Bread", unit: "400 g", price: 3.99, old: null, rating: 4.8, reviews: 156, tag: "Artisan", img: pick(4), category: "Bakery", brand: "Barilla", inStock: true },
  { id: "p6", name: "Bananas", unit: "1 kg", price: 0.99, old: 1.29, rating: 4.5, reviews: 402, tag: "Deal", img: pick(5), category: "Fruits", brand: "Local Farm", inStock: true },
  { id: "p7", name: "Baby Spinach", unit: "200 g", price: 2.19, old: 2.79, rating: 4.7, reviews: 65, tag: "Organic", img: pick(6), category: "Vegetables", brand: "Local Farm", inStock: true },
  { id: "p8", name: "Cheddar Cheese", unit: "250 g", price: 5.49, old: 6.99, rating: 4.9, reviews: 178, tag: "Premium", img: pick(7), category: "Dairy & Eggs", brand: "Kraft", inStock: true },
  { id: "p9", name: "Chicken Breast", unit: "500 g", price: 6.99, old: 8.49, rating: 4.6, reviews: 92, tag: "Fresh", img: pick(8), category: "Meat", brand: "Local Farm", inStock: true },
  { id: "p10", name: "Atlantic Salmon", unit: "300 g", price: 11.99, old: 14.99, rating: 4.8, reviews: 54, tag: "Wild-caught", img: pick(9), category: "Seafood", brand: "Local Farm", inStock: true },
  { id: "p11", name: "Chocolate Cookies", unit: "300 g", price: 3.49, old: 4.29, rating: 4.5, reviews: 220, tag: "Snack", img: pick(10), category: "Snacks", brand: "Kellogg's", inStock: true },
  { id: "p12", name: "Cola 6-Pack", unit: "6 x 330ml", price: 5.99, old: 7.49, rating: 4.6, reviews: 310, tag: "Combo", img: pick(11), category: "Beverages", brand: "Coca-Cola", inStock: true },
  { id: "p13", name: "Ground Coffee", unit: "250 g", price: 8.49, old: null, rating: 4.7, reviews: 145, tag: "Arabica", img: pick(12), category: "Beverages", brand: "Nestlé", inStock: true },
  { id: "p14", name: "Red Apples", unit: "1 kg", price: 2.29, old: 2.99, rating: 4.7, reviews: 189, tag: "Crisp", img: pick(13), category: "Fruits", brand: "Local Farm", inStock: true },
  { id: "p15", name: "Carrots", unit: "1 kg", price: 1.19, old: null, rating: 4.6, reviews: 74, tag: "Fresh", img: pick(14), category: "Vegetables", brand: "Local Farm", inStock: true },
  { id: "p16", name: "Croissants", unit: "4 pcs", price: 4.49, old: 5.49, rating: 4.8, reviews: 98, tag: "Butter", img: pick(15), category: "Bakery", brand: "Barilla", inStock: true },
  { id: "p17", name: "Ketchup", unit: "500 g", price: 2.99, old: 3.49, rating: 4.5, reviews: 132, tag: "Classic", img: pick(16), category: "Snacks", brand: "Heinz", inStock: true },
  { id: "p18", name: "Yogurt Cups", unit: "4 x 125g", price: 3.29, old: 3.99, rating: 4.7, reviews: 210, tag: "Probiotic", img: pick(17), category: "Dairy & Eggs", brand: "Danone", inStock: true },
  { id: "p19", name: "Rice 5kg", unit: "5 kg", price: 9.99, old: 12.49, rating: 4.6, reviews: 88, tag: "Basmati", img: pick(18), category: "Snacks", brand: "Barilla", inStock: false },
  { id: "p20", name: "Cornflakes", unit: "500 g", price: 4.99, old: null, rating: 4.5, reviews: 156, tag: "Breakfast", img: pick(19), category: "Snacks", brand: "Kellogg's", inStock: true },
  { id: "p21", name: "Oranges", unit: "1 kg", price: 2.49, old: 2.99, rating: 4.7, reviews: 112, tag: "Juicy", img: pick(20), category: "Fruits", brand: "Local Farm", inStock: true },
  { id: "p22", name: "Broccoli", unit: "500 g", price: 1.89, old: null, rating: 4.6, reviews: 66, tag: "Fresh", img: pick(21), category: "Vegetables", brand: "Local Farm", inStock: true },
  { id: "p23", name: "Ground Beef", unit: "500 g", price: 7.49, old: 8.99, rating: 4.5, reviews: 74, tag: "Lean", img: pick(22), category: "Meat", brand: "Local Farm", inStock: true },
  { id: "p24", name: "Shrimp", unit: "400 g", price: 12.99, old: null, rating: 4.7, reviews: 42, tag: "Frozen", img: pick(23), category: "Seafood", brand: "Local Farm", inStock: true },
];
