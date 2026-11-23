const CART_KEY = "sifat_gosht_cart";

function getCart() {
  try {
    const cart = JSON.parse(localStorage.getItem(CART_KEY));
    return Array.isArray(cart) ? cart : [];
  } catch (error) {
    return [];
  }
}

function saveCart(cart) {
  localStorage.setItem(CART_KEY, JSON.stringify(cart));
  updateCartBadge();
  syncCardControls();
  if (document.getElementById("cart-items")) {
    renderCartPage();
  }
}

function addToCart(item) {
  const cart = getCart();
  const existing = cart.find((product) => product.id === item.id);

  if (existing) {
    existing.qty += 1;
  } else {
    cart.push({ ...item, qty: 1 });
  }

  saveCart(cart);
}

function changeQty(id, delta) {
  const cart = getCart()
    .map((item) => item.id === id ? { ...item, qty: item.qty + delta } : item)
    .filter((item) => item.qty > 0);

  saveCart(cart);
}

function removeItem(id) {
  saveCart(getCart().filter((item) => item.id !== id));
}

function updateCartBadge() {
  const count = getCart().reduce((sum, item) => sum + item.qty, 0);
  document.querySelectorAll("[data-cart-count]").forEach((element) => {
    element.textContent = count;
  });
}

function getItemQty(id) {
  const item = getCart().find((product) => product.id === id);
  return item ? item.qty : 0;
}

function syncCardControls() {
  document.querySelectorAll(".product-card").forEach((card) => {
    const addButton = card.querySelector(".add-to-cart-btn");
    const quantity = card.querySelector("[data-item-qty]");
    if (addButton && quantity) {
      quantity.textContent = getItemQty(addButton.dataset.id);
    }
  });
}

function formatSum(number) {
  return number.toString().replace(/\B(?=(\d{3})+(?!\d))/g, " ") + " so'm";
}

function renderCartPage() {
  const container = document.getElementById("cart-items");
  const totalElement = document.getElementById("cart-total");
  if (!container || !totalElement) return;

  const cart = getCart();
  container.replaceChildren();

  if (!cart.length) {
    const empty = document.createElement("p");
    empty.className = "empty-cart";
    empty.textContent = "Savat hozircha bo'sh.";
    container.appendChild(empty);
    totalElement.textContent = "";
    return;
  }

  cart.forEach((item) => {
    const row = document.createElement("div");
    row.className = "cart-item";

    const details = document.createElement("div");
    const name = document.createElement("strong");
    name.textContent = item.name;
    const price = document.createElement("div");
    price.textContent = `${formatSum(item.price)} × ${item.qty} kg`;
    details.append(name, price);

    const controls = document.createElement("div");
    controls.className = "cart-controls";

    const minus = document.createElement("button");
    minus.type = "button";
    minus.textContent = "−";
    minus.setAttribute("aria-label", `${item.name} miqdorini kamaytirish`);
    minus.addEventListener("click", () => changeQty(item.id, -1));

    const quantity = document.createElement("span");
    quantity.textContent = item.qty;

    const plus = document.createElement("button");
    plus.type = "button";
    plus.textContent = "+";
    plus.setAttribute("aria-label", `${item.name} miqdorini oshirish`);
    plus.addEventListener("click", () => changeQty(item.id, 1));

    const remove = document.createElement("button");
    remove.type = "button";
    remove.className = "remove-btn";
    remove.textContent = "O'chirish";
    remove.addEventListener("click", () => removeItem(item.id));

    controls.append(minus, quantity, plus, remove);
    row.append(details, controls);
    container.appendChild(row);
  });

  const total = cart.reduce((sum, item) => sum + item.price * item.qty, 0);
  totalElement.textContent = `Jami: ${formatSum(total)}`;
}

function showStoreMessage(message) {
  const element = document.getElementById("catalog-message");
  if (element) {
    element.textContent = element.textContent ? `${element.textContent} ${message}` : message;
  }
}

function createProductCard(product) {
  const card = document.createElement("article");
  card.className = "product-card";

  const image = document.createElement("div");
  image.className = "product-image";
  image.setAttribute("aria-hidden", "true");
  if (product.imageUrl) {
    const photo = document.createElement("img");
    photo.src = product.imageUrl;
    photo.alt = "";
    image.appendChild(photo);
  } else {
    image.textContent = product.emoji;
  }

  const name = document.createElement("h3");
  name.textContent = product.name;
  const price = document.createElement("p");
  price.className = "price";
  price.textContent = `${formatSum(product.price)} / kg`;

  const controls = document.createElement("div");
  controls.className = "card-qty-box";
  const decrease = document.createElement("button");
  decrease.type = "button";
  decrease.className = "dec-from-cart-btn";
  decrease.dataset.id = product.id;
  decrease.textContent = "−";
  decrease.setAttribute("aria-label", `${product.name} miqdorini kamaytirish`);

  const quantity = document.createElement("span");
  quantity.dataset.itemQty = "";
  quantity.textContent = "0";

  const add = document.createElement("button");
  add.type = "button";
  add.className = "add-to-cart-btn";
  add.dataset.id = product.id;
  add.dataset.name = product.name;
  add.dataset.price = product.price;
  add.textContent = "+";
  add.setAttribute("aria-label", `${product.name} qo'shish`);

  controls.append(decrease, quantity, add);
  card.append(image, name, price, controls);
  return card;
}

