import type { APIRoute } from 'astro';
import { supabaseAdmin } from '../../lib/supabase';
import { clearNavbarCache } from '../../lib/menus';

export const prerender = false;

/**
 * Seed Menu Widgets API
 *
 * Creates widget configurations that exactly match the original static mega menu designs.
 * Run this to populate the database with the correct settings.
 *
 * Usage: POST /api/seed-menu-widgets?menu=about (or menu=ramadan, or menu=all)
 */

// Our Work Menu - Category Tabs + Campaign Grid + Promo Card
const ourWorkWidgets = [
  // Left Column - Category Tabs (dynamically loaded from categories table)
  {
    menu_id: 'our-work',
    position: 'left',
    widget_type: 'category-tabs',
    title: null,
    config: {
      // Categories will be auto-populated from the categories table
      // This is a placeholder - actual categories come from the database
      categories: [], // Populated dynamically
      viewAllLink: { label: 'View All Appeals', href: '/appeals' }
    },
    sort_order: 0,
    is_active: true
  },
  // Center Column - Campaign Grid
  {
    menu_id: 'our-work',
    position: 'center',
    widget_type: 'campaign-grid',
    title: null,
    config: {
      limit: 8,
      viewAllText: 'All Projects & Appeals',
      viewAllHref: '/appeals'
    },
    sort_order: 0,
    is_active: true
  },
  // Right Column - Promo Card (Sponsor an Orphan)
  {
    menu_id: 'our-work',
    position: 'right',
    widget_type: 'promo-card',
    title: null,
    config: {
      href: '/appeals/sponsor-an-orphan',
      bgColor: '#01534d',
      bgColorEnd: '#013d38',
      image: 'https://images.unsplash.com/photo-1488521787991-ed7bbaae773c?w=400&q=80',
      badge: 'FEATURED',
      badgeColor: '#D97718',
      heading: 'Sponsor an Orphan',
      description: "Change a child's life with monthly support for education, food & healthcare.",
      priceLabel: 'Starting from',
      price: '$50',
      priceSuffix: '/month',
      priceColor: '#D97718',
      buttonText: 'Sponsor Now',
      buttonColor: '#D97718'
    },
    sort_order: 0,
    is_active: true
  }
];

// Zakat Menu - Links + Info Box + Quick Form
const zakatWidgets = [
  // Left Column - Link List
  {
    menu_id: 'zakat',
    position: 'left',
    widget_type: 'link-list',
    title: null,
    config: {
      hoverColor: '#e6f4fa',
      links: [
        { label: 'Pay Your Zakat', href: '/zakat', icon: 'money', color: '#0096D6' },
        { label: 'Zakat Calculator', href: '/zakat-calculator', icon: 'calculator', color: '#16a34a' },
        { label: 'Zakat FAQ', href: '/zakat-faq', icon: 'question', color: '#7c3aed' },
        { label: 'What is Zakat?', href: '/what-is-zakat', icon: 'book', color: '#ea580c' },
        { label: 'Zakat on Gold & Silver', href: '/zakat-on-gold', icon: 'gold', color: '#eab308' },
      ]
    },
    sort_order: 0,
    is_active: true
  },
  // Center Column - Info Box (content style)
  {
    menu_id: 'zakat',
    position: 'center',
    widget_type: 'info-box',
    title: 'Understanding Zakat',
    config: {
      heading: 'The Third Pillar of Islam',
      description: 'Zakat is an obligatory form of charity for Muslims who meet the necessary criteria of wealth (nisab). It purifies your wealth and helps those in need.',
      stats: [
        { value: '2.5%', label: 'Of qualifying wealth', color: '#0096D6', href: '/zakat-calculator' },
        { value: 'Live', label: 'Silver Nisab threshold', color: '#eab308', href: '/zakat-calculator' },
      ],
      button: {
        label: 'Calculate Your Zakat Now',
        href: '/zakat-calculator',
        color: '#0096D6'
      }
    },
    sort_order: 0,
    is_active: true
  },
  // Right Column - Quick Form
  {
    menu_id: 'zakat',
    position: 'right',
    widget_type: 'quick-form',
    title: 'Quick Zakat Payment',
    config: {
      subtitle: 'Give Zakat',
      amounts: [100, 250, 500],
      placeholder: 'Enter Zakat amount',
      buttonText: 'Pay Zakat Now',
      buttonColor: '#0096D6',
      buttonLink: '/zakat',
      footnote: '100% Zakat policy - all funds reach those in need'
    },
    sort_order: 0,
    is_active: true
  }
];

