import React from 'react';

export default function PrivacyPolicyPage() {
  return (
    <div className="privacy-policy-page static-page">
      <h1>Privacy Policy</h1>
      <p>Last updated: {new Date().toLocaleDateString()}</p>
      <h2>1. Introduction</h2>
      <p>
        OSIANTECH values your privacy. This Privacy Policy explains how we collect, use, and
        protect your personal information.
      </p>
      <h2>2. Information We Collect</h2>
      <p>We collect information you provide directly, such as:</p>
      <ul>
        <li>Email address</li>
        <li>Name and profile information</li>
        <li>Payment information (processed securely)</li>
      </ul>
      <h2>3. How We Use Your Information</h2>
      <p>We use your information to provide services, process payments, and improve our platform.</p>
    </div>
  );
}
