'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

export default function DashboardPage() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [profile, setProfile] = useState<any>(null);
  const [purchases, setPurchases] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState('overview');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const uid = localStorage.getItem('firebase_uid');
    if (!uid) {
      router.push('/auth');
      return;
    }

    // Load profile
    fetch(`/api/profile/${uid}`)
      .then(res => res.json())
      .then(data => setProfile(data))
      .catch(console.error);

    // Load purchases from API
    fetch(`/api/profile/${uid}/purchases`)
      .then(res => res.json())
      .then(data => {
        const apiPurchases = data.purchases || [];
        // Merge with local purchases
        const localPurchases = JSON.parse(localStorage.getItem(`osian_purchases_${uid}`) || '[]');
        const merged = [
          ...apiPurchases,
           ...localPurchases.filter((lp: any) => !apiPurchases.some((ap: any) => ap.course_id === lp.course_id))
        ];
        setPurchases(merged);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [router]);

  const handleSignOut = () => {
    localStorage.removeItem('firebase_uid');
    localStorage.removeItem('firebase_id_token');
    router.push('/');
  };

  if (loading) {
    return <div className="loading">Loading dashboard...</div>;
  }

  return (
    <div className="dashboard-page">
      <div className="dashboard-container">
        <div className="dashboard-header">
          <h1>Dashboard</h1>
          <button className="btn btn-secondary" onClick={handleSignOut}>Sign Out</button>
        </div>

        <div className="dashboard-tabs">
          <button
            className={`tab-btn ${activeTab === 'overview' ? 'active' : ''}`}
            onClick={() => setActiveTab('overview')}
          >
            Overview
          </button>
          <button
            className={`tab-btn ${activeTab === 'courses' ? 'active' : ''}`}
            onClick={() => setActiveTab('courses')}
          >
            My Courses
          </button>
          <button
            className={`tab-btn ${activeTab === 'settings' ? 'active' : ''}`}
            onClick={() => setActiveTab('settings')}
          >
            Settings
          </button>
        </div>

        <div className="dashboard-content">
          {/* Overview Tab */}
          {activeTab === 'overview' && (
            <div className="tab-content">
              <h2>Welcome to Your Dashboard</h2>
              <div className="overview-stats">
                <div className="stat-card">
                  <span className="stat-label">Courses Enrolled</span>
                  <span className="stat-value">{purchases.length}</span>
                </div>
              </div>
            </div>
          )}

          {/* Courses Tab */}
          {activeTab === 'courses' && (
            <div className="tab-content">
              <h2>My Courses</h2>
              {purchases.length === 0 ? (
                <div className="empty-state">
                  <p>You haven't enrolled in any courses yet.</p>
                  <a href="/courses" className="btn btn-primary">Browse Courses</a>
                </div>
              ) : (
                <div className="purchased-courses-grid">
                  {purchases.map((purchase) => (
                    <div key={purchase.course_id} className="purchased-course-card">
                      <h3>{purchase.course_title}</h3>
                      <p className="purchase-date">
                        Enrolled: {new Date(purchase.purchase_date).toLocaleDateString()}
                      </p>
                      <button className="btn btn-small">View Course</button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Settings Tab */}
          {activeTab === 'settings' && (
            <div className="tab-content">
              <h2>Profile Settings</h2>
              {profile ? (
                <div className="profile-info">
                  <p><strong>Name:</strong> {profile.name}</p>
                  <p><strong>Email:</strong> {profile.email}</p>
                  <p><strong>Nationality:</strong> {profile.nationality}</p>
                  <p><strong>City:</strong> {profile.city}</p>
                </div>
              ) : (
                <p>Complete your profile to see details here.</p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
