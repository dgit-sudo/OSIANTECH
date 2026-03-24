'use client';

import React, { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';

export default function CheckoutPage() {
  const params = useParams() as any;
  const router = useRouter();
  const courseId = params?.id || '';
  const [course, setCourse] = useState<any>(null);
  const [step, setStep] = useState('country'); // country, payment, confirmation
  const [selectedCountry, setSelectedCountry] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    fetch('/api/courses')
      .then(res => res.json())
      .then(data => {
        const courses = Array.isArray(data) ? data : data.courses || [];
         const found = courses.find((c: any) => c.id === Number(courseId));
        setCourse(found);
      });
  }, [courseId]);

  const handleCountrySelect = (country: string) => {
    setSelectedCountry(country);
  };

  const completeCheckout = async () => {
    setLoading(true);
    setError('');

    try {
      const uid = localStorage.getItem('firebase_uid');
      const idToken = localStorage.getItem('firebase_id_token');

      if (!uid || !idToken) {
        throw new Error('Please sign in first');
      }

      // Record purchase
      const response = await fetch(`/api/profile/${uid}/purchases`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${idToken}`,
        },
        body: JSON.stringify({
          course_id: Number(courseId),
          course_title: course.title,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to complete checkout');
      }

      // Save locally as backup
      const purchases = JSON.parse(localStorage.getItem(`osian_purchases_${uid}`) || '[]');
      purchases.push({
        course_id: courseId,
        course_title: course.title,
        purchase_date: new Date().toISOString(),
      });
      localStorage.setItem(`osian_purchases_${uid}`, JSON.stringify(purchases));

      setStep('confirmation');
      setTimeout(() => {
        router.push('/dashboard');
      }, 2000);
    } catch (err) {
      setError((err as any).message || 'An error occurred');
      // Save locally even if backend fails
      const uid = localStorage.getItem('firebase_uid');
      if (uid) {
        const purchases = JSON.parse(localStorage.getItem(`osian_purchases_${uid}`) || '[]');
        purchases.push({
          course_id: courseId,
          course_title: course.title,
          purchase_date: new Date().toISOString(),
        });
        localStorage.setItem(`osian_purchases_${uid}`, JSON.stringify(purchases));
      }
    } finally {
      setLoading(false);
    }
  };

  if (!course) {
    return <div className="loading">Loading...</div>;
  }

  return (
    <div className="checkout-page">
      <div className="checkout-container">
        <h1>Complete Your Purchase</h1>

        {error && <div className="error-message">{error}</div>}

        {step === 'country' && (
          <div className="checkout-step">
            <h2>Select Your Country</h2>
            <div className="country-grid">
              {['India', 'USA', 'UK', 'Canada', 'Australia'].map(country => (
                <button
                  key={country}
                  className={`country-btn ${selectedCountry === country ? 'selected' : ''}`}
                  onClick={() => handleCountrySelect(country)}
                >
                  {country}
                </button>
              ))}
            </div>
            <button
              className="btn btn-primary"
              onClick={() => setStep('payment')}
              disabled={!selectedCountry}
            >
              Continue
            </button>
          </div>
        )}

        {step === 'payment' && (
          <div className="checkout-step">
            <h2>Payment Details</h2>
            <div className="payment-summary">
              <h3>{course.title}</h3>
              <p className="price">₹{course.price}</p>
            </div>
            <button
              className="btn btn-primary"
              onClick={completeCheckout}
              disabled={loading}
            >
              {loading ? 'Processing...' : 'Complete Purchase'}
            </button>
          </div>
        )}

        {step === 'confirmation' && (
          <div className="checkout-step">
            <div className="success-message">
              <h2>✓ Purchase Successful!</h2>
              <p>You will be added to the course shortly.</p>
              <p>Redirecting to dashboard...</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
