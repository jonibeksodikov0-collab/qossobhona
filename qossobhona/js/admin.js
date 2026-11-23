const adminStatus = document.getElementById("admin-status");
const loginMessage = document.getElementById("login-message");
const loginPanel = document.getElementById("admin-login");
const adminPanel = document.getElementById("admin-panel");
const productImageInput = document.getElementById("product-image");
const productImagePreview = document.getElementById("product-image-preview");
const productImagePlaceholder = document.getElementById("product-image-placeholder");
const allowedProductImageTypes = new Set(["image/jpeg", "image/png", "image/webp"]);
const maxProductImageSize = 5 * 1024 * 1024;
let productPreviewObjectUrl = null;

async function adminRequest(path, options) {
  const requestOptions = options || {};
  const headers = new Headers(requestOptions.headers || {});
  if (requestOptions.body && !(requestOptions.body instanceof FormData)) {
    headers.set("Content-Type", "application/json");
  }

  const response = await fetch(path, {
    ...requestOptions,
    headers,
    credentials: "same-origin"
  });
  if (!response.ok) {
    const errorMessage = response.status === 401
      ? "Kirish amalga oshmadi yoki sessiya tugadi."
      : response.status === 404
        ? "Administrator serveri ulanmagan. Server sozlangach, qayta urinib ko'ring."
        : `Server xatosi: ${response.status}`;
    const error = new Error(errorMessage);
    error.status = response.status;
    throw error;
  }
  return response.status === 204 ? null : response.json();
}

function showStatus(message, isError) {
  adminStatus.textContent = message;
  adminStatus.classList.toggle("error", Boolean(isError));
}

function formatPrice(value) {
  return `${Number(value).toLocaleString("uz-UZ")} so'm`;
}

function createCell(text) {
  const cell = document.createElement("td");
  cell.textContent = text;
  return cell;
}

function createButton(text, className, onClick) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = className;
  button.textContent = text;
  button.addEventListener("click", onClick);
  return button;
}

function showProductImagePreview(url) {
  if (productPreviewObjectUrl) {
    URL.revokeObjectURL(productPreviewObjectUrl);
    productPreviewObjectUrl = null;
  }

  if (!url) {
    productImagePreview.removeAttribute("src");
    productImagePreview.hidden = true;
    productImagePlaceholder.hidden = false;
    return;
  }

  productImagePreview.src = url;
  productImagePreview.hidden = false;
  productImagePlaceholder.hidden = true;
  if (url.startsWith("blob:")) {
    productPreviewObjectUrl = url;
  }
}

async function loadAdminData() {
  const [products, orders, customers, content, report] = await Promise.all([
    adminRequest("/api/admin/products"),
    adminRequest("/api/admin/orders"),
    adminRequest("/api/admin/customers"),
    adminRequest("/api/content"),
    adminRequest("/api/admin/reports")
  ]);
  renderProducts(products);
  renderOrders(orders);
  renderCustomers(customers);
  renderContent(content);
  renderReport(report);
}

function renderProducts(products) {
  const table = document.getElementById("products-table");
  table.replaceChildren();
  products.forEach((product) => {
    const row = document.createElement("tr");
    row.append(
      createCell(`${product.emoji} ${product.name}`),
      createCell(formatPrice(product.price)),
      createCell(product.active ? "Faol" : "Yashirin")
    );
    const actions = document.createElement("td");
    actions.append(
      createButton("Tahrirlash", "secondary-btn", () => {
        const form = document.getElementById("product-form");
        form.elements.id.value = product.id;
        form.elements.name.value = product.name;
        form.elements.price.value = product.price;
        form.elements.emoji.value = product.emoji;
        form.elements.active.checked = product.active;
        form.elements.image.value = "";
        showProductImagePreview(product.imageUrl || "");
        document.getElementById("cancel-product-edit").hidden = false;
        form.scrollIntoView({ behavior: "smooth", block: "center" });
      }),
      createButton("O'chirish", "danger-btn", async () => {
        if (!window.confirm("Mahsulotni o'chirasizmi?")) return;
        try {
          await adminRequest(`/api/admin/products/${encodeURIComponent(product.id)}`, { method: "DELETE" });
          await loadAdminData();
          showStatus("Mahsulot o'chirildi.", false);
        } catch (error) {
          showStatus(error.message, true);
        }
      })
    );
    row.appendChild(actions);
    table.appendChild(row);
  });
}

