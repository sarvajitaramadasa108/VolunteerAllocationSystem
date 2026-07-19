import "./globals.css";

export const metadata = {
  title: "Volunteer Allocation System",
  description: "Volunteer allocation and lookup backed by Supabase."
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
