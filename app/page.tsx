import React from 'react';

export default function Home() {
  return (
    <div className="home-page">
      <section className="hero">
        <h1>Build Your Future with OSIANTECH</h1>
        <p>Learn professional skills with industry experts</p>
        <button className="btn btn-primary">Explore Courses</button>
      </section>

      <section className="featured-courses">
        <h2>Featured Courses</h2>
        <div id="featured-carousel" className="course-grid">
          {/* Courses will be loaded here via JavaScript */}
        </div>
      </section>
    </div>
  );
}
