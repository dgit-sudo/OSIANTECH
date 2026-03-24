'use client';

import React from 'react';

export default function AuthPage() {
  return (
    <div className="auth-container">
      <div className="auth-card">
        <div className="auth-tabs">
          <button className="auth-tab active" data-mode="signin">Sign In</button>
          <button className="auth-tab" data-mode="signup">Sign Up</button>
        </div>

        {/* Sign In Form */}
        <div id="signin-form" className="auth-form active">
          <h2>Welcome Back</h2>
          <form id="signin-email-form">
            <input type="email" placeholder="Email" required className="form-input" />
            <input type="password" placeholder="Password" required className="form-input" />
            <button type="submit" className="btn btn-primary">Sign In</button>
          </form>
          <div className="divider">OR</div>
          <button className="btn btn-google" id="signin-google">
            Sign In with Google
          </button>
        </div>

        {/* Sign Up Form */}
        <div id="signup-form" className="auth-form">
          <h2>Create Account</h2>
          <form id="signup-email-form">
            <input type="email" placeholder="Email" required className="form-input" />
            <input type="password" placeholder="Password" required className="form-input" />
            <input type="password" placeholder="Confirm Password" required className="form-input" />
            <button type="submit" className="btn btn-primary">Sign Up</button>
          </form>
          <div className="divider">OR</div>
          <button className="btn btn-google" id="signup-google">
            Sign Up with Google
          </button>
        </div>
      </div>
    </div>
  );
}
