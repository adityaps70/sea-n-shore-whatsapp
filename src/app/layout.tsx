import type { Metadata } from "next";import "./globals.css";
export const metadata:Metadata={title:"La Shimti Hotel · Operations",description:"Property management, reservations, billing and hotel operations for La Shimti Hotel, Shillong."};
export default function RootLayout({children}:{children:React.ReactNode}){return <html lang="en"><body>{children}</body></html>}