window.ANTARMANA_SITE_CONFIG = {
  // Leave blank to keep orders in browser storage.
  // Add your backend URL later if you want a custom API.
  orderApiBaseUrl: "",
  orderPollIntervalMs: 15000,
  // Firestore mode is optional. If Firebase is unavailable or Firestore
  // isn't enabled yet, the website falls back to browser storage automatically.
  firebase: {
    enabled: true,
    firestoreCollection: "orders",
    config: {
      apiKey: "AIzaSyCEw5L84gudjjEA0507sRRa-LaHngx3dNs",
      authDomain: "antarmana-sweets-and-snacks.firebaseapp.com",
      projectId: "antarmana-sweets-and-snacks",
      storageBucket: "antarmana-sweets-and-snacks.firebasestorage.app",
      messagingSenderId: "549999071461",
      appId: "1:549999071461:web:dd646c228b55567dafc40c",
      measurementId: "G-BY4WNTT8MC"
    }
  }
};