// About Menu - Exact copy of original static design
const aboutWidgets = [
  // Left Column - Link List
  {
    menu_id: 'about',
    position: 'left',
    widget_type: 'link-list',
    title: null,
    config: {
      links: [
        { label: 'Our Story', href: '/about', icon: 'user', color: '#D97718' },
        { label: 'Annual Reports', href: '/reports', icon: 'document', color: '#16a34a' },
        { label: 'Our Impact', href: '/impact', icon: 'heart', color: '#7c3aed' },
        { label: 'Media Center', href: '/media', icon: 'image', color: '#dc2626' },
        { label: 'Contact Us', href: '/contact', icon: 'email', color: '#333333' },
      ]
    },
    sort_order: 0,
    is_active: true
  },
  // Center Column - Info Box with Stats
  {
    menu_id: 'about',
    position: 'center',
    widget_type: 'info-box',
    title: 'Our Impact',
    config: {
      stats: [
        { value: '25+', label: 'Years of Service', color: '#D97718', href: '/about' },
        { value: '53+', label: 'Countries Served', color: '#0096D6', href: '/impact' },
        { value: '2M+', label: 'Lives Impacted', color: '#16a34a', href: '/impact' },
        { value: '100%', label: 'Zakat Policy', color: '#7c3aed', href: '/zakat' },
      ],
      button: {
        label: 'Learn More About Us',
        href: '/about',
        color: '#D97718'
      }
    },
    sort_order: 0,
    is_active: true
  },
  // Right Column - Newsletter
  {
    menu_id: 'about',
    position: 'right',
    widget_type: 'newsletter',
    title: 'Newsletter',
    config: {
      subtitle: 'Stay Connected',
      heading: 'Newsletter',
      description: 'Get updates on our projects and impact stories delivered to your inbox.',
      placeholder: 'Enter your email',
      buttonText: 'Subscribe',
      buttonColor: '#D97718',
      accentColor: '#D97718',
      formAction: '/api/newsletter',
      socialLinks: [
        { platform: 'facebook', href: 'https://facebook.com/qurbani.usa' },
        { platform: 'twitter', href: 'https://twitter.com/qurbaniusa' },
        { platform: 'instagram', href: 'https://instagram.com/qurbani.usa' },
      ]
    },
    sort_order: 0,
    is_active: true
  }
];

// Ramadan Menu - Exact copy of original static design
const ramadanWidgets = [
  // Left Column - Link List with Ramadan links
  {
    menu_id: 'ramadan',
    position: 'left',
    widget_type: 'link-list',
    title: null,
    config: {
      links: [
        { label: 'Ramadan 2026', href: '/ramadan', icon: 'moon', color: '#024139' },
        { label: '30 Days of Ramadan', href: '/30-days-of-ramadan', icon: 'star', color: '#024139', subtitle: 'Automate Your Giving' },
        { label: 'Fidya', href: '/fidya', icon: 'heart', color: '#16a34a' },
        { label: 'Kaffarah', href: '/kaffarah', icon: 'x-circle', color: '#dc2626' },
        { label: 'Zakat ul-Fitr', href: '/zakat-ul-fitr', icon: 'money', color: '#0096D6' },
        { label: 'Feed Iftar', href: '/iftar', icon: 'food', color: '#ea580c' },
        { label: 'Food Packs', href: '/food-packs', icon: 'shopping-bag', color: '#eab308' },
      ]
    },
    sort_order: 0,
    is_active: true
  },
  // Center Column - Promo Box
  {
    menu_id: 'ramadan',
    position: 'center',
    widget_type: 'promo-box',
    title: 'Ramadan 2026',
    config: {
      bgColor: '#024139',
      heading: 'The Blessed Month',
      description: 'Multiply your rewards this Ramadan. Every good deed is multiplied many times over during this sacred month.',
      priceTiers: [
        { price: '$10', label: 'Fidya/day', href: '/fidya' },
        { price: '$15', label: 'Zakat ul-Fitr', href: '/zakat-ul-fitr' },
        { price: '$5', label: 'Feed Iftar', href: '/iftar' },
      ],
      button: {
        label: 'Explore Ramadan Giving',
        href: '/ramadan',
        color: '#024139'
      }
    },
    sort_order: 0,
    is_active: true
  },
  // Right Column - Feature Card (30 Days)
  {
    menu_id: 'ramadan',
    position: 'right',
    widget_type: 'promo-card',
    title: null,
    config: {
      href: '/30-days-of-ramadan',
      bgColor: '#024139',
      bgColorEnd: '#012d28',
      badge: 'AUTOMATE',
      badgeColor: '#D97718',
      heading: '30 Days of Ramadan',
      description: 'Automate your daily giving throughout Ramadan. Set it once, earn rewards every day.',
      features: ['Auto-scheduled', 'Daily rewards'],
      buttonText: 'Start Giving',
      buttonColor: '#D97718',
      // Custom display
      largeNumber: '30',
      numberLabel: 'Days of Giving',
      icon: 'moon',
      iconColor: '#D97718'
    },
    sort_order: 0,
    is_active: true
  }
];

