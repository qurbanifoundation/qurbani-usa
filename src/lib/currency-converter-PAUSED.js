/**
 * CURRENCY CONVERTER - PAUSED
 *
 * This code was paused for later implementation.
 * To re-enable, integrate this into Navbar.astro
 */

// Currency state with conversion rates (rates relative to USD)
const currencyRates = {
  USD: { symbol: '$', rate: 1, position: 'before' },
  GBP: { symbol: '£', rate: 0.79, position: 'before' },
  EUR: { symbol: '€', rate: 0.92, position: 'before' },
  CAD: { symbol: 'C$', rate: 1.36, position: 'before' },
  AUD: { symbol: 'A$', rate: 1.53, position: 'before' },
  AED: { symbol: 'د.إ', rate: 3.67, position: 'after' }
};

let currencyState = {
  code: localStorage.getItem('currency') || 'USD',
  symbol: currencyRates[localStorage.getItem('currency') || 'USD']?.symbol || '$',
  rate: currencyRates[localStorage.getItem('currency') || 'USD']?.rate || 1
};

// Format a price in current currency
function formatPriceInCurrency(usdAmount) {
  const curr = currencyRates[currencyState.code];
  const converted = usdAmount * curr.rate;
  const formatted = converted.toLocaleString('en-US', {
    minimumFractionDigits: converted % 1 === 0 ? 0 : 2,
    maximumFractionDigits: 2
  });
  return curr.position === 'after' ? `${formatted} ${curr.symbol}` : `${curr.symbol}${formatted}`;
}

// CONVERT ALL PRICES ON THE PAGE
function convertAllPrices() {
  const curr = currencyRates[currencyState.code];

  // 1. Convert elements with data-amount attribute (donation buttons, etc.)
  document.querySelectorAll('[data-amount]').forEach(el => {
    const usdAmount = parseFloat(el.dataset.amount);
    if (isNaN(usdAmount)) return;

    // Store original if not stored
    if (!el.dataset.originalHtml) {
      el.dataset.originalHtml = el.innerHTML;
    }

    // Find and update the price display within this element
    const converted = usdAmount * curr.rate;
    const formatted = Math.round(converted).toLocaleString('en-US');
    const priceText = curr.position === 'after' ? `${formatted} ${curr.symbol}` : `${curr.symbol}${formatted}`;

    // Try to find price element
    const priceEl = el.querySelector('.font-bold, .text-lg, .text-xl, .text-2xl');
    if (priceEl) {
      priceEl.textContent = priceText;
    }
  });

  // 2. Convert elements with data-usd attribute (explicit USD amounts)
  document.querySelectorAll('[data-usd]').forEach(el => {
    const usdAmount = parseFloat(el.dataset.usd);
    if (isNaN(usdAmount)) return;
    el.textContent = formatPriceInCurrency(usdAmount);
  });

  // 3. Convert all visible price patterns in the DOM ($XX, $XX.XX, $X,XXX)
  const pricePattern = /^\s*\$\s*(\d{1,3}(?:,\d{3})*(?:\.\d{2})?)\s*$/;
  const allElements = document.querySelectorAll('span, div, p, button, td, th, li, h1, h2, h3, h4, h5, h6, label, a');

  allElements.forEach(el => {
    // Skip if has children elements (to avoid duplicating)
    if (el.children.length > 0) return;

    const text = el.textContent.trim();
    const match = text.match(pricePattern);

    if (match) {
      // Store original USD amount
      if (!el.dataset.originalUsd) {
        el.dataset.originalUsd = match[1].replace(/,/g, '');
      }

      const usdAmount = parseFloat(el.dataset.originalUsd);
      el.textContent = formatPriceInCurrency(usdAmount);
    }
  });

  // 4. Convert inline prices like "$50" within text
  document.querySelectorAll('*').forEach(el => {
    if (el.children.length > 0) return; // Skip parents

    const text = el.textContent;
    if (!text.includes('$')) return;

    // Check for price patterns
    const inlinePattern = /\$(\d{1,3}(?:,\d{3})*(?:\.\d{2})?)/g;
    if (inlinePattern.test(text)) {
      // Store original
      if (!el.dataset.originalText) {
        el.dataset.originalText = text;
      }

      // Convert from original
      const original = el.dataset.originalText;
      const newText = original.replace(/\$(\d{1,3}(?:,\d{3})*(?:\.\d{2})?)/g, (match, amount) => {
        const usdAmount = parseFloat(amount.replace(/,/g, ''));
        return formatPriceInCurrency(usdAmount);
      });

      if (newText !== el.textContent) {
        el.textContent = newText;
      }
    }
  });

  // 5. Update cart total in navbar
  const cartTotal = document.querySelector('.cart-total');
  if (cartTotal) {
    const cart = JSON.parse(localStorage.getItem('cart') || '[]');
    const totalUSD = cart.reduce((sum, item) => sum + (item.amount * item.quantity), 0);
    cartTotal.textContent = formatPriceInCurrency(totalUSD);
  }

  // 6. Update any input placeholders with dollar amounts
  document.querySelectorAll('input[placeholder*="$"]').forEach(input => {
    if (!input.dataset.originalPlaceholder) {
      input.dataset.originalPlaceholder = input.placeholder;
    }
    const original = input.dataset.originalPlaceholder;
    input.placeholder = original.replace(/\$(\d+)/g, (match, amount) => {
      return formatPriceInCurrency(parseFloat(amount));
    });
  });

  console.log('[Currency] Converted all prices to', currencyState.code);
}

// EVENT LISTENERS FOR CURRENCY DROPDOWN
/*
currencyTrigger?.addEventListener('click', (e) => {
  e.stopPropagation();
  currencyMenu?.classList.toggle('hidden');
  languageMenu?.classList.add('hidden');
});

document.querySelectorAll('.currency-option').forEach(btn => {
  btn.addEventListener('click', () => {
    const code = btn.dataset.currency;
    const curr = currencyRates[code];

    currencyState = {
      code: code,
      symbol: curr.symbol,
      rate: curr.rate
    };

    localStorage.setItem('currency', code);
    localStorage.setItem('currencySymbol', curr.symbol);
    localStorage.setItem('currencyRate', curr.rate.toString());

    if (currentCurrencyEl) currentCurrencyEl.textContent = code;
    currencyMenu?.classList.add('hidden');

    // Convert all prices on the page immediately
    convertAllPrices();

    // Show confirmation toast
    const toast = document.createElement('div');
    toast.className = 'fixed bottom-4 right-4 bg-[#0096D6] text-white px-6 py-3 rounded-lg shadow-lg z-[99999]';
    toast.style.animation = 'fadeIn 0.3s ease-out';
    toast.innerHTML = `
      <div class="flex items-center gap-2">
        <span class="text-lg">${curr.symbol}</span>
        <span>Currency changed to ${code}</span>
      </div>
    `;
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 2000);

    // Dispatch event for other components (like donation cart)
    window.dispatchEvent(new CustomEvent('currencyChanged', { detail: currencyState }));
  });
});

// Make currency functions globally available
window.getCurrency = () => currencyState;
window.formatPrice = formatPriceInCurrency;
window.convertAllPrices = convertAllPrices;
*/
