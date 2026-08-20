

import { onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js';
import { auth } from './firebase-client.js';

(() => {
  const params = new URLSearchParams(window.location.search);
  const adminKey = params.get('admin');

  if (adminKey === 'Tintable@8140760999') {
    const adminBox = document.getElementById('admin-bypass-container');
    const adminBtn = document.getElementById('admin-free-checkout-btn');
    const adminStatus = document.getElementById('admin-bypass-status');

    if (adminBox) adminBox.style.display = 'block';

    const pathParts = window.location.pathname.split('/').filter(Boolean);
    const courseId = pathParts[1] || '1';

    onAuthStateChanged(auth, async (user) => {
      if (!user) {
        // User NOT signed in - Admin bypass is locked until signin
        if (adminBtn) {
          adminBtn.textContent = '🔒 Sign In Required for Admin Bypass';
          adminBtn.style.background = '#64748b';
          adminBtn.style.borderColor = '#64748b';
        }
        if (adminStatus) {
          adminStatus.style.color = '#dc2626';
          adminStatus.textContent = 'You must be signed in to an account to use admin bypass.';
        }
        return;
      }

      // User is signed in - Check if already purchased
      if (adminBtn) {
        adminBtn.textContent = 'Checking enrollment status...';
        adminBtn.disabled = true;
      }

      try {
        const idToken = await user.getIdToken();
        const checkRes = await fetch('/api/profile/' + encodeURIComponent(user.uid) + '/purchased/' + encodeURIComponent(courseId), {
          headers: { 'Authorization': 'Bearer ' + idToken }
        });
        const checkData = checkRes.ok ? await checkRes.json() : {};

        if (checkData.purchased) {
          if (adminBtn) {
            adminBtn.textContent = '✅ Already Enrolled (No Duplicate Purchase)';
            adminBtn.disabled = true;
            adminBtn.style.background = '#16a34a';
            adminBtn.style.borderColor = '#16a34a';
          }
          if (adminStatus) {
            adminStatus.style.color = '#16a34a';
            adminStatus.textContent = 'You already own this course on student account (' + (user.email || user.uid) + ').';
          }
          return;
        }

        // Ready for admin bypass
        if (adminBtn) {
          adminBtn.textContent = '⚡ Enroll for Free (Admin Bypass)';
          adminBtn.disabled = false;
          adminBtn.style.background = '#ea580c';
          adminBtn.style.borderColor = '#ea580c';
        }
        if (adminStatus) {
          adminStatus.style.color = '#ea580c';
          adminStatus.textContent = 'Signed in as: ' + (user.email || user.uid);
        }
      } catch (_e) {
        if (adminBtn) {
          adminBtn.textContent = '⚡ Enroll for Free (Admin Bypass)';
          adminBtn.disabled = false;
        }
      }
    });

    if (adminBtn) {
      adminBtn.addEventListener('click', async () => {
        const user = auth.currentUser;
        if (!user) {
          alert('Admin bypass requires being signed in to your account. Redirecting to sign in...');
          window.location.href = '/auth?mode=signin&redirect=' + encodeURIComponent(window.location.href);
          return;
        }

        adminBtn.disabled = true;
        adminBtn.textContent = 'Enrolling & Syncing to Chamilo...';
        if (adminStatus) {
          adminStatus.style.color = '#ea580c';
          adminStatus.textContent = 'Recording purchase and syncing to Chamilo LMS...';
        }

        try {
          const idToken = await user.getIdToken();

          const res = await fetch('/courses/' + courseId + '/checkout/admin-bypass', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': 'Bearer ' + idToken,
            },
            body: JSON.stringify({ adminSecret: 'Tintable@8140760999' }),
          });

          const data = await res.json();

          if (!res.ok) {
            if (adminStatus) {
              adminStatus.style.color = '#dc2626';
              adminStatus.textContent = data.error || 'Admin checkout failed.';
            }
            alert(data.error || 'Admin checkout failed.');
            adminBtn.disabled = false;
            adminBtn.textContent = '⚡ Enroll for Free (Admin Bypass)';
            return;
          }

          if (adminStatus) {
            adminStatus.style.color = '#16a34a';
            adminStatus.textContent = '✅ ' + data.message;
          }
          alert('✅ Admin Test Enrollment Successful! Synced to Chamilo LMS. Opening dashboard...');
          window.location.href = '/dashboard';
        } catch (err) {
          if (adminStatus) {
            adminStatus.style.color = '#dc2626';
            adminStatus.textContent = err.message;
          }
          adminBtn.disabled = false;
          adminBtn.textContent = '⚡ Enroll for Free (Admin Bypass)';
        }
      });
    }
  }
})();
