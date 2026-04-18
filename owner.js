const ordersStorageKey = "Antarmana-orders";
const ordersResetKey = "sapna-patni-orders-reset-2026-04-17";
const ownerAccessSessionKey = "Antarmana-owner-access";
const ownerPasscodes = new Set(["owner123", "antarmana123"]);

const currency = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 0
});

const dateTimeFormatter = new Intl.DateTimeFormat("en-IN", {
  dateStyle: "medium",
  timeStyle: "short"
});

const statusLabels = {
  new: "New",
  preparing: "Preparing",
  dispatched: "Dispatched",
  completed: "Completed"
};

const sampleOrders = createSampleOrders();

const ownerLockScreen = document.getElementById("ownerLockScreen");
const ownerDashboardShell = document.getElementById("ownerDashboardShell");
const ownerUnlockForm = document.getElementById("ownerUnlockForm");
const ownerPasscodeInput = document.getElementById("ownerPasscode");
const ownerUnlockError = document.getElementById("ownerUnlockError");
const lockDashboardButton = document.getElementById("lockDashboardButton");
const heroOrderCount = document.getElementById("heroOrderCount");
const statTotalOrders = document.getElementById("statTotalOrders");
const statOpenOrders = document.getElementById("statOpenOrders");
const statRevenue = document.getElementById("statRevenue");
const statCities = document.getElementById("statCities");
const searchOrders = document.getElementById("searchOrders");
const statusFilter = document.getElementById("statusFilter");
const paymentFilter = document.getElementById("paymentFilter");
const cityFilter = document.getElementById("cityFilter");
const sortOrders = document.getElementById("sortOrders");
const clearFiltersButton = document.getElementById("clearFiltersButton");
const loadSampleOrdersButton = document.getElementById("loadSampleOrdersButton");
const clearAllOrdersButton = document.getElementById("clearAllOrdersButton");
const clearAllOrdersToolbarButton = document.getElementById("clearAllOrdersToolbarButton");
const ordersList = document.getElementById("ordersList");
const resultsCount = document.getElementById("resultsCount");
const locationList = document.getElementById("locationList");
const topProductsList = document.getElementById("topProductsList");
const navLinks = document.querySelectorAll(".nav-link");
let dashboardInitialized = false;

init();

function trackAnalyticsEvent(eventName, details = {}) {
  window.siteAnalytics?.trackEvent(eventName, details);
}

function init() {
  ownerUnlockForm?.addEventListener("submit", handleOwnerUnlock);
  ownerPasscodeInput?.addEventListener("input", hideOwnerUnlockError);
  lockDashboardButton?.addEventListener("click", lockOwnerDashboard);

  if (window.sessionStorage.getItem(ownerAccessSessionKey) === "unlocked") {
    unlockOwnerDashboard(false);
    return;
  }

  showOwnerLockScreen();
}

function initializeDashboard() {
  if (dashboardInitialized) {
    renderDashboard();
    return;
  }

  dashboardInitialized = true;
  renderDashboard();
  setupScrollSpy();

  [searchOrders, statusFilter, paymentFilter, cityFilter, sortOrders].forEach((element) => {
    element.addEventListener("input", renderDashboard);
    element.addEventListener("change", renderDashboard);
  });

  clearFiltersButton.addEventListener("click", clearFilters);
  loadSampleOrdersButton.addEventListener("click", loadSampleOrders);
  clearAllOrdersButton.addEventListener("click", clearAllOrders);
  clearAllOrdersToolbarButton.addEventListener("click", clearAllOrders);

  ordersList.addEventListener("click", handleOrderListClick);
  ordersList.addEventListener("change", handleOrderStatusChange);

  window.addEventListener("storage", (event) => {
    if (event.key === ordersStorageKey) {
      renderDashboard();
    }
  });
}

function handleOwnerUnlock(event) {
  event.preventDefault();

  if (!isValidOwnerPasscode(ownerPasscodeInput?.value || "")) {
    showOwnerUnlockError();
    return;
  }

  unlockOwnerDashboard(true);
}

function unlockOwnerDashboard(shouldFocusTop) {
  window.sessionStorage.setItem(ownerAccessSessionKey, "unlocked");
  hideOwnerUnlockError();

  if (ownerPasscodeInput) {
    ownerPasscodeInput.value = "";
  }

  if (ownerLockScreen) {
    ownerLockScreen.hidden = true;
  }

  if (ownerDashboardShell) {
    ownerDashboardShell.hidden = false;
  }

  runOneTimeOrdersReset();
  initializeDashboard();
  trackAnalyticsEvent("owner_dashboard_unlocked", {
    focusTop: shouldFocusTop
  });

  if (shouldFocusTop) {
    window.scrollTo({ top: 0, behavior: "smooth" });
  }
}