export const POST: APIRoute = async ({ url }) => {
  try {
    const menuParam = url.searchParams.get('menu') || 'all';
    const templateParam = url.searchParams.get('template'); // Optional: apply a specific template to any menu
    const results: string[] = [];

    // Fetch categories from database for Our Work template
    const { data: categories } = await supabaseAdmin
      .from('categories')
      .select('id, slug, label, color, icon, sort_order')
      .eq('is_active', true)
      .order('sort_order');

    // Update Our Work widget with real categories
    if (categories && categories.length > 0) {
      const categoryTabsWidget = ourWorkWidgets.find(w => w.widget_type === 'category-tabs');
      if (categoryTabsWidget) {
        categoryTabsWidget.config.categories = categories.map(cat => ({
          slug: cat.slug,
          label: cat.label,
          color: cat.color,
          icon: cat.icon || 'heart'
        }));
      }
    }

    // Template colors
    const templateColors: Record<string, string> = {
      'our-work': '#D97718',  // Orange
      'zakat': '#0096D6',     // Blue
      'about': '#D97718',     // Orange
      'ramadan': '#024139',   // Dark teal green (Ramadan-style template)
      'appeals': '#024139',   // Same as ramadan template
    };

    // Template widget definitions
    const templates: Record<string, typeof aboutWidgets> = {
      'our-work': ourWorkWidgets,
      'zakat': zakatWidgets,
      'about': aboutWidgets,
      'ramadan': ramadanWidgets,
      'appeals': ramadanWidgets, // Appeals uses the Ramadan-style template
    };

    // Helper to apply template to a menu
    async function applyTemplate(menuId: string, templateId: string) {
      const templateWidgets = templates[templateId];
      if (!templateWidgets) {
        throw new Error(`Unknown template: ${templateId}`);
      }

      // Clone widgets and update menu_id to target menu
      const widgetsForMenu = templateWidgets.map(w => ({
        ...w,
        menu_id: menuId // Apply to target menu, not the template's original menu
      }));

      // First, delete existing widgets for this menu
      const { error: deleteError } = await supabaseAdmin
        .from('menu_widgets')
        .delete()
        .eq('menu_id', menuId);

      if (deleteError) {
        throw new Error(`Failed to clear ${menuId} widgets: ${deleteError.message}`);
      }

      // Insert new widgets
      const { data, error } = await supabaseAdmin
        .from('menu_widgets')
        .insert(widgetsForMenu)
        .select();

      if (error) {
        throw new Error(`Failed to insert ${menuId} widgets: ${error.message}`);
      }

      // Update the menu color in mega_menus table based on template
      const color = templateColors[templateId];
      if (color) {
        const { error: colorError } = await supabaseAdmin
          .from('mega_menus')
          .update({ color: color })
          .eq('id', menuId);

        if (colorError) {
          console.warn(`Warning: Could not update ${menuId} color: ${colorError.message}`);
        }
      }

      results.push(`${menuId}: Applied "${templateId}" template (${data.length} widgets), color: ${color || 'default'}`);
    }

    // If template parameter provided, apply that template to the specified menu
    if (templateParam && menuParam !== 'all') {
      await applyTemplate(menuParam, templateParam);
    } else {
      // Legacy behavior: seed original menus with their matching templates
      if (menuParam === 'our-work' || menuParam === 'all') {
        await applyTemplate('our-work', 'our-work');
      }

      if (menuParam === 'zakat' || menuParam === 'all') {
        await applyTemplate('zakat', 'zakat');
      }

      if (menuParam === 'about' || menuParam === 'all') {
        await applyTemplate('about', 'about');
      }

      if (menuParam === 'appeals' || menuParam === 'all') {
        await applyTemplate('appeals', 'appeals');
      }

      // Legacy support for 'ramadan' menu param
      if (menuParam === 'ramadan') {
        await applyTemplate('ramadan', 'ramadan');
      }
    }

    // Clear navbar cache
    clearNavbarCache();

    return new Response(JSON.stringify({
      success: true,
      message: 'Menu widgets seeded successfully',
      results
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error: any) {
    return new Response(JSON.stringify({
      success: false,
      error: error.message
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};

// GET - Show available menus to seed
export const GET: APIRoute = async () => {
  return new Response(JSON.stringify({
    message: 'Seed Menu Widgets API',
    usage: 'POST /api/seed-menu-widgets?menu=our-work|zakat|about|appeals|all',
    availableMenus: ['our-work', 'zakat', 'about', 'appeals', 'all'],
    description: 'Seeds the menu_widgets table with widget configurations that exactly match the original static mega menu designs.',
    menuDetails: {
      'our-work': 'Category Tabs + Campaign Grid + Promo Card (Sponsor an Orphan)',
      'zakat': 'Link List + Info Box (Understanding Zakat) + Quick Form',
      'about': 'Link List + Stats Grid (Our Impact) + Newsletter',
      'appeals': 'Link List + Promo Box (Blessed Month) + Feature Card (30 Days)'
    },
    templates: {
      'our-work': 'Orange theme with category tabs',
      'zakat': 'Blue theme with calculator',
      'about': 'Orange theme with stats and newsletter',
      'ramadan': 'Dark teal theme with Ramadan-style content'
    }
  }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' }
  });
};
