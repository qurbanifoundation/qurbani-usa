import { supabase } from './supabase';

// Default settings (fallback if Supabase fails)
const defaultSettings = {
  site_name: 'Qurbani Foundation USA',
  site_tagline: 'A Muslim Charity Serving Humanity',
  site_logo: 'https://www.staging9.qurbani.com/wp-content/uploads/2021/07/QurbaniFoundation-Logo-2.png',
  footer_logo: '',
  site_favicon: '/favicon.ico',

  contact_phone: '+1 (703) 596-4900',
  contact_toll_free: '1-800-900-0027',
  contact_email: 'info@qurbani.com',
  contact_address_street: '145 Sherwood Ave',
  contact_address_city: 'Teaneck',
  contact_address_state: 'NJ',
  contact_address_zip: '07666',

  social_facebook: 'https://facebook.com/qurbani',
  social_youtube: 'https://youtube.com/qurbani',
  social_instagram: 'https://instagram.com/qurbani',
  social_twitter: 'https://twitter.com/qurbani',

  footer_about: "A Muslim charity dedicated to alleviating suffering of the world's poorest people. Operating in 53+ countries since 1999.",
  footer_zakat_policy: '100% Zakat Policy',
  footer_ein: '38-4109716',
  footer_copyright: 'Qurbani Foundation USA. All rights reserved.',

  donate_button_text: 'DONATE NOW',
  donate_button_href: '/donate',
  donate_button_color: '#fdc448',

  // Header settings
  show_top_bar: true,
  header_transparent: false,
};

export type SiteSettings = typeof defaultSettings;

// Fetch settings from Supabase with fallback to defaults
export async function getSettings(): Promise<SiteSettings> {
  try {
    const { data, error } = await supabase
      .from('site_settings')
      .select('*')
      .eq('id', 'main')
      .single();

    if (error) {
      console.error('Failed to fetch settings from Supabase:', error.message);
      return defaultSettings;
    }

    return data || defaultSettings;
  } catch (error) {
    console.error('Error fetching settings:', error);
    return defaultSettings;
  }
}

// Helper to format phone for tel: links
export function formatPhoneLink(phone: string): string {
  return phone.replace(/[^0-9+]/g, '');
}