function lockOwnerDashboard() {
  window.sessionStorage.removeItem(ownerAccessSessionKey);

  if (ownerDashboardShell) {
    ownerDashboardShell.hidden = true;
  }

  showOwnerLockScreen();
}

function showOwnerLockScreen() {
  if (ownerLockScreen) {
    ownerLockScreen.hidden = false;
  }

  if (ownerDashboardShell) {
    ownerDashboardShell.hidden = true;
  }

  if (ownerPasscodeInput) {
    ownerPasscodeInput.value = "";
    ownerPasscodeInput.focus();
  }

  hideOwnerUnlockError();
}

function showOwnerUnlockError() {
  if (!ownerUnlockError) {
    return;
  }

  ownerUnlockError.hidden = false;
}

function hideOwnerUnlockError() {
  if (!ownerUnlockError) {
    return;
  }

  ownerUnlockError.hidden = true;
}

function isValidOwnerPasscode(passcode) {
  const normalizedPasscode = normalizeText(passcode).replace(/\s+/g, "");
  return ownerPasscodes.has(normalizedPasscode);
}

function renderDashboard() {
  const allOrders = getOrders();

  renderStats(allOrders);
  populateCityFilter(allOrders);
  const filteredOrders = getFilteredOrders(allOrders);
  renderOrders(filteredOrders);
  renderLocations(allOrders);
  renderTopProducts(allOrders);
}

function renderStats(orders) {
  const openOrderCount = orders.filter((order) => order.status !== "completed").length;
  const revenue = orders.reduce((sum, order) => sum + Number(order.total || 0), 0);
  const uniqueCities = new Set(orders.map((order) => formatLocation(order)).filter(Boolean));

  heroOrderCount.textContent = `${orders.length} order${orders.length === 1 ? "" : "s"} saved`;
  statTotalOrders.textContent = String(orders.length);
  statOpenOrders.textContent = String(openOrderCount);
  statRevenue.textContent = currency.format(revenue);
  statCities.textContent = String(uniqueCities.size);
}

function populateCityFilter(orders) {
  const previousValue = cityFilter.value || "all";
  const cities = [...new Set(orders.map((order) => formatLocation(order)).filter(Boolean))].sort((left, right) =>
    left.localeCompare(right)
  );

  cityFilter.innerHTML = [
    '<option value="all">All cities</option>',
    ...cities.map((city) => `<option value="${escapeHtml(city)}">${escapeHtml(city)}</option>`)
  ].join("");

  cityFilter.value = cities.includes(previousValue) ? previousValue : "all";
}

function renderOrders(orders) {
  resultsCount.textContent = `${orders.length} order${orders.length === 1 ? "" : "s"}`;

  if (!orders.length) {
    ordersList.innerHTML = `
      <div class="owner-empty-state">
        <h3>No matching orders yet</h3>
        <p>
          Place a test order from the storefront or load sample orders to preview
          how the owner dashboard tracks items and delivery addresses.
        </p>
        <div class="owner-empty-actions">
          <button class="primary-button" type="button" data-owner-action="load-samples">
            Load Sample Orders
          </button>
          <a class="secondary-button" href="index.html">Open Storefront</a>
        </div>
      </div>
    `;
    return;
  }

  ordersList.innerHTML = orders.map(renderOrderCard).join("");
}

