import "./globals.css";

export const metadata = {
  title: "Volunteer Allocation System",
  description: "Volunteer pre-registration, lookup, and allocation backed by Supabase."
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