function renderOrders(orders) {
  const table = document.getElementById("orders-table");
  table.replaceChildren();
  const statuses = [
    ["new", "Yangi"],
    ["processing", "Jarayonda"],
    ["completed", "Bajarildi"],
    ["cancelled", "Bekor qilindi"]
  ];

  orders.forEach((order) => {
    const row = document.createElement("tr");
    row.append(
      createCell(order.id.slice(0, 8)),
      createCell(`${order.customerName} · ${order.phone}\n${order.address}`),
      createCell(order.items.map((item) => `${item.name} × ${item.quantity} kg`).join(", ")),
      createCell(formatPrice(order.total))
    );
    const statusCell = document.createElement("td");
    const select = document.createElement("select");
    statuses.forEach(([value, label]) => {
      const option = document.createElement("option");
      option.value = value;
      option.textContent = label;
      select.appendChild(option);
    });
    select.value = order.status;
    select.addEventListener("change", async () => {
      const previousStatus = order.status;
      try {
        await adminRequest(`/api/admin/orders/${encodeURIComponent(order.id)}/status`, {
          method: "PUT",
          body: JSON.stringify({ status: select.value })
        });
        order.status = select.value;
        showStatus("Buyurtma holati yangilandi.", false);
      } catch (error) {
        select.value = previousStatus;
        showStatus(error.message, true);
      }
    });
    statusCell.appendChild(select);
    row.append(statusCell, createCell(new Date(order.createdAt).toLocaleString()));
    table.appendChild(row);
  });
}

function renderCustomers(customers) {
  const table = document.getElementById("customers-table");
  table.replaceChildren();
  customers.forEach((customer) => {
    const row = document.createElement("tr");
    row.dataset.id = customer.id;
    const nameCell = document.createElement("td");
    const name = document.createElement("input");
    name.value = customer.name;
    name.maxLength = 120;
    nameCell.appendChild(name);
    const phoneCell = createCell(customer.phone);
    const addressCell = document.createElement("td");
    const address = document.createElement("input");
    address.value = customer.address;
    address.maxLength = 300;
    addressCell.appendChild(address);
    row.append(nameCell, phoneCell, addressCell, createCell(String(customer.orderCount)));
    const actions = document.createElement("td");
    actions.append(
      createButton("Saqlash", "secondary-btn", async () => {
        try {
          await adminRequest(`/api/admin/customers/${customer.id}`, {
            method: "PUT",
            body: JSON.stringify({ name: name.value, address: address.value })
          });
          showStatus("Mijoz ma'lumotlari saqlandi.", false);
        } catch (error) {
          showStatus(error.message, true);
        }
      }),
      createButton("O'chirish", "danger-btn", async () => {
        if (!window.confirm("Mijozni o'chirasizmi? Buyurtmalar tarixi saqlanib qoladi.")) return;
        try {
          await adminRequest(`/api/admin/customers/${customer.id}`, { method: "DELETE" });
          await loadAdminData();
          showStatus("Mijoz o'chirildi.", false);
        } catch (error) {
          showStatus(error.message, true);
        }
      })
    );
    row.appendChild(actions);
    table.appendChild(row);
  });
}

function renderContent(content) {
  const form = document.getElementById("content-form");
  form.elements.heroTitle.value = content.heroTitle || "";
  form.elements.heroText.value = content.heroText || "";
  form.elements.aboutTitle.value = content.aboutTitle || "";
  form.elements.aboutText.value = content.aboutText || "";
}

function renderReport(report) {
  const stats = [
    ["Jami buyurtmalar", report.orderCount],
    ["Faol buyurtmalar", report.activeOrders],
    ["Bajarilgan", report.completedOrders],
    ["Bekor qilingan", report.cancelledOrders],
    ["Tushum", formatPrice(report.revenue)],
    ["Mijozlar", report.customerCount],
    ["Faol mahsulotlar", report.productCount]
  ];
  const cards = document.getElementById("report-stats");
  cards.replaceChildren();
  stats.forEach(([label, value]) => {
    const card = document.createElement("article");
    const heading = document.createElement("h3");
    heading.textContent = label;
    const total = document.createElement("strong");
    total.textContent = value;
    card.append(heading, total);
    cards.appendChild(card);
  });

  const daily = document.getElementById("report-daily");
  daily.replaceChildren();
  report.last7Days.forEach((day) => {
    const row = document.createElement("tr");
    row.append(
      createCell(day.date),
      createCell(String(day.orders)),
      createCell(formatPrice(day.revenue))
    );
    daily.appendChild(row);
  });
}