function renderOrderCard(order) {
  const address = order.address || {};
  const customer = order.customer || {};
  const sanitizedPhone = sanitizePhone(customer.phone || "");
  const phoneLink = sanitizedPhone ? `<a class="quick-link" href="tel:${sanitizedPhone}">Call Customer</a>` : "";
  const whatsappLink = sanitizedPhone ? `<a class="quick-link" href="https://wa.me/${sanitizedPhone}" target="_blank" rel="noreferrer">WhatsApp</a>` : "";
  const instructions = address.instructions ? escapeHtml(address.instructions) : "No delivery instructions provided.";

  return `
    <article class="order-card">
      <div class="order-card-top">
        <div>
          <p class="order-card-id">${escapeHtml(order.id)}</p>
          <div class="order-meta">
            <span>${escapeHtml(formatDate(order.placedAt))}</span>
            <span>${escapeHtml(order.paymentLabel || getPaymentLabel(order.paymentMethod))}</span>
            <span>${escapeHtml(order.source || "Website checkout")}</span>
          </div>
        </div>
        <div class="order-total">
          <span class="status-pill status-${escapeHtml(order.status)}">${escapeHtml(getStatusLabel(order.status))}</span>
          <strong>${currency.format(Number(order.total || 0))}</strong>
        </div>
      </div>

      <div class="order-grid">
        <section class="order-panel">
          <h3>Customer and delivery</h3>
          <div class="order-contact-row">
            <div>
              <strong>${escapeHtml(customer.name || "Unknown customer")}</strong>
              <span>Customer name</span>
            </div>
          </div>
          <div class="order-contact-row">
            <div>
              <strong>${escapeHtml(customer.phone || "-")}</strong>
              <span>Phone number</span>
            </div>
            <div>
              <strong>${escapeHtml(customer.email || "-")}</strong>
              <span>Email address</span>
            </div>
          </div>
          <div class="order-address-row">
            <p>
              ${escapeHtml(address.street || "")}<br>
              ${escapeHtml(address.city || "")}, ${escapeHtml(address.state || "")} ${escapeHtml(address.postalCode || "")}<br>
              ${escapeHtml(address.country || "")}
            </p>
            <div class="order-address-tags">
              <span class="address-chip">${escapeHtml(address.city || "Unknown city")}</span>
              <span class="address-chip">${escapeHtml(address.state || "Unknown state")}</span>
            </div>
            <p class="order-note">${instructions}</p>
          </div>
        </section>

        <section class="order-panel">
          <h3>Items ordered</h3>
          ${(order.items || []).map(renderOrderItem).join("")}
        </section>
      </div>

      <div class="order-footer">
        <div class="order-actions-row">
          <select class="status-select" data-order-id="${escapeHtml(order.id)}" aria-label="Update status for ${escapeHtml(order.id)}">
            ${renderStatusOptions(order.status)}
          </select>
          ${phoneLink}
          ${whatsappLink}
        </div>
        <div class="order-meta">
          <span>Subtotal ${currency.format(Number(order.subtotal || 0))}</span>
          <span>Delivery ${currency.format(Number(order.shipping || 0))}</span>
        </div>
      </div>
    </article>
  `;
}

function renderOrderItem(item) {
  return `
    <div class="order-item-row">
      <div>
        <strong>${escapeHtml(item.name || "Item")}</strong>
        <small>${escapeHtml(String(item.quantity || 0))} kg x ${currency.format(Number(item.price || 0))}</small>
      </div>
      <strong>${currency.format(Number(item.lineTotal || 0))}</strong>
    </div>
  `;
}

function renderLocations(orders) {
  const counts = new Map();

  orders.forEach((order) => {
    const location = formatLocation(order);
    if (!location) {
      return;
    }

    counts.set(location, (counts.get(location) || 0) + 1);
  });

  const locations = [...counts.entries()].sort((left, right) => right[1] - left[1]).slice(0, 8);

  if (!locations.length) {
    locationList.innerHTML = `
      <div class="owner-empty-state">
        <h3>No delivery locations yet</h3>
        <p>Placed orders will show which cities and states need delivery attention.</p>
      </div>
    `;
    return;
  }

  locationList.innerHTML = locations
    .map(
      ([location, count]) => `
        <article class="location-card">
          <div>
            <strong>${escapeHtml(location)}</strong>
            <span>Delivery destination</span>
          </div>
          <strong>${count}</strong>
        </article>
      `
    )
    .join("");
}

function renderTopProducts(orders) {
  const productCounts = new Map();

  orders.forEach((order) => {
    (order.items || []).forEach((item) => {
      const existing = productCounts.get(item.name) || { quantity: 0, revenue: 0 };
      existing.quantity += Number(item.quantity || 0);
      existing.revenue += Number(item.lineTotal || 0);
      productCounts.set(item.name, existing);
    });
  });

  const products = [...productCounts.entries()]
    .sort((left, right) => right[1].quantity - left[1].quantity)
    .slice(0, 6);

  if (!products.length) {
    topProductsList.innerHTML = `
      <div class="owner-empty-state">
        <h3>No item data yet</h3>
        <p>Once orders arrive, this panel will show which sweets and snacks are moving fastest.</p>
      </div>
    `;
    return;
  }

  topProductsList.innerHTML = products
    .map(
      ([name, stats]) => `
        <article class="product-insight-card">
          <div>
            <strong>${escapeHtml(name)}</strong>
            <span>${stats.quantity} kg ordered</span>
          </div>
          <strong>${currency.format(stats.revenue)}</strong>
        </article>
      `
    )
    .join("");
}

