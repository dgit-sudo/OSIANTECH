'use client';

import React, { useState, useEffect } from 'react';

export default function CoursesPage() {
  const [courses, setCourses] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    fetch('/api/courses')
      .then(res => res.json())
      .then(data => setCourses(Array.isArray(data) ? data : data.courses || []))
      .catch(err => console.error('Failed to load courses:', err));
  }, []);

  const filtered = courses.filter(course =>
    course.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (course?.description && course.description.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  return (
    <div className="courses-page">
      <div className="courses-header">
        <h1>Our Courses</h1>
        <input
          type="search"
          placeholder="Search courses..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="search-input"
        />
      </div>

      <div className="courses-grid">
        {filtered.map((course) => (
          <a key={course.id} href={`/courses/${course.id}`} className="course-card">
            <img
              src={`/course-images/${course.slug || course.id}.svg`}
              alt={course.title}
              className="course-image"
              onError={(e) => { (e.target as any).src = '/images/placeholder.svg'; }}
            />
            <h3>{course.title}</h3>
            <p>{course.description?.substring(0, 100)}...</p>
            <div className="course-footer">
              <span className="price">₹{course.price}</span>
              <button className="btn btn-small">View Details</button>
            </div>
          </a>
        ))}
      </div>

      {filtered.length === 0 && (
        <div className="empty-state">
          <p>No courses found. Try adjusting your search.</p>
        </div>
      )}
    </div>
  );
}
