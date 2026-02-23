import type { APIRoute } from 'astro';
import { supabaseAdmin } from '../../lib/supabase';

export const prerender = false;

export const GET: APIRoute = async () => {
  try {
    // Check if campaign already exists
    const { data: existing } = await supabaseAdmin
      .from('campaigns')
      .select('id')
      .eq('slug', 'thirst-relief')
      .single();

    if (existing) {
      return new Response(JSON.stringify({
        message: 'Thirst Relief campaign already exists!',
        url: '/campaigns/thirst-relief'
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Insert the campaign
    const { data, error } = await supabaseAdmin
      .from('campaigns')
      .insert([{
        slug: 'thirst-relief',
        name: 'Water For Life',
        title: 'Water For Life',
        country: 'worldwide',
        subtitle: '1 in 3 people around the world do not have access to clean drinking water.',
        description: '<p class="text-xl mb-6">Women and children often walk for miles each day to collect water. Billions of people around the world are suffering from poor access to water, sanitation and hygiene.</p><p class="mb-4"><strong>Every year, 3.57 million people die from water related diseases.</strong> Most of these (2.2 million) are children.</p><p>Small donations from $300 could help provide clean water to a community in need. Your generosity can transform lives and bring hope to families who desperately need access to safe, clean water.</p>',
        featured_image: 'https://images.unsplash.com/photo-1541544537156-7627a7a4aa1c?w=1920&h=1080&fit=crop',
        gallery_images: [],
        donation_options: [
          { amount: 300, label: 'Water Hand Pump' },
          { amount: 400, label: 'Electric Water Well' },
          { amount: 600, label: 'Water Well' },
          { amount: 3500, label: 'Solar Community Well' },
          { amount: 7250, label: 'Small Purification Plant' },
          { amount: 14500, label: 'Large Purification Plant' }
        ],
        content_sections: [
          {
            title: 'Water Hand Pump - $300',
            content: '<p>Serves up to <strong>40 families</strong> in remote villages. Used for drinking, cooking, and sanitation. A simple yet life-changing solution for communities without access to clean water.</p>',
            image: ''
          },
          {
            title: 'Water Well - $600',
            content: '<p>Serves up to <strong>60 families</strong>. Installed in rural areas with limited electricity access. Provides a reliable source of clean water for entire communities.</p>',
            image: ''
          },
          {
            title: 'Electric Water Wells - $400',
            content: '<p>Installed in schools, hospitals, and mosques. Benefits up to <strong>600 people</strong>. Includes linked water tank for storage and distribution.</p>',
            image: ''
          },
          {
            title: 'Solar Community Water Well - $3,500',
            content: '<p>Serves up to <strong>2,000 people</strong>. Replaces 5-6 mile daily water collection walks. Sustainable solar-powered solution for large communities.</p>',
            image: ''
          },
          {
            title: 'Water Purification Plants',
            content: '<p><strong>Small Plant ($7,250):</strong> Uses reverse osmosis and advanced filtration technology for communities with severe water shortage.</p><p><strong>Large Plant ($14,500):</strong> Same technology at larger scale for significant community needs.</p>',
            image: ''
          }
        ],
        is_active: true,
        is_featured: true,
        show_on_homepage: true,
        meta_title: 'Thirst Relief - Water For Life | Qurbani Foundation',
        meta_description: 'Help provide clean water to communities in need. From $300, you can fund a water hand pump that serves 40 families.'
      }])
      .select()
      .single();

    if (error) throw error;

    return new Response(JSON.stringify({
      success: true,
      message: 'Thirst Relief campaign created successfully!',
      url: '/campaigns/thirst-relief',
      campaign: data
    }), {
      status: 201,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error: any) {
    return new Response(JSON.stringify({
      error: error.message
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};
