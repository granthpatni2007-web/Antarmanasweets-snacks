(function bootstrapOrderStore() {
  const fallbackStorageKey = "Antarmana-orders";
  const defaultPollIntervalMs = 15000;
  const siteConfig = window.ANTARMANA_SITE_CONFIG || {};
  const normalizedBaseUrl =
    typeof siteConfig.orderApiBaseUrl === "string"
      ? siteConfig.orderApiBaseUrl.trim().replace(/\/+$/, "")
      : "";
  const configuredPollInterval = Number(siteConfig.orderPollIntervalMs);
  const configuredFirebase =
    siteConfig.firebase && typeof siteConfig.firebase === "object"
      ? siteConfig.firebase
      : {};

  const config = {
    orderApiBaseUrl: normalizedBaseUrl,
    orderPollIntervalMs:
      Number.isFinite(configuredPollInterval) && configuredPollInterval > 0
        ? configuredPollInterval
        : defaultPollIntervalMs,
    firebase: {
      enabled: Boolean(configuredFirebase.enabled),
      firestoreCollection:
        typeof configuredFirebase.firestoreCollection === "string" &&
        configuredFirebase.firestoreCollection.trim()
          ? configuredFirebase.firestoreCollection.trim()
          : "orders",
      config:
        configuredFirebase.config && typeof configuredFirebase.config === "object"
          ? configuredFirebase.config
          : null
    }
  };

  let firestoreContextPromise = null;

  function hasApiMode() {
    return Boolean(config.orderApiBaseUrl);
  }

  function hasFirestoreMode() {
    const firebaseConfig = config.firebase.config || {};
    return (
      config.firebase.enabled &&
      typeof window.firebase !== "undefined" &&
      Boolean(firebaseConfig.apiKey) &&
      Boolean(firebaseConfig.projectId)
    );
  }

  function getMode() {
    if (hasFirestoreMode()) {
      return "firestore";
    }

    if (hasApiMode()) {
      return "api";
    }

    return "local";
  }

  function isRemoteMode() {
    return getMode() !== "local";
  }

  function getPollIntervalMs() {
    return config.orderPollIntervalMs;
  }

  function normalizeOrders(orders) {
    if (!Array.isArray(orders)) {
      return [];
    }

    return orders
      .filter((order) => order && typeof order === "object" && !Array.isArray(order))
      .map((order) => ({ ...order }));
  }

  function cloneValue(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function dispatchLocalOrdersChanged(orders) {
    window.dispatchEvent(
      new CustomEvent("antarmana-orders-changed", {
        detail: {
          orders: cloneValue(orders)
        }
      })
    );
  }

  function loadLocalOrders() {
    try {
      const savedValue = window.localStorage.getItem(fallbackStorageKey);
      return normalizeOrders(savedValue ? JSON.parse(savedValue) : []);
    } catch {
      return [];
    }
  }

  function saveLocalOrders(orders) {
    const normalizedOrders = sortOrders(normalizeOrders(orders));
    window.localStorage.setItem(fallbackStorageKey, JSON.stringify(normalizedOrders));
    dispatchLocalOrdersChanged(normalizedOrders);
    return normalizedOrders;
  }

  function sortOrders(orders) {
    return [...normalizeOrders(orders)].sort((left, right) => {
      const rightTime = Date.parse(right.placedAt || "") || 0;
      const leftTime = Date.parse(left.placedAt || "") || 0;
      return rightTime - leftTime;
    });
  }

  async function request(path, options = {}) {
    const endpoint = `${config.orderApiBaseUrl}${path.startsWith("/") ? path : `/${path}`}`;
    const headers = {
      Accept: "application/json"
    };

    if (options.ownerToken) {
      headers["X-Owner-Token"] = options.ownerToken;
    }

    if (options.body !== undefined) {
      headers["Content-Type"] = "application/json";
    }

    const response = await window.fetch(endpoint, {
      method: options.method || "GET",
      headers,
      body: options.body === undefined ? undefined : JSON.stringify(options.body)
    });
    const contentType = response.headers.get("content-type") || "";
    const payload = contentType.includes("application/json")
      ? await response.json().catch(() => null)
      : await response.text().catch(() => "");

    if (!response.ok) {
      const error = new Error(
        (payload && payload.error) ||
          (typeof payload === "string" && payload) ||
          `Request failed with status ${response.status}`
      );
      error.status = response.status;
      error.payload = payload;
      throw error;
    }

    return payload;
  }

  function extractOrders(payload) {
    if (Array.isArray(payload)) {
      return sortOrders(payload);
    }

    if (payload && Array.isArray(payload.orders)) {
      return sortOrders(payload.orders);
    }

    return [];
  }

  function extractOrder(payload) {
    if (payload && payload.order && typeof payload.order === "object") {
      return { ...payload.order };
    }

    if (payload && typeof payload === "object" && !Array.isArray(payload)) {
      return { ...payload };
    }

    return null;
  }

  function getNormalizedFirestoreDoc(doc) {
    const rawData = doc.data() || {};
    return {
      id: rawData.id || doc.id,
      ...rawData
    };
  }

  async function getFirestoreContext() {
    if (!hasFirestoreMode()) {
      return null;
    }

    if (!firestoreContextPromise) {
      firestoreContextPromise = Promise.resolve().then(() => {
        try {
          const existingApp =
            window.firebase.apps && window.firebase.apps.length
              ? window.firebase.app()
              : window.firebase.initializeApp(config.firebase.config);
          const firestore = window.firebase.firestore(existingApp);

          return {
            app: existingApp,
            firestore,
            collectionName: config.firebase.firestoreCollection
          };
        } catch (error) {
          console.error("Unable to initialize Firestore. Falling back to local storage.", error);
          return null;
        }
      });
    }

    return firestoreContextPromise;
  }

  async function listFirestoreOrders() {
    const firestoreContext = await getFirestoreContext();
    if (!firestoreContext) {
      return loadLocalOrders();
    }

    try {
      const snapshot = await firestoreContext.firestore
        .collection(firestoreContext.collectionName)
        .get();
      return sortOrders(snapshot.docs.map(getNormalizedFirestoreDoc));
    } catch (error) {
      console.error("Unable to load Firestore orders. Falling back to local storage.", error);
      return loadLocalOrders();
    }
  }

  async function createFirestoreOrder(order) {
    const firestoreContext = await getFirestoreContext();
    if (!firestoreContext) {
      const nextOrders = [order, ...loadLocalOrders()];
      saveLocalOrders(nextOrders);
      return { ...order };
    }

    const nextOrder = { ...order };
    const collection = firestoreContext.firestore.collection(firestoreContext.collectionName);
    const docId = String(nextOrder.id || collection.doc().id).trim();
    nextOrder.id = docId;

    try {
      await collection.doc(docId).set(nextOrder);
      return { ...nextOrder };
    } catch (error) {
      console.error("Unable to save Firestore order. Falling back to local storage.", error);
      const nextOrders = [nextOrder, ...loadLocalOrders()];
      saveLocalOrders(nextOrders);
      return { ...nextOrder };
    }
  }

  async function replaceFirestoreOrders(orders) {
    const firestoreContext = await getFirestoreContext();
    const normalizedOrders = sortOrders(orders);

    if (!firestoreContext) {
      return saveLocalOrders(normalizedOrders);
    }

    try {
      const collection = firestoreContext.firestore.collection(firestoreContext.collectionName);
      const snapshot = await collection.get();
      const batch = firestoreContext.firestore.batch();

      snapshot.docs.forEach((doc) => {
        batch.delete(doc.ref);
      });

      normalizedOrders.forEach((order) => {
        const nextOrder = { ...order };
        const docId = String(nextOrder.id || collection.doc().id).trim();
        nextOrder.id = docId;
        batch.set(collection.doc(docId), nextOrder);
      });

      await batch.commit();
      return normalizedOrders;
    } catch (error) {
      console.error("Unable to replace Firestore orders. Falling back to local storage.", error);
      return saveLocalOrders(normalizedOrders);
    }
  }

  async function listOrders(options = {}) {
    const mode = getMode();

    if (mode === "firestore") {
      return listFirestoreOrders(options);
    }

    if (mode === "local") {
      return loadLocalOrders();
    }

    const payload = await request("/orders", {
      ownerToken: options.ownerToken
    });
    return extractOrders(payload);
  }

  async function createOrder(order) {
    const mode = getMode();

    if (mode === "firestore") {
      return createFirestoreOrder(order);
    }

    if (mode === "local") {
      const nextOrders = [order, ...loadLocalOrders()];
      saveLocalOrders(nextOrders);
      return { ...order };
    }

    const payload = await request("/orders", {
      method: "POST",
      body: {
        order
      }
    });

    return extractOrder(payload) || { ...order };
  }

  async function replaceOrders(orders, options = {}) {
    const mode = getMode();

    if (mode === "firestore") {
      return replaceFirestoreOrders(orders, options);
    }

    if (mode === "local") {
      return saveLocalOrders(orders);
    }

    const payload = await request("/orders", {
      method: "PUT",
      ownerToken: options.ownerToken,
      body: {
        orders
      }
    });

    return extractOrders(payload);
  }

  window.antarmanaOrderStore = {
    storageKey: fallbackStorageKey,
    config,
    getMode,
    isRemoteMode,
    getPollIntervalMs,
    listOrders,
    createOrder,
    replaceOrders
  };
})();
