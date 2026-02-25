/**
 * Menu Widget Template System
 *
 * Templates define the visual appearance of widgets.
 * Each widget type can have multiple template variants.
 *
 * To add a new template:
 * 1. Add template config to the appropriate widget type below
 * 2. The template will automatically appear in Menu Builder
 * 3. MegaMenuWidget will apply the styles based on template selection
 */

export interface TemplateStyle {
  // Container
  container?: string;
  // Card/Item styles
  card?: string;
  cardHover?: string;
  // Typography
  title?: string;
  subtitle?: string;
  text?: string;
  // Colors (CSS custom properties)
  colors?: {
    primary?: string;
    secondary?: string;
    accent?: string;
    background?: string;
    border?: string;
  };
  // Spacing
  gap?: string;
  padding?: string;
  // Special properties
  imageSize?: string;
  borderRadius?: string;
  shadow?: string;
}

export interface WidgetTemplate {
  id: string;
  name: string;
  description: string;
  preview?: string; // Preview image URL
  styles: TemplateStyle;
}

export interface WidgetTemplates {
  [widgetType: string]: WidgetTemplate[];
}

// ============================================
// TEMPLATE DEFINITIONS
// ============================================

export const menuTemplates: WidgetTemplates = {

  // Campaign Grid Templates
  'campaign-grid': [
    {
      id: 'standard',
      name: 'Standard Cards',
      description: 'White cards with border, horizontal layout',
      styles: {
        container: 'grid grid-cols-2 gap-3 mb-4 max-h-[320px] overflow-y-auto pr-1 custom-scrollbar',
        card: 'flex items-center gap-3 p-3 rounded-lg bg-white border border-gray-200',
        cardHover: 'hover:shadow-md hover:border-gray-300 transition-all',
        title: 'text-sm font-semibold text-gray-500 uppercase tracking-wider mb-4',
        text: 'text-sm font-medium text-[#333] line-clamp-2',
        imageSize: 'w-16 h-16',
        borderRadius: 'rounded-lg',
      }
    },
    {
      id: 'compact',
      name: 'Compact List',
      description: 'Smaller items, more campaigns visible',
      styles: {
        container: 'grid grid-cols-2 gap-2 mb-4 max-h-[320px] overflow-y-auto pr-1 custom-scrollbar',
        card: 'flex items-center gap-2 p-2 rounded-lg bg-white border border-gray-100',
        cardHover: 'hover:bg-gray-50 hover:border-gray-200 transition-all',
        title: 'text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3',
        text: 'text-xs font-medium text-[#333] line-clamp-2',
        imageSize: 'w-10 h-10',
        borderRadius: 'rounded',
      }
    },
    {
      id: 'featured',
      name: 'Featured Grid',
      description: 'Larger cards with prominent images',
      styles: {
        container: 'grid grid-cols-2 gap-4 mb-4 max-h-[350px] overflow-y-auto pr-1 custom-scrollbar',
        card: 'flex flex-col rounded-xl bg-white border border-gray-200 overflow-hidden',
        cardHover: 'hover:shadow-lg hover:-translate-y-0.5 transition-all',
        title: 'text-sm font-bold text-gray-600 uppercase tracking-wider mb-4',
        text: 'text-sm font-semibold text-[#333] p-3',
        imageSize: 'w-full h-24 object-cover',
        borderRadius: 'rounded-xl',
      }
    }
  ],

  // Promo Card Templates
  'promo-card': [
    {
      id: 'gradient',
      name: 'Gradient Card',
      description: 'Dark gradient background with image header',
      styles: {
        container: 'rounded-xl overflow-hidden shadow-lg',
        card: 'bg-gradient-to-br from-[#01534d] to-[#013d38]',
        title: 'font-bold text-lg text-white mb-1',
        subtitle: 'text-white/80 text-sm mb-3',
        colors: {
          primary: '#01534d',
          accent: '#D97718',
        }
      }
    },
    {
      id: 'minimal',
      name: 'Minimal White',
      description: 'Clean white card with subtle shadow',
      styles: {
        container: 'rounded-xl overflow-hidden shadow-md bg-white',
        card: 'bg-white',
        title: 'font-bold text-lg text-[#333] mb-1',
        subtitle: 'text-gray-600 text-sm mb-3',
        colors: {
          primary: '#ffffff',
          accent: '#D97718',
        }
      }
    },
    {
      id: 'overlay',
      name: 'Full Image Overlay',
      description: 'Full-bleed image with text overlay',
      styles: {
        container: 'rounded-xl overflow-hidden shadow-lg relative',
        card: 'absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent',
        title: 'font-bold text-xl text-white mb-1',
        subtitle: 'text-white/90 text-sm',
        colors: {
          primary: '#000000',
          accent: '#D97718',
        }
      }
    }
  ],

  // Info Box Templates
  'info-box': [
    {
      id: 'stats-grid',
      name: 'Stats Grid',
      description: '2x2 grid of statistics with large numbers',
      styles: {
        container: 'space-y-4',
        card: 'bg-white rounded-xl p-4 border-2 border-gray-100 text-center',
        cardHover: 'hover:border-gray-200 hover:shadow-md transition-all',
        title: 'text-sm font-semibold text-gray-500 uppercase tracking-wider mb-4',
        text: 'text-3xl font-bold mb-1',
        subtitle: 'text-sm text-gray-600',
        gap: 'gap-3',
      }
    },
    {
      id: 'stats-horizontal',
      name: 'Stats Row',
      description: 'Horizontal row of statistics',
      styles: {
        container: 'space-y-4',
        card: 'bg-gray-50 rounded-lg p-3 text-center flex-1',
        cardHover: 'hover:bg-white hover:shadow transition-all',
        title: 'text-sm font-semibold text-gray-500 uppercase tracking-wider mb-4',
        text: 'text-2xl font-bold mb-0.5',
        subtitle: 'text-xs text-gray-600',
        gap: 'gap-2',
      }
    },
    {
      id: 'content-box',
      name: 'Content Box',
      description: 'Text content with optional heading',
      styles: {
        container: 'space-y-4',
        card: 'bg-white rounded-xl p-5 border border-gray-100',
        title: 'font-bold text-[#333] mb-2 text-lg',
        text: 'text-sm text-gray-600',
      }
    }
  ],

  // Link List Templates
  'link-list': [
    {
      id: 'standard',
      name: 'Standard Links',
      description: 'Icon + label with arrow, divider lines',
      styles: {
        container: 'space-y-0',
        card: 'flex items-center gap-3 px-4 py-2.5 border-b border-gray-200/60',
        cardHover: 'hover:bg-gray-100 transition-colors',
        text: 'font-medium text-[#333] text-[15px]',
        imageSize: 'w-8 h-8',
        borderRadius: 'rounded',
      }
    },
    {
      id: 'pills',
      name: 'Pill Buttons',
      description: 'Rounded pill-style buttons',
      styles: {
        container: 'flex flex-wrap gap-2 p-2',
        card: 'flex items-center gap-2 px-4 py-2 bg-white border border-gray-200',
        cardHover: 'hover:bg-gray-50 hover:border-gray-300 transition-all',
        text: 'font-medium text-[#333] text-sm',
        imageSize: 'w-5 h-5',
        borderRadius: 'rounded-full',
      }
    },
    {
      id: 'cards',
      name: 'Card Links',
      description: 'Each link as a small card',
      styles: {
        container: 'grid grid-cols-2 gap-2 p-2',
        card: 'flex items-center gap-2 p-3 bg-white border border-gray-100',
        cardHover: 'hover:shadow-md hover:border-gray-200 transition-all',
        text: 'font-medium text-[#333] text-sm',
        imageSize: 'w-8 h-8',
        borderRadius: 'rounded-lg',
      }
    }
  ],

  // Category Tabs Templates
  'category-tabs': [
    {
      id: 'standard',
      name: 'Standard Tabs',
      description: 'Vertical list with icon, label, and arrow',
      styles: {
        container: 'space-y-0',
        card: 'flex items-center gap-3 px-4 py-2.5 border-b border-gray-200/60 text-left',
        cardHover: 'hover:bg-[#fbefdd] transition-colors',
        text: 'font-medium text-[#333] text-[15px]',
        imageSize: 'w-8 h-8',
        borderRadius: 'rounded',
        colors: {
          background: '#fbefdd',
        }
      }
    },
    {
      id: 'compact',
      name: 'Compact Tabs',
      description: 'Smaller, tighter spacing',
      styles: {
        container: 'space-y-0',
        card: 'flex items-center gap-2 px-3 py-2 border-b border-gray-100 text-left',
        cardHover: 'hover:bg-gray-100 transition-colors',
        text: 'font-medium text-[#333] text-sm',
        imageSize: 'w-6 h-6',
        borderRadius: 'rounded',
        colors: {
          background: '#f3f4f6',
        }
      }
    }
  ],

  // Newsletter Templates
  'newsletter': [
    {
      id: 'standard',
      name: 'Standard Card',
      description: 'White card with centered content',
      styles: {
        container: 'bg-white rounded-xl p-5 shadow-lg border border-gray-100 text-center',
        title: 'font-bold text-xl text-[#333] mb-2',
        subtitle: 'text-sm italic mb-1',
        text: 'text-sm text-gray-600 mb-4',
      }
    },
    {
      id: 'minimal',
      name: 'Minimal',
      description: 'Simple form without borders',
      styles: {
        container: 'p-4 text-center',
        title: 'font-bold text-lg text-[#333] mb-2',
        subtitle: 'text-xs italic mb-1',
        text: 'text-sm text-gray-600 mb-3',
      }
    },
    {
      id: 'dark',
      name: 'Dark Theme',
      description: 'Dark background with light text',
      styles: {
        container: 'bg-[#1a1a1a] rounded-xl p-5 text-center',
        title: 'font-bold text-xl text-white mb-2',
        subtitle: 'text-sm italic text-gray-400 mb-1',
        text: 'text-sm text-gray-300 mb-4',
        colors: {
          primary: '#1a1a1a',
          secondary: '#ffffff',
        }
      }
    }
  ],

  // Quick Form Templates
  'quick-form': [
    {
      id: 'standard',
      name: 'Standard Form',
      description: 'Amount buttons with input field',
      styles: {
        container: 'bg-white rounded-xl p-4 shadow-lg border border-gray-100',
        title: 'text-lg font-bold text-[#333] text-center mb-3',
        subtitle: 'text-[15px] italic text-center mb-0.5',
        card: 'py-2 border rounded bg-white text-[#333] font-bold text-[15px]',
        cardHover: 'hover:border-current transition',
      }
    },
    {
      id: 'compact',
      name: 'Compact Form',
      description: 'Smaller, condensed layout',
      styles: {
        container: 'bg-white rounded-lg p-3 shadow border border-gray-100',
        title: 'text-base font-bold text-[#333] text-center mb-2',
        subtitle: 'text-sm italic text-center mb-0.5',
        card: 'py-1.5 border rounded bg-white text-[#333] font-semibold text-sm',
        cardHover: 'hover:border-current transition',
      }
    }
  ],

  // Contact Card Templates
  'contact-card': [
    {
      id: 'standard',
      name: 'Standard Card',
      description: 'White card with icons',
      styles: {
        container: 'bg-white rounded-xl p-4 shadow-lg border border-gray-100',
        card: 'flex items-center gap-3',
        text: 'text-sm font-medium',
        imageSize: 'w-8 h-8',
      }
    },
    {
      id: 'minimal',
      name: 'Minimal List',
      description: 'Simple list without card styling',
      styles: {
        container: 'space-y-3 p-2',
        card: 'flex items-center gap-2',
        text: 'text-sm',
        imageSize: 'w-6 h-6',
      }
    }
  ],

  // Program Cards Templates
  'program-cards': [
    {
      id: 'grid',
      name: '2x2 Grid',
      description: 'Four cards in a grid layout',
      styles: {
        container: 'grid grid-cols-2 gap-3',
        card: 'bg-white rounded-lg p-3 border border-gray-100',
        cardHover: 'hover:shadow-md transition group',
        title: 'font-semibold text-sm text-[#333]',
        text: 'text-xs',
        imageSize: 'w-full h-20 object-cover rounded mb-2',
      }
    },
    {
      id: 'list',
      name: 'Vertical List',
      description: 'Stack of program cards',
      styles: {
        container: 'space-y-2',
        card: 'flex items-center gap-3 bg-white rounded-lg p-2 border border-gray-100',
        cardHover: 'hover:shadow-md transition',
        title: 'font-semibold text-sm text-[#333]',
        text: 'text-xs',
        imageSize: 'w-12 h-12 object-cover rounded',
      }
    }
  ]
};

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Get all templates for a widget type
 */
export function getTemplatesForWidget(widgetType: string): WidgetTemplate[] {
  return menuTemplates[widgetType] || [];
}

/**
 * Get a specific template by widget type and template ID
 */
export function getTemplate(widgetType: string, templateId: string): WidgetTemplate | null {
  const templates = menuTemplates[widgetType];
  if (!templates) return null;
  return templates.find(t => t.id === templateId) || templates[0] || null;
}

/**
 * Get default template for a widget type
 */
export function getDefaultTemplate(widgetType: string): WidgetTemplate | null {
  const templates = menuTemplates[widgetType];
  return templates?.[0] || null;
}

/**
 * Apply template styles to a class string
 */
export function applyTemplateStyles(template: WidgetTemplate | null, element: keyof TemplateStyle): string {
  if (!template?.styles) return '';
  return (template.styles[element] as string) || '';
}
