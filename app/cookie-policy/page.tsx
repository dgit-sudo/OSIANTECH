import React from 'react';

export default function CookiePolicyPage() {
  return (
    <div className="cookie-policy-page static-page">
      <h1>Cookie Policy</h1>
      <p>Last updated: {new Date().toLocaleDateString()}</p>
      <h2>1. What Are Cookies?</h2>
      <p>
        Cookies are small text files stored on your device that help us provide a better experience.
      </p>
      <h2>2. Types of Cookies We Use</h2>
      <ul>
        <li><strong>Essential Cookies:</strong> Required for site functionality</li>
        <li><strong>Analytics Cookies:</strong> Help us understand user behavior</li>
        <li><strong>Preference Cookies:</strong> Remember your settings</li>
      </ul>
      <h2>3. Managing Cookies</h2>
      <p>You can control cookies through your browser settings.</p>
    </div>
  );
}