function getFilteredOrders(orders) {
  const searchValue = normalizeText(searchOrders.value);
  const selectedStatus = statusFilter.value;
  const selectedPayment = paymentFilter.value;
  const selectedCity = cityFilter.value;
  const sortValue = sortOrders.value;

  const filtered = orders.filter((order) => {
    const searchableText = normalizeText(
      [
        order.id,
        order.customer?.name,
        order.customer?.phone,
        order.customer?.email,
        order.address?.street,
        order.address?.city,
        order.address?.state,
        order.address?.postalCode
      ].join(" ")
    );

    const matchesSearch = !searchValue || searchableText.includes(searchValue);
    const matchesStatus = selectedStatus === "all" || order.status === selectedStatus;
    const matchesPayment = selectedPayment === "all" || order.paymentMethod === selectedPayment;
    const matchesCity = selectedCity === "all" || formatLocation(order) === selectedCity;

    return matchesSearch && matchesStatus && matchesPayment && matchesCity;
  });

  filtered.sort((left, right) => {
    if (sortValue === "oldest") {
      return new Date(left.placedAt) - new Date(right.placedAt);
    }

    if (sortValue === "highest") {
      return Number(right.total || 0) - Number(left.total || 0);
    }

    if (sortValue === "lowest") {
      return Number(left.total || 0) - Number(right.total || 0);
    }

    return new Date(right.placedAt) - new Date(left.placedAt);
  });

  return filtered;
}

function handleOrderListClick(event) {
  const actionTarget = event.target.closest("[data-owner-action]");
  if (!actionTarget) {
    return;
  }

  if (actionTarget.dataset.ownerAction === "load-samples") {
    loadSampleOrders();
  }
}

function handleOrderStatusChange(event) {
  const select = event.target.closest(".status-select");
  if (!select) {
    return;
  }

  const orderId = select.dataset.orderId;
  const nextStatus = select.value;
  const orders = getOrders();
  const nextOrders = orders.map((order) =>
    order.id === orderId
      ? { ...order, status: nextStatus }
      : order
  );

  setOrders(nextOrders);
  trackAnalyticsEvent("owner_order_status_updated", {
    orderId,
    status: nextStatus
  });
  renderDashboard();
}

function loadSampleOrders() {
  const orders = getOrders();
  const existingIds = new Set(orders.map((order) => order.id));
  const missingSamples = sampleOrders.filter((order) => !existingIds.has(order.id));

  if (!missingSamples.length) {
    return;
  }

  setOrders([...missingSamples, ...orders]);
  renderDashboard();
}

function clearFilters() {
  searchOrders.value = "";
  statusFilter.value = "all";
  paymentFilter.value = "all";
  cityFilter.value = "all";
  sortOrders.value = "latest";
  renderDashboard();
}

function clearAllOrders() {
  setOrders([]);
  trackAnalyticsEvent("owner_cleared_orders");
  clearFilters();
}

function getOrders() {
  try {
    const savedValue = window.localStorage.getItem(ordersStorageKey);
    return savedValue ? JSON.parse(savedValue).map(normalizeOrderTotals) : [];
  } catch {
    return [];
  }
}

function setOrders(orders) {
  window.localStorage.setItem(ordersStorageKey, JSON.stringify(orders));
}

function runOneTimeOrdersReset() {
  if (window.localStorage.getItem(ordersResetKey) === "done") {
    return;
  }

  setOrders([]);
  window.localStorage.setItem(ordersResetKey, "done");
}

function normalizeOrderTotals(order) {
  const subtotal = Number(order.subtotal || 0);

  return {
    ...order,
    shipping: 0,
    total: subtotal
  };
}

