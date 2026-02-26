# Google Analytics & Ads Tracking

## GA4 Configuration
- **Measurement ID:** `G-0WC0W1PBKC`
- **Property ID:** `389786456`

## Google Ads Configuration
- **Account ID:** `AW-793369119`
- **Conversion Label:** `2lawCM74xKcBEJ-0p_oC`

## E-commerce Events Tracked
| Event | When Fired |
|-------|------------|
| `view_item` | Campaign page loaded |
| `add_to_cart` | Donation added to cart |
| `view_cart` | Cart opened |
| `remove_from_cart` | Item removed |
| `begin_checkout` | Checkout modal opened |
| `add_payment_info` | Moved to payment step |
| `purchase` | Donation completed |

## Tracking Code Location
**File:** `src/layouts/Layout.astro` (lines 38-179)

## Global Tracking Functions
```javascript
window.trackAddToCart(item)
window.trackBeginCheckout(items, total)
window.trackPurchase(transactionId, items, total)
window.trackViewItem(item)
window.trackViewCart(items, total)
window.trackRemoveFromCart(item)
window.trackAddPaymentInfo(items, total, paymentType)
window.trackDonationEvent(eventName, params)
```

## 30 Days of Ramadan Page
Has its own checkout tracking in `src/pages/30-days-of-ramadan.astro`
