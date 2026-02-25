import { initializeApp } from "https://www.gstatic.com/firebasejs/12.9.0/firebase-app.js";
import { getFirestore, collection, doc, getDocs, addDoc, getDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/12.9.0/firebase-firestore.js";

const app = initializeApp({
  apiKey: "AIzaSyCGU14FHH82Ja5Bx9ZE3ImlePoyKvZLdYg",
  authDomain: "ggs-global.firebaseapp.com",
  projectId: "ggs-global",
  storageBucket: "ggs-global.firebasestorage.app",
  messagingSenderId: "688407888100",
  appId: "1:688407888100:web:a9f3e068ca9624e3b66cf1"
});
const db = getFirestore(app);

// ── LOAD PRODUCTS FROM FIREBASE ──
async function loadFromFirebase() {
  try {
    const snap = await getDocs(collection(db, 'products'));
    const fbProds = snap.docs.map(d => ({ firestoreId: d.id, ...d.data() }));

    if (fbProds.length === 0) {
      // No products in Firebase yet — use defaults and render
      renderCatalog();
      return;
    }

    // Sort by sortOrder
    fbProds.sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0));

    // Separate into tech and fashion, only active products
    window.allProducts = {
      tech: fbProds.filter(p => p.category === 'tech' && p.active !== false),
      fashion: fbProds.filter(p => p.category === 'fashion' && p.active !== false)
    };

    // Re-render catalog with live Firebase data
    renderCatalog();

    // Load settings (announcement bar, slots, etc.)
    loadSiteSettings();

  } catch (e) {
    console.warn('Firebase load failed, using defaults:', e.message);
    renderCatalog();
  }
}

// ── LOAD SITE SETTINGS ──
async function loadSiteSettings() {
  try {
    const snap = await getDoc(doc(db, 'settings', 'site-config'));
    if (!snap.exists()) return;
    const s = snap.data();

    // Update announcement bar
    if (s.announcementText) {
      const annBar = document.querySelector('.ann-bar span');
      if (annBar) annBar.textContent = s.announcementText;
    }

    // Update slots
    if (s.urgencySlots) {
      const { total, remaining } = s.urgencySlots;
      const slotsText = document.getElementById('slotsText');
      const slotsFill = document.getElementById('slotsFill');
      if (slotsText) slotsText.textContent = `${total - remaining} of ${total} slots · ${remaining} remaining`;
      if (slotsFill) slotsFill.style.width = `${Math.round(((total - remaining) / total) * 100)}%`;
    }

    // Update countdown deadline
    if (s.countdownDeadline?.toDate) {
      window._ggsDeadline = s.countdownDeadline.toDate();
    }

    // Update maintenance mode
    if (s.maintenanceMode === true) {
      document.body.innerHTML = '<div style="display:flex;align-items:center;justify-content:center;min-height:100vh;background:#08090C;color:#F5B945;font-family:sans-serif;text-align:center;padding:40px"><div><div style="font-size:3rem;margin-bottom:20px">🔧</div><h1 style="font-size:2rem;margin-bottom:12px">Site Under Maintenance</h1><p style="color:#8C8898">We are making some updates. Back shortly!</p></div></div>';
    }

  } catch (e) {
    console.warn('Settings load failed:', e.message);
  }
}

// ── SAVE ORDER TO FIREBASE ──
window.saveOrderToFirebase = async function(r, first, last, email, phone, state, addr, ref, shippingMethod, totalPaid, txRef) {
  try {
    const isRivers = state.toLowerCase().includes('rivers');
    await addDoc(collection(db, 'orders'), {
      txRef: txRef,
      flwId: r.transaction_id || null,
      status: 'paid',
      orderStatus: 'processing',
      customer: { firstName: first, lastName: last, email, phone, state, address: addr },
      items: window.cart?.map(i => ({ id: i.id, name: i.name, icon: i.icon, price: i.price, qty: i.qty, variant: i.variant })) || [],
      totalPaid,
      shippingMethod,
      deliveryFee: isRivers ? 'Free (Port Harcourt)' : '₦5,000',
      referralCode: ref || 'none',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });
    console.log('✅ Order saved to Firebase');
  } catch (e) {
    console.warn('Order save failed (non-critical):', e.message);
    // Not critical — Flutterwave already processed payment
  }
}

// ── START ──
loadFromFirebase();

----------------------------------------------------------------

================================================================
FIRESTORE SECURITY RULES — PASTE INTO FIREBASE CONSOLE
================================================================
Go to: Firebase Console → Firestore Database → Rules tab
Delete everything there and paste this:

rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    // Products: anyone can read, only admin can write
    match /products/{id} {
      allow read: if true;
      allow write: if request.auth != null
        && request.auth.token.email == 'ggsglobalconsult@gmail.com';
    }

    // Orders: storefront can create, only admin can read/update
    match /orders/{id} {
      allow create: if true;
      allow read, update, delete: if request.auth != null
        && request.auth.token.email == 'ggsglobalconsult@gmail.com';
    }

    // Settings: anyone can read, only admin can write
    match /settings/{id} {
      allow read: if true;
      allow write: if request.auth != null
        && request.auth.token.email == 'ggsglobalconsult@gmail.com';
    }
  }
}
