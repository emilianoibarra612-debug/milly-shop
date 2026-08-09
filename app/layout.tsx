import type { Metadata } from "next";
import "./styles.css";
import "./owner.css";
import "./cart.css";
import "./owner-editor.css";
import { CartProvider } from "./cart";

export const metadata: Metadata = { title: "FOREVERREPENT.STORE", description: "Premium digital essentials." };
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body><CartProvider>{children}</CartProvider></body></html>;
}
