import type { Metadata } from 'next';
import React from 'react';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'OSIANTECH - Premium Online Courses',
  description: 'Learn professional skills with OSIANTECH',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <link rel="stylesheet" href="/css/style.css" />
        <script async src="https://www.googletagmanager.com/gtag/js?id=G-XXXXXXXXXX"></script>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              window.dataLayer = window.dataLayer || [];
              function gtag(){dataLayer.push(arguments);}
              gtag('js', new Date());
              gtag('config', 'G-XXXXXXXXXX');
            `,
          }}
        />
      </head>
      <body>
        <nav className="navbar">
          <div className="navbar-container">
            <Link href="/" className="navbar-logo">OSIANTECH</Link>
            <ul className="nav-menu">
              <li><Link href="/courses">Courses</Link></li>
              <li><Link href="/about">About</Link></li>
              <li><Link href="/contact">Contact</Link></li>
              <li><Link href="/auth">Sign In</Link></li>
              <li><Link href="/dashboard">Dashboard</Link></li>
            </ul>
          </div>
        </nav>
        <main>{children}</main>
        <footer className="footer">
          <div className="footer-container">
            <div className="footer-section">
              <h4>OSIANTECH</h4>
              <p>Premium online education platform</p>
            </div>
            <div className="footer-section">
              <h4>Quick Links</h4>
              <ul>
                <li><Link href="/about">About Us</Link></li>
                <li><Link href="/courses">Courses</Link></li>
                <li><Link href="/contact">Contact</Link></li>
              </ul>
            </div>
            <div className="footer-section">
              <h4>Legal</h4>
              <ul>
                <li><Link href="/privacy-policy">Privacy Policy</Link></li>
                <li><Link href="/terms-of-service">Terms of Service</Link></li>
                <li><Link href="/cookie-policy">Cookie Policy</Link></li>
              </ul>
            </div>
          </div>
          <div className="footer-bottom">
            <p>&copy; 2024 OSIANTECH. All rights reserved.</p>
          </div>
        </footer>
        <script src="/js/firebase-client.js"></script>
        <script src="/js/main.js"></script>
      </body>
    </html>
  );
}
