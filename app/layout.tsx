import type { Metadata } from "next";
import "./styles.css";
import "./product-art.css";
import "./order.css";
import "./owner.css";
import "./cart.css";
import "./owner-editor.css";
import "./mobile-login.css";
import "./features.css";
import "./dashboard.css";
import "./two-factor.css";
import "./activity-images.css";
import "./product-images-page.css";
// Reviews, promotions, analytics, owner activity, standalone product images, and 2FA release.
import { CartProvider } from "./cart";

export const metadata: Metadata = { title: "FOREVERREPENT.STORE", description: "Premium digital essentials." };
// Shared storefront shell, including checkout and private order pages.
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><head><link rel="preconnect" href="https://fonts.googleapis.com"/><link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous"/><link href="https://fonts.googleapis.com/css2?family=DM+Mono:wght@400;500&family=Manrope:wght@400;500;600;700;800&family=Playfair+Display:ital,wght@0,500;0,600;1,500;1,600&display=swap" rel="stylesheet"/></head><body><CartProvider>{children}</CartProvider></body></html>;
}