function createSampleOrders() {
  return [
    createSampleOrder({
      id: "SP-DEMO-101",
      placedAt: "2026-04-16T09:10:00+05:30",
      status: "new",
      paymentMethod: "upi",
      customer: {
        name: "Ankita Jain",
        email: "ankita@example.com",
        phone: "+91 98261 24567"
      },
      address: {
        street: "42 MG Road, Flat 3B",
        city: "Indore",
        state: "Madhya Pradesh",
        postalCode: "452001",
        country: "India",
        instructions: "Call once before reaching the building gate."
      },
      items: [
        { name: "Bura", price: 120, quantity: 2 },
        { name: "Bhujia", price: 400, quantity: 1 }
      ]
    }),
    createSampleOrder({
      id: "SP-DEMO-102",
      placedAt: "2026-04-16T08:05:00+05:30",
      status: "preparing",
      paymentMethod: "card",
      customer: {
        name: "Rakesh Gupta",
        email: "rakesh@example.com",
        phone: "+91 98930 77881"
      },
      address: {
        street: "12 Tower Chowk",
        city: "Ujjain",
        state: "Madhya Pradesh",
        postalCode: "456001",
        country: "India",
        instructions: "Please deliver after 4 PM."
      },
      items: [
        { name: "Besan Chakki", price: 600, quantity: 2 },
        { name: "Shakkarpara", price: 360, quantity: 1 }
      ]
    }),
    createSampleOrder({
      id: "SP-DEMO-103",
      placedAt: "2026-04-15T19:20:00+05:30",
      status: "dispatched",
      paymentMethod: "bank",
      customer: {
        name: "Pooja Sharma",
        email: "pooja@example.com",
        phone: "+91 97555 22110"
      },
      address: {
        street: "88 Civil Lines",
        city: "Bhopal",
        state: "Madhya Pradesh",
        postalCode: "462001",
        country: "India",
        instructions: "Security desk will receive the parcel."
      },
      items: [
        { name: "Petha", price: 380, quantity: 3 },
        { name: "Bhujia", price: 400, quantity: 2 }
      ]
    }),
    createSampleOrder({
      id: "SP-DEMO-104",
      placedAt: "2026-04-15T14:45:00+05:30",
      status: "completed",
      paymentMethod: "upi",
      customer: {
        name: "Neha Maheshwari",
        email: "neha@example.com",
        phone: "+91 93011 55442"
      },
      address: {
        street: "5 Station Road",
        city: "Dewas",
        state: "Madhya Pradesh",
        postalCode: "455001",
        country: "India",
        instructions: ""
      },
      items: [
        { name: "Sawali", price: 340, quantity: 2 },
        { name: "Methi Mathri", price: 320, quantity: 2 },
        { name: "Dry Kachori", price: 450, quantity: 1 }
      ]
    })
  ];
}

function createSampleOrder(order) {
  const items = order.items.map((item) => ({
    ...item,
    lineTotal: item.price * item.quantity
  }));
  const subtotal = items.reduce((sum, item) => sum + item.lineTotal, 0);
  const shipping = 0;

  return {
    ...order,
    source: "Website checkout",
    paymentLabel: getPaymentLabel(order.paymentMethod),
    subtotal,
    shipping,
    total: subtotal + shipping
  };
}

function getPaymentLabel(paymentType) {
  if (paymentType === "card") {
    return "Card";
  }

  if (paymentType === "bank") {
    return "Bank Transfer";
  }

  return "UPI";
}

function getStatusLabel(status) {
  return statusLabels[status] || "New";
}

function renderStatusOptions(currentStatus) {
  return Object.entries(statusLabels)
    .map(
      ([value, label]) => `
        <option value="${value}" ${value === currentStatus ? "selected" : ""}>
          ${label}
        </option>
      `
    )
    .join("");
}

function formatLocation(order) {
  const city = order.address?.city || "";
  const state = order.address?.state || "";
  return [city, state].filter(Boolean).join(", ");
}

function formatDate(isoString) {
  try {
    return dateTimeFormatter.format(new Date(isoString));
  } catch {
    return isoString || "";
  }
}

function sanitizePhone(value) {
  return String(value || "").replace(/\D/g, "");
}

function normalizeText(value) {
  return String(value || "").trim().toLowerCase();
}

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function setupScrollSpy() {
  const sections = ["overview", "orders", "locations"]
    .map((id) => document.getElementById(id))
    .filter(Boolean);

  const observer = new IntersectionObserver(
    (entries) => {
      const visibleEntry = entries
        .filter((entry) => entry.isIntersecting)
        .sort((left, right) => right.intersectionRatio - left.intersectionRatio)[0];

      if (!visibleEntry) {
        return;
      }

      navLinks.forEach((link) => {
        const isActive = link.getAttribute("href") === `#${visibleEntry.target.id}`;
        link.classList.toggle("active", isActive);
      });
    },
    {
      rootMargin: "-35% 0px -45% 0px",
      threshold: [0.2, 0.45, 0.7]
    }
  );

  sections.forEach((section) => observer.observe(section));
}
