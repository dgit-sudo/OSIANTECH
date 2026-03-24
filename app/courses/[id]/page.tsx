'use client';

import React, { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';

export default function CourseDetailPage() {
  const params = useParams() as Promise<{ id: string }> | { id: string };
  const courseId = (params as any).id || '';
  const [course, setCourse] = useState<any>(null);
  const [isEnrolled, setIsEnrolled] = useState(false);

  useEffect(() => {
    fetch('/api/courses')
      .then(res => res.json())
      .then(data => {
        const courses = Array.isArray(data) ? data : data.courses || [];
         const found = courses.find((c: any) => c.id === Number(courseId));
        setCourse(found);
      });
  }, [courseId]);

  useEffect(() => {
    const checkEnrollment = async () => {
      const uid = localStorage.getItem('firebase_uid');
      if (uid) {
        try {
          const res = await fetch(`/api/profile/${uid}/purchases/${courseId}`);
          const data = await res.json();
          setIsEnrolled(data.purchased);
        } catch (err) {
          console.error('Error checking enrollment:', err);
        }
      }
    };
    checkEnrollment();
  }, [courseId]);

  if (!course) {
    return <div className="loading">Loading course...</div>;
  }

  return (
    <div className="course-detail">
      <div className="course-hero">
        <img
          src={`/course-images/${course.slug || course.id}.svg`}
          alt={course.title}
          className="course-hero-image"
          onError={(e) => { (e.target as any).src = '/images/placeholder.svg'; }}
        />
      </div>

      <div className="course-content">
        <h1>{course.title}</h1>
        <p className="description">{course.description}</p>
        
        <div className="course-details">
          <div className="detail-item">
            <span className="label">Price:</span>
            <span className="value">₹{course.price}</span>
          </div>
          {course.category && (
            <div className="detail-item">
              <span className="label">Category:</span>
              <span className="value">{course.category}</span>
            </div>
          )}
        </div>

        <div className="course-actions">
          {isEnrolled ? (
            <button className="btn btn-disabled" disabled>Already Enrolled</button>
          ) : (
            <a href={`/courses/${courseId}/checkout`} className="btn btn-primary">
              Enroll Now
            </a>
          )}
        </div>
      </div>
    </div>
  );
}