function showAdminPanel() {
  loginPanel.hidden = true;
  adminPanel.hidden = false;
  loadAdminData()
    .then(() => showStatus("Ma'lumotlar yangilandi.", false))
    .catch((error) => showStatus(error.message, true));
}

document.getElementById("admin-login-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  loginMessage.textContent = "";
  const form = event.currentTarget;
  try {
    await adminRequest("/api/admin/login", {
      method: "POST",
      body: JSON.stringify({
        username: form.elements.username.value,
        password: form.elements.password.value
      })
    });
    form.reset();
    showAdminPanel();
  } catch (error) {
    loginMessage.textContent = error.message;
  }
});

document.getElementById("admin-logout").addEventListener("click", async () => {
  try {
    await adminRequest("/api/admin/logout", { method: "POST" });
    adminPanel.hidden = true;
    loginPanel.hidden = false;
    showStatus("", false);
  } catch (error) {
    showStatus(error.message, true);
  }
});

document.querySelectorAll("[data-admin-tab]").forEach((button) => {
  button.addEventListener("click", () => {
    document.querySelectorAll("[data-admin-tab]").forEach((tab) => tab.classList.remove("active"));
    document.querySelectorAll("[data-admin-panel]").forEach((panel) => { panel.hidden = true; });
    button.classList.add("active");
    document.querySelector(`[data-admin-panel="${button.dataset.adminTab}"]`).hidden = false;
  });
});

document.getElementById("product-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  const form = event.currentTarget;
  const id = form.elements.id.value;
  const product = {
    name: form.elements.name.value,
    price: Number(form.elements.price.value),
    emoji: form.elements.emoji.value,
    active: form.elements.active.checked
  };
  const image = form.elements.image.files[0];
  let body = JSON.stringify(product);
  if (image) {
    body = new FormData();
    Object.entries(product).forEach(([key, value]) => body.set(key, String(value)));
    body.set("image", image);
  }

  try {
    await adminRequest(id ? `/api/admin/products/${encodeURIComponent(id)}` : "/api/admin/products", {
      method: id ? "PUT" : "POST",
      body
    });
    form.reset();
    form.elements.active.checked = true;
    showProductImagePreview("");
    document.getElementById("cancel-product-edit").hidden = true;
    await loadAdminData();
    showStatus("Mahsulot saqlandi.", false);
  } catch (error) {
    showStatus(error.message, true);
  }
});

productImageInput.addEventListener("change", () => {
  const image = productImageInput.files[0];
  if (!image) {
    showProductImagePreview("");
    return;
  }

  if (!allowedProductImageTypes.has(image.type) || image.size > maxProductImageSize) {
    productImageInput.value = "";
    showProductImagePreview("");
    showStatus("JPG, PNG yoki WebP formatidagi rasmni tanlang (5 MB gacha).", true);
    return;
  }

  showProductImagePreview(URL.createObjectURL(image));
  showStatus("Rasm tanlandi. Uni saqlash uchun serverda rasm yuklash API si kerak.", false);
});

document.getElementById("cancel-product-edit").addEventListener("click", () => {
  const form = document.getElementById("product-form");
  form.reset();
  form.elements.active.checked = true;
  showProductImagePreview("");
  document.getElementById("cancel-product-edit").hidden = true;
});

document.getElementById("customer-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  const form = event.currentTarget;
  try {
    await adminRequest("/api/admin/customers", {
      method: "POST",
      body: JSON.stringify({
        name: form.elements.name.value,
        phone: form.elements.phone.value,
        address: form.elements.address.value
      })
    });
    form.reset();
    await loadAdminData();
    showStatus("Mijoz qo'shildi.", false);
  } catch (error) {
    showStatus(error.status === 409 ? "Bu telefon raqami allaqachon ro'yxatda." : error.message, true);
  }
});

document.getElementById("content-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  const form = event.currentTarget;
  try {
    await adminRequest("/api/admin/content", {
      method: "PUT",
      body: JSON.stringify({
        heroTitle: form.elements.heroTitle.value,
        heroText: form.elements.heroText.value,
        aboutTitle: form.elements.aboutTitle.value,
        aboutText: form.elements.aboutText.value
      })
    });
    showStatus("Bosh sahifa matni saqlandi.", false);
  } catch (error) {
    showStatus(error.message, true);
  }
});

adminRequest("/api/admin/me")
  .then((session) => {
    if (session.authenticated) showAdminPanel();
  })
  .catch((error) => {
    if (error.status !== 401) {
      loginMessage.textContent = error.message;
    }
  });
