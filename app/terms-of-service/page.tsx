import React from 'react';

export default function TermsOfServicePage() {
  return (
    <div className="terms-of-service-page static-page">
      <h1>Terms of Service</h1>
      <p>Last updated: {new Date().toLocaleDateString()}</p>
      <h2>1. Acceptance of Terms</h2>
      <p>By accessing OSIANTECH, you agree to comply with these Terms of Service.</p>
      <h2>2. User Responsibilities</h2>
      <p>You are responsible for:</p>
      <ul>
        <li>Maintaining the confidentiality of your account</li>
        <li>Providing accurate information</li>
        <li>Complying with all applicable laws</li>
      </ul>
      <h2>3. Course Content</h2>
      <p>
        All course content is provided "as-is". We reserve the right to modify or update courses at any time.
      </p>
    </div>
  );
}
