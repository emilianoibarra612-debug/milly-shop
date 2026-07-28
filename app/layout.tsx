import type { Metadata } from "next";
import "./styles.css";
import "./owner.css";

export const metadata: Metadata = { title: "FOREVERREPENT.STORE", description: "Premium digital essentials." };
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