async function loadStoreProducts() {
  const containers = document.querySelectorAll(".products[data-products-limit]");
  if (!containers.length) return;

  try {
    const response = await fetch("/api/products");
    if (response.status === 404) return;
    if (!response.ok) {
      throw new Error(`Mahsulotlarni yuklab bo'lmadi (${response.status}).`);
    }

    const products = await response.json();
    containers.forEach((container) => {
      const limit = container.dataset.productsLimit === "all"
        ? products.length
        : Number(container.dataset.productsLimit);
      container.replaceChildren(...products.slice(0, limit).map(createProductCard));
    });

    const currentProducts = new Map(products.map((product) => [product.id, product]));
    let cartChanged = false;
    const updatedCart = getCart().map((item) => {
      const current = currentProducts.get(item.id);
      if (!current || (item.name === current.name && item.price === current.price)) return item;
      cartChanged = true;
      return { ...item, name: current.name, price: current.price };
    });
    if (cartChanged) saveCart(updatedCart);
    syncCardControls();
  } catch (error) {
    showStoreMessage(`${error.message} Server katalogi mavjud emas, boshlang'ich mahsulotlar ko'rsatilmoqda.`);
  }
}

async function loadSiteContent() {
  const heroTitle = document.getElementById("site-hero-title");
  const heroText = document.getElementById("site-hero-text");
  const aboutTitle = document.getElementById("site-about-title");
  const aboutText = document.getElementById("site-about-text");
  if (!heroTitle && !aboutTitle) return;

  try {
    const response = await fetch("/api/content");
    if (response.status === 404) return;
    if (!response.ok) {
      throw new Error(`Sahifa matnini yuklab bo'lmadi (${response.status}).`);
    }

    const content = await response.json();
    if (heroTitle && content.heroTitle) heroTitle.textContent = content.heroTitle;
    if (heroText && content.heroText) heroText.textContent = content.heroText;
    if (aboutTitle && content.aboutTitle) aboutTitle.textContent = content.aboutTitle;
    if (aboutText && content.aboutText) aboutText.textContent = content.aboutText;
  } catch (error) {
    showStoreMessage(error.message);
  }
}

document.addEventListener("DOMContentLoaded", () => {
  updateCartBadge();
  syncCardControls();
  renderCartPage();

  document.addEventListener("click", (event) => {
    const addButton = event.target.closest(".add-to-cart-btn");
    if (addButton) {
      addToCart({
        id: addButton.dataset.id,
        name: addButton.dataset.name,
        price: Number(addButton.dataset.price)
      });
      return;
    }

    const decreaseButton = event.target.closest(".dec-from-cart-btn");
    if (decreaseButton) {
      changeQty(decreaseButton.dataset.id, -1);
    }
  });

  const clearCart = document.getElementById("clear-cart");
  if (clearCart) {
    clearCart.addEventListener("click", () => saveCart([]));
  }

  const checkoutForm = document.getElementById("checkout-form");
  if (checkoutForm) {
    checkoutForm.addEventListener("submit", async (event) => {
      event.preventDefault();
      const message = document.getElementById("checkout-message");
      const cart = getCart();
      if (!cart.length) {
        message.textContent = "Savat bo'sh. Avval mahsulot tanlang.";
        return;
      }

      const form = event.currentTarget;
      try {
        const response = await fetch("/api/orders", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: form.elements.name.value,
            phone: form.elements.phone.value,
            address: form.elements.address.value,
            items: cart.map((item) => ({ id: item.id, quantity: item.qty }))
          })
        });
        if (response.status === 404) {
          throw new Error("Buyurtmalar serveri hali ulanmagan.");
        }

        const result = await response.json();
        if (!response.ok) {
          const errors = {
            invalid_order: "Buyurtma ma'lumotlarini tekshiring.",
            product_unavailable: "Mahsulotlardan biri hozir mavjud emas."
          };
          throw new Error(errors[result.error] || `Buyurtma yuborilmadi (${response.status}).`);
        }

        saveCart([]);
        form.reset();
        message.textContent = `Buyurtma qabul qilindi. Raqami: ${result.id.slice(0, 8)}.`;
      } catch (error) {
        message.textContent = error.message;
      }
    });
  }

  loadStoreProducts();
  loadSiteContent();

  const accountForm = document.getElementById("account-form");
  if (accountForm) {
    const registerForm = document.getElementById("account-register-form");
    const loginMessage = document.getElementById("account-message");
    const registerMessage = document.getElementById("register-message");
    const modeButtons = document.querySelectorAll("[data-account-mode]");

    modeButtons.forEach((button) => {
      button.addEventListener("click", () => {
        const registering = button.dataset.accountMode === "register";
        accountForm.hidden = registering;
        loginMessage.hidden = registering;
        registerForm.hidden = !registering;
        registerMessage.hidden = !registering;
        loginMessage.textContent = "";
        registerMessage.textContent = "";
        modeButtons.forEach((modeButton) => {
          const active = modeButton === button;
          modeButton.classList.toggle("active", active);
          modeButton.setAttribute("aria-pressed", String(active));
        });
      });
    });

    accountForm.addEventListener("submit", (event) => {
      event.preventDefault();
      loginMessage.textContent = "Kirish xizmati serverga ulanmagan.";
    });

    registerForm.addEventListener("submit", (event) => {
      event.preventDefault();
      const password = registerForm.elements.password.value;
      const confirmation = registerForm.elements.passwordConfirm.value;
      if (password !== confirmation) {
        registerMessage.textContent = "Parollar mos kelmadi.";
        return;
      }

      registerMessage.textContent =
        "Ro'yxatdan o'tish serverga ulanmagan. Ma'lumotlaringiz saqlanmadi.";
    });
  }
});
