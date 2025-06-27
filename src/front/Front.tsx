// src/pages/LandingPage.tsx
import React from 'react';
import { Link } from 'react-router-dom';

const Front: React.FC = () => {
  const styles = {
    page: {
      fontFamily: 'Arial, sans-serif',
      background: 'linear-gradient(to bottom right, #e0f2ff, #ffffff)',
      minHeight: '100vh',
      display: 'flex',
      flexDirection: 'column' as const,
    },
    header: {
      backgroundColor: '#2196f3',
      color: '#fff',
      padding: '1rem 2rem',
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
    },
    title: {
      fontSize: '1.5rem',
      fontWeight: 'bold',
    },
    button: {
      backgroundColor: '#fff',
      color: '#2196f3',
      padding: '0.5rem 1.2rem',
      borderRadius: '9999px',
      fontWeight: 'bold',
      textDecoration: 'none',
      boxShadow: '0 2px 6px rgba(0,0,0,0.2)',
    },
    hero: {
      textAlign: 'center' as const,
      padding: '4rem 1rem 2rem',
    },
    heroTitle: {
      fontSize: '2.5rem',
      fontWeight: 'bold',
      color: '#333',
      marginBottom: '1rem',
    },
    heroDesc: {
      fontSize: '1.2rem',
      color: '#666',
      marginBottom: '2rem',
    },
    screenshot: {
      maxWidth: '90%',
      maxHeight: '500px',
      borderRadius: '20px',
      boxShadow: '0 10px 25px rgba(0,0,0,0.1)',
      margin: '2rem auto',
      display: 'block',
    },
    features: {
      display: 'flex',
      justifyContent: 'space-around',
      flexWrap: 'wrap' as const,
      gap: '1.5rem',
      padding: '2rem',
    },
    card: {
      backgroundColor: '#fff',
      borderRadius: '12px',
      padding: '1.5rem',
      boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
      flex: '1 1 250px',
      maxWidth: '300px',
    },
    footer: {
      textAlign: 'center' as const,
      padding: '3rem 1rem',
      backgroundColor: '#f0f8ff',
    },
  };

  return (
    <div style={styles.page}>
      <header style={styles.header}>
        <div style={styles.title}>My App</div>
        <Link to="/app" style={styles.button}>今すぐ始める</Link>
      </header>

      <section style={styles.hero}>
        <h2 style={styles.heroTitle}>限界を超えるカレンダー共有体験</h2>
        <p style={styles.heroDesc}>Self・Friends・World で予定をつなげる。</p>
        <Link to="/login" style={{ ...styles.button, backgroundColor: '#2196f3', color: '#fff' }}>
          今すぐ始める（無料）
        </Link>
      </section>

      <img src="/loo.png" alt="アプリのスクリーンショット" style={styles.screenshot} />

      <section style={styles.features}>
        {[
          { title: 'Self', desc: '自分だけの時間割ビュー。毎日の習慣を見える化。' },
          { title: 'Friends', desc: '友達の予定をフィード形式でチェック・応援。' },
          { title: 'World', desc: '世界中のスケジュールをカード形式で共有・共感。' },
        ].map(({ title, desc }) => (
          <div key={title} style={styles.card}>
            <h3 style={{ fontSize: '1.2rem', fontWeight: 'bold', color: '#2196f3', marginBottom: '0.5rem' }}>{title}</h3>
            <p style={{ color: '#555' }}>{desc}</p>
          </div>
        ))}
      </section>

      <footer style={styles.footer}>
        <h4 style={{ fontSize: '1.8rem', fontWeight: 'bold', marginBottom: '1rem' }}>あなたの予定で世界を変えよう</h4>
        <Link to="/app" style={{ ...styles.button, backgroundColor: '#2196f3', color: '#fff', padding: '1rem 2rem' }}>
          今すぐ始める
        </Link>
      </footer>
    </div>
  );
};

export default Front;

